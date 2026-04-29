import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MathRender } from "@/components/MathRender";
import { BarChart3, TrendingUp, Users, ArrowRight } from "lucide-react";

export default function ResultsPage() {
  const { exams, attempts, questions, users, currentUser } = useStore();
  const visibleExams = currentUser.role === "admin"
    ? exams
    : exams.filter((e) => e.teacherId === currentUser.id);

  const overallAvg = (() => {
    const all = attempts.filter((a) => visibleExams.some((e) => e.id === a.examId));
    if (!all.length) return 0;
    return Math.round(
      (all.reduce((s, a) => s + a.score / a.maxScore, 0) / all.length) * 100
    );
  })();

  return (
    <AppLayout title="ผลคะแนนรวม">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="w-3.5 h-3.5" /> ชุดข้อสอบที่ติดตาม
          </div>
          <div className="text-2xl font-semibold mt-1.5 tabular-nums">{visibleExams.length}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" /> การส่งทั้งหมด
          </div>
          <div className="text-2xl font-semibold mt-1.5 tabular-nums">
            {attempts.filter((a) => visibleExams.some((e) => e.id === a.examId)).length}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="w-3.5 h-3.5" /> คะแนนเฉลี่ยรวม
          </div>
          <div className="text-2xl font-semibold mt-1.5 tabular-nums">{overallAvg}%</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" /> นักเรียนที่ส่งแล้ว
          </div>
          <div className="text-2xl font-semibold mt-1.5 tabular-nums">
            {new Set(attempts.map((a) => a.studentId)).size}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {visibleExams.map((e) => {
          const list = attempts.filter((a) => a.examId === e.id);
          const avg = list.length
            ? Math.round((list.reduce((s, a) => s + a.score / a.maxScore, 0) / list.length) * 100)
            : 0;

          // Item analysis
          const items = e.questions.map((eq) => {
            const q = questions.find((x) => x.id === eq.questionId);
            const total = list.length;
            const correct = list.filter((a) => (a.answers[eq.questionId] ?? "").trim() === q?.correctAnswer).length;
            return { q, pct: total ? Math.round((correct / total) * 100) : 0 };
          });

          return (
            <Card key={e.id} className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold">{e.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {list.length} การส่ง • คะแนนเฉลี่ย {avg}%
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-1">
                  <Link to={`/exams/${e.id}/results`}>รายละเอียด <ArrowRight className="w-3.5 h-3.5" /></Link>
                </Button>
              </div>

              {list.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">นักเรียน</div>
                    <ul className="space-y-1.5">
                      {list.slice(0, 5).map((a) => {
                        const u = users.find((x) => x.id === a.studentId);
                        const pct = Math.round((a.score / a.maxScore) * 100);
                        return (
                          <li key={a.id} className="flex items-center gap-2 text-sm">
                            <div className={`w-6 h-6 rounded-full ${u?.avatarColor ?? "bg-primary"} text-white flex items-center justify-center text-[10px] font-semibold`}>
                              {u?.name.slice(0, 1)}
                            </div>
                            <span className="flex-1 truncate">{u?.name}</span>
                            <span className={`font-medium tabular-nums ${pct >= 70 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive"}`}>
                              {a.score}/{a.maxScore}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">วิเคราะห์รายข้อ</div>
                    <ul className="space-y-2">
                      {items.slice(0, 5).map((it, i) => (
                        <li key={i}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="truncate"><MathRender text={`ข้อ ${i + 1}. ${it.q?.title ?? ""}`} /></span>
                            <span className="text-muted-foreground tabular-nums">{it.pct}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${it.pct >= 70 ? "bg-success" : it.pct >= 40 ? "bg-warning" : "bg-destructive"}`}
                              style={{ width: `${it.pct}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  ยังไม่มีการส่งข้อสอบ
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}
