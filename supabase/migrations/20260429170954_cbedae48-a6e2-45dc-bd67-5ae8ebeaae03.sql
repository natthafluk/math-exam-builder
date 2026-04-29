-- Allow super admin / admin to delete a user fully (auth + profile cascade)
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _is_super boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'ไม่สามารถลบบัญชีของตัวเองได้';
  END IF;
  SELECT is_super_admin INTO _is_super FROM public.profiles WHERE id = _user_id;
  IF COALESCE(_is_super, false) THEN
    RAISE EXCEPTION 'ไม่สามารถลบ Super Admin ได้';
  END IF;

  -- Remove dependent data that references this user but has no FK cascade
  DELETE FROM public.attempts WHERE student_id = _user_id;
  DELETE FROM public.class_members WHERE student_id = _user_id;
  UPDATE public.classes SET teacher_id = NULL WHERE teacher_id = _user_id;
  UPDATE public.exams SET teacher_id = NULL WHERE teacher_id = _user_id;
  UPDATE public.questions SET author_id = NULL WHERE author_id = _user_id;

  DELETE FROM public.profiles WHERE id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;