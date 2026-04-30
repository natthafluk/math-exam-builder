import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { MathRender } from "@/components/MathRender";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowDown, ArrowUp, Save, Sparkles, X, ArrowLeft, ArrowRight, Check,
} from "lucide-react";
import { toast } from "sonner";
import type { Exam, ExamSettings } from "@/lib/types";

const STEPS = ["รายละเอียด", "เลือกข้อสอบ", "ตั้งค่า & ทบทวน", "มอบหมาย"] as const;

const DEFAULT_SETTINGS: ExamSettings = {
  randomizeQuestionOrder: false,
  randomizeChoices: false,
  allowLateSubmission: false,
  showScoreImmediately: true,
  showExplanationsAfterClose: true,
};

interface DbClass { id: string; name: string; grade_level: string; teacher_id: string | null; student_count: number }

export default function ExamBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { exams, questions, topics, currentUser, addExam, updateExam, logAudit } = useStore();
  const existing = id && id !== "new" ? exams.find((e) => e.id === id) : undefined;

  // Real classes from DB (filtered by RPC to current teacher / admin)
  const [classes, setClasses] = useState<DbClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      setClassesLoading(true);
      const { data, error } = await (supabase as any).rpc("teacher_list_classes_with_students");
      if (cancelled) return;
      if (error) {
        console.warn("[ExamBuilder] load classes failed:", error.message);
        toast.error("โหลดห้องเรียนไม่สำเร็จ: " + error.message);
        setClasses([]);
      } else {
        setClasses((data ?? []).map((c: any) => ({
          id: c.id, name: c.name, grade_level: c.grade_level,
          teacher_id: c.teacher_id, student_count: c.student_count ?? 0,
        })));
      }
      setClassesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profile]);

  const [step, setStep] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [draft, setDraft] = useState<Exam>(
    existing ?? {
      id: `e-${Date.now()}`, title: "", description: "",
      teacherId: currentUser.id, classIds: [], questions: [],
      timeLimitMinutes: 60,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      showExplanations: true, status: "draft",
      settings: DEFAULT_SETTINGS,
      createdAt: new Date().toISOString(),
    }
  );
  const settings = draft.settings ?? DEFAULT_SETTINGS;
  const set = <K extends keyof Exam>(k: K, v: Exam[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setSetting = <K extends keyof ExamSettings>(k: K, v: ExamSettings[K]) =>
    set("settings", { ...settings, [k]: v });

  const [randGrade, setRandGrade] = useState("ม.4");
  const [randDiff, setRandDiff] = useState("all");
  const [randCount, setRandCount] = useState(5);

  const selectedIds = useMemo(() => new Set(draft.questions.map((q) => q.questionId)), [draft.questions]);
  const totalPoints = draft.questions.reduce((s, q) => s + q.points, 0);
  const items = draft.questions.map(eq => ({ eq, q: questions.find(q => q.id === eq.questionId)! })).filter(x => x.q);

  const distribution = useMemo(() => {
    const byTopic: Record<string, number> = {};
    const byDiff: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
    items.forEach(({ q }) => {
      byTopic[q.topicId] = (byTopic[q.topicId] ?? 0) + 1;
      byDiff[q.difficulty]++;
    });
    return { byTopic, byDiff };
  }, [items]);

  const addQuestion = (qid: string) => {
    if (selectedIds.has(qid)) return;
    set("questions", [...draft.questions, { questionId: qid, order: draft.questions.length + 1, points: 5 }]);
  };
  const removeQuestion = (qid: string) => {
    set("questions", draft.questions.filter((q) => q.questionId !== qid).map((q, i) => ({ ...q, order: i + 1 })));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...draft.questions];
    const t = idx + dir;
    if (t < 0 || t >= next.length) return;
    [next[idx], next[t]] = [next[t], next[idx]];
    set("questions", next.map((q, i) => ({ ...q, order: i + 1 })));
  };
  const setPoints = (idx: number, pts: number) => {
    set("questions", draft.questions.map((q, i) => (i === idx ? { ...q, points: pts } : q)));
  };
  const generateRandom = () => {
    const pool = questions.filter((q) =>
      q.status === "published" && q.gradeLevel === randGrade &&
      (randDiff === "all" || q.difficulty === randDiff) && !selectedIds.has(q.id)
    );
    const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, randCount);
    if (!picked.length) { toast.error("ไม่พบข้อสอบในเงื่อนไขนี้"); return; }
    const start = draft.questions.length;
    set("questions", [...draft.questions, ...picked.map((p, i) => ({ questionId: p.id, order: start + i + 1, points: 5 }))]);
    toast.success(`สุ่มเพิ่ม ${picked.length} ข้อแล้ว`);
  };

  const saveDraft = () => {
    if (!draft.title.trim()) { toast.error("กรุณาตั้งชื่อชุดข้อสอบ"); return; }
    existing ? updateExam(draft) : addExam(draft);
    toast.success("บันทึกชุดข้อสอบแล้ว");
    navigate("/exams");
  };
  const assign = () => {
    if (!draft.classIds.length) { toast.error("กรุณาเลือกห้องเรียนอย่างน้อย 1 ห้อง"); setStep(3); return; }
    const next = { ...draft, status: "assigned" as const };
    existing ? updateExam(next) : addExam(next);
    logAudit({ action: "มอบหมายชุดข้อสอบ", target: `${next.title} → ${classes.filter(c => next.classIds.includes(c.id)).map(c => c.name).join(", ")}`, tone: "success" });
    toast.success("มอบหมายข้อสอบให้นักเรียนแล้ว");
    navigate("/exams");
  };

  const canNext = () => {
    if (step === 0) return draft.title.trim().length > 0;
    if (step === 1) return draft.questions.length > 0;
    return true;
  };

  return (
    <AppLayout
      title={existing ? "แก้ไขชุดข้อสอบ" : "สร้างชุดข้อสอบ"}
      breadcrumbs={[{ label: "หน้าหลัก", to: "/" }, { label: "ชุดข้อสอบ", to: "/exams" }, { label: existing ? "แก้ไข" : "สร้างใหม่" }]}
      actions={
        <Button variant="outline" size="sm" onClick={saveDraft} className="gap-1.5"><Save className="w-4 h-4" /> บันทึกร่าง</Button>
      }
    >
      <Stepper current={step} onJump={(i) => setStep(i)} />

      <div className="mt-6">
        {step === 0 && (
          <Card className="p-5 space-y-4 max-w-2xl">
            <div>
              <Label>ชื่อชุดข้อสอบ</Label>
              <Input value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="เช่น สอบเก็บคะแนน บทที่ 3" className="mt-1.5" />
            </div>
            <div>
              <Label>คำอธิบาย</Label>
              <Textarea value={draft.description} onChange={(e) => set("description", e.target.value)} rows={3} className="mt-1.5" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>เวลาทำ (นาที)</Label>
                <Input type="number" value={draft.timeLimitMinutes} onChange={(e) => set("timeLimitMinutes", +e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>กำหนดส่ง</Label>
                <Input type="date" value={draft.dueDate.slice(0, 10)} onChange={(e) => set("dueDate", e.target.value)} className="mt-1.5" />
              </div>
            </div>
          </Card>
        )}

        {step === 1 && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">ข้อสอบในชุดนี้ ({draft.questions.length})</h3>
                  <span className="text-sm text-muted-foreground">รวม {totalPoints} คะแนน</span>
                </div>
                {draft.questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">ยังไม่มีข้อสอบ — เลือกจากด้านขวาหรือใช้ตัวสุ่ม</p>
                ) : (
                  <ol className="space-y-2">
                    {draft.questions.map((q, i) => {
                      const item = questions.find((x) => x.id === q.questionId)!;
                      return (
                        <li key={q.questionId} className="flex flex-col sm:flex-row sm:items-start gap-2 p-3 rounded-md border border-border">
                          <span className="text-sm font-semibold text-muted-foreground sm:w-6">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{item?.title}</div>
                            <div className="text-sm text-muted-foreground line-clamp-1"><MathRender text={item?.body ?? ""} /></div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Input type="number" value={q.points} onChange={(e) => setPoints(i, +e.target.value)} className="w-16 h-8" aria-label="คะแนน" />
                            <span className="text-xs text-muted-foreground">คะแนน</span>
                            <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="เลื่อนขึ้น" title="เลื่อนขึ้น"><ArrowUp className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === draft.questions.length - 1} aria-label="เลื่อนลง" title="เลื่อนลง"><ArrowDown className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => removeQuestion(q.questionId)} aria-label="ลบออก" title="ลบออก"><X className="w-4 h-4" /></Button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Card>
            </div>

            <div className="space-y-5">
              <Card className="p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> สุ่มข้อสอบ</h3>
                <div className="space-y-3">
                  <Select value={randGrade} onValueChange={setRandGrade}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={randDiff} onValueChange={setRandDiff}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกระดับยาก</SelectItem>
                      <SelectItem value="easy">ง่าย</SelectItem>
                      <SelectItem value="medium">ปานกลาง</SelectItem>
                      <SelectItem value="hard">ยาก</SelectItem>
                    </SelectContent>
                  </Select>
                  <div>
                    <Label className="text-xs">จำนวนข้อ</Label>
                    <Input type="number" value={randCount} onChange={(e) => setRandCount(+e.target.value)} className="mt-1" />
                  </div>
                  <Button onClick={generateRandom} className="w-full">สุ่ม</Button>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="font-semibold mb-3">เลือกจากคลัง</h3>
                <div className="space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin -mx-2 px-2">
                  {questions.filter(q => q.status === "published").map((q) => {
                    const added = selectedIds.has(q.id);
                    return (
                      <button key={q.id} onClick={() => added ? removeQuestion(q.id) : addQuestion(q.id)}
                        className={`w-full text-left p-2.5 rounded-md border transition-colors ${added ? "border-success bg-success/5" : "border-border hover:bg-muted"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium truncate">{q.title}</div>
                          <span className="text-xs text-muted-foreground shrink-0">{q.gradeLevel}</span>
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5"><MathRender text={q.body} /></div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <h3 className="font-semibold mb-3">สรุปการตั้งค่า</h3>
              <div className="space-y-1.5 text-sm">
                <Row label="ชื่อ" value={draft.title || "—"} />
                <Row label="จำนวนข้อ" value={`${draft.questions.length} ข้อ`} />
                <Row label="คะแนนเต็ม" value={`${totalPoints} คะแนน`} />
                <Row label="เวลา" value={`${draft.timeLimitMinutes} นาที`} />
                <Row label="กำหนดส่ง" value={new Date(draft.dueDate).toLocaleDateString("th-TH")} />
              </div>
              <div className="mt-4">
                <div className="text-xs font-medium text-muted-foreground mb-1.5">การกระจายตามความยาก</div>
                <div className="flex gap-2 text-xs">
                  <span className="chip bg-success/10 text-success">ง่าย {distribution.byDiff.easy}</span>
                  <span className="chip bg-warning/10 text-warning">กลาง {distribution.byDiff.medium}</span>
                  <span className="chip bg-destructive/10 text-destructive">ยาก {distribution.byDiff.hard}</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs font-medium text-muted-foreground mb-1.5">การกระจายตามหัวข้อ</div>
                <div className="flex gap-1.5 flex-wrap">
                  {Object.entries(distribution.byTopic).map(([tid, n]) => (
                    <span key={tid} className="chip bg-muted text-muted-foreground">{topics.find(t => t.id === tid)?.title ?? tid} × {n}</span>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <h3 className="font-semibold">ตัวเลือกการสอบ</h3>
              <ToggleRow label="สลับลำดับข้อสอบ" hint="แต่ละนักเรียนได้ลำดับข้อต่างกัน" value={settings.randomizeQuestionOrder} onChange={(v) => setSetting("randomizeQuestionOrder", v)} />
              <ToggleRow label="สลับตัวเลือก (ปรนัย)" hint="ลดการลอกคำตอบ" value={settings.randomizeChoices} onChange={(v) => setSetting("randomizeChoices", v)} />
              <ToggleRow label="อนุญาตส่งเลยเวลา" hint="หลังกำหนดส่งยังเปิดให้ส่งได้" value={settings.allowLateSubmission} onChange={(v) => setSetting("allowLateSubmission", v)} />
              <ToggleRow label="แสดงคะแนนทันทีหลังส่ง" value={settings.showScoreImmediately} onChange={(v) => setSetting("showScoreImmediately", v)} />
              <ToggleRow label="เปิดเฉลยหลังปิดสอบ" value={settings.showExplanationsAfterClose} onChange={(v) => setSetting("showExplanationsAfterClose", v)} />
              <ToggleRow label="แสดงคำอธิบายเฉลย" value={draft.showExplanations} onChange={(v) => set("showExplanations", v)} />
            </Card>
          </div>
        )}

        {step === 3 && (
          <Card className="p-5 max-w-2xl">
            <h3 className="font-semibold mb-3">เลือกห้องเรียนที่จะมอบหมาย</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {classes.map((c) => {
                const checked = draft.classIds.includes(c.id);
                return (
                  <label key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${checked ? "border-primary bg-primary-soft" : "border-border hover:bg-muted"}`}>
                    <Checkbox checked={checked} onCheckedChange={(v) => set("classIds", v ? [...draft.classIds, c.id] : draft.classIds.filter((x) => x !== c.id))} />
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.studentIds.length} คน</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="mt-5 p-3 rounded-md bg-muted/50 text-sm">
              จะส่งให้ <strong>{classes.filter(c => draft.classIds.includes(c.id)).reduce((s, c) => s + c.studentIds.length, 0)}</strong> คน
              ในห้อง {classes.filter(c => draft.classIds.includes(c.id)).map(c => c.name).join(", ") || "—"}
            </div>
          </Card>
        )}
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> ก่อนหน้า
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="gap-1.5">
            ถัดไป <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={() => setConfirm(true)} className="gap-1.5"><Check className="w-4 h-4" /> มอบหมายข้อสอบ</Button>
        )}
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการมอบหมายข้อสอบ</AlertDialogTitle>
            <AlertDialogDescription>
              "{draft.title}" จะถูกมอบหมายให้นักเรียนในห้องที่เลือก เมื่อมอบหมายแล้วนักเรียนจะเริ่มทำข้อสอบได้ทันที
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={assign}>ยืนยันมอบหมาย</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function Stepper({ current, onJump }: { current: number; onJump: (i: number) => void }) {
  return (
    <ol className="flex items-center gap-1 sm:gap-3 overflow-x-auto scrollbar-thin pb-1">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-1 sm:gap-3 shrink-0">
            <button onClick={() => onJump(i)} className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-colors ${
                done ? "bg-success text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>{done ? <Check className="w-3.5 h-3.5" /> : i + 1}</span>
              <span className={`text-xs sm:text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"} hidden sm:inline`}>{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="w-4 sm:w-8 h-px bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
