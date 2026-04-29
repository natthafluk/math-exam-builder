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

const DASHBOARD_RETRY: Required<RetryOptions> = { maxTries: 1, delays: [0], timeoutMs: 4500 };

let classStatsCache: Pick<PrimaryStats, "students" | "classes"> | null = null;
let usersStatsCache: Pick<PrimaryStats, "admins" | "teachers"> | null = null;

export const isTransientDbError = (message: string) => /schema cache|Database client|Retrying/i.test(message);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error);
const errorText = (label: string, reason: unknown) => `${label}: ${messageOf(reason)}`;
const withTimeout = async <T,>(promise: SupabaseCall<T>, ms: number, label: string) => Promise.race([
  promise,
  new Promise<SupabaseResult<T>>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), ms)),
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

const loadPrimaryDirect = async (prefix: string): Promise<PrimaryStats> => {
  const [usersResult, classesResult, studentsResult] = await Promise.allSettled([
    retrySupabase<Array<{ role: string; approval_status: string | null }>>(
      () => supabase.from("profiles").select("role, approval_status"),
      `${prefix}_profiles`
    ),
    countResult(`${prefix}_classes`, () => supabase.from("classes").select("id", { count: "exact", head: true })),
    countResult(`${prefix}_class_students`, () => supabase.from("class_students").select("id", { count: "exact", head: true })),
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
  } else errors.push(errorText("โหลดผู้ใช้ไม่สำเร็จ", usersResult.reason));

  if (classesResult.status === "fulfilled") classes = classesResult.value;
  else errors.push(errorText("โหลดจำนวนห้องเรียนไม่สำเร็จ", classesResult.reason));

  if (studentsResult.status === "fulfilled") students = studentsResult.value;
  else errors.push(errorText("โหลดจำนวนนักเรียนไม่สำเร็จ", studentsResult.reason));

  classStatsCache = classes !== null && students !== null ? { classes, students } : classStatsCache;
  const totalUsers = admins === null || teachers === null || students === null ? null : admins + teachers + students;
  return { admins, teachers, students, classes, totalUsers, errors };
};

const loadSecondaryDirect = async (prefix: string): Promise<SecondaryStats> => {
  const results = await Promise.allSettled([
    countResult(`${prefix}_questions`, () => supabase.from("questions").select("id", { count: "exact", head: true })),
    countResult(`${prefix}_exams`, () => supabase.from("exams").select("id", { count: "exact", head: true })),
    countResult(`${prefix}_attempts`, () => supabase.from("attempts").select("id", { count: "exact", head: true })),
    retrySupabase<Array<{ score: number | null; max_score: number | null }>>(
      () => supabase.from("attempts").select("score, max_score").eq("status", "submitted"),
      `${prefix}_attempt_scores`
    ),
    retrySupabase<Array<{ id: string; title: string; status: string; time_limit_minutes: number }>>(
      () => supabase.from("exams").select("id, title, status, time_limit_minutes").order("created_at", { ascending: false }).limit(5),
      `${prefix}_recent_exams`
    ),
  ]);

  const errors: string[] = [];
  const numberAt = (index: 0 | 1 | 2, label: string) => {
    const result = results[index];
    if (result.status === "fulfilled") return result.value;
    errors.push(errorText(label, result.reason));
    return null;
  };

  let avgScore: number | null = null;
  if (results[3].status === "fulfilled") {
    const scored = (results[3].value.data ?? []).filter((r) => Number(r.max_score) > 0);
    avgScore = scored.length === 0 ? 0 : Math.round(scored.reduce((acc, r) => acc + (Number(r.score) / Number(r.max_score)) * 100, 0) / scored.length);
  } else errors.push(errorText("โหลดคะแนนเฉลี่ยไม่สำเร็จ", results[3].reason));

  const recentExams = results[4].status === "fulfilled" ? results[4].value.data ?? [] : [];
  if (results[4].status === "rejected") errors.push(errorText("โหลดข้อสอบล่าสุดไม่สำเร็จ", results[4].reason));

  return {
    questions: numberAt(0, "โหลดจำนวนข้อสอบในคลังไม่สำเร็จ"),
    exams: numberAt(1, "โหลดจำนวนชุดข้อสอบไม่สำเร็จ"),
    attempts: numberAt(2, "โหลดจำนวนการส่งข้อสอบไม่สำเร็จ"),
    avgScore,
    recentExams,
    errors,
  };
};

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
    const fallback = await loadPrimaryDirect("primary_fallback");
    return { ...fallback, errors: fallback.errors.length > 0 ? [errorText("โหลดสถิติหลักแบบรวมไม่สำเร็จ", summaryError), ...fallback.errors] : [] };
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
    const fallback = await loadSecondaryDirect("secondary_fallback");
    return { ...fallback, errors: fallback.errors.length > 0 ? [errorText("โหลดสถิติรองแบบรวมไม่สำเร็จ", summaryError), ...fallback.errors] : [] };
  }
}

export async function loadSchoolStats(force = false): Promise<SchoolStats> {
  try {
    return await loadDashboardSummary(force);
  } catch (summaryError) {
    const [primary, secondary] = await Promise.all([loadPrimaryDirect("school_fallback"), loadSecondaryDirect("school_fallback")]);
    return { ...primary, ...secondary, errors: [errorText("โหลดสถิติแบบรวมไม่สำเร็จ", summaryError), ...primary.errors, ...secondary.errors] };
  }
}
