CREATE OR REPLACE FUNCTION public.is_exam_assigned_to_me(_exam_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.class_members cm ON cm.class_id = a.class_id
    WHERE a.exam_id = _exam_id
      AND cm.student_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS exams_select ON public.exams;

CREATE POLICY exams_select
ON public.exams
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  OR teacher_id = auth.uid()
  OR public.is_exam_assigned_to_me(id)
);