import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MathRender } from "@/components/MathRender";
import { Sigma, Clock, ChevronLeft, ChevronRight, Send } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

export default function TakeExam() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { exams, questions, currentUser, saveAttempt } = useStore();
  const exam = exams.find((e) => e.id === id);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);

  if (!exam) return <div className="p-8">ไม่พบข้อสอบ</div>;

  const items = useMemo(() =>
    [...exam.questions].sort((a, b) => a.order - b.order)
      .map((eq) => ({ ref: eq, q: questions.find((q) => q.id === eq.questionId)! }))
      .filter((x) => x.q),
    [exam, questions]
  );

  const current = items[idx];
  const answered = Object.keys(answers).length;
  const progress = (answered / items.length) * 100;

  const submit = () => {
    let score = 0;
    let max = 0;
    items.forEach(({ ref, q }) => {
      max += ref.points;
      const ans = (answers[q.id] ?? "").trim();
      if (!ans) return;
      const ok = q.type === "short"
        ? ans.replace(/\s/g, "") === q.correctAnswer.replace(/\s/g, "")
        : ans === q.correctAnswer;
      if (ok) score += ref.points;
    });
    saveAttempt({
      id: `at-${Date.now()}`, examId: exam.id, studentId: currentUser.id,
      answers, score, maxScore: max, submittedAt: new Date().toISOString(), status: "graded",
    });
    toast.success(`ส่งข้อสอบแล้ว: ${score}/${max} คะแนน`);
    navigate("/student/results");
  };

  const setAnswer = (qid: string, v: string) =>
    setAnswers((a) => ({ ...a, [qid]: v }));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <Sigma className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{exam.title}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {exam.timeLimitMinutes} นาที • ข้อ {idx + 1} จาก {items.length}
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="gap-1.5"><Send className="w-4 h-4" /> ส่งคำตอบ</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>ยืนยันการส่งข้อสอบ</AlertDialogTitle>
                <AlertDialogDescription>
                  คุณตอบไปแล้ว {answered} จาก {items.length} ข้อ — เมื่อส่งแล้วจะไม่สามารถแก้ไขได้
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction onClick={submit}>ส่งคำตอบ</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <Progress value={progress} className="h-1 rounded-none" />
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <Card className="p-6 md:p-8">
          <div className="text-xs text-muted-foreground mb-1">ข้อ {idx + 1} • {current.ref.points} คะแนน</div>
          <h2 className="font-semibold text-lg mb-3">{current.q.title}</h2>
          <div className="text-[17px] leading-relaxed mb-6">
            <MathRender text={current.q.body} block />
          </div>

          {current.q.type === "mcq" && (
            <div className="space-y-2">
              {(current.q.choices ?? []).map((c) => {
                const sel = answers[current.q.id] === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setAnswer(current.q.id, c.id)}
                    className={`w-full text-left p-4 rounded-md border-2 transition-colors flex items-start gap-3 ${
                      sel ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-semibold shrink-0 ${
                      sel ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    }`}>{c.id.toUpperCase()}</span>
                    <div className="text-[15px] pt-0.5"><MathRender text={c.text} /></div>
                  </button>
                );
              })}
            </div>
          )}
          {current.q.type === "tf" && (
            <div className="grid grid-cols-2 gap-3">
              {(["true", "false"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setAnswer(current.q.id, v)}
                  className={`p-4 rounded-md border-2 text-base font-medium transition-colors ${
                    answers[current.q.id] === v ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
                  }`}
                >
                  {v === "true" ? "✓ ถูก" : "✗ ผิด"}
                </button>
              ))}
            </div>
          )}
          {current.q.type === "short" && (
            <Input
              value={answers[current.q.id] ?? ""}
              onChange={(e) => setAnswer(current.q.id, e.target.value)}
              placeholder="พิมพ์คำตอบ..."
              className="text-base font-mono"
            />
          )}
          {current.q.type === "written" && (
            <Textarea
              value={answers[current.q.id] ?? ""}
              onChange={(e) => setAnswer(current.q.id, e.target.value)}
              placeholder="พิมพ์แนวคิด/วิธีทำ... ใช้ $...$ สำหรับสูตรได้"
              rows={6}
              className="font-mono"
            />
          )}
        </Card>

        <div className="flex justify-between mt-5">
          <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> ก่อนหน้า
          </Button>
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {items.map((it, i) => (
              <button
                key={it.q.id}
                onClick={() => setIdx(i)}
                className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${
                  i === idx ? "bg-primary text-primary-foreground"
                    : answers[it.q.id] ? "bg-success/15 text-success" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >{i + 1}</button>
            ))}
          </div>
          <Button onClick={() => setIdx((i) => Math.min(items.length - 1, i + 1))} disabled={idx === items.length - 1} className="gap-1">
            ถัดไป <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
