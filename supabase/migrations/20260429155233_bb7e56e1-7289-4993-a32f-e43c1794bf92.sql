-- Add columns
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS reveal_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS revealed_at timestamptz;

ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_reveal_mode_check;
ALTER TABLE public.exams ADD CONSTRAINT exams_reveal_mode_check CHECK (reveal_mode IN ('manual','after_due'));

-- Helper
CREATE OR REPLACE FUNCTION public.exam_is_revealed(_exam_id uuid, _assignment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN e.reveal_mode = 'manual' THEN e.revealed_at IS NOT NULL
    WHEN e.reveal_mode = 'after_due' THEN COALESCE(a.due_date, e.due_date) IS NOT NULL
                                          AND now() >= COALESCE(a.due_date, e.due_date)
    ELSE false
  END
  FROM public.exams e
  LEFT JOIN public.assignments a ON a.id = _assignment_id
  WHERE e.id = _exam_id;
$$;

CREATE OR REPLACE FUNCTION public.teacher_set_exam_reveal(_exam_id uuid, _mode text, _revealed boolean)
RETURNS public.exams LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.exams;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin')
          OR EXISTS (SELECT 1 FROM public.exams WHERE id = _exam_id AND teacher_id = auth.uid())) THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์แก้ไขข้อสอบนี้';
  END IF;
  IF _mode NOT IN ('manual','after_due') THEN
    RAISE EXCEPTION 'reveal_mode ไม่ถูกต้อง';
  END IF;
  UPDATE public.exams
  SET reveal_mode = _mode,
      revealed_at = CASE WHEN _revealed THEN COALESCE(revealed_at, now()) ELSE NULL END,
      updated_at = now()
  WHERE id = _exam_id RETURNING * INTO _row;
  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_list_exams_reveal()
RETURNS TABLE(exam_id uuid, title text, status text, reveal_mode text,
              revealed_at timestamptz, due_date timestamptz, attempts_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.title, e.status::text, e.reveal_mode, e.revealed_at, e.due_date,
         (SELECT count(*) FROM public.attempts at
          JOIN public.assignments a ON a.id = at.assignment_id
          WHERE a.exam_id = e.id) AS attempts_count
  FROM public.exams e
  WHERE public.has_role(auth.uid(), 'admin') OR e.teacher_id = auth.uid()
  ORDER BY e.updated_at DESC;
$$;

-- Drop & recreate student RPCs with new signatures
DROP FUNCTION IF EXISTS public.student_list_assignments(uuid, text);
CREATE FUNCTION public.student_list_assignments(_enrollment_id uuid, _code text)
RETURNS TABLE(assignment_id uuid, exam_id uuid, exam_title text, exam_description text,
              time_limit_minutes integer, due_date timestamptz, status text,
              show_explanations boolean, revealed boolean, reveal_mode text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, e.id, e.title, e.description, e.time_limit_minutes, a.due_date, a.status::text,
         e.show_explanations, public.exam_is_revealed(e.id, a.id), e.reveal_mode
  FROM public.class_students cs
  JOIN public.assignments a ON a.class_id = cs.class_id
  JOIN public.exams e ON e.id = a.exam_id
  WHERE cs.id = _enrollment_id AND cs.student_code = _code
  ORDER BY a.created_at DESC;
$$;

DROP FUNCTION IF EXISTS public.student_list_results(uuid, text);
CREATE FUNCTION public.student_list_results(_enrollment_id uuid, _code text)
RETURNS TABLE(attempt_id uuid, assignment_id uuid, exam_title text,
              score numeric, max_score numeric, submitted_at timestamptz, revealed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT at.id, at.assignment_id, e.title,
         CASE WHEN public.exam_is_revealed(e.id, a.id) THEN at.score ELSE NULL END,
         at.max_score, at.submitted_at, public.exam_is_revealed(e.id, a.id)
  FROM public.attempts at
  JOIN public.assignments a ON a.id = at.assignment_id
  JOIN public.exams e ON e.id = a.exam_id
  JOIN public.class_students cs ON cs.id = at.enrollment_id
  WHERE at.enrollment_id = _enrollment_id AND cs.student_code = _code
  ORDER BY at.submitted_at DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.student_submit_attempt(_enrollment_id uuid, _code text, _assignment_id uuid, _answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ok boolean; _attempt_id uuid; _score numeric := 0; _max numeric := 0;
  _q record; _ans text; _correct boolean; _pts numeric;
  _exam_id uuid; _revealed boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.class_students cs
    JOIN public.assignments a ON a.class_id = cs.class_id
    WHERE cs.id = _enrollment_id AND cs.student_code = _code AND a.id = _assignment_id
  ) INTO _ok;
  IF NOT _ok THEN RAISE EXCEPTION 'ไม่พบสิทธิ์ในการส่งข้อสอบนี้'; END IF;

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
    _correct := NULL; _pts := 0;
    IF _q.type IN ('mcq','tf','short') THEN
      _correct := lower(trim(_ans)) = lower(trim(coalesce(_q.correct_answer,'')));
      IF _correct THEN _pts := _q.points; END IF;
    END IF;
    _score := _score + _pts; _max := _max + _q.points;
    INSERT INTO public.attempt_answers (attempt_id, question_id, answer, is_correct, points_awarded)
    VALUES (_attempt_id, _q.qid, jsonb_build_object('value', _ans), _correct, _pts);
  END LOOP;

  UPDATE public.attempts SET score = _score, max_score = _max WHERE id = _attempt_id;
  SELECT a.exam_id INTO _exam_id FROM public.assignments a WHERE a.id = _assignment_id;
  _revealed := public.exam_is_revealed(_exam_id, _assignment_id);

  RETURN jsonb_build_object(
    'attempt_id', _attempt_id,
    'score', CASE WHEN _revealed THEN _score ELSE NULL END,
    'max_score', _max,
    'revealed', _revealed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.exam_is_revealed(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_set_exam_reveal(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_list_exams_reveal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_list_assignments(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_list_results(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_submit_attempt(uuid, text, uuid, jsonb) TO anon, authenticated;