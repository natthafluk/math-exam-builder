import { createContext, useContext, useMemo, useState, ReactNode, useCallback, useEffect } from "react";
import type { Attempt, ClassRoom, Exam, Question, Role, Topic, User, AuditEntry, SchoolSettings } from "./types";
import {
  seedAttempts, seedClasses, seedExams, seedQuestions, seedTopics, seedAudit, seedSchool,
} from "./seed";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

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
  addQuestion: (q: Question) => void;
  updateQuestion: (q: Question) => void;
  deleteQuestion: (id: string) => void;
  bulkUpdateQuestionStatus: (ids: string[], status: Question["status"]) => void;
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

// Map DB question row → app Question shape
function mapDbQuestion(row: any): Question {
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
    choices: undefined,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();

  // Real users come from Supabase profiles via useAuth(); seed users were demo data only.
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

  // Hydrate topics + questions from Supabase when authenticated
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [tRes, qRes] = await Promise.all([
        supabase.from("topics").select("id, title, grade_level, parent_topic_id"),
        supabase.from("questions").select("*").order("updated_at", { ascending: false }),
      ]);
      if (cancelled) return;
      if (tRes.data && tRes.data.length > 0) {
        setTopics(tRes.data.map((r: any) => ({
          id: r.id, title: r.title, gradeLevel: r.grade_level, parentId: r.parent_topic_id ?? undefined,
        })));
      }
      if (qRes.data) {
        // merge: prepend DB questions; keep seed for other pages that reference seed IDs
        const dbQs = qRes.data.map(mapDbQuestion);
        const dbIds = new Set(dbQs.map((x) => x.id));
        setQuestions([...dbQs, ...seedQuestions.filter((s) => !dbIds.has(s.id))]);
      }
      setIsBackendConnected(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Build a User object from the real profile so the rest of the app works unchanged
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

  const persistQuestion = async (q: Question, isNew: boolean) => {
    if (!user) return;
    const payload = {
      id: q.id,
      title: q.title,
      body_latex: q.body,
      type: q.type,
      correct_answer: q.correctAnswer,
      explanation_latex: q.explanation,
      grade_level: q.gradeLevel,
      topic_id: q.topicId && q.topicId.length === 36 ? q.topicId : null,
      difficulty: q.difficulty,
      status: q.status,
      author_id: user.id,
      tags: q.tags,
    };
    if (isNew) {
      const { error } = await supabase.from("questions").insert(payload);
      if (error) console.warn("Insert question failed:", error.message);
    } else {
      const { error } = await supabase.from("questions").update(payload).eq("id", q.id);
      if (error) console.warn("Update question failed:", error.message);
    }
  };

  const value = useMemo<StoreCtx>(() => ({
    currentUser, setCurrentUserId, users, classes, topics, questions, exams, attempts, audit, school, setSchool,
    isBackendConnected,
    addQuestion: (q) => {
      // give DB-compatible UUID id if needed
      const newId = /^[0-9a-f]{8}-/.test(q.id) ? q.id : crypto.randomUUID();
      const fixed = { ...q, id: newId, authorId: user?.id ?? q.authorId };
      setQuestions((p) => [fixed, ...p]);
      persistQuestion(fixed, true);
    },
    updateQuestion: (q) => {
      setQuestions((p) => p.map((x) => (x.id === q.id ? q : x)));
      // Only persist UUID-shaped IDs (skip seed mock IDs like "q-1")
      if (/^[0-9a-f]{8}-/.test(q.id)) persistQuestion(q, false);
    },
    deleteQuestion: (id) => {
      setQuestions((p) => p.filter((x) => x.id !== id));
      if (/^[0-9a-f]{8}-/.test(id)) supabase.from("questions").delete().eq("id", id);
    },
    bulkUpdateQuestionStatus: (ids, status) => {
      const ts = new Date().toISOString();
      setQuestions((p) => p.map((x) => (ids.includes(x.id) ? { ...x, status, updatedAt: ts } : x)));
      const dbIds = ids.filter((id) => /^[0-9a-f]{8}-/.test(id));
      if (dbIds.length > 0) supabase.from("questions").update({ status }).in("id", dbIds);
    },
    addExam: (e) => setExams((p) => [e, ...p]),
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
  }), [currentUser, users, classes, topics, questions, exams, attempts, audit, school, logAudit, isBackendConnected, user]);

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
