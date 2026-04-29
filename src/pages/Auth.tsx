import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Sigma, Loader2, UserCog, GraduationCap, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useStudentSession, StudentSession } from "@/lib/studentSession";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EnrollmentRow {
  enrollment_id: string;
  class_id: string;
  class_name: string;
  grade_level: string;
  subject_code: string;
  teacher_name: string;
  full_name: string;
}

type Tab = "staff" | "student";
type StaffMode = "login" | "signup" | "forgot";

export default function Auth() {
  const { user, signIn, loading } = useAuth();
  const { session: studentSession, setSession: setStudentSession } = useStudentSession();
  const nav = useNavigate();

  const [tab, setTab] = useState<Tab>("staff");
  const [staffMode, setStaffMode] = useState<StaffMode>("login");

  // Staff state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [requestedRole, setRequestedRole] = useState<"teacher" | "admin">("teacher");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Student state
  const [code, setCode] = useState("");
  const [studentBusy, setStudentBusy] = useState(false);
  const [matches, setMatches] = useState<EnrollmentRow[] | null>(null);

  if (!loading && user) return <Navigate to="/" replace />;
  if (studentSession) return <Navigate to="/student/exams" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) toast.error("เข้าสู่ระบบไม่สำเร็จ: " + error);
    else {
      toast.success("ยินดีต้อนรับ");
      nav("/", { replace: true });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error("กรุณากรอกรหัสผ่าน");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("รหัสผ่านและการยืนยันไม่ตรงกัน");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, requested_role: requestedRole },
      },
    });
    if (error) {
      setBusy(false);
      toast.error("สมัครไม่สำเร็จ: " + error.message);
      return;
    }
    await supabase.auth.signOut();
    setBusy(false);
    setSignupDone(true);
    toast.success("สมัครสำเร็จ รอผู้ดูแลอนุมัติ");
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("กรุณากรอกอีเมล");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error("ส่งอีเมลไม่สำเร็จ: " + error.message);
      return;
    }
    setResetSent(true);
    toast.success("ส่งลิงก์เปลี่ยนรหัสผ่านไปยังอีเมลแล้ว");
  };

  const handleStudentSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setStudentBusy(true);
    const { data, error } = await supabase.rpc("student_find_enrollments", { _code: c });
    setStudentBusy(false);
    if (error) {
      toast.error("ค้นหาไม่สำเร็จ: " + error.message);
      return;
    }
    const rows = (data ?? []) as EnrollmentRow[];
    if (rows.length === 0) {
      toast.error("ไม่พบเลขประจำตัวนักเรียนนี้ กรุณาติดต่อครูผู้สอน");
      setMatches(null);
      return;
    }
    if (rows.length === 1) {
      enterStudent(rows[0]);
      return;
    }
    setMatches(rows);
  };

  const enterStudent = (row: EnrollmentRow) => {
    const s: StudentSession = { ...row, student_code: code.trim() };
    setStudentSession(s);
    toast.success(`ยินดีต้อนรับ ${row.full_name}`);
    nav("/student/exams", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-xl bg-accent items-center justify-center text-accent-foreground mx-auto">
            <Sigma className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold">MathBank Studio</h1>
          <p className="text-sm text-muted-foreground">คลังข้อสอบคณิต — เลือกบทบาทเพื่อเข้าใช้งาน</p>
        </div>

        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setTab("staff")}
              aria-pressed={tab === "staff"}
              className={cn(
                "px-3 py-2.5 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-1.5",
                tab === "staff"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              <UserCog className="w-4 h-4" />
              ครู / ผู้ดูแล
            </button>
            <button
              type="button"
              onClick={() => setTab("student")}
              aria-pressed={tab === "student"}
              className={cn(
                "px-3 py-2.5 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-1.5",
                tab === "student"
                  ? "bg-accent text-accent-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              <GraduationCap className="w-4 h-4" />
              นักเรียน
            </button>
          </div>

          {tab === "staff" ? (
            signupDone ? (
              <div className="space-y-3 text-center">
                <div className="rounded-md bg-primary-soft text-primary p-4 text-sm font-medium">
                  ✓ สมัครสำเร็จแล้ว<br />
                  รอผู้ดูแลระบบอนุมัติบัญชีของคุณ
                </div>
                <p className="text-xs text-muted-foreground">เมื่อได้รับการอนุมัติ คุณจะสามารถเข้าสู่ระบบด้วยอีเมลและรหัสผ่านนี้ได้ทันที</p>
                <Button variant="outline" className="w-full" onClick={() => { setSignupDone(false); setStaffMode("login"); }}>
                  กลับไปหน้าเข้าสู่ระบบ
                </Button>
              </div>
            ) : resetSent ? (
              <div className="space-y-3 text-center">
                <div className="rounded-md bg-primary-soft text-primary p-4 text-sm font-medium">
                  ✓ ส่งลิงก์เปลี่ยนรหัสผ่านแล้ว<br />
                  กรุณาตรวจสอบอีเมลของคุณ
                </div>
                <Button variant="outline" className="w-full" onClick={() => { setResetSent(false); setStaffMode("login"); }}>
                  กลับไปหน้าเข้าสู่ระบบ
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-md">
                  <button type="button" onClick={() => setStaffMode("login")}
                    className={cn("py-1.5 text-xs font-medium rounded transition-colors",
                      staffMode === "login" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>
                    เข้าสู่ระบบ
                  </button>
                  <button type="button" onClick={() => setStaffMode("signup")}
                    className={cn("py-1.5 text-xs font-medium rounded transition-colors",
                      staffMode === "signup" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>
                    สมัครสมาชิก
                  </button>
                </div>

                {staffMode === "forgot" ? (
                  <form onSubmit={handleForgot} className="space-y-3">
                    <p className="text-xs text-muted-foreground">กรอกอีเมลของคุณ ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้</p>
                    <div className="space-y-1.5">
                      <Label htmlFor="forgot-email">อีเมล</Label>
                      <Input id="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                    </div>
                    <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy}>
                      {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      ส่งลิงก์เปลี่ยนรหัสผ่าน
                    </Button>
                    <Button type="button" variant="ghost" className="w-full" onClick={() => setStaffMode("login")}>
                      ย้อนกลับ
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={staffMode === "login" ? handleLogin : handleSignup} className="space-y-3">
                    {staffMode === "signup" && (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="fullname">ชื่อ-นามสกุล</Label>
                          <Input id="fullname" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="เช่น สมหญิง ใจดี" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>บทบาทที่ขอ</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setRequestedRole("teacher")}
                              className={cn("py-2 text-sm rounded-md border transition-colors",
                                requestedRole === "teacher" ? "border-primary bg-primary-soft text-primary font-medium" : "border-border text-muted-foreground")}>
                              ครู
                            </button>
                            <button type="button" onClick={() => setRequestedRole("admin")}
                              className={cn("py-2 text-sm rounded-md border transition-colors",
                                requestedRole === "admin" ? "border-destructive bg-destructive/10 text-destructive font-medium" : "border-border text-muted-foreground")}>
                              ผู้ดูแลระบบ
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="email">อีเมล</Label>
                      <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@example.com" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">รหัสผ่าน</Label>
                        {staffMode === "login" && (
                          <button type="button" onClick={() => setStaffMode("forgot")} className="text-xs text-primary hover:underline">
                            ลืมรหัสผ่าน?
                          </button>
                        )}
                      </div>
                      <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
                    </div>
                    {staffMode === "signup" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="confirm-password">ยืนยันรหัสผ่าน</Label>
                        <Input id="confirm-password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••" />
                      </div>
                    )}
                    <Button
                      type="submit"
                      disabled={busy}
                      className={cn(
                        "w-full text-white shadow-md transition-colors",
                        staffMode === "login"
                          ? "bg-primary hover:bg-primary/90"
                          : "bg-accent hover:bg-accent/90"
                      )}
                    >
                      {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : staffMode === "login" ? (
                        <LogIn className="w-4 h-4 mr-2" />
                      ) : (
                        <UserPlus className="w-4 h-4 mr-2" />
                      )}
                      {staffMode === "login" ? "เข้าสู่ระบบ" : "สมัครและรออนุมัติ"}
                    </Button>
                    {staffMode === "signup" && (
                      <p className="text-[11px] text-muted-foreground text-center">
                        บัญชีจะใช้งานได้หลังจากผู้ดูแลระบบอนุมัติเท่านั้น
                      </p>
                    )}
                  </form>
                )}
              </>
            )
          ) : !matches ? (
            <form onSubmit={handleStudentSearch} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">เลขประจำตัวนักเรียน</Label>
                <Input id="code" autoFocus required value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น 12345" />
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={studentBusy}>
                {studentBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <GraduationCap className="w-4 h-4 mr-2" />}
                เข้าสู่ระบบนักเรียน
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                ครูผู้สอนเป็นผู้นำเข้าเลขประจำตัวของคุณตอนสร้างห้องเรียน
              </p>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-medium">พบหลายห้องเรียนสำหรับเลข <span className="font-mono">{code}</span> กรุณาเลือก:</div>
              <div className="space-y-2">
                {matches.map((m) => (
                  <button
                    key={m.enrollment_id}
                    onClick={() => enterStudent(m)}
                    className="w-full text-left p-3 rounded-md border hover:bg-muted transition-colors"
                  >
                    <div className="font-medium">{m.class_name} <span className="text-xs text-muted-foreground font-normal">({m.grade_level})</span></div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      รหัสวิชา: <span className="font-mono">{m.subject_code || "—"}</span> • ครู: {m.teacher_name}
                    </div>
                    <div className="text-xs text-muted-foreground">ชื่อในระบบ: {m.full_name}</div>
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setMatches(null); setCode(""); }}>ค้นหาด้วยเลขอื่น</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
