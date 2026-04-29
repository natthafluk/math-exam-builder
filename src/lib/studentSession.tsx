import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

export interface StudentSession {
  enrollment_id: string;
  class_id: string;
  class_name: string;
  subject_code: string;
  grade_level: string;
  teacher_name: string;
  full_name: string;
  student_code: string;
}

const KEY = "mathbank.studentSession.v1";

interface Ctx {
  session: StudentSession | null;
  setSession: (s: StudentSession | null) => void;
  signOut: () => void;
}
const Ctx = createContext<Ctx | null>(null);

export function StudentSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<StudentSession | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSessionState(JSON.parse(raw));
    } catch {}
  }, []);

  const setSession = useCallback((s: StudentSession | null) => {
    setSessionState(s);
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  }, []);

  const signOut = useCallback(() => {
    setSessionState(null);
    localStorage.removeItem(KEY);
  }, []);

  return <Ctx.Provider value={{ session, setSession, signOut }}>{children}</Ctx.Provider>;
}

export function useStudentSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStudentSession must be inside StudentSessionProvider");
  return c;
}
