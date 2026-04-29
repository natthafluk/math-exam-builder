import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MathRender } from "@/components/MathRender";
import { Clock, ArrowRight, CheckCircle2 } from "lucide-react";

export function StudentExams() {
  const { currentUser, exams, attempts } = useStore();
  const myExams = exams.filter((e) => e.classIds.includes(currentUser.classId ?? ""));

  return (
    <AppLayout title="ข้อสอบของฉัน">
      <div className="grid md:grid-cols-2 gap-4">
        {myExams.map((e) => {
          const done = attempts.find((a) => a.examId === e.id && a.studentId === currentUser.id);
          return (
            <Card key={e.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{e.title}</h3>
                {done && <CheckCircle2 className="w-5 h-5 text-success shrink-0" />}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{e.description}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {e.timeLimitMinutes} นาที</span>
                <span>•</span>
                <span>{e.questions.length} ข้อ</span>
                <span>•</span>
                <span>กำหนดส่ง {new Date(e.dueDate).toLocaleDateString("th-TH")}</span>
              </div>
              <div className="mt-4">
                {done ? (
                  <div className="flex items-center justify-between">
                    <span className="chip bg-success/10 text-success">คะแนน {done.score}/{done.maxScore}</span>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/student/results">ดูผล</Link>
                    </Button>
                  </div>
                ) : (
                  <Button asChild className="w-full gap-1.5">
                    <Link to={`/student/take/${e.id}`}>เริ่มทำข้อสอบ <ArrowRight className="w-4 h-4" /></Link>
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
        {myExams.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground md:col-span-2">
            ยังไม่มีข้อสอบที่ได้รับมอบหมาย
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

export function StudentResults() {
  const { currentUser, exams, attempts, questions } = useStore();
  const mine = attempts.filter((a) => a.studentId === currentUser.id);

  return (
    <AppLayout title="ผลคะแนนของฉัน">
      <div className="space-y-4">
        {mine.map((a) => {
          const exam = exams.find((e) => e.id === a.examId);
          const pct = Math.round((a.score / a.maxScore) * 100);
          return (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{exam?.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ส่งเมื่อ {a.submittedAt ? new Date(a.submittedAt).toLocaleString("th-TH") : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold tabular-nums">{a.score}/{a.maxScore}</div>
                  <div className={`text-sm font-medium ${pct >= 70 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive"}`}>{pct}%</div>
                </div>
              </div>

              {exam?.showExplanations && (
                <details className="mt-4 group">
                  <summary className="cursor-pointer text-sm text-primary hover:underline">ดูเฉลยและคำอธิบาย</summary>
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    {exam.questions.map((eq, i) => {
                      const q = questions.find((x) => x.id === eq.questionId)!;
                      const ans = a.answers[q.id] ?? "";
                      const ok = ans === q.correctAnswer;
                      return (
                        <div key={q.id} className="text-sm">
                          <div className="font-medium mb-1">ข้อ {i + 1}. <MathRender text={q.title} /></div>
                          <div className="text-muted-foreground"><MathRender text={q.body} /></div>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                            <span className={ok ? "text-success" : "text-destructive"}>คำตอบของคุณ: <MathRender text={ans || "—"} /></span>
                            {!ok && <span className="text-success">เฉลย: <MathRender text={q.correctAnswer} /></span>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1"><MathRender text={q.explanation} /></div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </Card>
          );
        })}
        {mine.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground">ยังไม่มีผลการทำข้อสอบ</Card>
        )}
      </div>
    </AppLayout>
  );
}
