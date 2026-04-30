import { supabase } from "@/integrations/supabase/client";

export type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string;
  role: string;
  requested_role?: string | null;
  approval_status: string;
  is_super_admin: boolean;
  created_at?: string;
};

export type ClassStatsRow = { student_count: number | string | null };

export type PrimaryStats = {
  admins: number;
  teachers: number;
  students: number;
  classes: number;
  totalUsers: number;
  errors: string[];
};

export type SecondaryStats = {
  questions: number;
  exams: number;
  attempts: number;
  avgScore: number;
  recentExams: Array<{ id: string; title: string; status: string; time_limit_minutes: number }>;
  errors: string[];
};

export type SchoolStats = PrimaryStats & SecondaryStats;

// Session cache — last successful values, used as fallback when a query fails.
let primaryCache: PrimaryStats = { admins: 0, teachers: 0, students: 0, classes: 0, totalUsers: 0, errors: [] };
let secondaryCache: SecondaryStats = { questions: 0, exams: 0, attempts: 0, avgScore: 0, recentExams: [], errors: [] };

export const setCachedClassStats = (rows: ClassStatsRow[]) => {
  const classes = rows.length;
  const students = rows.reduce((sum, row) => sum + (Number(row.student_count) || 0), 0);
  primaryCache = { ...primaryCache, classes, students, totalUsers: primaryCache.admins + primaryCache.teachers + students };
};

// Backward-compat shim for AdminPage user list.
export async function retrySupabase<T>(
  fn: (signal: AbortSignal) => PromiseLike<{ data: T | null; error: { message?: string } | null; count?: number | null }>,
  label: string,
  _options?: unknown,
) {
  const controller = new AbortController();
  const result = await fn(controller.signal);
  if (result.error) {
    console.warn(`[${label}] failed:`, result.error.message);
    throw new Error(result.error.message ?? `${label} failed`);
  }
  return result;
}

export async function loadPrimarySchoolStats(_force = false): Promise<PrimaryStats> {
  const [profilesRes, classesRes, studentsRes] = await Promise.all([
    supabase.from("profiles").select("role, approval_status"),
    supabase.from("classes").select("*", { count: "exact", head: true }),
    supabase.from("class_students").select("*", { count: "exact", head: true }),
  ]);

  const next: PrimaryStats = { ...primaryCache, errors: [] };

  if (!profilesRes.error && profilesRes.data) {
    const approved = profilesRes.data.filter((u: any) => u.approval_status === "approved");
    next.admins = approved.filter((u: any) => u.role === "admin").length;
    next.teachers = approved.filter((u: any) => u.role === "teacher").length;
  }
  if (!classesRes.error) next.classes = classesRes.count ?? 0;
  if (!studentsRes.error) next.students = studentsRes.count ?? 0;
  next.totalUsers = next.admins + next.teachers + next.students;

  primaryCache = next;
  return next;
}

export async function loadSecondarySchoolStats(_force = false): Promise<SecondaryStats> {
  const [qRes, eRes, aRes, scoresRes, recentRes] = await Promise.all([
    supabase.from("questions").select("*", { count: "exact", head: true }),
    supabase.from("exams").select("*", { count: "exact", head: true }),
    supabase.from("attempts").select("*", { count: "exact", head: true }),
    supabase.from("attempts").select("score, max_score").eq("status", "submitted"),
    supabase.from("exams").select("id, title, status, time_limit_minutes").order("created_at", { ascending: false }).limit(5),
  ]);

  const next: SecondaryStats = { ...secondaryCache, errors: [] };

  if (!qRes.error) next.questions = qRes.count ?? 0;
  if (!eRes.error) next.exams = eRes.count ?? 0;
  if (!aRes.error) next.attempts = aRes.count ?? 0;

  if (!scoresRes.error && scoresRes.data) {
    const scored = scoresRes.data.filter((r: any) => Number(r.max_score) > 0);
    next.avgScore = scored.length === 0 ? 0 : Math.round(scored.reduce((acc: number, r: any) => acc + (Number(r.score) / Number(r.max_score)) * 100, 0) / scored.length);
  }
  if (!recentRes.error && recentRes.data) {
    next.recentExams = recentRes.data as SecondaryStats["recentExams"];
  }

  secondaryCache = next;
  return next;
}

export async function loadSchoolStats(force = false): Promise<SchoolStats> {
  const [primary, secondary] = await Promise.all([loadPrimarySchoolStats(force), loadSecondarySchoolStats(force)]);
  return { ...primary, ...secondary, errors: [] };
}
