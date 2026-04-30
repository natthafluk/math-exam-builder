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

const PROFILE_COLUMNS =
  "id, full_name, email, role, avatar_initials, avatar_color, approval_status, is_super_admin, requested_role";
const PROFILE_CACHE_KEY = "mathbank.profile.";
const profileMemoryCache = new Map<string, Profile>();

// Note: we intentionally do NOT build a fallback profile from JWT metadata.
// Doing so previously caused admins/super-admins to appear as "teacher" when the DB was slow.

/** True for errors that are likely transient (network/db hiccup) and worth retrying */
const isTransient = (msg: string) =>
  /schema cache|database client|retrying|recovery mode|connection error|failed to fetch|timeout|ใช้เวลานาน/i.test(msg);

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const profileQuery = (uid: string) =>
  supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", uid).maybeSingle();

const readCachedProfile = (uid: string): Profile | null => {
  const mem = profileMemoryCache.get(uid);
  if (mem) return mem;
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY + uid);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile;
    if (parsed?.id !== uid) return null;
    profileMemoryCache.set(uid, parsed);
    return parsed;
  } catch {
    return null;
  }
};

const writeCachedProfile = (p: Profile) => {
  profileMemoryCache.set(p.id, p);
  try {
    window.localStorage.setItem(PROFILE_CACHE_KEY + p.id, JSON.stringify(p));
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

  // AbortController for the current in-flight profile load.
  // Replaced (and old one aborted) every time a new load starts.
  const abortRef = useRef<AbortController | null>(null);

  const loadProfile = useCallback(async (uid: string): Promise<void> => {
    // Cancel any previous in-flight load — this also causes its retry loop to exit cleanly.
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const cached = readCachedProfile(uid);
    if (cached) setProfile(cached);
    setProfileStatus({
      state: "loading",
      message: cached ? "กำลังอัปเดตโปรไฟล์" : "กำลังโหลดโปรไฟล์",
    });

    let lastMessage = "ระบบเชื่อมต่อฐานข้อมูลไม่สำเร็จชั่วคราว";

    for (let attempt = 1; attempt <= 8; attempt++) {
      // Check before making the request
      if (ctrl.signal.aborted) return;

      try {
        const { data, error } = await profileQuery(uid);

        // Check after awaiting — auth events may have aborted us in the meantime
        if (ctrl.signal.aborted) return;

        if (error) throw new Error(error.message);

        if (!data) {
          setProfile(null);
          setProfileStatus({ state: "missing", message: "ยังไม่พบโปรไฟล์ที่ตรงกับบัญชีนี้" });
          return;
        }

        const next = data as Profile;
        setProfile(next);
        writeCachedProfile(next);
        setProfileStatus({ state: "ok" });
        return;

      } catch (e) {
        lastMessage = e instanceof Error ? e.message : String(e);

        // AbortError means either:
        //   (a) We cancelled it ourselves → ctrl.signal.aborted is true → already checked above.
        //   (b) Supabase aborted the fetch during an internal auth-state reset → treat as transient.
        const shouldRetry = /abort/i.test(lastMessage) || isTransient(lastMessage);
        if (!shouldRetry) break; // Permanent error — stop retrying

        // Final safety check before sleeping
        if (ctrl.signal.aborted) return;

        setProfileStatus({
          state: "loading",
          message: `กำลังลองใหม่ครั้งที่ ${attempt}…`,
        });
        await wait(Math.min(2_000, 400 * attempt));
      }
    }

    // All retries exhausted. Check one more time before updating state.
    if (ctrl.signal.aborted) return;

    const staleCached = readCachedProfile(uid);
    if (staleCached) {
      setProfile(staleCached);
      setProfileStatus({
        state: "stale",
        message: "ใช้ข้อมูลบัญชีที่โหลดไว้ล่าสุดชั่วคราว เพราะฐานข้อมูลตอบกลับช้า",
      });
      toast.warning("โหลดโปรไฟล์สดไม่สำเร็จชั่วคราว ระบบใช้ข้อมูลบัญชีล่าสุดให้ก่อน");
      return;
    }

    // No cache and no successful load — show an error the UI can act on.
    setProfile(null);
    setProfileStatus({ state: "error", message: `โหลดโปรไฟล์ไม่สำเร็จ: ${lastMessage}` });
  }, []);

  useEffect(() => {
    let mounted = true;
    // Prevents getSession() and onAuthStateChange(INITIAL_SESSION) from
    // both triggering a profile load for the exact same initial session.
    let initialHandled = false;

    // FIX: defer loadProfile out of the Supabase callback with setTimeout(0).
    // Supabase aborts any fetch requests made synchronously inside its own
    // onAuthStateChange callback. Deferring with setTimeout lets Supabase finish
    // its internal processing first, so our profile fetch succeeds.
    const handleSession = (s: Session | null, defer = false) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        const uid = s.user.id;
        if (defer) {
          // Defer the actual fetch out of the Supabase callback
          window.setTimeout(() => {
            if (!mounted) return;
            loadProfile(uid).finally(() => {
              if (mounted) setLoading(false);
            });
          }, 0);
        } else {
          loadProfile(uid).finally(() => {
            if (mounted) setLoading(false);
          });
        }
      } else {
        // Signed out — cancel any in-flight load and reset state
        abortRef.current?.abort();
        setProfile(null);
        setProfileStatus({ state: "idle" });
        setLoading(false);
      }
    };

    // Subscribe first so we don't miss any events that fire synchronously
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;

      if (event === "INITIAL_SESSION") {
        // INITIAL_SESSION fires immediately when subscribing with the current session.
        // Only use it if getSession() hasn't already handled the initial state.
        if (!initialHandled) {
          initialHandled = true;
          // INITIAL_SESSION fires inside Supabase's subscribe call — defer to avoid abort
          handleSession(s, true);
        }
        return;
      }

      // All other events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED…)
      // always reflect genuine state changes — handle them unconditionally.
      // Defer profile load so Supabase finishes its internal processing first.
      handleSession(s, true);
    });

    // Fallback: if INITIAL_SESSION somehow never fires (older Supabase versions),
    // getSession() ensures we still bootstrap correctly.
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted || initialHandled) return;
      initialHandled = true;
      // getSession() is called outside Supabase's callback — no defer needed
      handleSession(s, false);
    });

    return () => {
      mounted = false;
      abortRef.current?.abort();
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const repairProfile = useCallback(async (): Promise<{ error: string | null }> => {
    if (!user) return { error: "ยังไม่ได้เข้าสู่ระบบ" };
    setProfileStatus({ state: "loading", message: "กำลังสร้างโปรไฟล์" });

    const fullName =
      user.user_metadata?.full_name || user.email?.split("@")[0] || "ผู้ใช้งาน";
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
      // FIX: Clear state immediately so RequireAuth redirects to /auth right away,
      // without waiting for the SIGNED_OUT event to fire (which can be slow).
      abortRef.current?.abort();
      const uid = user?.id;
      setSession(null);
      setUser(null);
      setProfile(null);
      setProfileStatus({ state: "idle" });
      setLoading(false);
      clearCachedProfile(uid);
      // Fire-and-forget: the actual Supabase session invalidation.
      // SIGNED_OUT event will fire but handleSession will just no-op since user is already null.
      supabase.auth.signOut().catch(() => { /* noop — UI already reset */ });
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
