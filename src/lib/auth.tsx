import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
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

const profileMemoryCache = new Map<string, Profile>();
const transientProfileError = (message: string) =>
  /schema cache|database client|retrying/i.test(message);
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const readCachedProfile = (uid: string): Profile | null => profileMemoryCache.get(uid) ?? null;
const writeCachedProfile = (profile: Profile) => profileMemoryCache.set(profile.id, profile);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState<ProfileLoadStatus>({ state: "idle" });

  const loadProfile = useCallback(async (uid: string) => {
    const cached = readCachedProfile(uid);
    if (cached) setProfile(cached);
    setProfileStatus({ state: "loading", message: cached ? "กำลังอัปเดตโปรไฟล์อีกครั้ง" : "กำลังโหลดโปรไฟล์" });

    let lastMessage = "ระบบเชื่อมต่อฐานข้อมูลไม่สำเร็จชั่วคราว";
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        const { data, error } = await supabase.rpc("get_my_profile");
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
        if (!transientProfileError(lastMessage) || attempt === 5) break;
        setProfileStatus({ state: "loading", message: `ฐานข้อมูลกำลังพร้อมใช้งาน กำลังลองใหม่ครั้งที่ ${attempt + 1}` });
        await wait(350 * attempt);
      }
    }

    if (cached && transientProfileError(lastMessage)) {
      setProfile(cached);
      setProfileStatus({ state: "stale", message: "ใช้ข้อมูลบัญชีที่โหลดไว้ล่าสุดชั่วคราว เพราะฐานข้อมูลตอบกลับช้า" });
      toast.warning("โหลดโปรไฟล์สดไม่สำเร็จชั่วคราว ระบบใช้ข้อมูลบัญชีล่าสุดให้ก่อน");
      return;
    }
    setProfile(null);
    setProfileStatus({ state: "error", message: `ผิดพลาดขณะโหลดโปรไฟล์ผ่าน RPC: ${lastMessage}` });
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
    setProfileStatus({ state: "loading", message: "กำลังซ่อมโปรไฟล์ผ่าน RPC" });
    const { data, error } = await supabase.rpc("repair_my_profile");
    if (error) {
      setProfileStatus({ state: "error", message: `ซ่อมโปรไฟล์ผ่าน RPC ไม่สำเร็จ: ${error.message}` });
      return { error: error.message };
    }
    if (data) {
      const repaired = data as Profile;
      setProfile(repaired);
      writeCachedProfile(repaired);
      setProfileStatus({ state: "ok", message: "ซ่อมและโหลดโปรไฟล์ผ่าน RPC สำเร็จ" });
    } else {
      await loadProfile(user.id);
    }
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
