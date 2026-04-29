import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useStore, roleLabel } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BookOpen, ClipboardList, Users, TrendingUp, ShieldCheck, Plus, Trash2, CheckCircle2, Database,
} from "lucide-react";
import { toast } from "sonner";
import type { Role, QuestionStatus } from "@/lib/types";

export default function AdminPage() {
  const {
    users, questions, exams, attempts, topics, audit, school, setSchool,
    setUserRole, addUser, deleteUser, addTopic, deleteTopic, updateQuestion,
  } = useStore();
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "teacher" as Role });
  const [newTopic, setNewTopic] = useState({ title: "", grade: "ม.4" });

  const reviewQueue = questions.filter((q) => q.status === "review" || q.status === "draft");

  const [dbStats, setDbStats] = useState<{
    teachers: number; students: number; classes: number;
    questions: number; exams: number; attempts: number; avgScore: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const opts = { count: "exact" as const, head: true };
      const [tRes, sRes, cRes, qRes, eRes, aRes, scRes] = await Promise.all([
        supabase.from("profiles").select("id", opts).eq("role", "teacher"),
        supabase.from("profiles").select("id", opts).eq("role", "student"),
        supabase.from("classes").select("id", opts),
        supabase.from("questions").select("id", opts),
        supabase.from("exams").select("id", opts),
        supabase.from("attempts").select("id", opts),
        supabase.from("attempts").select("score, max_score").eq("status", "submitted"),
      ]);
      if (cancelled) return;
      const scored = (scRes.data ?? []).filter((r: any) => r.max_score > 0);
      const avg = scored.length === 0 ? 0
        : Math.round(scored.reduce((acc: number, r: any) => acc + (r.score / r.max_score) * 100, 0) / scored.length);
      setDbStats({
        teachers: tRes.count ?? 0,
        students: sRes.count ?? 0,
        classes: cRes.count ?? 0,
        questions: qRes.count ?? 0,
        exams: eRes.count ?? 0,
        attempts: aRes.count ?? 0,
        avgScore: avg,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = [
    { icon: Users, label: "ผู้ใช้ทั้งหมด", value: users.length },
    { icon: BookOpen, label: "ข้อในคลัง", value: questions.length },
    { icon: ClipboardList, label: "ชุดข้อสอบ", value: exams.length },
    { icon: TrendingUp, label: "การส่งข้อสอบ", value: attempts.length },
  ];

  const handleApprove = (id: string, status: QuestionStatus) => {
    const q = questions.find((x) => x.id === id);
    if (!q) return;
    updateQuestion({ ...q, status, updatedAt: new Date().toISOString() });
    toast.success(status === "published" ? "อนุมัติและเผยแพร่แล้ว" : "ปฏิเสธและเก็บถาวรแล้ว");
  };

  const handleAddUser = () => {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      toast.error("กรุณากรอกชื่อและอีเมล");
      return;
    }
    addUser({
      id: `u-${Date.now()}`,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      avatarColor: "bg-primary",
    });
    setNewUser({ name: "", email: "", role: "teacher" });
    toast.success("เพิ่มผู้ใช้แล้ว");
  };

  const handleAddTopic = () => {
    if (!newTopic.title.trim()) {
      toast.error("กรุณากรอกชื่อหัวข้อ");
      return;
    }
    addTopic({
      id: `t-${Date.now()}`,
      title: newTopic.title,
      gradeLevel: newTopic.grade,
    });
    setNewTopic({ title: "", grade: "ม.4" });
    toast.success("เพิ่มหัวข้อแล้ว");
  };

  return (
    <AppLayout title="ศูนย์ควบคุมผู้ดูแลระบบ" breadcrumbs={[{ label: "หน้าหลัก", to: "/" }, { label: "ศูนย์ผู้ดูแล" }]}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label} className="p-5 flex items-start gap-3">
            <div className="w-10 h-10 rounded-md bg-primary-soft text-primary flex items-center justify-center">
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-semibold mt-0.5 tabular-nums">{s.value}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5 mb-6">
        <h3 className="font-semibold mb-3">ข้อมูลโรงเรียน</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">ชื่อโรงเรียน</label>
            <Input value={school.schoolName} onChange={(e) => setSchool({ ...school, schoolName: e.target.value })} className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">กลุ่มสาระ</label>
            <Input value={school.department} onChange={(e) => setSchool({ ...school, department: e.target.value })} className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">ปีการศึกษา</label>
            <Input value={school.academicYear} onChange={(e) => setSchool({ ...school, academicYear: e.target.value })} className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">ภาคเรียน</label>
            <Input value={school.semester} onChange={(e) => setSchool({ ...school, semester: e.target.value })} className="mt-1" />
          </div>
        </div>
      </Card>

      <Card className="p-5 mb-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          คิวรออนุมัติข้อสอบ ({reviewQueue.length})
        </h3>
        {reviewQueue.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">ไม่มีรายการรออนุมัติ</p>
        ) : (
          <ul className="divide-y divide-border">
            {reviewQueue.map((q) => (
              <li key={q.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{q.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {q.gradeLevel} • {q.difficulty} • สถานะปัจจุบัน: {q.status}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(q.id, "published")}
                    className="gap-1"
                    aria-label="อนุมัติและเผยแพร่"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> อนุมัติ
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApprove(q.id, "archived")}
                    aria-label="ปฏิเสธและเก็บถาวร"
                  >
                    ปฏิเสธ
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">จัดการผู้ใช้และบทบาท</h3>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px_auto] gap-2 mb-4">
            <Input
              placeholder="ชื่อ-สกุล"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            />
            <Input
              placeholder="อีเมล"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
            <Select value={newUser.role} onValueChange={(v: Role) => setNewUser({ ...newUser, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">{roleLabel.admin}</SelectItem>
                <SelectItem value="teacher">{roleLabel.teacher}</SelectItem>
                <SelectItem value="student">{roleLabel.student}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAddUser} aria-label="เพิ่มผู้ใช้" className="gap-1">
              <Plus className="w-4 h-4" /> เพิ่ม
            </Button>
          </div>

          <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>บทบาท</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <div className="text-sm">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(v: Role) => {
                        setUserRole(u.id, v);
                        toast.success(`เปลี่ยนบทบาท ${u.name} เป็น ${roleLabel[v]}`);
                      }}>
                        <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">{roleLabel.admin}</SelectItem>
                          <SelectItem value="teacher">{roleLabel.teacher}</SelectItem>
                          <SelectItem value="student">{roleLabel.student}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          deleteUser(u.id);
                          toast.success("ลบผู้ใช้แล้ว");
                        }}
                        aria-label={`ลบผู้ใช้ ${u.name}`}
                        title="ลบผู้ใช้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3">หัวข้อและระดับชั้น</h3>
          <div className="grid grid-cols-[1fr_100px_auto] gap-2 mb-4">
            <Input
              placeholder="ชื่อหัวข้อ เช่น เวกเตอร์"
              value={newTopic.title}
              onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
            />
            <Select value={newTopic.grade} onValueChange={(v) => setNewTopic({ ...newTopic, grade: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ม.4">ม.4</SelectItem>
                <SelectItem value="ม.5">ม.5</SelectItem>
                <SelectItem value="ม.6">ม.6</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAddTopic} aria-label="เพิ่มหัวข้อ" className="gap-1">
              <Plus className="w-4 h-4" /> เพิ่ม
            </Button>
          </div>
          <ul className="divide-y divide-border max-h-[360px] overflow-y-auto scrollbar-thin">
            {topics.map((t) => {
              const count = questions.filter((q) => q.topicId === t.id).length;
              return (
                <li key={t.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.gradeLevel} • {count} ข้อ</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (count > 0) {
                        toast.error(`ลบไม่ได้: มี ${count} ข้อใช้หัวข้อนี้`);
                        return;
                      }
                      deleteTopic(t.id);
                      toast.success("ลบหัวข้อแล้ว");
                    }}
                    aria-label={`ลบหัวข้อ ${t.title}`}
                    title="ลบหัวข้อ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card className="p-5 mt-6">
        <h3 className="font-semibold mb-3">ไทม์ไลน์การใช้งานระบบ (Audit Log)</h3>
        <ul className="space-y-3">
          {audit.slice(0, 10).map((a) => {
            const tone: Record<string, string> = {
              success: "bg-success", warning: "bg-warning", destructive: "bg-destructive", default: "bg-primary",
            };
            return (
              <li key={a.id} className="flex gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${tone[a.tone ?? "default"]}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm"><span className="font-medium">{a.actorName}</span> — {a.action}</div>
                  {a.target && <div className="text-xs text-muted-foreground truncate">{a.target}</div>}
                  <div className="text-[11px] text-muted-foreground">{new Date(a.at).toLocaleString("th-TH")}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </AppLayout>
  );
}
