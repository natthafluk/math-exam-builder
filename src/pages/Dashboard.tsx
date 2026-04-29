import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen, ClipboardList, Users, TrendingUp, Plus, ArrowRight,
  GraduationCap, Clock, ShieldCheck, UserCog,
} from "lucide-react";
import { MathRender } from "@/components/MathRender";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { currentUser } = useStore();
  if (currentUser.role === "admin") return <AdminDash />;
  if (currentUser.role === "teacher") return <TeacherDash />;
  return <StudentDash />;
}

function Stat({ icon: Icon, label, value, hint, tone = "primary" }: any) {
  const toneCls: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    accent: "bg-accent-soft text-accent",
    success: "bg-emerald-50 text-success",
    warning: "bg-amber-50 text-warning",
  };
  return (
    <Card className="p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-md flex items-center justify-center ${toneCls[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-0.5">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </div>
    </Card>
  );
}

function AdminDash() {
  const [stats, setStats] = useState<{
    admins: number; teachers: number; students: number;
    questions: number; exams: number; attempts: number; classes: number;
  } | null>(null);
  const [recentExams, setRecentExams] = useState<Array<{ id: string; title: string; status: string; time_limit_minutes: number }>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const opts = { count: "exact" as const, head: true };
      const [aRes, tRes, sRes, qRes, eRes, atRes, cRes, exList] = await Promise.all([
        supabase.from("profiles").select("id", opts).eq("role", "admin"),
        supabase.from("profiles").select("id", opts).eq("role", "teacher"),
        supabase.from("class_students").select("id", opts),
        supabase.from("questions").select("id", opts),
        supabase.from("exams").select("id", opts),
        supabase.from("attempts").select("id", opts),
        supabase.from("classes").select("id", opts),
        supabase.from("exams").select("id, title, status, time_limit_minutes").order("created_at", { ascending: false }).limit(5),
      ]);
      if (cancelled) return;
      setStats({
        admins: aRes.count ?? 0,
        teachers: tRes.count ?? 0,
        students: sRes.count ?? 0,
        questions: qRes.count ?? 0,
        exams: eRes.count ?? 0,
        attempts: atRes.count ?? 0,
        classes: cRes.count ?? 0,
      });
      setRecentExams((exList.data ?? []) as any);
    })();
    return () => { cancelled = true; };
  }, []);

  const totalUsers = stats ? stats.admins + stats.teachers + stats.students : 0;

  return (
    <AppLayout title="Dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Users} label="ผู้ใช้ทั้งหมด" value={totalUsers} hint="ผู้ดูแล + ครู + นักเรียน" />
        <Stat icon={BookOpen} label="ข้อสอบในคลัง" value={stats?.questions ?? 0} tone="accent" />
        <Stat icon={ClipboardList} label="ชุดข้อสอบ" value={stats?.exams ?? 0} tone="success" />
        <Stat icon={TrendingUp} label="การทำข้อสอบ" value={stats?.attempts ?? 0} tone="warning" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <Stat icon={ShieldCheck} label="ผู้ดูแลระบบ" value={stats?.admins ?? 0} tone="primary" />
        <Stat icon={UserCog} label="ครู" value={stats?.teachers ?? 0} tone="accent" />
        <Stat icon={GraduationCap} label="นักเรียน" value={stats?.students ?? 0} tone="success" />
      </div>

      <div className="mt-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">ข้อสอบใหม่ล่าสุด</h3>
          <ul className="divide-y divide-border">
            {recentExams.map((e) => (
              <li key={e.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{e.time_limit_minutes} นาที</div>
                </div>
                <span className="chip bg-primary-soft text-primary">{e.status}</span>
              </li>
            ))}
            {recentExams.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อสอบ</li>
            )}
          </ul>
        </Card>
      </div>
    </AppLayout>
  );
}

