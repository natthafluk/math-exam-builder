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
  admins: number | null;
  teachers: number | null;
  students: number | null;
  classes: number | null;
  totalUsers: number | null;
  errors: string[];
};

export type SecondaryStats = {
  questions: number | null;
  exams: number | null;
  attempts: number | null;
  avgScore: number | null;
  recentExams: Array<{ id: string; title: string; status: string; time_limit_minutes: number }>;
  errors: string[];
};

export type SchoolStats = PrimaryStats & SecondaryStats;

// Cache holds last known good values across the session so we never regress to "..." once loaded.
let primaryCache: PrimaryStats | null = null;
let secondaryCache: SecondaryStats | null = null;
let primaryPromise: Promise<PrimaryStats> | null = null;
let secondaryPromise: Promise<SecondaryStats> | null = null;

export const setCachedClassStats = (rows: ClassStatsRow[]) => {
  const classes = rows.length;
  const students = rows.reduce((sum, row) => sum + (Number(row.student_count) || 0), 0);
  if (primaryCache) {
    primaryCache = { ...primaryCache, classes, students, totalUsers: (primaryCache.admins ?? 0) + (primaryCache.teachers ?? 0) + students };
  } else {
    primaryCache = { admins: null, teachers: null, students, classes, totalUsers: null, errors: [] };
  }
};

const isTransient = (msg: string) => /schema cache|Database client|Retrying|fetch|network|timeout/i.test(msg ?? "");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Run a supabase query with up to 3 attempts when the error is a transient schema-cache reload.
async function runWithRetry<T extends { data: any; error: { message?: string } | null; count?: number | null }>(
  build: () => PromiseLike<T>,
  label: string,
  attempts = 3,
): Promise<T> {
  let last: T | null = null;
  for (let i = 1; i <= attempts; i++) {
    const res = await build();
    if (!res.error) return res;
    last = res;
    const msg = res.error.message ?? "";
    console.warn(`[${label}] attempt ${i}/${attempts} failed:`, msg);
    if (i === attempts || !isTransient(msg)) break;
    await wait(400 * i); // 400ms, 800ms
  }
  return last as T;
}

// Backward-compat shim for AdminPage.
export async function retrySupabase<T>(
  fn: (signal: AbortSignal) => PromiseLike<{ data: T | null; error: { message?: string } | null; count?: number | null }>,
  label: string,
  _options?: unknown,
) {
  const controller = new AbortController();
  const result = await runWithRetry(() => fn(controller.signal), label);
  if (result.error) throw new Error(result.error.message ?? `${label} failed`);
  return result;
}

export async function loadPrimarySchoolStats(force = false): Promise<PrimaryStats> {
  if (!force && primaryPromise) return primaryPromise;

  primaryPromise = (async (): Promise<PrimaryStats> => {
    const [profilesRes, classesRes, studentsRes] = await Promise.allSettled([
      runWithRetry(() => supabase.from("profiles").select("role, approval_status"), "stats_profiles"),
      runWithRetry(() => supabase.from("classes").select("*", { count: "exact", head: true }), "stats_classes"),
      runWithRetry(() => supabase.from("class_students").select("*", { count: "exact", head: true }), "stats_class_students"),
    ]);

    const errors: string[] = [];
    let admins: number | null = primaryCache?.admins ?? null;
    let teachers: number | null = primaryCache?.teachers ?? null;
    let classes: number | null = primaryCache?.classes ?? null;
    let students: number | null = primaryCache?.students ?? null;

    if (profilesRes.status === "fulfilled" && !profilesRes.value.error) {
      const approved = (profilesRes.value.data ?? []).filter((u: any) => u.approval_status === "approved");
      admins = approved.filter((u: any) => u.role === "admin").length;
      teachers = approved.filter((u: any) => u.role === "teacher").length;
    } else {
      const msg = profilesRes.status === "fulfilled" ? profilesRes.value.error?.message : (profilesRes.reason as Error)?.message;
      console.warn("[stats_profiles] failed:", msg);
      if (admins === null) errors.push("โหลดจำนวนผู้ใช้ไม่สำเร็จ");
    }

    if (classesRes.status === "fulfilled" && !classesRes.value.error) {
      classes = classesRes.value.count ?? 0;
    } else {
      const msg = classesRes.status === "fulfilled" ? classesRes.value.error?.message : (classesRes.reason as Error)?.message;
      console.warn("[stats_classes] failed:", msg);
      if (classes === null) errors.push("โหลดจำนวนห้องเรียนไม่สำเร็จ");
    }

    if (studentsRes.status === "fulfilled" && !studentsRes.value.error) {
      students = studentsRes.value.count ?? 0;
    } else {
      const msg = studentsRes.status === "fulfilled" ? studentsRes.value.error?.message : (studentsRes.reason as Error)?.message;
      console.warn("[stats_class_students] failed:", msg);
      if (students === null) errors.push("โหลดจำนวนนักเรียนไม่สำเร็จ");
    }

    const totalUsers = admins !== null && teachers !== null && students !== null ? admins + teachers + students : null;
    const next: PrimaryStats = { admins, teachers, students, classes, totalUsers, errors };
    primaryCache = next;
    return next;
  })().finally(() => {
    primaryPromise = null;
  });

  return primaryPromise;
}

