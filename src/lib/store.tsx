import { createContext, useContext, useMemo, useState, ReactNode, useCallback, useEffect } from "react";
import type { Attempt, ClassRoom, Exam, Question, Role, Topic, User, AuditEntry, SchoolSettings, Choice } from "./types";
import { seedTopics, seedAudit, seedSchool } from "./seed";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { toast } from "sonner";

const isTransient = (msg: string) =>
  /schema cache|recovery mode|connection|connection reset|timeout|fetch|temporarily|503|PGRST002|network/i.test(msg);

const errorMessage = (error: unknown) => {
  if (!error) return "unknown error";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    const maybe = error as { message?: unknown; code?: unknown };
    return [maybe.code, maybe.message].filter(Boolean).join(" ") || JSON.stringify(error);
  } catch {
    return String(error);
  }
};

async function withRetry<T>(fn: () => Promise<{ error: any; data?: T }>, attempts = 4) {
  let lastErr: any = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fn();
    if (!res.error) return res;
    lastErr = res.error;
    if (!isTransient(errorMessage(res.error))) return res;
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return { error: lastErr } as any;
}

interface StoreCtx {
  currentUser: User;
  setCurrentUserId: (id: string) => void;
  users: User[];
  classes: ClassRoom[];
  topics: Topic[];
  questions: Question[];
  exams: Exam[];
  attempts: Attempt[];
  audit: AuditEntry[];
  school: SchoolSettings;
  setSchool: (s: SchoolSettings) => void;
  refreshQuestions: (source?: string) => Promise<Question[]>;
  addQuestion: (q: Question) => Promise<Question | null>;
  updateQuestion: (q: Question) => Promise<Question | null>;
  deleteQuestion: (id: string) => Promise<void>;
  bulkUpdateQuestionStatus: (ids: string[], status: Question["status"]) => Promise<void>;
  addExam: (e: Exam) => void;
  updateExam: (e: Exam) => void;
  saveAttempt: (a: Attempt) => void;
  setUserRole: (id: string, role: Role) => void;
  addUser: (u: User) => void;
  deleteUser: (id: string) => void;
  addTopic: (t: Topic) => void;
  deleteTopic: (id: string) => void;
  logAudit: (entry: Omit<AuditEntry, "id" | "at" | "actorId" | "actorName">) => void;
  isBackendConnected: boolean;
}

const Ctx = createContext<StoreCtx | null>(null);

export function mapDbQuestion(row: any, choices?: Choice[]): Question {
  return {
    id: row.id,
    title: row.title,
    body: row.body_latex ?? "",
    type: row.type,
    correctAnswer: row.correct_answer ?? "",
    explanation: row.explanation_latex ?? "",
    gradeLevel: row.grade_level ?? "",
    topicId: row.topic_id ?? "",
    difficulty: row.difficulty,
    status: row.status,
    authorId: row.author_id ?? "",
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    choices,
  };
}

