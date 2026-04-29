
CREATE OR REPLACE FUNCTION public.repair_my_profile()
 RETURNS profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _email text;
  _full_name text;
  _profile public.profiles;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- If profile already exists, just return it without overwriting anything
  SELECT * INTO _profile FROM public.profiles WHERE id = _user_id;
  IF FOUND THEN
    RETURN _profile;
  END IF;

  -- Only create a new profile if none exists (fallback safety net)
  _email := lower(coalesce(auth.jwt() ->> 'email', auth.email(), ''));
  _full_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(split_part(_email, '@', 1), ''),
    'ผู้ใช้งาน'
  );

  INSERT INTO public.profiles (id, email, full_name, role, avatar_initials, avatar_color, approval_status)
  VALUES (
    _user_id,
    nullif(_email, ''),
    _full_name,
    'student',
    upper(left(_full_name, 1)),
    'bg-accent',
    'pending'
  )
  RETURNING * INTO _profile;

  RETURN _profile;
END;
$function$;
