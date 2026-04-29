CREATE TABLE IF NOT EXISTS public.school_settings (
  id boolean PRIMARY KEY DEFAULT true,
  school_name text NOT NULL DEFAULT 'โรงเรียนตัวอย่างวิทยา',
  department text NOT NULL DEFAULT 'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
  academic_year text NOT NULL DEFAULT '2568',
  semester text NOT NULL DEFAULT '1',
  allow_teacher_create_topic boolean NOT NULL DEFAULT false,
  review_before_publish boolean NOT NULL DEFAULT true,
  show_explanations_after_submit boolean NOT NULL DEFAULT true,
  allow_print_exam boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = true)
);

INSERT INTO public.school_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_settings_select ON public.school_settings;
CREATE POLICY school_settings_select ON public.school_settings
FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS school_settings_admin_update ON public.school_settings;
CREATE POLICY school_settings_admin_update ON public.school_settings
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS school_settings_admin_insert ON public.school_settings;
CREATE POLICY school_settings_admin_insert ON public.school_settings
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));