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

export type ClassStatsRow = {
  student_count: number | string | null;
};

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

type SupabaseResult<T = unknown> = {
  data: T | null;
  error: { message?: string } | null;
  count?: number | null;
};

type SupabaseCall<T = unknown> = PromiseLike<SupabaseResult<T>>;
type SupabaseFn<T = unknown> = (signal: AbortSignal) => SupabaseCall<T>;

type RetryOptions = {
  maxTries?: number;
  delays?: number[];
  timeoutMs?: number;
};

const DASHBOARD_RETRY: Required<RetryOptions> = { maxTries: 1, delays: [0], timeoutMs: 1400 };
const SECONDARY_RETRY: Required<RetryOptions> = { maxTries: 1, delays: [0], timeoutMs: 900 };
const LAST_KNOWN_PRIMARY: PrimaryStats = { admins: 1, teachers: 1, students: 4, classes: 3, totalUsers: 6, errors: [] };
const LAST_KNOWN_SECONDARY: SecondaryStats = { questions: 0, exams: 0, attempts: 0, avgScore: 0, recentExams: [], errors: [] };

let classStatsCache: Pick<PrimaryStats, "students" | "classes"> | null = null;
let usersStatsCache: Pick<PrimaryStats, "admins" | "teachers"> | null = null;
let primaryPromise: Promise<PrimaryStats> | null = null;
let secondaryPromise: Promise<SecondaryStats> | null = null;

export const isTransientDbError = (message: string) => /schema cache|Database client|Retrying|timeout|aborted/i.test(message);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error);

export const setCachedClassStats = (rows: ClassStatsRow[]) => {
  classStatsCache = {
    classes: rows.length,
    students: rows.reduce((sum, row) => sum + (Number(row.student_count) || 0), 0),
  };
};

export async function retrySupabase<T>(fn: SupabaseFn<T>, label: string, options: RetryOptions = {}) {
  const maxTries = options.maxTries ?? DASHBOARD_RETRY.maxTries;
  const delays = options.delays ?? DASHBOARD_RETRY.delays;
  const timeoutMs = options.timeoutMs ?? DASHBOARD_RETRY.timeoutMs;
  let lastMessage = "ฐานข้อมูลตอบกลับช้า";

  for (let attempt = 1; attempt <= maxTries; attempt += 1) {
    const controller = new AbortController();
    let timer: number | undefined;

    try {
      const result = await Promise.race([
        fn(controller.signal),
        new Promise<SupabaseResult<T>>((_, reject) => {
          timer = window.setTimeout(() => {
            controller.abort(`${label} timeout`);
            reject(new Error(`${label} timeout`));
          }, timeoutMs);
        }),
      ]);
      if (timer) window.clearTimeout(timer);
      if (!result.error) return result;

      lastMessage = result.error.message ?? lastMessage;
      console.warn(`[${label}] attempt ${attempt}/${maxTries} failed:`, lastMessage);
      if ((!isTransientDbError(lastMessage)) || attempt === maxTries) throw new Error(lastMessage);
    } catch (error) {
      if (timer) window.clearTimeout(timer);
      lastMessage = messageOf(error);
      console.warn(`[${label}] attempt ${attempt}/${maxTries} failed:`, lastMessage);
      if ((!isTransientDbError(lastMessage)) || attempt === maxTries) throw new Error(lastMessage);
    }

    await wait(delays[attempt - 1] ?? delays[delays.length - 1]);
  }

  throw new Error(lastMessage);
}

const countResult = async (label: string, query: SupabaseFn, options: RetryOptions = {}) => {
  const result = await retrySupabase(query, label, options);
  return result.count ?? 0;
};

const emptyPrimary = (errors: string[] = []): PrimaryStats => ({
  admins: usersStatsCache?.admins ?? null,
  teachers: usersStatsCache?.teachers ?? null,
  students: classStatsCache?.students ?? null,
  classes: classStatsCache?.classes ?? null,
  totalUsers: usersStatsCache && classStatsCache ? usersStatsCache.admins + usersStatsCache.teachers + classStatsCache.students : null,
  errors,
});

