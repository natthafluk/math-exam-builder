REVOKE ALL ON FUNCTION public.teacher_list_classes_with_students() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_list_classes_with_students() FROM anon;
GRANT EXECUTE ON FUNCTION public.teacher_list_classes_with_students() TO authenticated;

REVOKE ALL ON FUNCTION public.teacher_create_class(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_create_class(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.teacher_create_class(text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.teacher_add_student_to_class(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_add_student_to_class(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.teacher_add_student_to_class(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';