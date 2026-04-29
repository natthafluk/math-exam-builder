-- 1. subject_code on classes
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS subject_code text NOT NULL DEFAULT '';

-- 2. class_students table (roster imported by teacher)
CREATE TABLE IF NOT EXISTS public.class_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_code text NOT NULL,
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_code)
);
CREATE INDEX IF NOT EXISTS class_students_code_idx ON public.class_students (student_code);

ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY class_students_manage ON public.class_students
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR public.is_class_teacher(class_id, auth.uid())
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.is_class_teacher(class_id, auth.uid())
  );

CREATE POLICY class_students_select_auth ON public.class_students
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 3. attempts: allow nullable student_id + add enrollment_id
ALTER TABLE public.attempts ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS enrollment_id uuid REFERENCES public.class_students(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS attempts_enrollment_idx ON public.attempts (enrollment_id);

-- Update RLS for attempts to also allow viewing by enrollment-based access for teacher/admin (existing covers it)
-- Allow public select via SECURITY DEFINER RPCs only — no anon RLS needed.

-- 4. RPCs (SECURITY DEFINER, callable by anon) ---------------------------------

-- 4a. find enrollments by student_code
CREATE OR REPLACE FUNCTION public.student_find_enrollments(_code text)
RETURNS TABLE (
  enrollment_id uuid,
  class_id uuid,
  class_name text,
  grade_level text,
  subject_code text,
  teacher_name text,
  full_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cs.id, c.id, c.name, c.grade_level, c.subject_code,
         COALESCE(p.full_name, 'ไม่ระบุครูผู้สอน'),
         cs.full_name
  FROM public.class_students cs
  JOIN public.classes c ON c.id = cs.class_id
  LEFT JOIN public.profiles p ON p.id = c.teacher_id
  WHERE cs.student_code = _code
  ORDER BY c.name;
$$;

REVOKE ALL ON FUNCTION public.student_find_enrollments(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_find_enrollments(text) TO anon, authenticated;

-- 4b. verify enrollment + code (used as cheap auth check)
CREATE OR REPLACE FUNCTION public.student_verify(_enrollment_id uuid, _code text)
RETURNS TABLE (
  enrollment_id uuid,
  class_id uuid,
  class_name text,
  subject_code text,
  grade_level text,
  teacher_name text,
  full_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cs.id, c.id, c.name, c.subject_code, c.grade_level,
         COALESCE(p.full_name, 'ไม่ระบุครูผู้สอน'),
         cs.full_name
  FROM public.class_students cs
  JOIN public.classes c ON c.id = cs.class_id
  LEFT JOIN public.profiles p ON p.id = c.teacher_id
  WHERE cs.id = _enrollment_id AND cs.student_code = _code
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.student_verify(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_verify(uuid, text) TO anon, authenticated;

-- 4c. list assignments + exams for the student's class
CREATE OR REPLACE FUNCTION public.student_list_assignments(_enrollment_id uuid, _code text)
RETURNS TABLE (
  assignment_id uuid,
  exam_id uuid,
  exam_title text,
  exam_description text,
  time_limit_minutes int,
  due_date timestamptz,
  status text,
  show_explanations boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, e.id, e.title, e.description, e.time_limit_minutes, a.due_date, a.status::text, e.show_explanations
  FROM public.class_students cs
  JOIN public.assignments a ON a.class_id = cs.class_id
  JOIN public.exams e ON e.id = a.exam_id
  WHERE cs.id = _enrollment_id AND cs.student_code = _code
  ORDER BY a.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.student_list_assignments(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_list_assignments(uuid, text) TO anon, authenticated;

-- 4d. fetch a single exam + questions (no correct_answer / no is_correct on choices)
CREATE OR REPLACE FUNCTION public.student_get_exam(_enrollment_id uuid, _code text, _assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
  _ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.class_students cs
    JOIN public.assignments a ON a.class_id = cs.class_id
    WHERE cs.id = _enrollment_id AND cs.student_code = _code AND a.id = _assignment_id
  ) INTO _ok;
  IF NOT _ok THEN
    RAISE EXCEPTION 'ไม่พบสิทธิ์ในการเข้าสอบนี้';
  END IF;

  SELECT jsonb_build_object(
    'assignment_id', a.id,
    'exam', jsonb_build_object(
      'id', e.id,
      'title', e.title,
      'description', e.description,
      'time_limit_minutes', e.time_limit_minutes,
      'show_explanations', e.show_explanations,
      'settings', e.settings
    ),
    'questions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'exam_question_id', eq.id,
        'question_id', q.id,
        'sort_order', eq.sort_order,
        'points', eq.points,
        'title', q.title,
        'body_latex', q.body_latex,
        'type', q.type,
        'choices', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', ch.id, 'label', ch.label, 'body_latex', ch.body_latex, 'sort_order', ch.sort_order
          ) ORDER BY ch.sort_order)
          FROM public.question_choices ch WHERE ch.question_id = q.id
        ), '[]'::jsonb)
      ) ORDER BY eq.sort_order)
      FROM public.exam_questions eq
      JOIN public.questions q ON q.id = eq.question_id
      WHERE eq.exam_id = e.id
    ), '[]'::jsonb)
  )
  INTO _result
  FROM public.assignments a
  JOIN public.exams e ON e.id = a.exam_id
  WHERE a.id = _assignment_id;

  RETURN _result;