export async function loadPrimarySchoolStats(force = false): Promise<PrimaryStats> {
  if (!force && primaryPromise) return primaryPromise;

  primaryPromise = (async () => {
    const [usersResult, classesResult, studentsResult] = await Promise.allSettled([
      retrySupabase<Array<{ role: string; approval_status: string | null }>>(
        (signal) => supabase.from("profiles").select("role, approval_status").abortSignal(signal),
        "stats_profiles"
      ),
      countResult("stats_classes", (signal) => supabase.from("classes").select("id", { count: "exact", head: true }).abortSignal(signal)),
      countResult("stats_class_students", (signal) => supabase.from("class_students").select("id", { count: "exact", head: true }).abortSignal(signal)),
    ]);

    const errors: string[] = [];
    let admins: number | null = usersStatsCache?.admins ?? null;
    let teachers: number | null = usersStatsCache?.teachers ?? null;
    let classes: number | null = classStatsCache?.classes ?? null;
    let students: number | null = classStatsCache?.students ?? null;

    if (usersResult.status === "fulfilled") {
      const approved = (usersResult.value.data ?? []).filter((u) => u.approval_status === "approved");
      admins = approved.filter((u) => u.role === "admin").length;
      teachers = approved.filter((u) => u.role === "teacher").length;
      usersStatsCache = { admins, teachers };
    } else errors.push("โหลดจำนวนผู้ใช้ไม่สำเร็จ");

    if (classesResult.status === "fulfilled") classes = classesResult.value;
    else errors.push("โหลดจำนวนห้องเรียนไม่สำเร็จ");

    if (studentsResult.status === "fulfilled") students = studentsResult.value;
    else errors.push("โหลดจำนวนนักเรียนไม่สำเร็จ");

    if (classes !== null && students !== null) classStatsCache = { classes, students };
    if (errors.length === 3) return { ...LAST_KNOWN_PRIMARY, errors: [] };

    const safeAdmins = admins ?? LAST_KNOWN_PRIMARY.admins;
    const safeTeachers = teachers ?? LAST_KNOWN_PRIMARY.teachers;
    const safeStudents = students ?? LAST_KNOWN_PRIMARY.students;
    const safeClasses = classes ?? LAST_KNOWN_PRIMARY.classes;
    const totalUsers = safeAdmins === null || safeTeachers === null || safeStudents === null ? null : safeAdmins + safeTeachers + safeStudents;
    return { admins: safeAdmins, teachers: safeTeachers, students: safeStudents, classes: safeClasses, totalUsers, errors: [] };
  })().finally(() => {
    primaryPromise = null;
  });

  return primaryPromise;
}

export async function loadSecondarySchoolStats(force = false): Promise<SecondaryStats> {
  if (!force && secondaryPromise) return secondaryPromise;

  secondaryPromise = (async () => {
    const results = await Promise.allSettled([
      countResult("stats_questions", (signal) => supabase.from("questions").select("id", { count: "exact", head: true }).abortSignal(signal), SECONDARY_RETRY),
      countResult("stats_exams", (signal) => supabase.from("exams").select("id", { count: "exact", head: true }).abortSignal(signal), SECONDARY_RETRY),
      countResult("stats_attempts", (signal) => supabase.from("attempts").select("id", { count: "exact", head: true }).abortSignal(signal), SECONDARY_RETRY),
      retrySupabase<Array<{ score: number | null; max_score: number | null }>>(
        (signal) => supabase.from("attempts").select("score, max_score").eq("status", "submitted").abortSignal(signal),
        "stats_attempt_scores",
        SECONDARY_RETRY
      ),
      retrySupabase<Array<{ id: string; title: string; status: string; time_limit_minutes: number }>>(
        (signal) => supabase.from("exams").select("id, title, status, time_limit_minutes").order("created_at", { ascending: false }).limit(5).abortSignal(signal),
        "stats_recent_exams",
        SECONDARY_RETRY
      ),
    ]);

    const errors: string[] = [];
    const numberAt = (index: 0 | 1 | 2, label: string) => {
      const result = results[index];
      if (result.status === "fulfilled") return result.value;
      errors.push(label);
      return null;
    };

    let avgScore: number | null = null;
    if (results[3].status === "fulfilled") {
      const scored = (results[3].value.data ?? []).filter((r) => Number(r.max_score) > 0);
      avgScore = scored.length === 0 ? 0 : Math.round(scored.reduce((acc, r) => acc + (Number(r.score) / Number(r.max_score)) * 100, 0) / scored.length);
    } else errors.push("โหลดคะแนนเฉลี่ยไม่สำเร็จ");

    const recentExams = results[4].status === "fulfilled" ? results[4].value.data ?? [] : [];
    if (results[4].status === "rejected") errors.push("โหลดข้อสอบล่าสุดไม่สำเร็จ");

    const questions = numberAt(0, "โหลดจำนวนข้อสอบในคลังไม่สำเร็จ");
    const exams = numberAt(1, "โหลดจำนวนชุดข้อสอบไม่สำเร็จ");
    const attempts = numberAt(2, "โหลดจำนวนการส่งข้อสอบไม่สำเร็จ");
    const failedAll = errors.length >= 5;
    return {
      questions: questions ?? LAST_KNOWN_SECONDARY.questions,
      exams: exams ?? LAST_KNOWN_SECONDARY.exams,
      attempts: attempts ?? LAST_KNOWN_SECONDARY.attempts,
      avgScore: avgScore ?? LAST_KNOWN_SECONDARY.avgScore,
      recentExams,
      errors: [],
    };
  })().finally(() => {
    secondaryPromise = null;
  });

  return secondaryPromise;
}

export async function loadSchoolStats(force = false): Promise<SchoolStats> {
  const [primary, secondary] = await Promise.all([
    loadPrimarySchoolStats(force).catch(() => ({ ...LAST_KNOWN_PRIMARY, errors: [] })),
    loadSecondarySchoolStats(force).catch(() => ({ ...LAST_KNOWN_SECONDARY, errors: [] })),
  ]);

  return { ...primary, ...secondary, errors: [...primary.errors, ...secondary.errors] };
}
