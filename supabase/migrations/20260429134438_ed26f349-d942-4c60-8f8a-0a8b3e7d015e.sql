CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role := 'student';
  _name TEXT;
BEGIN
  BEGIN
    _role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', '')::public.app_role, 'student');
  EXCEPTION WHEN invalid_text_representation THEN
    _role := 'student';
  END;

  _name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1), 'ผู้ใช้งาน');

  INSERT INTO public.profiles (id, email, full_name, role, avatar_initials, avatar_color)
  VALUES (
    NEW.id,
    NEW.email,
    _name,
    _role,
    UPPER(LEFT(_name, 1)),
    CASE _role
      WHEN 'admin' THEN 'bg-destructive'
      WHEN 'teacher' THEN 'bg-primary'
      ELSE 'bg-accent'
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    avatar_initials = EXCLUDED.avatar_initials,
    avatar_color = EXCLUDED.avatar_color,
    updated_at = now();

  RETURN NEW;
END;
$$;