END;
$$;
REVOKE ALL ON FUNCTION public.student_get_exam(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_get_exam(uuid, text, uuid) TO anon, authenticated;

-- 4e. submit attempt: grades MCQ/TF/short on server, stores answers
CREATE OR REPLACE FUNCTION public.student_submit_attempt(
  _enrollment_id uuid,
  _code text,
  _assignment_id uuid,
  _answers jsonb  -- { question_id: answer_text or choice_id }
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
  _attempt_id uuid;
  _score numeric := 0;
  _max numeric := 0;
  _q record;
  _ans text;
  _correct boolean;
  _pts numeric;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.class_students cs
    JOIN public.assignments a ON a.class_id = cs.class_id
    WHERE cs.id = _enrollment_id AND cs.student_code = _code AND a.id = _assignment_id
  ) INTO _ok;
  IF NOT _ok THEN
    RAISE EXCEPTION 'ไม่พบสิทธิ์ในการส่งข้อสอบนี้';
  END IF;

  INSERT INTO public.attempts (assignment_id, enrollment_id, student_id, status, score, max_score, submitted_at)
  VALUES (_assignment_id, _enrollment_id, NULL, 'submitted', 0, 0, now())
  RETURNING id INTO _attempt_id;

  FOR _q IN
    SELECT eq.points, q.id AS qid, q.type, q.correct_answer
    FROM public.exam_questions eq
    JOIN public.assignments a ON a.exam_id = eq.exam_id
    JOIN public.questions q ON q.id = eq.question_id
    WHERE a.id = _assignment_id
  LOOP
    _ans := COALESCE(_answers ->> _q.qid::text, '');
    _correct := NULL;
    _pts := 0;
    IF _q.type IN ('mcq','tf','short') THEN
      _correct := lower(trim(_ans)) = lower(trim(coalesce(_q.correct_answer,'')));
      IF _correct THEN _pts := _q.points; END IF;
    END IF;
    _score := _score + _pts;
    _max := _max + _q.points;

    INSERT INTO public.attempt_answers (attempt_id, question_id, answer, is_correct, points_awarded)
    VALUES (_attempt_id, _q.qid, jsonb_build_object('value', _ans), _correct, _pts);
  END LOOP;

  UPDATE public.attempts SET score = _score, max_score = _max WHERE id = _attempt_id;

  RETURN jsonb_build_object('attempt_id', _attempt_id, 'score', _score, 'max_score', _max);
END;
$$;
REVOKE ALL ON FUNCTION public.student_submit_attempt(uuid, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_submit_attempt(uuid, text, uuid, jsonb) TO anon, authenticated;

-- 4f. list past results for this enrollment
CREATE OR REPLACE FUNCTION public.student_list_results(_enrollment_id uuid, _code text)
RETURNS TABLE (
  attempt_id uuid,
  exam_title text,
  score numeric,
  max_score numeric,
  submitted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT at.id, e.title, at.score, at.max_score, at.submitted_at
  FROM public.attempts at
  JOIN public.assignments a ON a.id = at.assignment_id
  JOIN public.exams e ON e.id = a.exam_id
  JOIN public.class_students cs ON cs.id = at.enrollment_id
  WHERE at.enrollment_id = _enrollment_id AND cs.student_code = _code
  ORDER BY at.submitted_at DESC NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.student_list_results(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_list_results(uuid, text) TO anon, authenticated;

-- 4g. teacher bulk import roster
CREATE OR REPLACE FUNCTION public.teacher_import_roster(_class_id uuid, _rows jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n int := 0;
  _row jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_class_teacher(_class_id, auth.uid())) THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์นำเข้านักเรียนในห้องนี้';
  END IF;
  FOR _row IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    INSERT INTO public.class_students (class_id, student_code, full_name)
    VALUES (_class_id, trim(_row->>'student_code'), trim(_row->>'full_name'))
    ON CONFLICT (class_id, student_code) DO UPDATE SET full_name = EXCLUDED.full_name;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION public.teacher_import_roster(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_import_roster(uuid, jsonb) TO authenticated;