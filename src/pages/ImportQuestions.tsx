import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, FileText, FileType, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const SAMPLE_CSV = `title,type,body,choice_a,choice_b,choice_c,choice_d,answer,grade,topic,difficulty
สมการเชิงเส้น,mcq,"แก้สมการ $2x + 3 = 11$",x=2,x=3,x=4,x=5,c,ม.3,t-eq3,easy
อนุพันธ์เบื้องต้น,short,"จงหา $\\frac{d}{dx}(x^3)$",,,,,3x^2,ม.6,t-calc,easy`;

interface Row { title: string; type: string; grade: string; topic: string; ok: boolean; note: string }

export default function ImportQuestions() {
  const navigate = useNavigate();
  const { topics, addQuestion, currentUser, logAudit } = useStore();
  const [source, setSource] = useState<"csv" | "word" | "pdf">("csv");
  const [raw, setRaw] = useState(SAMPLE_CSV);
  const [defaultTopic, setDefaultTopic] = useState(topics[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>([]);

  const parse = () => {
    if (source !== "csv") {
      toast.info(`การนำเข้าจาก ${source.toUpperCase()} อยู่ในเวอร์ชันสาธิต — ระบบจะแสดงตัวอย่างการแมปข้อมูล`);
    }
    const lines = raw.trim().split("\n").filter(Boolean);
    if (lines.length < 2) { toast.error("ข้อมูลไม่เพียงพอ"); return; }
    const parsed: Row[] = lines.slice(1).map((line) => {
      const cols = splitCsv(line);
      const title = cols[0] ?? "";
      const type = (cols[1] ?? "mcq").trim();
      const grade = cols[8] ?? "ม.4";
      const topic = cols[9] ?? defaultTopic;
      const ok = !!title.trim() && ["mcq","short","tf","written"].includes(type);
      return { title, type, grade, topic, ok, note: ok ? "พร้อมนำเข้า" : "ข้อมูลไม่ครบ — ตรวจสอบคอลัมน์" };
    });
    setRows(parsed);
    toast.success(`พบ ${parsed.length} รายการ — ตรวจสอบก่อนยืนยัน`);
  };

  const importAll = () => {
    const valid = rows.filter(r => r.ok);
    if (valid.length === 0) { toast.error("ไม่มีรายการที่นำเข้าได้"); return; }
    const lines = raw.trim().split("\n").slice(1).filter(Boolean);
    valid.forEach((r, idx) => {
      const cols = splitCsv(lines[idx]);
      const type = r.type as any;
      addQuestion({
        id: `q-imp-${Date.now()}-${idx}`,
        title: r.title,
        body: cols[2] ?? "",
        type,
        choices: type === "mcq" ? ["a","b","c","d"].map((id, i) => ({ id, text: cols[3 + i] ?? "" })) : undefined,
        correctAnswer: cols[7] ?? "",
        explanation: "",
        gradeLevel: r.grade,
        topicId: topics.find(t => t.id === r.topic) ? r.topic : defaultTopic,
        difficulty: (cols[10] ?? "medium") as any,
        tags: ["นำเข้า"],
        status: "draft",
        authorId: currentUser.id,
        lastEditedBy: currentUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
    logAudit({ action: `นำเข้าข้อสอบ ${valid.length} ข้อ`, tone: "success" });
    toast.success(`นำเข้าสำเร็จ ${valid.length} ข้อ (สถานะ: ฉบับร่าง)`);
    navigate("/questions");
  };

  return (
    <AppLayout
      title="นำเข้าข้อสอบ"
      breadcrumbs={[
        { label: "หน้าหลัก", to: "/" },
        { label: "คลังข้อสอบ", to: "/questions" },
        { label: "นำเข้า" },
      ]}
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
        </Button>
      }
    >
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-5">
            <h3 className="font-semibold mb-3">เลือกแหล่งที่มา</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "csv", icon: FileSpreadsheet, label: "CSV / Excel", desc: "แนะนำ • โครงสร้างชัด" },
                { id: "word", icon: FileType, label: "Word (.docx)", desc: "เดโม" },
                { id: "pdf", icon: FileText, label: "PDF", desc: "เดโม" },
              ].map((s) => (
                <button key={s.id} onClick={() => setSource(s.id as any)}
                  className={`p-3 rounded-md border-2 text-left transition-colors ${source === s.id ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"}`}>
                  <s.icon className="w-5 h-5 mb-1.5 text-primary" />
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-[11px] text-muted-foreground">{s.desc}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <Label>วาง/อัปโหลดข้อมูล (เดโม: ใช้ตัวอย่าง CSV ด้านล่าง)</Label>
            <Textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={10} className="mt-2 font-mono text-xs" />
            <div className="flex gap-2 mt-3">
              <Button onClick={parse} className="gap-1.5"><Upload className="w-4 h-4" /> วิเคราะห์ข้อมูล</Button>
              <Button variant="outline" onClick={() => setRaw(SAMPLE_CSV)}>โหลดตัวอย่าง</Button>
            </div>
          </Card>

          {rows.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">ตัวอย่างก่อนนำเข้า ({rows.filter(r => r.ok).length}/{rows.length} พร้อม)</h3>
                <Button onClick={importAll} className="gap-1.5"><CheckCircle2 className="w-4 h-4" /> ยืนยันนำเข้า</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อ</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>ระดับ</TableHead>
                      <TableHead>หัวข้อ</TableHead>
                      <TableHead>สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{r.title || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-xs">{r.type}</TableCell>
                        <TableCell className="text-xs">{r.grade}</TableCell>
                        <TableCell className="text-xs">{topics.find(t => t.id === r.topic)?.title ?? r.topic}</TableCell>
                        <TableCell>
                          <span className={`chip ${r.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{r.note}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="font-semibold mb-3">การตั้งค่าค่าเริ่มต้น</h3>
            <Label className="text-xs">หัวข้อหลักหากไม่ระบุ</Label>
            <Select value={defaultTopic} onValueChange={setDefaultTopic}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {topics.map((t) => <SelectItem key={t.id} value={t.id}>{t.title} ({t.gradeLevel})</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-3">ข้อสอบที่นำเข้าจะอยู่ในสถานะ "ฉบับร่าง" เพื่อให้คุณตรวจทานก่อนเผยแพร่</p>
          </Card>

          <Card className="p-5 text-xs space-y-2">
            <h3 className="font-semibold text-sm">รูปแบบ CSV</h3>
            <p className="text-muted-foreground">คอลัมน์ที่รองรับ:</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
              <li>title, type (mcq/short/tf/written)</li>
              <li>body (ใส่สูตรในรูป $...$)</li>
              <li>choice_a — choice_d</li>
              <li>answer (สำหรับ mcq ใช้ a/b/c/d)</li>
              <li>grade, topic, difficulty</li>
            </ul>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}
