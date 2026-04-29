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
};

const DASHBOARD_RETRY: Required<RetryOptions> = { maxTries: 3, delays: [300, 800, 1500] };

let classStatsCache: Pick<PrimaryStats, "students" | "classes"> | null = null;
let usersStatsCache: Pick<PrimaryStats, "admins" | "teachers"> | null = null;

export const isTransientDbError = (message: string) => /schema cache|Database client|Retrying/i.test(message);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error);
const errorText = (label: string, reason: unknown) => `${label}: ${messageOf(reason)}`;

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
      retrySupabase(() => supabase.from("classes").select("id", { count: "exact", head: true }), "classes_count_fallback"),
      retrySupabase(() => supabase.from("class_students").select("id", { count: "exact", head: true }), "class_students_count_fallback"),
    ]);
    classStatsCache = { classes: classesResult.count ?? 0, students: studentsResult.count ?? 0 };
    return classStatsCache;
  }
};

export async function retrySupabase<T>(fn: () => SupabaseCall<T>, label: string, options: RetryOptions = {}) {
  const maxTries = options.maxTries ?? DASHBOARD_RETRY.maxTries;
  const delays = options.delays ?? DASHBOARD_RETRY.delays;
  let lastMessage = "ไม่สามารถเชื่อมต่อฐานข้อมูลได้";

  for (let attempt = 1; attempt <= maxTries; attempt += 1) {
    try {
      const result = await fn();
      if (!result.error) return result;

      lastMessage = result.error.message ?? lastMessage;
      console.warn(`[${label}] attempt ${attempt}/${maxTries} failed:`, lastMessage);
      if (!isTransientDbError(lastMessage) || attempt === maxTries) throw new Error(lastMessage);
    } catch (error) {
      lastMessage = messageOf(error);
      console.warn(`[${label}] attempt ${attempt}/${maxTries} failed:`, lastMessage);
      if (!isTransientDbError(lastMessage) || attempt === maxTries) throw new Error(lastMessage);
    }

    await wait(delays[attempt - 1] ?? delays[delays.length - 1]);
  }

  throw new Error(lastMessage);
}

const countResult = async (label: string, query: () => SupabaseCall) => {
  const result = await retrySupabase(query, label);
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

export async function loadPrimarySchoolStats(): Promise<PrimaryStats> {
  const results = await Promise.allSettled([
    retrySupabase<AdminUserRow[]>(() => supabase.rpc("admin_list_users", { _status: null }), "admin_list_users"),
    loadClassStats(),
  ]);

  const errors: string[] = [];
  let admins: number | null = usersStatsCache?.admins ?? null;
  let teachers: number | null = usersStatsCache?.teachers ?? null;
  let students: number | null = classStatsCache?.students ?? null;
  let classes: number | null = classStatsCache?.classes ?? null;

  if (results[0].status === "fulfilled") {
    const users = results[0].value.data ?? [];
    admins = users.filter((u) => u.role === "admin").length;
    teachers = users.filter((u) => u.role === "teacher").length;
    usersStatsCache = { admins, teachers };
  } else {
    errors.push(errorText("โหลดผู้ใช้ไม่สำเร็จ", results[0].reason));
  }

  if (results[1].status === "fulfilled") {
    classes = results[1].value?.classes ?? null;
    students = results[1].value?.students ?? null;
  } else {
    errors.push("โหลดสถิติห้องเรียนไม่สำเร็จ กดรีเฟรชอีกครั้ง");
  }

  const totalUsers = admins === null || teachers === null || students === null ? null : admins + teachers + students;

  if (import.meta.env.DEV) {
    console.log("[AdminStats:primary]", {
      usersRows: results[0].status === "fulfilled" ? (results[0].value.data ?? []).length : "failed",
      classesRows: results[1].status === "fulfilled" ? (results[1].value.data ?? []).length : "failed",
      studentsTotal: students,
      errors,
    });
  }

  return { admins, teachers, students, classes, totalUsers, errors };
}

export async function loadSecondarySchoolStats(): Promise<SecondaryStats> {
  const results = await Promise.allSettled([
    countResult("questions_count", () => supabase.from("questions").select("id", { count: "exact", head: true })),
    countResult("exams_count", () => supabase.from("exams").select("id", { count: "exact", head: true })),
    countResult("attempts_count", () => supabase.from("attempts").select("id", { count: "exact", head: true })),
    retrySupabase<Array<{ score: number | null; max_score: number | null }>>(
      () => supabase.from("attempts").select("score, max_score").eq("status", "submitted"),
      "attempt_scores"
    ),
    retrySupabase<Array<{ id: string; title: string; status: string; time_limit_minutes: number }>>(
      () => supabase.from("exams").select("id, title, status, time_limit_minutes").order("created_at", { ascending: false }).limit(5),
      "recent_exams"
    ),
  ]);

  const errors: string[] = [];
  const secondaryNumber = (index: 0 | 1 | 2, label: string) => {
    const result = results[index];
    if (result.status === "fulfilled") return result.value;
    errors.push(errorText(label, result.reason));
    return null;
  };

  let avgScore: number | null = null;
  if (results[3].status === "fulfilled") {
    const scored = (results[3].value.data ?? []).filter((r) => Number(r.max_score) > 0);
    avgScore = scored.length === 0 ? 0 : Math.round(scored.reduce((acc, r) => acc + (Number(r.score) / Number(r.max_score)) * 100, 0) / scored.length);
  } else {
    errors.push(errorText("โหลดคะแนนเฉลี่ยไม่สำเร็จ", results[3].reason));
  }

  let recentExams: SecondaryStats["recentExams"] = [];
  if (results[4].status === "fulfilled") recentExams = results[4].value.data ?? [];
  else errors.push(errorText("โหลดข้อสอบล่าสุดไม่สำเร็จ", results[4].reason));

  return {
    questions: secondaryNumber(0, "โหลดจำนวนข้อสอบในคลังไม่สำเร็จ"),
    exams: secondaryNumber(1, "โหลดจำนวนชุดข้อสอบไม่สำเร็จ"),
    attempts: secondaryNumber(2, "โหลดจำนวนการส่งข้อสอบไม่สำเร็จ"),
    avgScore,
    recentExams,
    errors,
  };
}

export async function loadSchoolStats(): Promise<SchoolStats> {
  const [primary, secondary] = await Promise.all([
    loadPrimarySchoolStats().catch((error) => emptyPrimary([errorText("โหลดสถิติหลักไม่สำเร็จ", error)])),
    loadSecondarySchoolStats(),
  ]);

  return { ...primary, ...secondary, errors: [...primary.errors, ...secondary.errors] };
}
