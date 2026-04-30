import { Link, useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MathRender } from "@/components/MathRender";
import { ArrowLeft, Edit3, CheckCircle2 } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  mcq: "ปรนัย", short: "เติมคำตอบ", tf: "ถูก/ผิด", written: "อัตนัย",
};
const DIFF_LABEL: Record<string, string> = { easy: "ง่าย", medium: "ปานกลาง", hard: "ยาก" };

export default function QuestionPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { questions, topics, currentUser } = useStore();
  const q = questions.find((x) => x.id === id);

  if (!q) {
    return (
      <AppLayout title="ไม่พบข้อสอบ">
        <Card className="p-10 text-center text-muted-foreground">
          ไม่พบข้อสอบที่ระบุ
        </Card>
      </AppLayout>
    );
  }

  const topic = topics.find((t) => t.id === q.topicId);
  const isTeacherView = currentUser.role !== "student";

  return (
    <AppLayout
      title="ตัวอย่างข้อสอบ"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-1.5" aria-label="ย้อนกลับ">
            <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
          </Button>
          {isTeacherView && (
            <Button asChild className="gap-1.5" aria-label="แก้ไขข้อสอบ">
              <Link to={`/questions/${q.id}`}><Edit3 className="w-4 h-4" /> แก้ไข</Link>
            </Button>
          )}
        </div>
      }
    >
      <div className="max-w-3xl mx-auto space-y-5">
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="chip bg-primary-soft text-primary">{q.gradeLevel}</span>
            {topic && <span className="chip bg-muted text-muted-foreground">{topic.title}</span>}
            <span className="chip bg-accent-soft text-accent">{DIFF_LABEL[q.difficulty]}</span>
            <span className="chip bg-secondary text-secondary-foreground">{TYPE_LABEL[q.type]}</span>
          </div>
          <h2 className="text-xl font-semibold mb-3">{q.title}</h2>
          <div className="text-[16px] leading-relaxed">
            <MathRender text={q.body} block />
          </div>

          {q.type === "mcq" && q.choices && (
            <ol className="mt-5 space-y-2">
              {q.choices.map((c) => {
                const isCorrect = isTeacherView && c.id === q.correctAnswer;
                return (
                  <li
                    key={c.id}
                    className={`flex items-start gap-3 p-3 rounded-md border ${
                      isCorrect ? "border-success bg-success/5" : "border-border"
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-semibold shrink-0 ${
                      isCorrect ? "border-success bg-success text-white" : "border-border"
                    }`}>{c.id.toUpperCase()}</span>
                    <div className="flex-1 pt-0.5"><MathRender text={c.text} /></div>
                    {isCorrect && <CheckCircle2 className="w-5 h-5 text-success shrink-0" aria-label="คำตอบที่ถูก" />}
                  </li>
                );
              })}
            </ol>
          )}

          {q.type === "tf" && (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {(["true", "false"] as const).map((v) => {
                const isCorrect = isTeacherView && v === q.correctAnswer;
                return (
                  <div key={v} className={`p-4 rounded-md border-2 text-base font-medium text-center ${
                    isCorrect ? "border-success bg-success/5 text-success" : "border-border"
                  }`}>
                    {v === "true" ? "✓ ถูก" : "✗ ผิด"}
                    {isCorrect && <span className="block text-xs mt-1">เฉลย</span>}
                  </div>
                );
              })}
            </div>
          )}

          {q.type === "short" && isTeacherView && (
            <div className="mt-5 p-3 rounded-md border border-success bg-success/5">
              <div className="text-xs text-muted-foreground mb-1">เฉลย</div>
              <div className="font-mono text-sm"><MathRender text={q.correctAnswer} /></div>
            </div>
          )}

          {q.type === "written" && isTeacherView && (
            <div className="mt-5 p-3 rounded-md border border-success bg-success/5">
              <div className="text-xs text-muted-foreground mb-1">แนวคำตอบ</div>
              <div><MathRender text={q.correctAnswer} block /></div>
            </div>
          )}
        </Card>

        {isTeacherView && q.explanation && (
          <Card className="p-6">
            <h3 className="font-semibold mb-2">คำอธิบายเฉลย</h3>
            <div className="text-[15px] text-foreground/90 leading-relaxed">
              <MathRender text={q.explanation} block />
            </div>
          </Card>
        )}

        {q.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {q.tags.map((t) => (
              <span key={t} className="chip bg-muted text-muted-foreground">#{t}</span>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
