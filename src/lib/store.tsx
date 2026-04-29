import { createContext, useContext, useMemo, useState, ReactNode, useCallback } from "react";
import type { Attempt, ClassRoom, Exam, Question, Role, Topic, User, AuditEntry, SchoolSettings } from "./types";
import {
  seedAttempts, seedClasses, seedExams, seedQuestions, seedTopics, seedUsers, seedAudit, seedSchool,
} from "./seed";

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
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(seedUsers);
  const [currentUserId, setCurrentUserId] = useState("u-t1");
  const [classes] = useState<ClassRoom[]>(seedClasses);
  const [topics, setTopics] = useState<Topic[]>(seedTopics);
  const [questions, setQuestions] = useState<Question[]>(seedQuestions);
  const [exams, setExams] = useState<Exam[]>(seedExams);
  const [attempts, setAttempts] = useState<Attempt[]>(seedAttempts);
  const [audit, setAudit] = useState<AuditEntry[]>(seedAudit);
  const [school, setSchool] = useState<SchoolSettings>(seedSchool);

  const currentUser = users.find((u) => u.id === currentUserId) ?? users[0];

  const logAudit = useCallback((entry: Omit<AuditEntry, "id" | "at" | "actorId" | "actorName">) => {
    setAudit((p) => [
      { id: `a-${Date.now()}`, at: new Date().toISOString(), actorId: currentUser.id, actorName: currentUser.name, ...entry },
      ...p,
    ].slice(0, 50));
  }, [currentUser]);

  const value = useMemo<StoreCtx>(() => ({
    currentUser, setCurrentUserId, users, classes, topics, questions, exams, attempts, audit, school, setSchool,
    addQuestion: (q) => setQuestions((p) => [q, ...p]),
    updateQuestion: (q) => setQuestions((p) => p.map((x) => (x.id === q.id ? q : x))),
    deleteQuestion: (id) => setQuestions((p) => p.filter((x) => x.id !== id)),
    bulkUpdateQuestionStatus: (ids, status) =>
      setQuestions((p) => p.map((x) => (ids.includes(x.id) ? { ...x, status, updatedAt: new Date().toISOString() } : x))),
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
  }), [currentUser, users, classes, topics, questions, exams, attempts, audit, school, logAudit]);

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