export async function loadSecondarySchoolStats(force = false): Promise<SecondaryStats> {
  if (!force && secondaryPromise) return secondaryPromise;

  secondaryPromise = (async (): Promise<SecondaryStats> => {
    const [qRes, eRes, aRes, scoresRes, recentRes] = await Promise.allSettled([
      runWithRetry(() => supabase.from("questions").select("*", { count: "exact", head: true }), "stats_questions"),
      runWithRetry(() => supabase.from("exams").select("*", { count: "exact", head: true }), "stats_exams"),
      runWithRetry(() => supabase.from("attempts").select("*", { count: "exact", head: true }), "stats_attempts"),
      runWithRetry(() => supabase.from("attempts").select("score, max_score").eq("status", "submitted"), "stats_scores"),
      runWithRetry(() => supabase.from("exams").select("id, title, status, time_limit_minutes").order("created_at", { ascending: false }).limit(5), "stats_recent"),
    ]);

    const errors: string[] = [];
    const numOrNull = (res: PromiseSettledResult<any>, label: string, prev: number | null): number | null => {
      if (res.status === "fulfilled" && !res.value.error) return res.value.count ?? 0;
      console.warn(`[${label}] failed`);
      if (prev === null) errors.push(label);
      return prev;
    };

    const questions = numOrNull(qRes, "โหลดจำนวนข้อสอบในคลังไม่สำเร็จ", secondaryCache?.questions ?? null);
    const exams = numOrNull(eRes, "โหลดจำนวนชุดข้อสอบไม่สำเร็จ", secondaryCache?.exams ?? null);
    const attempts = numOrNull(aRes, "โหลดจำนวนการส่งข้อสอบไม่สำเร็จ", secondaryCache?.attempts ?? null);

    let avgScore: number | null = secondaryCache?.avgScore ?? null;
    if (scoresRes.status === "fulfilled" && !scoresRes.value.error) {
      const scored = (scoresRes.value.data ?? []).filter((r: any) => Number(r.max_score) > 0);
      avgScore = scored.length === 0 ? 0 : Math.round(scored.reduce((acc: number, r: any) => acc + (Number(r.score) / Number(r.max_score)) * 100, 0) / scored.length);
    } else if (avgScore === null) {
      errors.push("โหลดคะแนนเฉลี่ยไม่สำเร็จ");
    }

    let recentExams = secondaryCache?.recentExams ?? [];
    if (recentRes.status === "fulfilled" && !recentRes.value.error) {
      recentExams = (recentRes.value.data ?? []) as SecondaryStats["recentExams"];
    }

    const next: SecondaryStats = { questions, exams, attempts, avgScore, recentExams, errors };
    secondaryCache = next;
    return next;
  })().finally(() => {
    secondaryPromise = null;
  });

  return secondaryPromise;
}

export async function loadSchoolStats(force = false): Promise<SchoolStats> {
  const [primary, secondary] = await Promise.all([
    loadPrimarySchoolStats(force).catch(() => ({ admins: null, teachers: null, students: null, classes: null, totalUsers: null, errors: ["โหลดสถิติหลักไม่สำเร็จ"] } as PrimaryStats)),
    loadSecondarySchoolStats(force).catch(() => ({ questions: null, exams: null, attempts: null, avgScore: null, recentExams: [], errors: ["โหลดสถิติรองไม่สำเร็จ"] } as SecondaryStats)),
  ]);
  return { ...primary, ...secondary, errors: [...primary.errors, ...secondary.errors] };
}
