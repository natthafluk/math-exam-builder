import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen, ClipboardList, Users, TrendingUp, Plus, ArrowRight,
  GraduationCap, Clock, ShieldCheck, UserCog, GraduationCap as GradIcon,
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
  const { users, questions, exams, attempts } = useStore();
  return (
    <AppLayout title="แดชบอร์ดผู้ดูแลระบบ">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Users} label="ผู้ใช้ทั้งหมด" value={users.length} hint="ครู นักเรียน และผู้ดูแล" />
        <Stat icon={BookOpen} label="ข้อในคลัง" value={questions.length} tone="accent" />
        <Stat icon={ClipboardList} label="ชุดข้อสอบ" value={exams.length} tone="success" />
        <Stat icon={TrendingUp} label="การทำข้อสอบ" value={attempts.length} tone="warning" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">สรุปบทบาทผู้ใช้</h3>
          <div className="space-y-2">
            {(["admin", "teacher", "student"] as const).map((r) => {
              const c = users.filter((u) => u.role === r).length;
              const pct = (c / users.length) * 100;
              return (
                <div key={r}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize">
                      {r === "admin" ? "ผู้ดูแลระบบ" : r === "teacher" ? "ครู" : "นักเรียน"}
                    </span>
                    <span className="text-muted-foreground">{c} คน</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-3">ข้อสอบใหม่ล่าสุด</h3>
          <ul className="divide-y divide-border">
            {exams.slice(0, 5).map((e) => (
              <li key={e.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{e.questions.length} ข้อ • {e.timeLimitMinutes} นาที</div>
                </div>
                <span className="chip bg-primary-soft text-primary">{e.status}</span>
              </li>
            ))}
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
