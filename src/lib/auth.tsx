import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "./types";

interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  role: Role;
  avatar_initials: string | null;
  avatar_color: string | null;
}

interface ProfileLoadStatus {
  state: "idle" | "loading" | "ok" | "missing" | "error";
  message?: string;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileStatus: ProfileLoadStatus;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  repairProfile: () => Promise<{ error: string | null }>;
}

const Ctx = createContext<AuthCtx | null>(null);

const ROLE_BY_EMAIL: Record<string, { role: Role; full_name: string; avatar_color: string }> = {
  "admin@example.com": { role: "admin", full_name: "ผู้ดูแลระบบ", avatar_color: "bg-destructive" },
  "teacher@example.com": { role: "teacher", full_name: "ครูสมหญิง", avatar_color: "bg-primary" },
  "student@example.com": { role: "student", full_name: "นักเรียนสมชาย", avatar_color: "bg-accent" },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState<ProfileLoadStatus>({ state: "idle" });

  const loadProfile = useCallback(async (uid: string) => {
    setProfileStatus({ state: "loading", message: `กำลังค้นหาโปรไฟล์สำหรับ id=${uid}` });
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, avatar_initials, avatar_color")
        .eq("id", uid)
        .maybeSingle();
      if (error) {
        setProfile(null);
        setProfileStatus({ state: "error", message: `ผิดพลาดขณะค้นหาโปรไฟล์: ${error.message}` });
        return;
      }
      if (!data) {
        setProfile(null);
        setProfileStatus({ state: "missing", message: "ไม่พบแถวโปรไฟล์ที่ตรงกับบัญชีนี้" });
        return;
      }
      setProfile(data as Profile);
      setProfileStatus({ state: "ok", message: "โหลดโปรไฟล์สำเร็จ" });
    } catch (e) {
      setProfile(null);
      setProfileStatus({ state: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          loadProfile(s.user.id).finally(() => mounted && setLoading(false));
        }, 0);
      } else {
        setProfile(null);
        setProfileStatus({ state: "idle" });
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id).finally(() => mounted && setLoading(false));
      else setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const repairProfile = useCallback(async (): Promise<{ error: string | null }> => {
    if (!user) return { error: "ยังไม่ได้เข้าสู่ระบบ" };
    const email = (user.email ?? "").toLowerCase();
    const mapped = ROLE_BY_EMAIL[email];
    const full_name = mapped?.full_name ?? user.user_metadata?.full_name ?? email.split("@")[0] ?? "ผู้ใช้งาน";
    const role: Role = mapped?.role ?? (user.user_metadata?.role as Role) ?? "student";
    const avatar_color = mapped?.avatar_color ?? (role === "admin" ? "bg-destructive" : role === "teacher" ? "bg-primary" : "bg-accent");
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      email,
      full_name,
      role,
      avatar_initials: full_name.slice(0, 1).toUpperCase(),
      avatar_color,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (error) return { error: error.message };
    await loadProfile(user.id);
    return { error: null };
  }, [user, loadProfile]);

  const value: AuthCtx = {
    session,
    user,
    profile,
    loading,
    profileStatus,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshProfile: async () => {
      if (user) await loadProfile(user.id);
    },
    repairProfile,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
