import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "./types";
import { toast } from "sonner";

interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  role: Role;
  avatar_initials: string | null;
  avatar_color: string | null;
  approval_status?: string;
  is_super_admin?: boolean;
  requested_role?: Role | null;
}

interface ProfileLoadStatus {
  state: "idle" | "loading" | "ok" | "missing" | "error" | "stale";
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

const PROFILE_COLUMNS = "id, full_name, email, role, avatar_initials, avatar_color, approval_status, is_super_admin, requested_role";
const PROFILE_CACHE_KEY = "mathbank.profile.";
const profileMemoryCache = new Map<string, Profile>();
const transientProfileError = (message: string) =>
  /schema cache|database client|retrying|recovery mode|connection error|failed to fetch|aborted|timeout|ใช้เวลานาน/i.test(message);
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const buildFallbackProfile = (u: User): Profile => {
  const email = u.email ?? null;
  const fullName = u.user_metadata?.full_name || email?.split("@")[0] || "ผู้ใช้งาน";
  return {
    id: u.id,
    full_name: fullName,
    email,
    role: "teacher",
    requested_role: "teacher",
    avatar_initials: fullName.slice(0, 1).toUpperCase(),
    avatar_color: "bg-primary",
    approval_status: "approved",
    is_super_admin: false,
  };
};

const profileQueryWithTimeout = async (uid: string, timeoutMs = 1600) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", uid)
      .maybeSingle()
      .abortSignal(controller.signal);
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const readCachedProfile = (uid: string): Profile | null => {
  const memory = profileMemoryCache.get(uid);
  if (memory) return memory;
  try {
    const stored = window.localStorage.getItem(PROFILE_CACHE_KEY + uid);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Profile;
    if (parsed?.id !== uid) return null;
    profileMemoryCache.set(uid, parsed);
    return parsed;
  } catch {
    return null;
  }
};

const writeCachedProfile = (profile: Profile) => {
  profileMemoryCache.set(profile.id, profile);
  try {
    window.localStorage.setItem(PROFILE_CACHE_KEY + profile.id, JSON.stringify(profile));
  } catch {
    // Storage may be unavailable in private browsing; memory cache is still enough for this session.
  }
};

const clearCachedProfile = (uid?: string) => {
  if (!uid) return;
  profileMemoryCache.delete(uid);
  try { window.localStorage.removeItem(PROFILE_CACHE_KEY + uid); } catch { /* noop */ }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState<ProfileLoadStatus>({ state: "idle" });
  const profileRequestRef = useRef<Promise<void> | null>(null);

  const loadProfile = useCallback(async (uid: string, authUser?: User) => {
    const cached = readCachedProfile(uid);
    if (cached) setProfile(cached);
    setProfileStatus({ state: "loading", message: cached ? "กำลังอัปเดตโปรไฟล์อีกครั้ง" : "กำลังโหลดโปรไฟล์" });

    const deadline = Date.now() + (cached ? 2_500 : 4_500);
    let attempt = 0;

    let lastMessage = "ระบบเชื่อมต่อฐานข้อมูลไม่สำเร็จชั่วคราว";
    while (Date.now() < deadline) {
      attempt += 1;
      try {
        const { data, error } = await profileQueryWithTimeout(uid, cached ? 1200 : 1600);
        if (error) throw new Error(error.message);
        if (!data) {
          setProfile(null);
          setProfileStatus({ state: "missing", message: "ยังไม่พบโปรไฟล์ที่ตรงกับบัญชีนี้" });
          return;
        }
        const nextProfile = data as Profile;
        setProfile(nextProfile);
        writeCachedProfile(nextProfile);
        setProfileStatus({ state: "ok", message: "โหลดโปรไฟล์สำเร็จ" });
        return;
      } catch (e) {
        lastMessage = e instanceof Error ? e.message : String(e);
        if (!transientProfileError(lastMessage)) break;
        setProfileStatus({ state: "loading", message: `ฐานข้อมูลกำลังพร้อมใช้งาน กำลังลองใหม่ครั้งที่ ${attempt + 1}` });
        await wait(Math.min(700, 250 * attempt));
      }
    }

    if (cached && transientProfileError(lastMessage)) {
      setProfile(cached);
      setProfileStatus({ state: "stale", message: "ใช้ข้อมูลบัญชีที่โหลดไว้ล่าสุดชั่วคราว เพราะฐานข้อมูลตอบกลับช้า" });
      toast.warning("โหลดโปรไฟล์สดไม่สำเร็จชั่วคราว ระบบใช้ข้อมูลบัญชีล่าสุดให้ก่อน");
      return;
    }
    if (authUser && transientProfileError(lastMessage)) {
      const fallback = buildFallbackProfile(authUser);
      setProfile(fallback);
      setProfileStatus({ state: "stale", message: "เปิดหน้าให้ใช้งานก่อน เพราะฐานข้อมูลตอบกลับช้า" });
      return;
    }
    setProfile(null);
    setProfileStatus({ state: "error", message: `โหลดโปรไฟล์ไม่สำเร็จ: ${lastMessage}` });
  }, []);

  useEffect(() => {
    let mounted = true;
    const applySession = (s: Session | null) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        if (!profileRequestRef.current) {
          profileRequestRef.current = loadProfile(s.user.id).finally(() => {
            profileRequestRef.current = null;
          });
        }
        profileRequestRef.current.finally(() => mounted && setLoading(false));
      } else {
        setProfile(null);
        setProfileStatus({ state: "idle" });
        setLoading(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setTimeout(() => applySession(s), 0);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      applySession(s);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const repairProfile = useCallback(async (): Promise<{ error: string | null }> => {
    if (!user) return { error: "ยังไม่ได้เข้าสู่ระบบ" };
    setProfileStatus({ state: "loading", message: "กำลังสร้างโปรไฟล์" });

    const fullName = user.user_metadata?.full_name || user.email?.split("@")[0] || "ผู้ใช้งาน";
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? null,
      full_name: fullName,
      role: "teacher",
      requested_role: "teacher",
      avatar_initials: fullName.slice(0, 1).toUpperCase(),
      avatar_color: "bg-primary",
      approval_status: "pending",
    });

    if (error && error.code !== "23505") {
      setProfileStatus({ state: "error", message: `สร้างโปรไฟล์ไม่สำเร็จ: ${error.message}` });
      return { error: error.message };
    }

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
      clearCachedProfile(user?.id);
      setProfile(null);
      setProfileStatus({ state: "idle" });
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
