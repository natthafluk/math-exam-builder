import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MathRender } from "@/components/MathRender";
import { Clock, ArrowRight, CheckCircle2, XCircle, ChevronDown } from "lucide-react";

export function StudentExams() {
  const { currentUser, exams, attempts } = useStore();
  const myExams = exams.filter((e) => e.classIds.includes(currentUser.classId ?? ""));
  const isDone = (eid: string) => attempts.some((a) => a.examId === eid && a.studentId === currentUser.id);
  const now = Date.now();
  const open = myExams.filter((e) => !isDone(e.id) && new Date(e.dueDate).getTime() >= now && e.status === "assigned");
  const done = myExams.filter((e) => isDone(e.id));
  const closed = myExams.filter((e) => !isDone(e.id) && (new Date(e.dueDate).getTime() < now || e.status === "closed"));

  return (
    <AppLayout
      title="ข้อสอบของฉัน"
      breadcrumbs={[{ label: "หน้าหลัก", to: "/" }, { label: "ข้อสอบของฉัน" }]}
    >
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">เปิดให้ทำ ({open.length})</TabsTrigger>
          <TabsTrigger value="done">ทำเสร็จแล้ว ({done.length})</TabsTrigger>
          <TabsTrigger value="closed">ปิดแล้ว ({closed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open"><ExamGrid items={open} variant="open" /></TabsContent>
        <TabsContent value="done"><ExamGrid items={done} variant="done" /></TabsContent>
        <TabsContent value="closed"><ExamGrid items={closed} variant="closed" /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function ExamGrid({ items, variant }: { items: any[]; variant: "open" | "done" | "closed" }) {
  const { attempts, currentUser } = useStore();
  if (items.length === 0) {
    return <Card className="p-10 text-center text-muted-foreground mt-4">ไม่มีรายการในหมวดนี้</Card>;
  }
  return (
    <div className="grid md:grid-cols-2 gap-4 mt-4">
      {items.map((e) => {
        const attempt = attempts.find((a) => a.examId === e.id && a.studentId === currentUser.id);
        return (
          <Card key={e.id} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold leading-tight">{e.title}</h3>
              {attempt && <CheckCircle2 className="w-5 h-5 text-success shrink-0" />}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.description}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {e.timeLimitMinutes} นาที</span>
              <span>•</span><span>{e.questions.length} ข้อ</span>
              <span>•</span><span>กำหนด {new Date(e.dueDate).toLocaleDateString("th-TH")}</span>
            </div>
            <div className="mt-4">
              {variant === "open" && (
                <Button asChild className="w-full gap-1.5">
                  <Link to={`/student/take/${e.id}`}>เริ่มทำข้อสอบ <ArrowRight className="w-4 h-4" /></Link>
                </Button>
              )}
              {variant === "done" && attempt && (
                <div className="flex items-center justify-between">
                  <span className="chip bg-success/10 text-success">คะแนน {attempt.score}/{attempt.maxScore}</span>
                  <Button asChild variant="outline" size="sm"><Link to="/student/results">ดูเฉลย</Link></Button>
                </div>
              )}
              {variant === "closed" && (
                <Button variant="outline" disabled className="w-full">หมดเวลาแล้ว</Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function StudentResults() {
  const { currentUser, exams, attempts, questions } = useStore();
  const mine = attempts.filter((a) => a.studentId === currentUser.id);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <AppLayout
      title="ผลคะแนนของฉัน"
      breadcrumbs={[{ label: "หน้าหลัก", to: "/" }, { label: "ผลคะแนน" }]}
    >
      <div className="space-y-4">
        {mine.map((a) => {
          const exam = exams.find((e) => e.id === a.examId);
          const pct = Math.round((a.score / a.maxScore) * 100);
          const isOpen = openId === a.id;
          return (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
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
                <>
                  <Button variant="ghost" size="sm" onClick={() => setOpenId(isOpen ? null : a.id)} className="mt-3 gap-1.5">
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    {isOpen ? "ซ่อนเฉลยรายข้อ" : "ดูเฉลยรายข้อ"}
                  </Button>
                  {isOpen && exam && (
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      {exam.questions.map((eq, i) => {
                        const q = questions.find((x) => x.id === eq.questionId);
                        if (!q) return null;
                        const ans = a.answers[q.id] ?? "";
                        const ok = ans === q.correctAnswer || ans.replace(/\s/g, "") === q.correctAnswer.replace(/\s/g, "");
                        return (
                          <div key={q.id} className={`p-3 rounded-md border-l-4 ${ok ? "border-l-success bg-success/5" : "border-l-destructive bg-destructive/5"}`}>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="font-medium text-sm">ข้อ {i + 1}. {q.title}</div>
                              {ok ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" /> : <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                            </div>
                            <div className="text-sm text-muted-foreground mb-2"><MathRender text={q.body} /></div>
                            <div className="grid sm:grid-cols-2 gap-2 text-xs">
                              <div className={`p-2 rounded ${ok ? "bg-success/10" : "bg-destructive/10"}`}>
                                <div className="text-muted-foreground mb-0.5">คำตอบของคุณ</div>
                                <div className="font-medium"><MathRender text={ans || "ไม่ได้ตอบ"} /></div>
                              </div>
                              <div className="p-2 rounded bg-muted">
                                <div className="text-muted-foreground mb-0.5">เฉลย</div>
                                <div className="font-medium"><MathRender text={q.correctAnswer} /></div>
                              </div>
                            </div>
                            {q.explanation && (
                              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                                <span className="font-medium">คำอธิบาย: </span><MathRender text={q.explanation} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
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
