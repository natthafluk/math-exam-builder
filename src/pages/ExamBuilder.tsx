import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
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
import { ArrowDown, ArrowUp, Save, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Exam, ExamQuestionRef } from "@/lib/types";

export default function ExamBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { exams, questions, classes, currentUser, addExam, updateExam } = useStore();
  const existing = id && id !== "new" ? exams.find((e) => e.id === id) : undefined;

  const [draft, setDraft] = useState<Exam>(
    existing ?? {
      id: `e-${Date.now()}`,
      title: "",
      description: "",
      teacherId: currentUser.id,
      classIds: [],
      questions: [],
      timeLimitMinutes: 60,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      showExplanations: true,
      status: "draft",
      createdAt: new Date().toISOString(),
    }
  );

  const set = <K extends keyof Exam>(k: K, v: Exam[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const [randGrade, setRandGrade] = useState("ม.4");
  const [randTopic, setRandTopic] = useState("all");
  const [randDiff, setRandDiff] = useState("all");
  const [randCount, setRandCount] = useState(5);

  const selectedIds = useMemo(() => new Set(draft.questions.map((q) => q.questionId)), [draft.questions]);

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
      q.status === "published" &&
      q.gradeLevel === randGrade &&
      (randTopic === "all" || q.topicId === randTopic) &&
      (randDiff === "all" || q.difficulty === randDiff) &&
      !selectedIds.has(q.id)
    );
    const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, randCount);
    if (!picked.length) { toast.error("ไม่พบข้อสอบในเงื่อนไขนี้"); return; }
    const start = draft.questions.length;
    set("questions", [
      ...draft.questions,
      ...picked.map((p, i) => ({ questionId: p.id, order: start + i + 1, points: 5 })),
    ]);
    toast.success(`สุ่มเพิ่ม ${picked.length} ข้อแล้ว`);
  };

  const save = () => {
    if (!draft.title.trim() || draft.questions.length === 0) {
      toast.error("กรุณาตั้งชื่อและเลือกข้อสอบอย่างน้อย 1 ข้อ");
      return;
    }
    existing ? updateExam(draft) : addExam(draft);
    toast.success("บันทึกชุดข้อสอบแล้ว");
    navigate("/exams");
  };

  const assign = () => {
    if (!draft.classIds.length) { toast.error("กรุณาเลือกห้องเรียนอย่างน้อย 1 ห้อง"); return; }
    const next = { ...draft, status: "assigned" as const };
    existing ? updateExam(next) : addExam(next);
    setDraft(next);
    toast.success("มอบหมายข้อสอบให้นักเรียนแล้ว");
    navigate("/exams");
  };

  const totalPoints = draft.questions.reduce((s, q) => s + q.points, 0);

  return (
    <AppLayout
      title={existing ? "แก้ไขชุดข้อสอบ" : "สร้างชุดข้อสอบ"}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={save} className="gap-1.5"><Save className="w-4 h-4" /> บันทึก</Button>
          <Button onClick={assign}>มอบหมาย</Button>
        </div>
      }
    >
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-5 space-y-4">
            <div>
              <Label>ชื่อชุดข้อสอบ</Label>
              <Input value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="เช่น สอบเก็บคะแนน บทที่ 3" className="mt-1.5" />
            </div>
            <div>
              <Label>คำอธิบาย</Label>
              <Textarea value={draft.description} onChange={(e) => set("description", e.target.value)} rows={2} className="mt-1.5" />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>เวลา (นาที)</Label>
                <Input type="number" value={draft.timeLimitMinutes} onChange={(e) => set("timeLimitMinutes", +e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>กำหนดส่ง</Label>
                <Input type="date" value={draft.dueDate.slice(0, 10)} onChange={(e) => set("dueDate", e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label className="block mb-2">เฉลยหลังส่ง</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch checked={draft.showExplanations} onCheckedChange={(v) => set("showExplanations", v)} />
                  <span className="text-sm text-muted-foreground">{draft.showExplanations ? "แสดง" : "ไม่แสดง"}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3">ห้องเรียนที่มอบหมาย</h3>
            <div className="grid sm:grid-cols-3 gap-2">
              {classes.map((c) => {
                const checked = draft.classIds.includes(c.id);
                return (
                  <label key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                    checked ? "border-primary bg-primary-soft" : "border-border hover:bg-muted"
                  }`}>
                    <Checkbox checked={checked} onCheckedChange={(v) => {
                      set("classIds", v ? [...draft.classIds, c.id] : draft.classIds.filter((x) => x !== c.id));
                    }} />
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.studentIds.length} คน</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </Card>

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
                    <li key={q.questionId} className="flex items-start gap-3 p-3 rounded-md border border-border">
                      <span className="text-sm font-semibold w-6 text-muted-foreground">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{item?.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          <MathRender text={item?.body ?? ""} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input type="number" value={q.points} onChange={(e) => setPoints(i, +e.target.value)} className="w-16 h-8" />
                        <span className="text-xs text-muted-foreground">คะแนน</span>
                        <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="เลื่อนขึ้น" title="เลื่อนขึ้น"><ArrowUp className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === draft.questions.length - 1} aria-label="เลื่อนลง" title="เลื่อนลง"><ArrowDown className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => removeQuestion(q.questionId)} aria-label="ลบออกจากชุด" title="ลบออก"><X className="w-4 h-4" /></Button>
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
                <SelectContent>
                  {["ม.4", "ม.5", "ม.6"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
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
            <h3 className="font-semibold mb-3">เพิ่มข้อจากคลัง</h3>
            <div className="space-y-2 max-h-[480px] overflow-y-auto scrollbar-thin -mx-2 px-2">
              {questions.filter(q => q.status === "published").map((q) => {
                const added = selectedIds.has(q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => added ? removeQuestion(q.id) : addQuestion(q.id)}
                    className={`w-full text-left p-2.5 rounded-md border transition-colors ${
                      added ? "border-success bg-success/5" : "border-border hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">{q.title}</div>
                      <span className="text-xs text-muted-foreground shrink-0">{q.gradeLevel}</span>
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      <MathRender text={q.body} />
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
