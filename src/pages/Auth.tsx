import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Sigma, Loader2, UserCog, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useStudentSession, StudentSession } from "@/lib/studentSession";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TEST_ACCOUNTS = [
  { email: "admin@example.com", password: "123456", full_name: "ผู้ดูแลระบบ", role: "admin" as const },
  { email: "teacher@example.com", password: "123456", full_name: "ครูสมหญิง", role: "teacher" as const },
  { email: "student@example.com", password: "123456", full_name: "นักเรียนสมชาย", role: "student" as const },
];

type SeedResult = {
  email: string;
  role: "admin" | "teacher" | "student";
  status: "created" | "already_exists" | "failed";
  message: string;
};

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
type StaffMode = "login" | "signup";

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
  const [seeding, setSeeding] = useState(false);
  const [seedResults, setSeedResults] = useState<SeedResult[]>([]);

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
    if (password.length < 6) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
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

  const quickLogin = async (e: string, p: string) => {
    setEmail(e); setPassword(p);
    setBusy(true);
    const { error } = await signIn(e, p);
    setBusy(false);
    if (error) toast.error("กรุณากด 'สร้างบัญชีทดสอบ' ก่อน หากยังไม่ได้สร้าง");
    else nav("/", { replace: true });
  };

  const seedTestAccounts = async () => {
    setSeeding(true);
    setSeedResults([]);
    const { data, error } = await supabase.functions.invoke<{ results: SeedResult[] }>("seed-demo-users", {
      method: "POST",
    });
    setSeeding(false);

    if (error || !data?.results) {
      const message = error?.message ?? "ไม่ได้รับผลลัพธ์จากตัวช่วยสร้างบัญชี";
      setSeedResults(TEST_ACCOUNTS.map((acc) => ({ ...acc, status: "failed", message })));
      toast.error("สร้างบัญชีทดสอบไม่สำเร็จ: " + message);
      return;
    }

    setSeedResults(data.results);
    const failed = data.results.filter((result) => result.status === "failed").length;
    const created = data.results.filter((result) => result.status === "created").length;
    const existed = data.results.filter((result) => result.status === "already_exists").length;
    if (failed) toast.error(`สร้างบัญชีทดสอบบางรายการไม่สำเร็จ (${failed} รายการ)`);
    else toast.success(`บัญชีทดสอบพร้อมใช้งาน (ใหม่ ${created} / มีอยู่แล้ว ${existed})`);
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
                    <Label htmlFor="password">รหัสผ่าน {staffMode === "signup" && <span className="text-muted-foreground text-xs">(อย่างน้อย 6 ตัว)</span>}</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {staffMode === "login" ? "เข้าสู่ระบบ" : "สมัครและรออนุมัติ"}
                  </Button>
                  {staffMode === "signup" && (
                    <p className="text-[11px] text-muted-foreground text-center">
                      บัญชีจะใช้งานได้หลังจากผู้ดูแลระบบอนุมัติเท่านั้น
                    </p>
                  )}
                </form>
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

        {tab === "staff" && (
          <Card className="p-5 space-y-3 border-dashed">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserCog className="w-4 h-4 text-accent" />
              บัญชีทดสอบ (สำหรับ QA)
            </div>
            <Button onClick={seedTestAccounts} variant="outline" className="w-full" disabled={seeding}>
              {seeding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              สร้างบัญชีทดสอบทั้งหมด (ครั้งแรกเท่านั้น)
            </Button>
            <div className="grid gap-1.5">
              {TEST_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => quickLogin(a.email, a.password)}
                  disabled={busy}
                  className="flex items-center justify-between text-left px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-xs transition-colors"
                >
                  <span className="font-mono">{a.email}</span>
                  <span className="chip bg-primary-soft text-primary">
                    {a.role === "admin" ? "ผู้ดูแล" : a.role === "teacher" ? "ครู" : "นักเรียน"}
                  </span>
                </button>
              ))}
            </div>
            {seedResults.length > 0 ? (
              <div className="space-y-1.5 rounded-md border bg-muted/30 p-3 text-xs">
                {seedResults.map((result) => (
                  <div key={result.email} className="flex items-start justify-between gap-3">
                    <span className="font-mono text-foreground">{result.email}</span>
                    <span className={result.status === "failed" ? "text-destructive text-right" : "text-muted-foreground text-right"}>
                      {result.status === "created" ? "สร้างใหม่" : result.status === "already_exists" ? "มีอยู่แล้ว" : "ล้มเหลว"}: {result.message}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              รหัสผ่านสำหรับทุกบัญชี: <span className="font-mono">123456</span>
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
