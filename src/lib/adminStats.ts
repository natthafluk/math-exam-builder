import { supabase } from "@/integrations/supabase/client";

type SupabaseResult<T = unknown> = {
  data: T | null;
  error: { message?: string } | null;
  count?: number | null;
};

type SupabaseCall<T = unknown> = PromiseLike<SupabaseResult<T>>;

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

type RetryOptions = {
  maxTries?: number;
  delays?: number[];
  timeoutMs?: number;
};

const DASHBOARD_RETRY: Required<RetryOptions> = { maxTries: 1, delays: [0], timeoutMs: 2500 };
const STATS_RPC_TIMEOUT_MS = 3500;

let classStatsCache: Pick<PrimaryStats, "students" | "classes"> | null = null;
let usersStatsCache: Pick<PrimaryStats, "admins" | "teachers"> | null = null;
let summaryCache: SchoolStats | null = null;
let summaryPromise: Promise<SchoolStats> | null = null;

export const isTransientDbError = (message: string) => /schema cache|Database client|Retrying/i.test(message);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error);
const errorText = (label: string, reason: unknown) => `${label}: ${messageOf(reason)}`;
const withTimeout = async <T,>(promise: SupabaseCall<T>, ms: number, label: string) => Promise.race([
  promise,
  new Promise<SupabaseResult<T>>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), ms)),
]);

const withPromiseTimeout = async <T,>(promise: Promise<T>, ms: number, label: string) => Promise.race([
  promise,
  new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), ms)),
]);

export const setCachedClassStats = (rows: ClassStatsRow[]) => {
  classStatsCache = {
    classes: rows.length,
    students: rows.reduce((sum, row) => sum + (Number(row.student_count) || 0), 0),
  };
};

const loadClassStats = async () => {
  try {
    const { data } = await retrySupabase<ClassStatsRow[]>(
      () => (supabase as any).rpc("teacher_list_classes_with_students"),
      "teacher_list_classes_with_students"
    );
    const rows = data ?? [];
    setCachedClassStats(rows);
    return classStatsCache;
  } catch (rpcError) {
    console.warn("[teacher_list_classes_with_students] falling back to direct counts:", messageOf(rpcError));
    const [classesResult, studentsResult] = await Promise.all([
      retrySupabase(() => supabase.from("classes").select("id", { count: "exact", head: true }), "classes_count_fallback", { maxTries: 1, timeoutMs: 900 }),
      retrySupabase(() => supabase.from("class_students").select("id", { count: "exact", head: true }), "class_students_count_fallback", { maxTries: 1, timeoutMs: 900 }),
    ]);
    classStatsCache = { classes: classesResult.count ?? 0, students: studentsResult.count ?? 0 };
    return classStatsCache;
  }
};

export async function retrySupabase<T>(fn: () => SupabaseCall<T>, label: string, options: RetryOptions = {}) {
  const maxTries = options.maxTries ?? DASHBOARD_RETRY.maxTries;
  const delays = options.delays ?? DASHBOARD_RETRY.delays;
  const timeoutMs = options.timeoutMs ?? DASHBOARD_RETRY.timeoutMs;
  let lastMessage = "ไม่สามารถเชื่อมต่อฐานข้อมูลได้";

  for (let attempt = 1; attempt <= maxTries; attempt += 1) {
    try {
      const result = await withTimeout(fn(), timeoutMs, label);
      if (!result.error) return result;

      lastMessage = result.error.message ?? lastMessage;
      console.warn(`[${label}] attempt ${attempt}/${maxTries} failed:`, lastMessage);
      if ((!isTransientDbError(lastMessage) && !/timeout/i.test(lastMessage)) || attempt === maxTries) throw new Error(lastMessage);
    } catch (error) {
      lastMessage = messageOf(error);
      console.warn(`[${label}] attempt ${attempt}/${maxTries} failed:`, lastMessage);
      if ((!isTransientDbError(lastMessage) && !/timeout/i.test(lastMessage)) || attempt === maxTries) throw new Error(lastMessage);
    }

    await wait(delays[attempt - 1] ?? delays[delays.length - 1]);
  }

  throw new Error(lastMessage);
}

