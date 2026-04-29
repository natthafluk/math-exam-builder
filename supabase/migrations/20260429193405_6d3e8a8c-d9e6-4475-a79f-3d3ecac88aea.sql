CREATE OR REPLACE FUNCTION public.admin_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester public.profiles%ROWTYPE;
  admins_count integer := 0;
  teachers_count integer := 0;
  students_count integer := 0;
  classes_count integer := 0;
  questions_count integer := 0;
  exams_count integer := 0;
  attempts_count integer := 0;
  avg_score_percent integer := null;
  recent_exams_json jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO requester
  FROM public.profiles
  WHERE id = auth.uid();

  IF requester.id IS NULL OR requester.approval_status <> 'approved' OR (requester.role <> 'admin' AND requester.is_super_admin IS NOT TRUE) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT count(*)::integer INTO admins_count
  FROM public.profiles
  WHERE role = 'admin' AND approval_status = 'approved';

  SELECT count(*)::integer INTO teachers_count
  FROM public.profiles
  WHERE role = 'teacher' AND approval_status = 'approved';

  SELECT count(*)::integer INTO students_count
  FROM public.class_students;

  SELECT count(*)::integer INTO classes_count
  FROM public.classes;

  SELECT count(*)::integer INTO questions_count
  FROM public.questions;

  SELECT count(*)::integer INTO exams_count
  FROM public.exams;

  SELECT count(*)::integer INTO attempts_count
  FROM public.attempts;

  SELECT round(avg((score / nullif(max_score, 0)) * 100))::integer INTO avg_score_percent
  FROM public.attempts
  WHERE status = 'submitted' AND max_score > 0;

  SELECT coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) INTO recent_exams_json
  FROM (
    SELECT id, title, status, time_limit_minutes
    FROM public.exams
    ORDER BY created_at DESC
    LIMIT 5
  ) e;

  RETURN jsonb_build_object(
    'admins', admins_count,
    'teachers', teachers_count,
    'students', students_count,
    'classes', classes_count,
    'totalUsers', admins_count + teachers_count + students_count,
    'questions', questions_count,
    'exams', exams_count,
    'attempts', attempts_count,
    'avgScore', coalesce(avg_score_percent, 0),
    'recentExams', recent_exams_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_summary() TO authenticated;