function TeacherDash() {
  const navigate = useNavigate();
  const { currentUser, questions, exams, attempts, classes } = useStore();
  const myQs = questions.filter((q) => q.authorId === currentUser.id);
  const myExams = exams.filter((e) => e.teacherId === currentUser.id);
  const myClasses = classes.filter((c) => c.teacherId === currentUser.id);
  const recentAttempts = attempts.slice(0, 5);

  return (
    <AppLayout
      title={`สวัสดี ${currentUser.name.split(" ")[0]} 👋`}
      actions={
        <Button onClick={() => navigate("/questions/new")} className="gap-1.5">
          <Plus className="w-4 h-4" /> สร้างข้อใหม่
        </Button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={BookOpen} label="ข้อสอบของฉัน" value={myQs.length} hint="ในคลังของคุณ" />
        <Stat icon={ClipboardList} label="ชุดข้อสอบ" value={myExams.length} tone="accent" />
        <Stat icon={GraduationCap} label="ห้องเรียน" value={myClasses.length} tone="success" />
        <Stat icon={TrendingUp} label="ค่าเฉลี่ย" value={`${avgPct(attempts)}%`} tone="warning" hint="คะแนนเฉลี่ยรวม" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">ข้อล่าสุดในคลัง</h3>
            <Link to="/questions" className="text-sm text-primary hover:underline flex items-center gap-1">
              ดูทั้งหมด <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {myQs.slice(0, 5).map((q) => (
              <li key={q.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{q.title}</div>
                    <div className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                      <MathRender text={q.body} />
                    </div>
                  </div>
                  <span className="chip bg-muted text-muted-foreground shrink-0">{q.gradeLevel}</span>
                </div>
              </li>
            ))}
            {myQs.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อสอบ — เริ่มสร้างได้เลย</li>
            )}
          </ul>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-3">การส่งข้อสอบล่าสุด</h3>
          <ul className="space-y-3">
            {recentAttempts.map((a) => {
              const exam = exams.find((e) => e.id === a.examId);
              return (
                <li key={a.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium line-clamp-1">{exam?.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> เพิ่งส่ง
                    </div>
                  </div>
                  <span className="chip bg-success/10 text-success">{a.score}/{a.maxScore}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </AppLayout>
  );
}

function StudentDash() {
  const { currentUser, exams, attempts } = useStore();
  const myExams = exams.filter((e) => e.classIds.includes(currentUser.classId ?? ""));
  const myAttempts = attempts.filter((a) => a.studentId === currentUser.id);
  return (
    <AppLayout title={`ยินดีต้อนรับ ${currentUser.name}`}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat icon={ClipboardList} label="ข้อสอบที่ต้องทำ" value={myExams.length - myAttempts.length} />
        <Stat icon={GraduationCap} label="ทำเสร็จแล้ว" value={myAttempts.length} tone="success" />
        <Stat icon={TrendingUp} label="คะแนนเฉลี่ย" value={`${avgPct(myAttempts)}%`} tone="accent" />
      </div>

      <Card className="p-5 mt-6">
        <h3 className="font-semibold mb-3">ข้อสอบที่มอบหมาย</h3>
        <ul className="divide-y divide-border">
          {myExams.map((e) => {
            const done = myAttempts.find((a) => a.examId === e.id);
            return (
              <li key={e.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {e.questions.length} ข้อ • {e.timeLimitMinutes} นาที • กำหนดส่ง{" "}
                    {new Date(e.dueDate).toLocaleDateString("th-TH")}
                  </div>
                </div>
                {done ? (
                  <Link to="/student/results" className="chip bg-success/10 text-success">
                    เสร็จ • {done.score}/{done.maxScore}
                  </Link>
                ) : (
                  <Button asChild size="sm">
                    <Link to={`/student/take/${e.id}`}>เริ่มทำ</Link>
                  </Button>
                )}
              </li>
            );
          })}
          {myExams.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อสอบที่ได้รับมอบหมาย</li>
          )}
        </ul>
      </Card>
    </AppLayout>
  );
}

function avgPct(attempts: any[]) {
  const valid = attempts.filter((a) => a.maxScore > 0);
  if (!valid.length) return 0;
  return Math.round(
    (valid.reduce((s, a) => s + a.score / a.maxScore, 0) / valid.length) * 100
  );
}
