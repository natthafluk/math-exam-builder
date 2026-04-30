import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { MathRender } from "@/components/MathRender";
import { ArrowLeft, TrendingUp, Users, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ExamResults() {
  const { id } = useParams();
  const { exams, questions, attempts, users, classes } = useStore();
  const exam = exams.find((e) => e.id === id);

  const examAttempts = useMemo(
    () => attempts.filter((a) => a.examId === id),
    [attempts, id]
  );

  if (!exam) return <AppLayout title="ไม่พบข้อสอบ"><div /></AppLayout>;

  const cls = classes.filter((c) => exam.classIds.includes(c.id));
  const totalStudents = cls.reduce((s, c) => s + c.studentIds.length, 0);
  const completionPct = totalStudents ? Math.round((examAttempts.length / totalStudents) * 100) : 0;
  const avgPct = examAttempts.length
    ? Math.round((examAttempts.reduce((s, a) => s + a.score / a.maxScore, 0) / examAttempts.length) * 100)
    : 0;

  // Item analysis: % correct per question — skip questions deleted from the bank
  const itemAnalysis = exam.questions
    .map((eq) => {
      const q = questions.find((x) => x.id === eq.questionId);
      if (!q) return null;
      const total = examAttempts.length;
      const correct = examAttempts.filter((a) => {
        const ans = (a.answers[eq.questionId] ?? "").trim();
        return ans === q.correctAnswer;
      }).length;
      const pct = total ? Math.round((correct / total) * 100) : 0;
      return { q, pct, correct, total };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <AppLayout
      title={`ผลคะแนน: ${exam.title}`}
      actions={
        <Button asChild variant="outline" className="gap-1.5">
          <Link to="/exams"><ArrowLeft className="w-4 h-4" /> กลับ</Link>
        </Button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="ส่งแล้ว" value={`${examAttempts.length}/${totalStudents}`} hint={`${completionPct}% ของชั้น`} />
        <StatCard icon={TrendingUp} label="คะแนนเฉลี่ย" value={`${avgPct}%`} />
        <StatCard icon={Target} label="คะแนนสูงสุด" value={`${Math.max(0, ...examAttempts.map(a => a.score))}`} hint={`เต็ม ${examAttempts[0]?.maxScore ?? "—"}`} />
        <StatCard icon={Target} label="คะแนนต่ำสุด" value={`${examAttempts.length ? Math.min(...examAttempts.map(a => a.score)) : "—"}`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">รายชื่อการส่ง</h3>
          <div className="space-y-2">
            {examAttempts.map((a) => {
              const u = users.find((x) => x.id === a.studentId);
              const pct = Math.round((a.score / a.maxScore) * 100);
              return (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded-md row-hover">
                  <div className={`w-9 h-9 rounded-full ${u?.avatarColor ?? "bg-primary"} text-white flex items-center justify-center text-sm font-semibold`}>
                    {u?.name.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u?.name}</div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                      <div className={`h-full ${pct >= 70 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{a.score}/{a.maxScore}</div>
                </div>
              );
            })}
            {examAttempts.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">ยังไม่มีการส่งข้อสอบ</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">วิเคราะห์รายข้อ</h3>
          <div className="space-y-3">
            {itemAnalysis.map((it, i) => (
              <div key={it.q.id}>
                <div className="flex justify-between gap-3 text-sm mb-1">
                  <div className="min-w-0">
                    <span className="font-medium">ข้อ {i + 1}.</span>{" "}
                    <span className="text-muted-foreground"><MathRender text={it.q.title} /></span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">{it.correct}/{it.total} • {it.pct}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${it.pct >= 70 ? "bg-success" : it.pct >= 40 ? "bg-warning" : "bg-destructive"}`}
                    style={{ width: `${it.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function StatCard({ icon: Icon, label, value, hint }: any) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-2xl font-semibold mt-1.5 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );
}
