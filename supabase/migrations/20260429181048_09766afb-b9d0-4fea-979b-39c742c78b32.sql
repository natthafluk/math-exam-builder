CREATE OR REPLACE FUNCTION public.teacher_remove_student_from_class(_student_row_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _class_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'ยังไม่ได้เข้าสู่ระบบ';
  END IF;

  SELECT class_id INTO _class_id
  FROM public.class_students
  WHERE id = _student_row_id;

  IF _class_id IS NULL THEN
    RAISE EXCEPTION 'ไม่พบนักเรียนคนนี้ในห้องเรียน';
  END IF;

  IF NOT (public.has_role(_uid, 'admin') OR public.is_class_teacher(_class_id, _uid)) THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์ลบนักเรียนในห้องนี้';
  END IF;

  DELETE FROM public.class_students
  WHERE id = _student_row_id;
END;
$$;

REVOKE ALL ON FUNCTION public.teacher_remove_student_from_class(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_remove_student_from_class(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.teacher_remove_student_from_class(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';