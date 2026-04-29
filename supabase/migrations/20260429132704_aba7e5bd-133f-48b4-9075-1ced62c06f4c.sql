-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');
CREATE TYPE public.question_type AS ENUM ('mcq', 'short', 'tf', 'written');
CREATE TYPE public.difficulty_level AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE public.question_status AS ENUM ('draft', 'review', 'published', 'archived');
CREATE TYPE public.exam_status AS ENUM ('draft', 'assigned', 'closed');
CREATE TYPE public.assignment_status AS ENUM ('scheduled', 'open', 'closed');
CREATE TYPE public.attempt_status AS ENUM ('in_progress', 'submitted', 'graded');

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =================== TABLES (no policies yet) ===================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  role public.app_role NOT NULL DEFAULT 'student',
  avatar_initials TEXT,
  avatar_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);

CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  parent_topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body_latex TEXT NOT NULL DEFAULT '',
  type public.question_type NOT NULL DEFAULT 'mcq',
  correct_answer TEXT NOT NULL DEFAULT '',
  explanation_latex TEXT NOT NULL DEFAULT '',
  grade_level TEXT NOT NULL DEFAULT '',
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  difficulty public.difficulty_level NOT NULL DEFAULT 'medium',
  status public.question_status NOT NULL DEFAULT 'draft',
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.question_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  body_latex TEXT NOT NULL DEFAULT '',
  is_correct BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  time_limit_minutes INT NOT NULL DEFAULT 60,
  due_date TIMESTAMPTZ,
  show_explanations BOOLEAN NOT NULL DEFAULT true,
  status public.exam_status NOT NULL DEFAULT 'draft',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 1,
  UNIQUE (exam_id, question_id)
);

CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  status public.assignment_status NOT NULL DEFAULT 'open',
  due_date TIMESTAMPTZ,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.attempt_status NOT NULL DEFAULT 'in_progress',
  score NUMERIC NOT NULL DEFAULT 0,
  max_score NUMERIC NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_correct BOOLEAN,
  points_awarded NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (attempt_id, question_id)
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_exams_updated_at BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_attempts_updated_at BEFORE UPDATE ON public.attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =================== HELPER FUNCTIONS ===================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_class_teacher(_class_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.classes WHERE id = _class_id AND teacher_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_class_student(_class_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.class_members WHERE class_id = _class_id AND student_id = _user_id);
$$;

-- New user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role public.app_role; _name TEXT;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student');
  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  INSERT INTO public.profiles (id, email, full_name, role, avatar_initials, avatar_color)
  VALUES (NEW.id, NEW.email, _name, _role, UPPER(LEFT(_name, 1)),
    CASE _role WHEN 'admin' THEN 'bg-destructive' WHEN 'teacher' THEN 'bg-primary' ELSE 'bg-accent' END);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =================== ENABLE RLS ===================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =================== POLICIES ===================
-- profiles
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- classes
CREATE POLICY "classes_select_auth" ON public.classes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "classes_manage" ON public.classes FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR teacher_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR teacher_id = auth.uid());

-- class_members
CREATE POLICY "class_members_select" ON public.class_members FOR SELECT USING (
  public.has_role(auth.uid(),'admin') OR public.is_class_teacher(class_id, auth.uid()) OR student_id = auth.uid()
);
CREATE POLICY "class_members_manage" ON public.class_members FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.is_class_teacher(class_id, auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_class_teacher(class_id, auth.uid()));

-- topics
CREATE POLICY "topics_select_auth" ON public.topics FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "topics_manage" ON public.topics FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher'));

