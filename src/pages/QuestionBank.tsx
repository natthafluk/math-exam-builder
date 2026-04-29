import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MathRender } from "@/components/MathRender";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Edit3, Copy, Archive, Eye, Filter } from "lucide-react";
import { toast } from "sonner";
import type { Question } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  mcq: "ปรนัย", short: "เติมคำตอบ", tf: "ถูก/ผิด", written: "อัตนัย",
};
const DIFF_LABEL: Record<string, string> = { easy: "ง่าย", medium: "ปานกลาง", hard: "ยาก" };
const STATUS_TONE: Record<string, string> = {
  published: "bg-success/10 text-success",
  draft: "bg-muted text-muted-foreground",
  review: "bg-warning/10 text-warning",
  archived: "bg-destructive/10 text-destructive",
};

export default function QuestionBank() {
  const navigate = useNavigate();
  const { questions, topics, addQuestion, updateQuestion } = useStore();
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState<string>("all");
  const [topic, setTopic] = useState<string>("all");
  const [diff, setDiff] = useState<string>("all");
  const [type, setType] = useState<string>("all");

  const filtered = useMemo(() => {
    return questions.filter((x) => {
      if (q && !(`${x.title} ${x.body} ${x.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()))) return false;
      if (grade !== "all" && x.gradeLevel !== grade) return false;
      if (topic !== "all" && x.topicId !== topic) return false;
      if (diff !== "all" && x.difficulty !== diff) return false;
      if (type !== "all" && x.type !== type) return false;
      return true;
    });
  }, [questions, q, grade, topic, diff, type]);

  const duplicate = (item: Question) => {
    const clone: Question = {
      ...item,
      id: `q-${Date.now()}`,
      title: item.title + " (สำเนา)",
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addQuestion(clone);
    toast.success("ทำสำเนาข้อสอบแล้ว");
  };

  const archive = (item: Question) => {
    updateQuestion({ ...item, status: "archived" });
    toast.success("เก็บเข้าคลังแล้ว");
  };

  return (
    <AppLayout
      title="คลังข้อสอบ"
      actions={
        <Button onClick={() => navigate("/questions/new")} className="gap-1.5">
          <Plus className="w-4 h-4" /> สร้างข้อใหม่
        </Button>
      }
    >
      <Card className="p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาด้วยชื่อ เนื้อหา หรือแท็ก..." className="pl-8" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Filter className="w-4 h-4 text-muted-foreground self-center" />
            <SmallSelect value={grade} onChange={setGrade} placeholder="ระดับชั้น" options={[["all", "ทุกระดับ"], ["ม.4", "ม.4"], ["ม.5", "ม.5"], ["ม.6", "ม.6"]]} />
            <SmallSelect value={topic} onChange={setTopic} placeholder="หัวข้อ" options={[["all", "ทุกหัวข้อ"], ...topics.map(t => [t.id, t.title] as [string, string])]} />
            <SmallSelect value={diff} onChange={setDiff} placeholder="ระดับ" options={[["all", "ทุกระดับยาก"], ["easy", "ง่าย"], ["medium", "ปานกลาง"], ["hard", "ยาก"]]} />
            <SmallSelect value={type} onChange={setType} placeholder="ประเภท" options={[["all", "ทุกประเภท"], ["mcq", "ปรนัย"], ["short", "เติมคำตอบ"], ["tf", "ถูก/ผิด"], ["written", "อัตนัย"]]} />
          </div>
        </div>
      </Card>

      <div className="text-sm text-muted-foreground mb-3">พบ {filtered.length} ข้อ</div>

      <div className="space-y-3">
        {filtered.map((q) => {
          const topicName = topics.find((t) => t.id === q.topicId)?.title;
          return (
            <Card key={q.id} className="p-4 hover:shadow-sm transition-shadow">
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold">{q.title}</h3>
                    <span className={`chip ${STATUS_TONE[q.status]}`}>{q.status}</span>
                    <span className="chip bg-primary-soft text-primary">{q.gradeLevel}</span>
                    <span className="chip bg-muted text-muted-foreground">{topicName}</span>
                    <span className="chip bg-accent-soft text-accent">{DIFF_LABEL[q.difficulty]}</span>
                    <span className="chip bg-secondary text-secondary-foreground">{TYPE_LABEL[q.type]}</span>
                  </div>
                  <div className="text-[15px] text-foreground/90 leading-relaxed line-clamp-2">
                    <MathRender text={q.body} />
                  </div>
                  {q.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {q.tags.map((t) => (
                        <span key={t} className="text-[11px] text-muted-foreground">#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex md:flex-col gap-1 shrink-0">
                  <Button asChild variant="ghost" size="icon" title="แก้ไข">
                    <Link to={`/questions/${q.id}`}><Edit3 className="w-4 h-4" /></Link>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => duplicate(q)} title="ทำสำเนา">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => archive(q)} title="เก็บถาวร">
                    <Archive className="w-4 h-4" />
                  </Button>
                  <Button asChild variant="ghost" size="icon" title="ดูตัวอย่าง">
                    <Link to={`/questions/${q.id}?preview=1`}><Eye className="w-4 h-4" /></Link>
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground">
            ไม่พบข้อสอบที่ตรงกับเงื่อนไข
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function SmallSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: [string, string][]; placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[140px] text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
