import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
  Plus, Search, Edit3, Copy, Archive, Eye, Filter, X, Upload, Send,
  CheckCheck, FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import type { Question, QuestionStatus } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = { mcq: "ปรนัย", short: "เติมคำตอบ", tf: "ถูก/ผิด", written: "อัตนัย" };
const DIFF_LABEL: Record<string, string> = { easy: "ง่าย", medium: "ปานกลาง", hard: "ยาก" };
const STATUS_LABEL: Record<string, string> = { published: "เผยแพร่", draft: "ฉบับร่าง", review: "รออนุมัติ", archived: "เก็บถาวร" };
const STATUS_TONE: Record<string, string> = {
  published: "bg-success/10 text-success",
  draft: "bg-muted text-muted-foreground",
  review: "bg-warning/10 text-warning",
  archived: "bg-destructive/10 text-destructive",
};

export default function QuestionBank() {
  const navigate = useNavigate();
  const { questions, topics, addQuestion, updateQuestion, bulkUpdateQuestionStatus, logAudit } = useStore();
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("all");
  const [topic, setTopic] = useState("all");
  const [diff, setDiff] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | { kind: "archive"; ids: string[] }>(null);

  const filtered = useMemo(() => questions.filter((x) => {
    if (q && !(`${x.title} ${x.body} ${x.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()))) return false;
    if (grade !== "all" && x.gradeLevel !== grade) return false;
    if (topic !== "all" && x.topicId !== topic) return false;
    if (diff !== "all" && x.difficulty !== diff) return false;
    if (type !== "all" && x.type !== type) return false;
    if (status !== "all" && x.status !== status) return false;
    return true;
  }), [questions, q, grade, topic, diff, type, status]);

  const activeChips = [
    grade !== "all" && { k: "grade", label: `ระดับ: ${grade}`, clear: () => setGrade("all") },
    topic !== "all" && { k: "topic", label: `หัวข้อ: ${topics.find(t => t.id === topic)?.title}`, clear: () => setTopic("all") },
    diff !== "all" && { k: "diff", label: `ยาก: ${DIFF_LABEL[diff]}`, clear: () => setDiff("all") },
    type !== "all" && { k: "type", label: `ประเภท: ${TYPE_LABEL[type]}`, clear: () => setType("all") },
    status !== "all" && { k: "status", label: `สถานะ: ${STATUS_LABEL[status]}`, clear: () => setStatus("all") },
    q && { k: "q", label: `ค้นหา: "${q}"`, clear: () => setQ("") },
  ].filter(Boolean) as { k: string; label: string; clear: () => void }[];

  const clearAll = () => { setQ(""); setGrade("all"); setTopic("all"); setDiff("all"); setType("all"); setStatus("all"); };

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(x => x.id)));

  const duplicate = (item: Question) => {
    addQuestion({ ...item, id: `q-${Date.now()}`, title: item.title + " (สำเนา)", status: "draft", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    toast.success("ทำสำเนาข้อสอบแล้ว");
  };

  const sendForReview = (item: Question) => {
    updateQuestion({ ...item, status: "review", updatedAt: new Date().toISOString() });
    logAudit({ action: "ส่งข้อสอบให้ตรวจ", target: item.title, tone: "warning" });
    toast.success("ส่งข้อสอบเข้าคิวรออนุมัติแล้ว");
  };

  const bulkChangeStatus = (s: QuestionStatus) => {
    if (selected.size === 0) return;
    bulkUpdateQuestionStatus(Array.from(selected), s);
    logAudit({ action: `เปลี่ยนสถานะ ${selected.size} ข้อ → ${STATUS_LABEL[s]}`, tone: s === "archived" ? "warning" : "default" });
    toast.success(`ปรับสถานะ ${selected.size} ข้อแล้ว`);
    setSelected(new Set());
  };

  return (
    <AppLayout
      title="คลังข้อสอบ"
      breadcrumbs={[{ label: "หน้าหลัก", to: "/" }, { label: "คลังข้อสอบ" }]}
      actions={
        <div className="flex gap-1.5">
          <Button asChild variant="outline" size="sm" className="gap-1.5 hidden sm:inline-flex">
            <Link to="/questions/import"><Upload className="w-4 h-4" /> นำเข้า</Link>
          </Button>
          <Button onClick={() => navigate("/questions/new")} className="gap-1.5" size="sm">
            <Plus className="w-4 h-4" /> สร้างข้อใหม่
          </Button>
        </div>
      }
    >
      <Card className="p-4 mb-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาด้วยชื่อ เนื้อหา หรือแท็ก..." className="pl-8" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Filter className="w-4 h-4 text-muted-foreground self-center hidden sm:block" />
            <SmallSelect value={grade} onChange={setGrade} options={[["all", "ทุกระดับ"], ["ม.1","ม.1"],["ม.2","ม.2"],["ม.3","ม.3"],["ม.4", "ม.4"], ["ม.5", "ม.5"], ["ม.6", "ม.6"]]} />
            <SmallSelect value={topic} onChange={setTopic} options={[["all", "ทุกหัวข้อ"], ...topics.map(t => [t.id, t.title] as [string, string])]} />
            <SmallSelect value={diff} onChange={setDiff} options={[["all", "ทุกระดับยาก"], ["easy", "ง่าย"], ["medium", "ปานกลาง"], ["hard", "ยาก"]]} />
            <SmallSelect value={type} onChange={setType} options={[["all", "ทุกประเภท"], ["mcq", "ปรนัย"], ["short", "เติมคำตอบ"], ["tf", "ถูก/ผิด"], ["written", "อัตนัย"]]} />
            <SmallSelect value={status} onChange={setStatus} options={[["all", "ทุกสถานะ"], ["published", "เผยแพร่"], ["draft", "ฉบับร่าง"], ["review", "รออนุมัติ"], ["archived", "เก็บถาวร"]]} />
          </div>
        </div>
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">ตัวกรอง:</span>
            {activeChips.map((c) => (
              <button key={c.k} onClick={c.clear} className="chip bg-primary-soft text-primary hover:bg-primary/15 transition-colors gap-1">
                {c.label} <X className="w-3 h-3" />
              </button>
            ))}
            <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground underline ml-1">ล้างทั้งหมด</button>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="text-sm text-muted-foreground">พบ {filtered.length} ข้อ • เลือก {selected.size}</div>
        {selected.size > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => bulkChangeStatus("review")} className="gap-1"><Send className="w-3.5 h-3.5" /> ส่งตรวจ</Button>
            <Button size="sm" variant="outline" onClick={() => bulkChangeStatus("published")} className="gap-1"><CheckCheck className="w-3.5 h-3.5" /> เผยแพร่</Button>
            <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "archive", ids: Array.from(selected) })} className="gap-1"><Archive className="w-3.5 h-3.5" /> เก็บถาวร</Button>
            <Button size="sm" variant="ghost" onClick={() => {
              const csv = filtered.filter(x => selected.has(x.id)).map(x => `${x.id},"${x.title}",${x.gradeLevel},${x.difficulty}`).join("\n");
              navigator.clipboard?.writeText(csv).catch(() => {});
              toast.success("คัดลอก CSV ของข้อที่เลือกแล้ว");
            }} className="gap-1"><FileSpreadsheet className="w-3.5 h-3.5" /> ส่งออก CSV</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>ยกเลิกการเลือก</Button>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center gap-2 px-2 mb-2">
          <Checkbox checked={selected.size === filtered.length} onCheckedChange={toggleAll} aria-label="เลือกทั้งหมด" />
          <span className="text-xs text-muted-foreground">เลือกทั้งหน้านี้</span>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((item) => {
          const topicName = topics.find((t) => t.id === item.topicId)?.title;
          const isSel = selected.has(item.id);
          return (
            <Card key={item.id} className={`p-4 hover:shadow-sm transition-shadow ${isSel ? "ring-2 ring-primary/40" : ""}`}>
              <div className="flex flex-col md:flex-row md:items-start gap-3">
                <Checkbox checked={isSel} onCheckedChange={() => toggle(item.id)} className="mt-1 shrink-0" aria-label={`เลือก ${item.title}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <h3 className="font-semibold">{item.title}</h3>
                    <span className={`chip ${STATUS_TONE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                    <span className="chip bg-primary-soft text-primary">{item.gradeLevel}</span>
                    <span className="chip bg-muted text-muted-foreground">{topicName}</span>
                    <span className="chip bg-accent-soft text-accent">{DIFF_LABEL[item.difficulty]}</span>
                    <span className="chip bg-secondary text-secondary-foreground">{TYPE_LABEL[item.type]}</span>
                  </div>
                  <div className="text-[15px] text-foreground/90 leading-relaxed line-clamp-2">
                    <MathRender text={item.body} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-2">
                    <span>อัปเดต {new Date(item.updatedAt).toLocaleDateString("th-TH")}</span>
                    {item.tags.slice(0, 4).map((t) => <span key={t}>#{t}</span>)}
                  </div>
                </div>
                <div className="flex md:flex-col gap-1 shrink-0">
                  <Button asChild variant="ghost" size="icon" title="ดูตัวอย่าง" aria-label={`ดูตัวอย่างข้อสอบ ${item.title}`}>
                    <Link to={`/questions/${item.id}/preview`}><Eye className="w-4 h-4" /></Link>
                  </Button>
                  <Button asChild variant="ghost" size="icon" title="แก้ไข" aria-label={`แก้ไขข้อสอบ ${item.title}`}>
                    <Link to={`/questions/${item.id}`}><Edit3 className="w-4 h-4" /></Link>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => duplicate(item)} title="ทำสำเนา" aria-label={`ทำสำเนา ${item.title}`}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  {item.status === "draft" && (
                    <Button variant="ghost" size="icon" onClick={() => sendForReview(item)} title="ส่งให้ตรวจ" aria-label={`ส่งให้ตรวจ ${item.title}`}>
                      <Send className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setConfirm({ kind: "archive", ids: [item.id] })} title="เก็บถาวร" aria-label={`เก็บถาวร ${item.title}`}>
                    <Archive className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground space-y-2">
            <p>ไม่พบข้อสอบที่ตรงกับเงื่อนไข</p>
            <Button variant="outline" size="sm" onClick={clearAll}>ล้างตัวกรอง</Button>
          </Card>
        )}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการเก็บถาวร</AlertDialogTitle>
            <AlertDialogDescription>
              จะเก็บถาวร {confirm?.ids.length ?? 0} ข้อ ข้อสอบที่เก็บถาวรจะไม่ปรากฏในการสร้างชุดข้อสอบ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!confirm) return;
              bulkUpdateQuestionStatus(confirm.ids, "archived");
              logAudit({ action: `เก็บถาวร ${confirm.ids.length} ข้อ`, tone: "warning" });
              toast.success(`เก็บถาวร ${confirm.ids.length} ข้อแล้ว`);
              setSelected(new Set());
              setConfirm(null);
            }}>ยืนยัน</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function SmallSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[140px] text-sm"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