function mapChoice(row: any): Choice {
  return { id: row.label, text: row.body_latex ?? "" };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [classes] = useState<ClassRoom[]>([]);
  const [topics, setTopics] = useState<Topic[]>(seedTopics);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>(seedAudit);
  const [school, setSchool] = useState<SchoolSettings>(seedSchool);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  const refreshQuestions = useCallback(async (source = "StoreProvider") => {
    if (!user) {
      setQuestions([]);
      return [];
    }

    const qRes = await withRetry(() => supabase.from("questions").select("*").order("updated_at", { ascending: false }) as any);
    if (qRes.error) {
      const msg = errorMessage(qRes.error);
      console.error("[questions] DB load failed", { source, error: msg });
      setQuestions([]);
      setIsBackendConnected(false);
      toast.error("โหลดข้อสอบจากฐานข้อมูลไม่สำเร็จ: " + msg, { duration: Infinity });
      return [];
    }

    const rows = (qRes.data ?? []) as any[];
    const ids = rows.map((r) => r.id);
    const choicesByQuestion = new Map<string, Choice[]>();
    if (ids.length > 0) {
      const cRes = await withRetry(() => supabase
        .from("question_choices")
        .select("question_id, label, body_latex, sort_order")
        .in("question_id", ids)
        .order("sort_order", { ascending: true }) as any);
      if (cRes.error) {
        console.warn("[questions] DB choices load failed", { source, error: errorMessage(cRes.error) });
      } else {
        for (const row of (cRes.data ?? []) as any[]) {
          const arr = choicesByQuestion.get(row.question_id) ?? [];
          arr.push(mapChoice(row));
          choicesByQuestion.set(row.question_id, arr);
        }
      }
    }

    const mapped = rows.map((row) => mapDbQuestion(row, choicesByQuestion.get(row.id)));
    console.info("[questions] DB load success", { source, rowCount: mapped.length });
    setQuestions(mapped);
    setIsBackendConnected(true);
    return mapped;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setQuestions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const tRes = await supabase.from("topics").select("id, title, grade_level, parent_topic_id");
      if (cancelled) return;
      if (tRes.data && tRes.data.length > 0) {
        setTopics(tRes.data.map((r: any) => ({
          id: r.id, title: r.title, gradeLevel: r.grade_level, parentId: r.parent_topic_id ?? undefined,
        })));
      }
      await refreshQuestions("StoreProvider hydrate");
    })();
    return () => { cancelled = true; };
  }, [user, refreshQuestions]);

  const currentUser: User = useMemo(() => {
    if (profile) {
      return {
        id: profile.id,
        name: profile.full_name || profile.email || "ผู้ใช้",
        email: profile.email ?? "",
        role: profile.role,
        avatarColor: profile.avatar_color ?? "bg-primary",
      };
    }
    return users.find((u) => u.id === currentUserId) ?? users[0] ?? {
      id: "guest", name: "ผู้เยี่ยมชม", email: "", role: "student" as Role, avatarColor: "bg-muted",
    };
  }, [profile, users, currentUserId]);

  const logAudit = useCallback((entry: Omit<AuditEntry, "id" | "at" | "actorId" | "actorName">) => {
    setAudit((p) => [
      { id: `a-${Date.now()}`, at: new Date().toISOString(), actorId: currentUser.id, actorName: currentUser.name, ...entry },
      ...p,
    ].slice(0, 50));
  }, [currentUser]);

  const replaceQuestionChoices = async (q: Question) => {
    const del = await withRetry(() => supabase.from("question_choices").delete().eq("question_id", q.id) as any);
    if (del.error) return del.error;

    if (q.type !== "mcq") return null;
    const rows = (q.choices ?? [])
      .filter((c) => c.id.trim())
      .map((c, index) => ({
        question_id: q.id,
        label: c.id,
        body_latex: c.text ?? "",
        sort_order: index,
        is_correct: c.id === q.correctAnswer,
      }));
    if (rows.length === 0) return null;

    const ins = await withRetry(() => supabase.from("question_choices").insert(rows) as any);
    return ins.error ?? null;
  };

  const persistQuestion = async (q: Question, isNew: boolean): Promise<Question | null> => {
    if (!user) {
      toast.error("ยังไม่ได้เข้าสู่ระบบ", { duration: Infinity });
      return null;
    }
    const payload = {
      id: q.id,
      title: q.title,
      body_latex: q.body,
      type: q.type,
      correct_answer: q.correctAnswer,
      explanation_latex: q.explanation,
      grade_level: q.gradeLevel,
      topic_id: q.topicId && /^[0-9a-f]{8}-/i.test(q.topicId) ? q.topicId : null,
      difficulty: q.difficulty,
      status: q.status,
      author_id: user.id,
      tags: q.tags,
    };

    const saveRow = isNew
      ? await withRetry(() => supabase.from("questions").insert(payload).select("*").single() as any)
      : await withRetry(() => supabase.from("questions").update(payload).eq("id", q.id).select("*").single() as any);

    if (saveRow.error) {
      const msg = errorMessage(saveRow.error);
      console.error(isNew ? "[questions] DB insert failure" : "[questions] DB update failure", { questionId: q.id, error: msg });
      toast.error((isNew ? "บันทึกข้อสอบลงฐานข้อมูลไม่สำเร็จ: " : "อัปเดตข้อสอบไม่สำเร็จ: ") + msg, { duration: Infinity });
      return null;
    }

    const saved = mapDbQuestion(saveRow.data, q.choices);
    const choicesError = await replaceQuestionChoices({ ...saved, choices: q.choices, correctAnswer: q.correctAnswer, type: q.type });
    if (choicesError) {
      const msg = errorMessage(choicesError);
      console.error("[questions] DB choices save failure", { questionId: saved.id, error: msg });
      if (isNew) await supabase.from("questions").delete().eq("id", saved.id);
      toast.error("บันทึกตัวเลือกข้อสอบไม่สำเร็จ: " + msg, { duration: Infinity });
      return null;
    }

    console.info(isNew ? "[questions] DB insert success" : "[questions] DB update success", { questionId: saved.id, status: saved.status });
    setQuestions((p) => isNew ? [saved, ...p.filter((x) => x.id !== saved.id)] : p.map((x) => (x.id === saved.id ? saved : x)));
    setIsBackendConnected(true);
    return saved;
  };

  const value = useMemo<StoreCtx>(() => ({
    currentUser, setCurrentUserId, users, classes, topics, questions, exams, attempts, audit, school, setSchool,
    isBackendConnected,
    refreshQuestions,
    addQuestion: async (q) => {
      const newId = /^[0-9a-f]{8}-/i.test(q.id) ? q.id : crypto.randomUUID();
      const fixed = { ...q, id: newId, authorId: user?.id ?? q.authorId };
      return persistQuestion(fixed, true);
    },
    updateQuestion: async (q) => persistQuestion({ ...q, authorId: user?.id ?? q.authorId }, false),
    deleteQuestion: async (id) => {
      if (/^[0-9a-f]{8}-/i.test(id)) {
        const res = await withRetry(() => supabase.from("questions").delete().eq("id", id) as any);
        if (res.error) {
          toast.error("ลบข้อสอบไม่สำเร็จ: " + errorMessage(res.error), { duration: Infinity });
          return;
        }
      }
      setQuestions((p) => p.filter((x) => x.id !== id));
    },
    bulkUpdateQuestionStatus: async (ids, status) => {
      const dbIds = ids.filter((id) => /^[0-9a-f]{8}-/i.test(id));
      if (dbIds.length > 0) {
        const res = await withRetry(() => supabase.from("questions").update({ status }).in("id", dbIds) as any);
        if (res.error) {
          toast.error("อัปเดตสถานะข้อสอบไม่สำเร็จ: " + errorMessage(res.error), { duration: Infinity });
          return;
        }
      }
      const ts = new Date().toISOString();
      setQuestions((p) => p.map((x) => (ids.includes(x.id) ? { ...x, status, updatedAt: ts } : x)));
    },
    addExam: (e) => setExams((p) => [e, ...p.filter((x) => x.id !== e.id)]),
    updateExam: (e) => setExams((p) => p.map((x) => (x.id === e.id ? e : x))),
    saveAttempt: (a) => setAttempts((p) => {
      const exists = p.some((x) => x.id === a.id);
      return exists ? p.map((x) => (x.id === a.id ? a : x)) : [a, ...p];
    }),
    setUserRole: (id, role) => setUsers((p) => p.map((u) => (u.id === id ? { ...u, role } : u))),
    addUser: (u) => setUsers((p) => [...p, u]),
    deleteUser: (id) => setUsers((p) => p.filter((u) => u.id !== id)),
    addTopic: (t) => setTopics((p) => [...p, t]),
    deleteTopic: (id) => setTopics((p) => p.filter((t) => t.id !== id)),
    logAudit,
  }), [currentUser, users, classes, topics, questions, exams, attempts, audit, school, logAudit, isBackendConnected, user, refreshQuestions]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be inside StoreProvider");
  return c;
}

export const roleLabel: Record<Role, string> = {
  admin: "ผู้ดูแลระบบ",
  teacher: "ครู",
  student: "นักเรียน",
};
