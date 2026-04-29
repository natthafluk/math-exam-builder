import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Sigma, Loader2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useStudentSession, StudentSession } from "@/lib/studentSession";
import { toast } from "sonner";

interface EnrollmentRow {
  enrollment_id: string;
  class_id: string;
  class_name: string;
  grade_level: string;
  subject_code: string;
  teacher_name: string;
  full_name: string;
}

export default function StudentLogin() {
  const { session, setSession } = useStudentSession();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<EnrollmentRow[] | null>(null);

  if (session) return <Navigate to="/student/exams" replace />;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("student_find_enrollments", { _code: c });
    setBusy(false);
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
      enter(rows[0]);
      return;
    }
    setMatches(rows);
  };

  const enter = (row: EnrollmentRow) => {
    const s: StudentSession = { ...row, student_code: code.trim() };
    setSession(s);
    toast.success(`ยินดีต้อนรับ ${row.full_name}`);
    nav("/student/exams", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-accent/10 via-background to-primary/5">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-xl bg-accent items-center justify-center text-accent-foreground mx-auto">
            <Sigma className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold">MathBank Studio</h1>
          <p className="text-sm text-muted-foreground">นักเรียน — กรอกเลขประจำตัวเพื่อเข้าทำข้อสอบ</p>
        </div>

        {!matches ? (
          <Card className="p-6 space-y-4">
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">เลขประจำตัวนักเรียน</Label>
                <Input id="code" autoFocus required value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น 12345" />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <GraduationCap className="w-4 h-4 mr-2" />}
                เข้าสู่ระบบนักเรียน
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground text-center">
              ครูผู้สอนเป็นผู้นำเข้าเลขประจำตัวของคุณตอนสร้างห้องเรียน
            </p>
          </Card>
        ) : (
          <Card className="p-6 space-y-3">
            <div className="text-sm font-medium">พบหลายห้องเรียนสำหรับเลข <span className="font-mono">{code}</span> กรุณาเลือก:</div>
            <div className="space-y-2">
              {matches.map((m) => (
                <button
                  key={m.enrollment_id}
                  onClick={() => enter(m)}
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
          </Card>
        )}

        <div className="text-center">
          <Button variant="link" size="sm" onClick={() => nav("/auth")}>ฉันเป็นครู/ผู้ดูแล (ล็อกอินด้วยอีเมล)</Button>
        </div>
      </div>
    </div>
  );
}
