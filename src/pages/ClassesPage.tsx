import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface RosterRow { id: string; student_code: string; full_name: string }
interface ClassRow {
  id: string;
  name: string;
  grade_level: string;
  subject_code: string;
  teacher_id: string | null;
  teacher_name?: string;
  student_count: number;
  students: RosterRow[];
}

const dbErrorMessage = (message?: string) => {
  if (!message) return "ทำรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  if (message.includes("schema cache") || message.includes("Database client error")) {
    return "เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณากดโหลดใหม่อีกครั้ง";
  }
  return message;
};

export default function ClassesPage() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await (supabase as any).rpc("teacher_list_classes_with_students");
      if (error) {
        console.warn("load classes via RPC failed:", error.message);
        setClasses([]);
        setLoadError(dbErrorMessage(error.message));
      } else {
        setClasses(((data ?? []) as ClassRow[]).map((c) => ({ ...c, students: c.students ?? [], student_count: c.student_count ?? 0 })));
      }
    } catch (e) {
      console.warn("classes load exception:", e);
      setClasses([]);
      setLoadError("โหลดข้อมูลห้องเรียนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const canCreateClass = profile?.role === "teacher" || profile?.role === "admin";

  return (
    <AppLayout title="ห้องเรียน">
      <div className="flex justify-end mb-4">
        {canCreateClass && (
          <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1.5" /> สร้างห้องเรียนใหม่</Button>
        )}
      </div>
      {loading ? (
        <Card className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></Card>
      ) : loadError ? (
        <Card className="p-8 text-center space-y-3">
          <p className="font-medium">โหลดห้องเรียนไม่สำเร็จ</p>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button variant="outline" onClick={load}>โหลดใหม่</Button>
        </Card>
      ) : classes.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">ยังไม่มีห้องเรียน</Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {classes.map((c) => (
            <ClassCard key={c.id} c={c} onChange={load} />
          ))}
        </div>
      )}

      <CreateClassDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
    </AppLayout>
  );
}

function ClassCard({ c, onChange }: { c: ClassRow; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg">{c.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {c.grade_level} {c.subject_code ? `• รหัสวิชา ${c.subject_code}` : ""}
          </p>
        </div>
        <span className="chip bg-primary-soft text-primary"><Users className="w-3 h-3" /> {c.student_count} คน</span>
      </div>
      <div className="flex gap-2 mt-4">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setOpen(true)}>
          จัดการนักเรียน
        </Button>
      </div>
      <RosterDialog classId={c.id} className={c.name} students={c.students} open={open} onOpenChange={setOpen} onChange={onChange} />
    </Card>
  );
}

function CreateClassDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (b: boolean) => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim() || !grade.trim()) { toast.error("กรอกชื่อห้องและระดับชั้น"); return; }
    setBusy(true);
    const { error } = await (supabase as any).rpc("teacher_create_class", {
      _name: name.trim(),
      _grade_level: grade.trim(),
      _subject_code: code.trim(),
    });
    setBusy(false);
    if (error) { toast.error("สร้างห้องเรียนไม่สำเร็จ: " + dbErrorMessage(error.message)); return; }
    toast.success("สร้างห้องเรียนแล้ว");
    setName(""); setGrade(""); setCode("");
    onOpenChange(false); onCreated();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>สร้างห้องเรียนใหม่</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>ชื่อห้อง</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ม.4/1" /></div>
          <div><Label>ระดับชั้น</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="เช่น ม.4" /></div>
          <div><Label>รหัสวิชา</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น ค31101" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}สร้าง</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RosterDialog({ classId, className, students, open, onOpenChange, onChange }: { classId: string; className: string; students: RosterRow[]; open: boolean; onOpenChange: (b: boolean) => void; onChange: () => void }) {
  const [roster, setRoster] = useState<RosterRow[]>(students);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setRoster(students); }, [students]);

  const addOne = async () => {
    if (!code.trim() || !name.trim()) { toast.error("กรอกเลขประจำตัวและชื่อ"); return; }
    setBusy(true);
    const { error } = await (supabase as any).rpc("teacher_add_student_to_class", { _class_id: classId, _student_code: code.trim(), _full_name: name.trim() });
    setBusy(false);
    if (error) { toast.error(dbErrorMessage(error.message)); return; }
    setCode(""); setName(""); await onChange();
    toast.success("เพิ่มนักเรียนแล้ว");
  };

  const importCsv = async () => {
    const lines = csv.split("\n").map((l) => l.trim()).filter(Boolean);
    const rows = lines.map((l) => {
      const [c, ...rest] = l.split(/[,\t]/).map((x) => x.trim());
      return { student_code: c, full_name: rest.join(" ").trim() };
    }).filter((r) => r.student_code && r.full_name);
    if (rows.length === 0) { toast.error("ไม่พบข้อมูลที่ใช้งานได้"); return; }
    setBusy(true);
    let added = 0;
    for (const row of rows) {
      const { error } = await (supabase as any).rpc("teacher_add_student_to_class", { _class_id: classId, _student_code: row.student_code, _full_name: row.full_name });
      if (error) {
        setBusy(false);
        toast.error(dbErrorMessage(error.message));
        return;
      }
      added += 1;
    }
    setBusy(false);
    setCsv(""); await onChange();
    toast.success(`นำเข้าแล้ว ${added} รายการ`);
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).rpc("teacher_remove_student_from_class", { _student_row_id: id });
    if (error) { toast.error(dbErrorMessage(error.message)); return; }
    await onChange();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>นักเรียนในห้อง {className}</DialogTitle></DialogHeader>
        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">รายชื่อ ({roster.length})</TabsTrigger>
            <TabsTrigger value="add">เพิ่มทีละคน</TabsTrigger>
            <TabsTrigger value="import">นำเข้าหลายคน</TabsTrigger>
          </TabsList>
          <TabsContent value="list">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto my-6" /> : roster.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">ยังไม่มีนักเรียน</div>
            ) : (
              <div className="max-h-80 overflow-auto space-y-1 mt-2">
                {roster.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                    <div className="text-sm"><span className="font-mono mr-3">{r.student_code}</span>{r.full_name}</div>
                    <Button variant="ghost" size="sm" onClick={() => remove(r.id)} aria-label="ลบ"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="add">
            <div className="space-y-3 mt-2">
              <div><Label>เลขประจำตัวนักเรียน</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น 12345" /></div>
              <div><Label>ชื่อ-นามสกุล</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น สมชาย ใจดี" /></div>
              <Button onClick={addOne} disabled={busy} className="w-full">{busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}เพิ่มนักเรียน</Button>
            </div>
          </TabsContent>
          <TabsContent value="import">
            <div className="space-y-3 mt-2">
              <Label>วางข้อมูล (รูปแบบ: เลขประจำตัว,ชื่อ-นามสกุล ต่อบรรทัด)</Label>
              <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={8} placeholder={"12345,สมชาย ใจดี\n12346,สมหญิง รักเรียน"} className="font-mono text-sm" />
              <Button onClick={importCsv} disabled={busy} className="w-full">{busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}นำเข้า</Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
