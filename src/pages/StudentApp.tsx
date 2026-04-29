import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MathRender } from "@/components/MathRender";
import { Sigma, Loader2, Clock, ArrowRight, LogOut, GraduationCap, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStudentSession } from "@/lib/studentSession";
import { toast } from "sonner";

function StudentShell({ children, title }: { children: React.ReactNode; title: string }) {
  const { session, signOut } = useStudentSession();
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-accent text-accent-foreground flex items-center justify-center"><Sigma className="w-5 h-5" /></div>
            <div>
              <div className="font-semibold leading-tight">MathBank — นักเรียน</div>
              <div className="text-xs text-muted-foreground">{session?.full_name} • {session?.class_name} • ครู: {session?.teacher_name}</div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { signOut(); nav("/student-login"); }}>
            <LogOut className="w-4 h-4 mr-1.5" /> ออกจากระบบ
          </Button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold mb-4">{title}</h1>
        {children}
      </main>
    </div>
  );
}

interface AssignmentRow {
  assignment_id: string;
  exam_id: string;
  exam_title: string;
  exam_description: string;
  time_limit_minutes: number;
  due_date: string | null;
  status: string;
  show_explanations: boolean;
}

export function StudentExams() {
  const { session } = useStudentSession();
  const [items, setItems] = useState<AssignmentRow[] | null>(null);
  const [results, setResults] = useState<{ attempt_id: string; exam_title: string; score: number; max_score: number; submitted_at: string | null }[]>([]);

  useEffect(() => {
    if (!session) return;
    supabase.rpc("student_list_assignments", { _enrollment_id: session.enrollment_id, _code: session.student_code })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setItems((data ?? []) as AssignmentRow[]);
      });
    supabase.rpc("student_list_results", { _enrollment_id: session.enrollment_id, _code: session.student_code })
      .then(({ data }) => setResults((data ?? []) as any));
  }, [session]);

  const doneIds = new Set(results.map((r) => r.exam_title));
  const open = (items ?? []).filter((a) => a.status !== "closed");
  const closed = (items ?? []).filter((a) => a.status === "closed");

  return (
    <StudentShell title="ข้อสอบของฉัน">
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">เปิดให้ทำ ({open.length})</TabsTrigger>
          <TabsTrigger value="results">ผลคะแนน ({results.length})</TabsTrigger>
          <TabsTrigger value="closed">ปิดแล้ว ({closed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open">
          {items === null ? (
            <Card className="p-10 text-center text-muted-foreground mt-4"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></Card>
          ) : open.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground mt-4">ยังไม่มีข้อสอบที่เปิดให้ทำ</Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              {open.map((a) => (
                <Card key={a.assignment_id} className="p-5">
                  <h3 className="font-semibold leading-tight">{a.exam_title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.exam_description}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {a.time_limit_minutes} นาที</span>
                    {a.due_date && <><span>•</span><span>กำหนด {new Date(a.due_date).toLocaleDateString("th-TH")}</span></>}
                  </div>
                  <Button asChild className="w-full mt-4 gap-1.5">
                    <Link to={`/student/take/${a.assignment_id}`}>เริ่มทำข้อสอบ <ArrowRight className="w-4 h-4" /></Link>
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="results">
          {results.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground mt-4">ยังไม่มีผลคะแนน</Card>
          ) : (
            <div className="space-y-3 mt-4">
              {results.map((r) => {
                const pct = r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0;
                return (
                  <Card key={r.attempt_id} className="p-5 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{r.exam_title}</div>
                      <div className="text-xs text-muted-foreground">ส่งเมื่อ {r.submitted_at ? new Date(r.submitted_at).toLocaleString("th-TH") : "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold tabular-nums">{r.score}/{r.max_score}</div>
                      <div className={`text-sm font-medium ${pct >= 70 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive"}`}>{pct}%</div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="closed">
          {closed.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground mt-4">ไม่มี</Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              {closed.map((a) => (
                <Card key={a.assignment_id} className="p-5 opacity-70">
                  <h3 className="font-semibold">{a.exam_title}</h3>
                  <Button variant="outline" disabled className="w-full mt-3">ปิดแล้ว</Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </StudentShell>
  );
}

interface ExamPayload {
  assignment_id: string;
  exam: { id: string; title: string; description: string; time_limit_minutes: number; show_explanations: boolean };
  questions: Array<{
    exam_question_id: string;
    question_id: string;
    sort_order: number;
    points: number;
    title: string;
    body_latex: string;
    type: "mcq" | "tf" | "short" | "written";
    choices: Array<{ id: string; label: string; body_latex: string; sort_order: number }>;
  }>;
}

export function StudentTakeExam() {
  const { session } = useStudentSession();
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<ExamPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; max_score: number } | null>(null);

  useEffect(() => {
    if (!session || !id) return;
    supabase.rpc("student_get_exam", { _enrollment_id: session.enrollment_id, _code: session.student_code, _assignment_id: id })
      .then(({ data, error }) => {
        if (error) { toast.error(error.message); nav("/student/exams"); return; }
        setData(data as unknown as ExamPayload);
      });
  }, [session, id, nav]);

  const submit = async () => {
    if (!session || !id) return;
    setSubmitting(true);
    const { data: res, error } = await supabase.rpc("student_submit_attempt", {
      _enrollment_id: session.enrollment_id,
      _code: session.student_code,
      _assignment_id: id,
      _answers: answers,
    });
    setSubmitting(false);
    if (error) { toast.error("ส่งคำตอบไม่สำเร็จ: " + error.message); return; }
    const r = res as any;
    setResult({ score: Number(r.score), max_score: Number(r.max_score) });
    toast.success("ส่งคำตอบเรียบร้อย");
  };

  if (!data) {
    return <StudentShell title="กำลังโหลดข้อสอบ..."><Card className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></Card></StudentShell>;
  }

  if (result) {
    const pct = result.max_score > 0 ? Math.round((result.score / result.max_score) * 100) : 0;
    return (
      <StudentShell title="ผลคะแนน">
        <Card className="p-8 text-center space-y-4">
          <GraduationCap className="w-12 h-12 mx-auto text-accent" />
          <div className="text-4xl font-bold tabular-nums">{result.score}/{result.max_score}</div>
          <div className={`text-lg font-medium ${pct >= 70 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive"}`}>{pct}%</div>
          <Button onClick={() => nav("/student/exams")} className="gap-1.5"><ArrowLeft className="w-4 h-4" /> กลับไปหน้าข้อสอบ</Button>
        </Card>
      </StudentShell>
    );
  }

  return (
    <StudentShell title={data.exam.title}>
      <Card className="p-5 mb-4">
        <p className="text-sm text-muted-foreground">{data.exam.description}</p>
        <div className="text-xs text-muted-foreground mt-2 flex gap-3">
          <span><Clock className="w-3 h-3 inline" /> {data.exam.time_limit_minutes} นาที</span>
          <span>{data.questions.length} ข้อ</span>
        </div>
      </Card>

      <div className="space-y-4">
        {data.questions.map((q, i) => (
          <Card key={q.exam_question_id} className="p-5">
            <div className="flex justify-between items-start gap-3 mb-2">
              <div className="font-semibold">ข้อ {i + 1}. {q.title}</div>
              <span className="chip bg-muted">{q.points} คะแนน</span>
            </div>
            <div className="text-sm mb-4"><MathRender text={q.body_latex} /></div>

            {q.type === "mcq" && (
              <RadioGroup value={answers[q.question_id] ?? ""} onValueChange={(v) => setAnswers((a) => ({ ...a, [q.question_id]: v }))}>
                <div className="space-y-2">
                  {q.choices.map((c) => (
                    <Label key={c.id} className="flex items-start gap-2 p-3 rounded-md border hover:bg-muted/40 cursor-pointer">
                      <RadioGroupItem value={c.label} className="mt-0.5" />
                      <span className="font-medium mr-1">{c.label}.</span>
                      <span><MathRender text={c.body_latex} /></span>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            )}
            {q.type === "tf" && (
              <RadioGroup value={answers[q.question_id] ?? ""} onValueChange={(v) => setAnswers((a) => ({ ...a, [q.question_id]: v }))}>
                <div className="flex gap-3">
                  {["true", "false"].map((v) => (
                    <Label key={v} className="flex items-center gap-2 p-3 rounded-md border hover:bg-muted/40 cursor-pointer flex-1">
                      <RadioGroupItem value={v} />
                      <span>{v === "true" ? "ถูก" : "ผิด"}</span>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            )}
            {(q.type === "short" || q.type === "written") && (
              <Input
                value={answers[q.question_id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.question_id]: e.target.value }))}
                placeholder="พิมพ์คำตอบ..."
              />
            )}
          </Card>
        ))}
      </div>

      <div className="sticky bottom-4 mt-6">
        <Card className="p-4 flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">ตอบแล้ว {Object.values(answers).filter(Boolean).length}/{data.questions.length} ข้อ</div>
          <Button onClick={submit} disabled={submitting} size="lg">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            ส่งคำตอบ
          </Button>
        </Card>
      </div>
    </StudentShell>
  );
}