-- questions
CREATE POLICY "questions_select" ON public.questions FOR SELECT USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher')
  OR (public.has_role(auth.uid(),'student') AND status = 'published')
);
CREATE POLICY "questions_insert" ON public.questions FOR INSERT WITH CHECK (
  (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher')) AND author_id = auth.uid()
);
CREATE POLICY "questions_update" ON public.questions FOR UPDATE USING (
  public.has_role(auth.uid(),'admin') OR author_id = auth.uid()
);
CREATE POLICY "questions_delete" ON public.questions FOR DELETE USING (
  public.has_role(auth.uid(),'admin') OR author_id = auth.uid()
);

-- question_choices
CREATE POLICY "choices_select" ON public.question_choices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.questions q WHERE q.id = question_id AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher')
    OR (public.has_role(auth.uid(),'student') AND q.status = 'published')
  ))
);
CREATE POLICY "choices_manage" ON public.question_choices FOR ALL
  USING (EXISTS (SELECT 1 FROM public.questions q WHERE q.id = question_id AND (public.has_role(auth.uid(),'admin') OR q.author_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.questions q WHERE q.id = question_id AND (public.has_role(auth.uid(),'admin') OR q.author_id = auth.uid())));

-- exams
CREATE POLICY "exams_select" ON public.exams FOR SELECT USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher')
  OR EXISTS (SELECT 1 FROM public.assignments a JOIN public.class_members cm ON cm.class_id = a.class_id WHERE a.exam_id = exams.id AND cm.student_id = auth.uid())
);
CREATE POLICY "exams_manage" ON public.exams FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR teacher_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR teacher_id = auth.uid());

-- exam_questions
CREATE POLICY "exam_questions_select" ON public.exam_questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND (
    public.has_role(auth.uid(),'admin') OR e.teacher_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.assignments a JOIN public.class_members cm ON cm.class_id = a.class_id WHERE a.exam_id = e.id AND cm.student_id = auth.uid())
  ))
);
CREATE POLICY "exam_questions_manage" ON public.exam_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND (public.has_role(auth.uid(),'admin') OR e.teacher_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND (public.has_role(auth.uid(),'admin') OR e.teacher_id = auth.uid())));

-- assignments
CREATE POLICY "assignments_select" ON public.assignments FOR SELECT USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher')
  OR public.is_class_student(class_id, auth.uid())
);
CREATE POLICY "assignments_manage" ON public.assignments FOR ALL
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid())
    OR public.is_class_teacher(class_id, auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid())
    OR public.is_class_teacher(class_id, auth.uid())
  );

-- attempts
CREATE POLICY "attempts_select" ON public.attempts FOR SELECT USING (
  student_id = auth.uid() OR public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND public.is_class_teacher(a.class_id, auth.uid()))
  OR EXISTS (SELECT 1 FROM public.assignments a JOIN public.exams e ON e.id = a.exam_id WHERE a.id = assignment_id AND e.teacher_id = auth.uid())
);
CREATE POLICY "attempts_insert_own" ON public.attempts FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "attempts_update" ON public.attempts FOR UPDATE USING (
  public.has_role(auth.uid(),'admin') OR student_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND public.is_class_teacher(a.class_id, auth.uid()))
);

-- attempt_answers
CREATE POLICY "answers_select" ON public.attempt_answers FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.attempts at WHERE at.id = attempt_id AND (
    at.student_id = auth.uid() OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = at.assignment_id AND public.is_class_teacher(a.class_id, auth.uid()))
  ))
);
CREATE POLICY "answers_manage" ON public.attempt_answers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.attempts at WHERE at.id = attempt_id AND (at.student_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.attempts at WHERE at.id = attempt_id AND (at.student_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- audit_logs
CREATE POLICY "audit_select_admin" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit_insert_self" ON public.audit_logs FOR INSERT WITH CHECK (actor_id = auth.uid());

-- INDEXES
CREATE INDEX idx_questions_topic ON public.questions(topic_id);
CREATE INDEX idx_questions_status ON public.questions(status);
CREATE INDEX idx_questions_author ON public.questions(author_id);
CREATE INDEX idx_choices_question ON public.question_choices(question_id);
CREATE INDEX idx_exam_questions_exam ON public.exam_questions(exam_id);
CREATE INDEX idx_assignments_class ON public.assignments(class_id);
CREATE INDEX idx_assignments_exam ON public.assignments(exam_id);
CREATE INDEX idx_class_members_student ON public.class_members(student_id);
CREATE INDEX idx_attempts_student ON public.attempts(student_id);
CREATE INDEX idx_attempts_assignment ON public.attempts(assignment_id);
CREATE INDEX idx_attempt_answers_attempt ON public.attempt_answers(attempt_id);