
-- 1. Make student_code globally unique (one school)
DELETE FROM public.class_students a USING public.class_students b
WHERE a.ctid < b.ctid AND a.student_code = b.student_code;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='class_students_student_code_unique') THEN
    CREATE UNIQUE INDEX class_students_student_code_unique ON public.class_students (student_code);
  END IF;
END $$;

-- 2. RPC: teacher creates a class reliably
CREATE OR REPLACE FUNCTION public.teacher_create_class(_name text, _grade_level text, _subject_code text DEFAULT '')
RETURNS public.classes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.classes;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'ยังไม่ได้เข้าสู่ระบบ';
  END IF;
  IF NOT (public.has_role(_uid, 'admin') OR public.has_role(_uid, 'teacher')) THEN
    RAISE EXCEPTION 'ต้องเป็นครูหรือผู้ดูแลระบบเท่านั้น';
  END IF;
  IF coalesce(trim(_name),'') = '' OR coalesce(trim(_grade_level),'') = '' THEN
    RAISE EXCEPTION 'กรุณากรอกชื่อห้องและระดับชั้น';
  END IF;

  INSERT INTO public.classes (name, grade_level, subject_code, teacher_id)
  VALUES (trim(_name), trim(_grade_level), coalesce(trim(_subject_code),''), _uid)
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

-- 3. Add a single-row student check before insert in teacher_import_roster (already exists, but enforce global uniqueness gracefully)
CREATE OR REPLACE FUNCTION public.teacher_import_roster(_class_id uuid, _rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n int := 0;
  _row jsonb;
  _code text;
  _name text;
  _existing_class uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_class_teacher(_class_id, auth.uid())) THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์นำเข้านักเรียนในห้องนี้';
  END IF;
  FOR _row IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    _code := trim(_row->>'student_code');
    _name := trim(_row->>'full_name');
    IF _code = '' OR _name = '' THEN CONTINUE; END IF;

    SELECT class_id INTO _existing_class FROM public.class_students WHERE student_code = _code LIMIT 1;
    IF _existing_class IS NOT NULL AND _existing_class <> _class_id THEN
      RAISE EXCEPTION 'เลขประจำตัว % มีอยู่แล้วในอีกห้องเรียน', _code;
    END IF;

    INSERT INTO public.class_students (class_id, student_code, full_name)
    VALUES (_class_id, _code, _name)
    ON CONFLICT (class_id, student_code) DO UPDATE SET full_name = EXCLUDED.full_name;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END;
$$;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
