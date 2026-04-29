import { supabase } from "@/integrations/supabase/client";

type SupabaseResult<T = unknown> = {
  data: T | null;
  error: { message?: string } | null;
  count?: number | null;
};

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

type ClassStatsRow = {
  student_count: number | string | null;
};

export type SchoolStats = {
  admins: number | null;
  teachers: number | null;
  students: number | null;
  classes: number | null;
  questions: number | null;
  exams: number | null;
  attempts: number | null;
  avgScore: number | null;
  totalUsers: number | null;
  recentExams: Array<{ id: string; title: string; status: string; time_limit_minutes: number }>;
  errors: string[];
};

export const isTransientDbError = (message: string) => /schema cache|Database client|Retrying/i.test(message);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error);

export async function retrySupabase<T>(fn: () => Promise<SupabaseResult<T>>, label: string, maxRetries = 5) {
  let lastMessage = "ไม่สามารถเชื่อมต่อฐานข้อมูลได้";

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const result = await fn();
      if (!result.error) return result;

      lastMessage = result.error.message ?? lastMessage;
      console.warn(`[${label}] attempt ${attempt}/${maxRetries} failed:`, lastMessage);
      if (!isTransientDbError(lastMessage) || attempt === maxRetries) {
        throw new Error(lastMessage);
      }
    } catch (error) {
      lastMessage = messageOf(error);
      console.warn(`[${label}] attempt ${attempt}/${maxRetries} failed:`, lastMessage);
      if (!isTransientDbError(lastMessage) || attempt === maxRetries) {
        throw new Error(lastMessage);
      }
    }

    const backoff = 250 * (2 ** (attempt - 1)) + Math.floor(Math.random() * 120);
    await wait(backoff);
  }

  throw new Error(lastMessage);
}

const countResult = async (label: string, query: () => Promise<SupabaseResult>) => {
  const result = await retrySupabase(query, label);
  return result.count ?? 0;
};

export async function loadSchoolStats(): Promise<SchoolStats> {
  const results = await Promise.allSettled([
    retrySupabase<AdminUserRow[]>(() => supabase.rpc("admin_list_users", { _status: null }), "admin_list_users"),
    retrySupabase<ClassStatsRow[]>(() => (supabase as any).rpc("teacher_list_classes_with_students"), "teacher_list_classes_with_students"),
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
  const errorText = (label: string, reason: unknown) => `${label}: ${messageOf(reason)}`;

  let admins: number | null = null;
  let teachers: number | null = null;
  if (results[0].status === "fulfilled") {
    const users = results[0].value.data ?? [];
    admins = users.filter((u) => u.role === "admin").length;
    teachers = users.filter((u) => u.role === "teacher").length;
  } else {
    errors.push(errorText("โหลดผู้ใช้ไม่สำเร็จ", results[0].reason));
  }

  let students: number | null = null;
  let classes: number | null = null;
  if (results[1].status === "fulfilled") {
    const classRows = results[1].value.data ?? [];
    classes = classRows.length;
    students = classRows.reduce((sum, row) => sum + (Number(row.student_count) || 0), 0);
  } else {
    errors.push(errorText("โหลดห้องเรียนไม่สำเร็จ", results[1].reason));
  }

  const secondaryNumber = (index: 2 | 3 | 4, label: string) => {
    const result = results[index];
    if (result.status === "fulfilled") return result.value;
    errors.push(errorText(label, result.reason));
    return null;
  };

  let avgScore: number | null = null;
  if (results[5].status === "fulfilled") {
    const scored = (results[5].value.data ?? []).filter((r) => Number(r.max_score) > 0);
    avgScore = scored.length === 0 ? 0 : Math.round(scored.reduce((acc, r) => acc + (Number(r.score) / Number(r.max_score)) * 100, 0) / scored.length);
  } else {
    errors.push(errorText("โหลดคะแนนเฉลี่ยไม่สำเร็จ", results[5].reason));
  }

  let recentExams: SchoolStats["recentExams"] = [];
  if (results[6].status === "fulfilled") {
    recentExams = results[6].value.data ?? [];
  } else {
    errors.push(errorText("โหลดข้อสอบล่าสุดไม่สำเร็จ", results[6].reason));
  }

  const totalUsers = admins === null || teachers === null || students === null ? null : admins + teachers + students;

  if (import.meta.env.DEV) {
    console.log("[AdminStats]", {
      usersRows: results[0].status === "fulfilled" ? (results[0].value.data ?? []).length : "failed",
      classesRows: results[1].status === "fulfilled" ? (results[1].value.data ?? []).length : "failed",
      studentsTotal: students,
      errors,
    });
  }

  return {
    admins,
    teachers,
    students,
    classes,
    questions: secondaryNumber(2, "โหลดจำนวนข้อสอบในคลังไม่สำเร็จ"),
    exams: secondaryNumber(3, "โหลดจำนวนชุดข้อสอบไม่สำเร็จ"),
    attempts: secondaryNumber(4, "โหลดจำนวนการส่งข้อสอบไม่สำเร็จ"),
    avgScore,
    totalUsers,
    recentExams,
    errors,
  };
}