const countResult = async (label: string, query: () => SupabaseCall) => {
  const result = await retrySupabase(query, label);
  return result.count ?? 0;
};

const fromSummary = (raw: any): SchoolStats => {
  const data = Array.isArray(raw) ? raw[0] : raw;
  const stats: SchoolStats = {
    admins: Number(data?.admins ?? 0),
    teachers: Number(data?.teachers ?? 0),
    students: Number(data?.students ?? 0),
    classes: Number(data?.classes ?? 0),
    totalUsers: Number(data?.totalUsers ?? data?.total_users ?? 0),
    questions: Number(data?.questions ?? 0),
    exams: Number(data?.exams ?? 0),
    attempts: Number(data?.attempts ?? 0),
    avgScore: Number(data?.avgScore ?? data?.avg_score ?? 0),
    recentExams: Array.isArray(data?.recentExams) ? data.recentExams : Array.isArray(data?.recent_exams) ? data.recent_exams : [],
    errors: [],
  };

  usersStatsCache = { admins: stats.admins, teachers: stats.teachers };
  classStatsCache = { classes: stats.classes, students: stats.students };
  summaryCache = stats;
  return stats;
};

export async function loadDashboardSummary(force = false): Promise<SchoolStats> {
  if (!force && summaryCache) return summaryCache;
  if (summaryPromise) return summaryPromise;

  summaryPromise = withPromiseTimeout(
    retrySupabase<any>(() => (supabase as any).rpc("admin_dashboard_summary"), "admin_dashboard_summary", { maxTries: 1, timeoutMs: STATS_RPC_TIMEOUT_MS })
      .then((result) => fromSummary(result.data)),
    STATS_RPC_TIMEOUT_MS + 400,
    "admin_dashboard_summary"
  ).finally(() => {
    summaryPromise = null;
  });

  return summaryPromise;
}

const emptyPrimary = (errors: string[] = []): PrimaryStats => ({
  admins: usersStatsCache?.admins ?? null,
  teachers: usersStatsCache?.teachers ?? null,
  students: classStatsCache?.students ?? null,
  classes: classStatsCache?.classes ?? null,
  totalUsers: usersStatsCache && classStatsCache ? usersStatsCache.admins + usersStatsCache.teachers + classStatsCache.students : null,
  errors,
});

export async function loadPrimarySchoolStats(force = false): Promise<PrimaryStats> {
  try {
    const summary = await loadDashboardSummary(force);
    return {
      admins: summary.admins,
      teachers: summary.teachers,
      students: summary.students,
      classes: summary.classes,
      totalUsers: summary.totalUsers,
      errors: [],
    };
  } catch (summaryError) {
    return emptyPrimary([errorText("โหลดสถิติหลักไม่สำเร็จ", summaryError)]);
  }
}

export async function loadSecondarySchoolStats(force = false): Promise<SecondaryStats> {
  try {
    const summary = await loadDashboardSummary(force);
    return {
      questions: summary.questions,
      exams: summary.exams,
      attempts: summary.attempts,
      avgScore: summary.avgScore,
      recentExams: summary.recentExams,
      errors: [],
    };
  } catch (summaryError) {
    return { questions: null, exams: null, attempts: null, avgScore: null, recentExams: [], errors: [errorText("โหลดสถิติรองไม่สำเร็จ", summaryError)] };
  }
}

export async function loadSchoolStats(force = false): Promise<SchoolStats> {
  try {
    return await loadDashboardSummary(force);
  } catch (summaryError) {
    const primary = emptyPrimary([errorText("โหลดสถิติหลักไม่สำเร็จ", summaryError)]);
    return { ...primary, questions: null, exams: null, attempts: null, avgScore: null, recentExams: [], errors: primary.errors };
  }
}
