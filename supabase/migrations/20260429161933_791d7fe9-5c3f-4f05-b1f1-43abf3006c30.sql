
-- 1) Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requested_role public.app_role,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_approval_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_approval_status_check
  CHECK (approval_status IN ('pending','approved','rejected'));

-- 2) Update has_role: only count approved users
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND role = _role
      AND approval_status = 'approved'
  );
$$;

-- 3) Update handle_new_user: first user becomes super admin + approved.
--    Subsequent self-signups for teacher/admin go to pending.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _requested public.app_role := 'teacher';
  _name text;
  _is_first boolean;
  _status text;
  _is_super boolean := false;
  _final_role public.app_role;
BEGIN
  -- Determine requested role from metadata (default teacher for self-signup)
  BEGIN
    _requested := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'requested_role','')::public.app_role,
      NULLIF(NEW.raw_user_meta_data->>'role','')::public.app_role,
      'teacher'
    );
  EXCEPTION WHEN invalid_text_representation THEN
    _requested := 'teacher';
  END;

  -- Students don't sign up here; force teacher minimum for self-signup
  IF _requested = 'student' THEN
    _requested := 'teacher';
  END IF;

  _name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), split_part(NEW.email,'@',1), 'ผู้ใช้งาน');

  -- First-ever user becomes super admin
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO _is_first;

  IF _is_first THEN
    _final_role := 'admin';
    _status := 'approved';
    _is_super := true;
  ELSE
    _final_role := _requested;
    _status := 'pending';
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, role, requested_role,
    avatar_initials, avatar_color,
    approval_status, is_super_admin, approved_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    _name,
    _final_role,
    _requested,
    UPPER(LEFT(_name,1)),
    CASE _final_role
      WHEN 'admin' THEN 'bg-destructive'
      WHEN 'teacher' THEN 'bg-primary'
      ELSE 'bg-accent'
    END,
    _status,
    _is_super,
    CASE WHEN _status='approved' THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4) Protect super admin
CREATE OR REPLACE FUNCTION public.protect_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_super_admin THEN
    RAISE EXCEPTION 'ไม่สามารถลบ Super Admin ได้';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_super_admin THEN
    IF NEW.role <> 'admin' OR NEW.approval_status <> 'approved' OR NEW.is_super_admin = false THEN
      RAISE EXCEPTION 'ไม่สามารถลด/เปลี่ยนสิทธิ์ Super Admin ได้';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS protect_super_admin_trg ON public.profiles;
CREATE TRIGGER protect_super_admin_trg
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin();

-- 5) Admin RPCs
CREATE OR REPLACE FUNCTION public.admin_list_users(_status text DEFAULT NULL)
RETURNS TABLE(id uuid, email text, full_name text, role app_role, requested_role app_role,
              approval_status text, is_super_admin boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, p.email, p.full_name, p.role, p.requested_role,
         p.approval_status, p.is_super_admin, p.created_at
  FROM public.profiles p
  WHERE public.has_role(auth.uid(),'admin')
    AND (_status IS NULL OR p.approval_status = _status)
  ORDER BY p.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_user(_user_id uuid, _role app_role DEFAULT NULL)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _row public.profiles;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์';
  END IF;
  UPDATE public.profiles
  SET approval_status='approved',
      role = COALESCE(_role, requested_role, role),
      approved_at = now(),
      approved_by = auth.uid(),
      updated_at = now()
  WHERE id = _user_id
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_user(_user_id uuid)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _row public.profiles;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์';
  END IF;
  UPDATE public.profiles
  SET approval_status='rejected', updated_at=now(), approved_by=auth.uid()
  WHERE id = _user_id AND is_super_admin = false
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role app_role)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _row public.profiles;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์';
  END IF;
  UPDATE public.profiles
  SET role=_role, updated_at=now()
  WHERE id=_user_id AND is_super_admin=false
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;

-- Helper to check current user's status
CREATE OR REPLACE FUNCTION public.my_approval_status()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT approval_status FROM public.profiles WHERE id = auth.uid();
$$;
