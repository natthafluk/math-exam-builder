CREATE OR REPLACE FUNCTION public.teacher_list_classes_with_students()
RETURNS TABLE(
  id uuid,
  name text,
  grade_level text,
  subject_code text,
  teacher_id uuid,
  teacher_name text,
  student_count integer,
  students jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'ยังไม่ได้เข้าสู่ระบบ';
  END IF;

  IF NOT (public.has_role(_uid, 'admin') OR public.has_role(_uid, 'teacher')) THEN
    RAISE EXCEPTION 'ต้องเป็นครูหรือผู้ดูแลระบบเท่านั้น';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.grade_level,
    c.subject_code,
    c.teacher_id,
    COALESCE(p.full_name, 'ไม่ระบุครูผู้สอน') AS teacher_name,
    COALESCE(count(cs.id), 0)::integer AS student_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', cs.id,
          'student_code', cs.student_code,
          'full_name', cs.full_name
        ) ORDER BY cs.student_code
      ) FILTER (WHERE cs.id IS NOT NULL),
      '[]'::jsonb
    ) AS students
  FROM public.classes c
  LEFT JOIN public.profiles p ON p.id = c.teacher_id
  LEFT JOIN public.class_students cs ON cs.class_id = c.id
  WHERE public.has_role(_uid, 'admin') OR c.teacher_id = _uid
  GROUP BY c.id, p.full_name
  ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_create_class(_name text, _grade_level text, _subject_code text DEFAULT '')
RETURNS public.classes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.classes;
  _class_name text := trim(coalesce(_name, ''));
  _level text := trim(coalesce(_grade_level, ''));
  _code text := trim(coalesce(_subject_code, ''));
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'ยังไม่ได้เข้าสู่ระบบ';
  END IF;

  IF NOT (public.has_role(_uid, 'admin') OR public.has_role(_uid, 'teacher')) THEN
    RAISE EXCEPTION 'ต้องเป็นครูหรือผู้ดูแลระบบเท่านั้น';
  END IF;

  IF _class_name = '' OR _level = '' THEN
    RAISE EXCEPTION 'กรุณากรอกชื่อห้องและระดับชั้น';
  END IF;

  SELECT * INTO _row
  FROM public.classes c
  WHERE c.teacher_id = _uid
    AND lower(c.name) = lower(_class_name)
    AND c.grade_level = _level
    AND c.subject_code = _code
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'มีห้องเรียนนี้อยู่แล้ว กรุณาตรวจชื่อห้อง ระดับชั้น และรหัสวิชา';
  END IF;

  INSERT INTO public.classes (name, grade_level, subject_code, teacher_id)
  VALUES (_class_name, _level, _code, _uid)
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_add_student_to_class(_class_id uuid, _student_code text, _full_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _code text := trim(coalesce(_student_code, ''));
  _name text := trim(coalesce(_full_name, ''));
  _existing public.class_students;
  _row public.class_students;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'ยังไม่ได้เข้าสู่ระบบ';
  END IF;

  IF NOT (public.has_role(_uid, 'admin') OR public.is_class_teacher(_class_id, _uid)) THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์เพิ่มนักเรียนในห้องนี้';
  END IF;

  IF _class_id IS NULL THEN
    RAISE EXCEPTION 'ไม่พบห้องเรียน';
  END IF;

  IF _code = '' OR _name = '' THEN
    RAISE EXCEPTION 'กรุณากรอกเลขประจำตัวและชื่อนักเรียน';
  END IF;

  SELECT * INTO _existing
  FROM public.class_students
  WHERE student_code = _code
  LIMIT 1;

  IF FOUND AND _existing.class_id <> _class_id THEN
    RAISE EXCEPTION 'เลขประจำตัว % มีอยู่แล้วในอีกห้องเรียน', _code;
  END IF;

  INSERT INTO public.class_students (class_id, student_code, full_name)
  VALUES (_class_id, _code, _name)
  ON CONFLICT (student_code) DO UPDATE
  SET full_name = EXCLUDED.full_name
  WHERE public.class_students.class_id = _class_id
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'ไม่สามารถเพิ่มนักเรียนได้ กรุณาตรวจสอบเลขประจำตัวอีกครั้ง';
  END IF;

  RETURN jsonb_build_object(
    'id', _row.id,
    'class_id', _row.class_id,
    'student_code', _row.student_code,
    'full_name', _row.full_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.teacher_list_classes_with_students() TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_create_class(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_add_student_to_class(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';