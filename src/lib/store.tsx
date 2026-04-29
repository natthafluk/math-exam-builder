import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import type { Attempt, ClassRoom, Exam, Question, Role, Topic, User } from "./types";
import {
  seedAttempts, seedClasses, seedExams, seedQuestions, seedTopics, seedUsers,
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
  addQuestion: (q: Question) => void;
  updateQuestion: (q: Question) => void;
  deleteQuestion: (id: string) => void;
  addExam: (e: Exam) => void;
  updateExam: (e: Exam) => void;
  saveAttempt: (a: Attempt) => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [users] = useState<User[]>(seedUsers);
  const [currentUserId, setCurrentUserId] = useState("u-t1");
  const [classes] = useState<ClassRoom[]>(seedClasses);
  const [topics] = useState<Topic[]>(seedTopics);
  const [questions, setQuestions] = useState<Question[]>(seedQuestions);
  const [exams, setExams] = useState<Exam[]>(seedExams);
  const [attempts, setAttempts] = useState<Attempt[]>(seedAttempts);

  const currentUser = users.find((u) => u.id === currentUserId) ?? users[0];

  const value = useMemo<StoreCtx>(() => ({
    currentUser, setCurrentUserId, users, classes, topics, questions, exams, attempts,
    addQuestion: (q) => setQuestions((p) => [q, ...p]),
    updateQuestion: (q) => setQuestions((p) => p.map((x) => (x.id === q.id ? q : x))),
    deleteQuestion: (id) => setQuestions((p) => p.filter((x) => x.id !== id)),
    addExam: (e) => setExams((p) => [e, ...p]),
    updateExam: (e) => setExams((p) => p.map((x) => (x.id === e.id ? e : x))),
    saveAttempt: (a) => setAttempts((p) => {
      const exists = p.some((x) => x.id === a.id);
      return exists ? p.map((x) => (x.id === a.id ? a : x)) : [a, ...p];
    }),
  }), [currentUser, users, classes, topics, questions, exams, attempts]);

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
