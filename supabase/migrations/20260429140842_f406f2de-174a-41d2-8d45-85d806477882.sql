CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.repair_my_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _role public.app_role := 'student';
  _full_name text := 'ผู้ใช้งาน';
  _avatar_color text := 'bg-accent';
  _profile public.profiles;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _email = '' THEN
    _email := lower(coalesce(auth.email(), ''));
  END IF;

  CASE _email
    WHEN 'admin@example.com' THEN
      _role := 'admin';
      _full_name := 'ผู้ดูแลระบบ';
      _avatar_color := 'bg-destructive';
    WHEN 'teacher@example.com' THEN
      _role := 'teacher';
      _full_name := 'ครูสมหญิง';
      _avatar_color := 'bg-primary';
    WHEN 'student@example.com' THEN
      _role := 'student';
      _full_name := 'นักเรียนสมชาย';
      _avatar_color := 'bg-accent';
    ELSE
      _role := 'student';
      _full_name := coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''), nullif(split_part(_email, '@', 1), ''), 'ผู้ใช้งาน');
      _avatar_color := 'bg-accent';
  END CASE;

  INSERT INTO public.profiles (id, email, full_name, role, avatar_initials, avatar_color)
  VALUES (_user_id, nullif(_email, ''), _full_name, _role, upper(left(_full_name, 1)), _avatar_color)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    avatar_initials = EXCLUDED.avatar_initials,
    avatar_color = EXCLUDED.avatar_color,
    updated_at = now()
  RETURNING * INTO _profile;

  RETURN _profile;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.repair_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_my_profile() TO authenticated;