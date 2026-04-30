import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FormulaEditor } from "@/components/FormulaEditor";
import { MathRender } from "@/components/MathRender";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, ArrowLeft, Save, CheckCircle2, Circle, Lock, Globe } from "lucide-react";
import { toast } from "sonner";
import { validateMath } from "@/lib/mathValidate";
import type { Choice, Difficulty, Question, QuestionStatus, QuestionType } from "@/lib/types";

export default function QuestionEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { questions, topics, users, currentUser, addQuestion, updateQuestion, logAudit } = useStore();
  const existing = id && id !== "new" ? questions.find((x) => x.id === id) : undefined;

  const [draft, setDraft] = useState<Question>(
    existing ?? {
      id: `q-${Date.now()}`, title: "", body: "", type: "mcq",
      choices: [
        { id: "a", text: "" }, { id: "b", text: "" },
        { id: "c", text: "" }, { id: "d", text: "" },
      ],
      correctAnswer: "a", explanation: "",
      gradeLevel: "ม.4", topicId: topics[0]?.id ?? "",
      difficulty: "medium", tags: [],
      status: "draft", authorId: currentUser.id, lastEditedBy: currentUser.id,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
  );
  const [tagInput, setTagInput] = useState("");

  const set = <K extends keyof Question>(k: K, v: Question[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const checklist = useMemo(() => {
    const allMath = [draft.body, draft.explanation, ...(draft.choices ?? []).map(c => c.text)].join("\n");
    const mathOk = validateMath(allMath).length === 0;
    return [
      { ok: !!draft.title.trim() && !!draft.body.trim(), label: "มีชื่อโจทย์และเนื้อหา" },
      { ok: !!draft.topicId, label: "เลือกหัวข้อแล้ว" },
      { ok: !!draft.difficulty, label: "ระบุระดับความยาก" },
      { ok: hasCorrectAnswer(draft), label: "กำหนดคำตอบที่ถูกต้อง" },
      { ok: !!draft.explanation.trim(), label: "มีคำอธิบายเฉลย" },
      { ok: mathOk, label: "สูตรคณิตศาสตร์ถูกต้อง" },
    ];
  }, [draft]);

  const ready = checklist.every(c => c.ok);

  const save = (status?: QuestionStatus) => {
    if (!draft.title.trim() || !draft.body.trim()) {
      toast.error("กรุณากรอกชื่อและเนื้อหาโจทย์");
      return;
    }
    const next: Question = {
      ...draft,
      status: status ?? draft.status,
      lastEditedBy: currentUser.id,
      reviewedBy: status === "published" ? currentUser.id : draft.reviewedBy,
      updatedAt: new Date().toISOString(),
    };
    existing ? updateQuestion(next) : addQuestion(next);
    if (status === "draft") logAudit({ action: existing ? "บันทึกข้อสอบส่วนตัว" : "สร้างข้อสอบส่วนตัว", target: next.title, tone: "default" });
    if (status === "published") logAudit({ action: existing ? "อัปเดตข้อสอบในคลัง" : "ส่งข้อสอบเข้าคลัง", target: next.title, tone: "success" });
    toast.success(existing ? "บันทึกการแก้ไขแล้ว" : "เพิ่มข้อใหม่เข้าคลังแล้ว");
    navigate("/questions");
  };

  const author = users.find(u => u.id === draft.authorId);
  const editor = users.find(u => u.id === draft.lastEditedBy);
  const reviewer = users.find(u => u.id === draft.reviewedBy);

  return (
    <AppLayout
      title={existing ? "แก้ไขข้อสอบ" : "สร้างข้อสอบใหม่"}
      breadcrumbs={[
        { label: "หน้าหลัก", to: "/" },
        { label: "คลังข้อสอบ", to: "/questions" },
        { label: existing ? "แก้ไข" : "สร้างใหม่" },
      ]}
      actions={
        <div className="flex flex-wrap gap-1.5 justify-end">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1.5"><ArrowLeft className="w-4 h-4" /> ย้อนกลับ</Button>
          <Button variant="secondary" size="sm" onClick={() => save("draft")} className="gap-1.5" title="เก็บไว้ดูคนเดียว ไม่เข้าคลังกลาง">
            <Lock className="w-3.5 h-3.5" /> เก็บส่วนตัว
          </Button>
          <Button size="sm" onClick={() => save("published")} className="gap-1.5" disabled={!ready} title={!ready ? "ตรวจสอบรายการคุณภาพก่อนส่งเข้าคลัง" : "ส่งเข้าคลังกลางให้ครูคนอื่นใช้ได้"}>
            <Globe className="w-4 h-4" /> ส่งเข้าคลัง
          </Button>
        </div>
      }
    >
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-5 space-y-4">
            <div>
              <Label>ชื่อข้อสอบ</Label>
              <Input value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="เช่น สมการกำลังสอง" className="mt-1.5" />
            </div>
            <FormulaEditor label="เนื้อโจทย์" value={draft.body} onChange={(v) => set("body", v)} />
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">ตัวเลือกและคำตอบ</h3>
              <Select value={draft.type} onValueChange={(v: QuestionType) => set("type", v)}>
                <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">ปรนัย (เลือกตอบ)</SelectItem>
                  <SelectItem value="short">เติมคำตอบ</SelectItem>
                  <SelectItem value="tf">ถูก / ผิด</SelectItem>
                  <SelectItem value="written">อัตนัย (พิสูจน์/เขียน)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {draft.type === "mcq" && (
              <ChoicesEditor
                choices={draft.choices ?? []}
                onChange={(c) => set("choices", c)}
                correct={draft.correctAnswer}
                setCorrect={(v) => set("correctAnswer", v)}
              />
            )}
            {draft.type === "tf" && (
              <div className="flex gap-3">
                {(["true", "false"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => set("correctAnswer", v)}
                    className={`flex-1 px-4 py-3 rounded-md border text-sm font-medium transition-colors ${draft.correctAnswer === v ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-muted"}`}>
                    {v === "true" ? "✓ ถูก" : "✗ ผิด"}
                  </button>
                ))}
              </div>
            )}
            {draft.type === "short" && (
              <div>
                <Label>คำตอบที่ถูกต้อง</Label>
                <Input value={draft.correctAnswer} onChange={(e) => set("correctAnswer", e.target.value)} placeholder="เช่น 12x^3 - 4x + 5" className="mt-1.5 font-mono" />
              </div>
            )}
            {draft.type === "written" && (
              <FormulaEditor label="แนวคำตอบ / เกณฑ์การให้คะแนน" value={draft.correctAnswer} onChange={(v) => set("correctAnswer", v)} rows={4} />
            )}
          </Card>

          <Card className="p-5">
            <FormulaEditor label="คำอธิบายเฉลย" value={draft.explanation} onChange={(v) => set("explanation", v)} rows={4} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="font-semibold mb-3">รายการคุณภาพ</h3>
            <ul className="space-y-2">
              {checklist.map((c, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm ${c.ok ? "text-success" : "text-muted-foreground"}`}>
                  {c.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <Circle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{c.label}</span>
                </li>
              ))}
            </ul>
            <div className={`mt-3 p-2.5 rounded-md text-xs ${ready ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
              {ready ? "พร้อมเผยแพร่" : "ยังไม่พร้อมเผยแพร่ — แก้ไขรายการที่ขาด"}
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="font-semibold">รายละเอียด</h3>
            <div>
              <Label>ระดับชั้น</Label>
              <Select value={draft.gradeLevel} onValueChange={(v) => set("gradeLevel", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>หัวข้อ</Label>
              <Select value={draft.topicId} onValueChange={(v) => set("topicId", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{topics.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>ระดับความยาก</Label>
              <Select value={draft.difficulty} onValueChange={(v: Difficulty) => set("difficulty", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">ง่าย</SelectItem>
                  <SelectItem value="medium">ปานกลาง</SelectItem>
                  <SelectItem value="hard">ยาก</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>แท็ก</Label>
              <div className="flex gap-1.5 flex-wrap mt-1.5 mb-2">
                {draft.tags.map((t) => (
                  <span key={t} className="chip bg-secondary text-secondary-foreground gap-1">
                    #{t}
                    <button onClick={() => set("tags", draft.tags.filter((x) => x !== t))} className="hover:text-destructive" aria-label={`ลบแท็ก ${t}`}>×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="เพิ่มแท็ก..." onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) { e.preventDefault(); set("tags", [...draft.tags, tagInput.trim()]); setTagInput(""); }
                }} />
                <Button type="button" variant="outline" size="icon" aria-label="เพิ่มแท็ก" onClick={() => {
                  if (tagInput.trim()) { set("tags", [...draft.tags, tagInput.trim()]); setTagInput(""); }
                }}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
          </Card>

          <Card className="p-5 text-xs space-y-1.5">
            <h3 className="font-semibold text-sm mb-2">ประวัติเวอร์ชัน</h3>
            <Row label="สร้างโดย" value={author?.name ?? "—"} sub={new Date(draft.createdAt).toLocaleString("th-TH")} />
            <Row label="แก้ไขล่าสุด" value={editor?.name ?? "—"} sub={new Date(draft.updatedAt).toLocaleString("th-TH")} />
            <Row label="ตรวจสอบโดย" value={reviewer?.name ?? "ยังไม่ได้รับการตรวจ"} />
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3">ตัวอย่างที่นักเรียนเห็น</h3>
            <div className="border border-border rounded-md p-4 bg-muted/30 text-[15px] leading-relaxed">
              <div className="font-medium mb-2">{draft.title || "ไม่มีชื่อข้อสอบ"}</div>
              <MathRender text={draft.body || "_เพิ่มเนื้อโจทย์_"} block />
              {draft.type === "mcq" && (
                <ol className="mt-3 space-y-1.5 list-[lower-alpha] pl-5">
                  {(draft.choices ?? []).map((c) => (
                    <li key={c.id}><MathRender text={c.text || "—"} /></li>
                  ))}
                </ol>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">
        <div className="font-medium text-foreground">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function hasCorrectAnswer(q: Question): boolean {
  if (q.type === "mcq") return !!q.correctAnswer && !!(q.choices ?? []).find(c => c.id === q.correctAnswer && c.text.trim());
  if (q.type === "tf") return q.correctAnswer === "true" || q.correctAnswer === "false";
  return !!q.correctAnswer.trim();
}

function ChoicesEditor({ choices, onChange, correct, setCorrect }: {
  choices: Choice[]; onChange: (c: Choice[]) => void; correct: string; setCorrect: (v: string) => void;
}) {
  const update = (idx: number, text: string) => onChange(choices.map((c, i) => (i === idx ? { ...c, text } : c)));
  const add = () => onChange([...choices, { id: String.fromCharCode(97 + choices.length), text: "" }]);
  const remove = (idx: number) => onChange(choices.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {choices.map((c, i) => (
        <div key={c.id} className="flex items-start gap-2">
          <button type="button" onClick={() => setCorrect(c.id)}
            className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${correct === c.id ? "border-success bg-success text-white" : "border-border hover:border-primary"}`}
            title="ตั้งเป็นคำตอบที่ถูก" aria-label={`ตั้งตัวเลือก ${c.id} เป็นคำตอบ`}>
            {c.id.toUpperCase()}
          </button>
          <Input value={c.text} onChange={(e) => update(i, e.target.value)} placeholder="ใช้ $...$ สำหรับสูตร" className="font-mono text-sm" />
          <Button variant="ghost" size="icon" onClick={() => remove(i)} aria-label={`ลบตัวเลือก ${c.id}`}><Trash2 className="w-4 h-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> เพิ่มตัวเลือก</Button>
      <p className="text-xs text-muted-foreground">คลิกตัวอักษรหน้าตัวเลือกเพื่อเลือกคำตอบที่ถูกต้อง</p>
    </div>
  );
}
