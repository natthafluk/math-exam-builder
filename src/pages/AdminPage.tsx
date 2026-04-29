import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useStore, roleLabel } from "@/lib/store";
import { useAuth } from "@/lib/auth";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BookOpen, ClipboardList, Users, TrendingUp, ShieldCheck, Plus, Trash2, CheckCircle2, Database, Crown, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import type { Role, QuestionStatus } from "@/lib/types";
import { loadPrimarySchoolStats, loadSecondarySchoolStats, retrySupabase, type PrimaryStats, type SecondaryStats } from "@/lib/adminStats";

type DbUser = {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  requested_role: Role | null;
  approval_status: string;
  is_super_admin: boolean;
  created_at: string;
};

export default function AdminPage() {
  const { profile: me } = useAuth();
  const { questions, topics, audit, addTopic, deleteTopic, updateQuestion } = useStore();
  const [newTopic, setNewTopic] = useState({ title: "", grade: "ม.4" });

  const reviewQueue = questions.filter((q) => q.status === "review" || q.status === "draft");

  const [primaryStats, setPrimaryStats] = useState<PrimaryStats | null>(null);
  const [secondaryStats, setSecondaryStats] = useState<SecondaryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [dbUsers, setDbUsers] = useState<DbUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<DbUser | null>(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    loadPrimarySchoolStats()
      .then((nextStats) => {
        setPrimaryStats(nextStats);
        setStatsError(nextStats.errors.length > 0 ? nextStats.errors.join(" / ") : null);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[AdminPage] load primary stats failed:", error);
        setStatsError(`โหลดสถิติหลักไม่สำเร็จ: ${message}`);
      })
      .finally(() => setStatsLoading(false));

    loadSecondarySchoolStats()
      .then((nextStats) => {
        setSecondaryStats(nextStats);
        if (nextStats.errors.length > 0) setStatsError((prev) => [prev, nextStats.errors.join(" / ")].filter(Boolean).join(" / "));
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[AdminPage] load secondary stats failed:", error);
        setStatsError((prev) => [prev, `โหลดสถิติรองไม่สำเร็จ: ${message}`].filter(Boolean).join(" / "));
      });
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const { data } = await retrySupabase<DbUser[]>(() => supabase.rpc("admin_list_users", { _status: null }), "admin_page_users");
      setDbUsers((data ?? []) as DbUser[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[AdminPage] load users failed:", error);
      toast.error(`โหลดผู้ใช้ไม่สำเร็จ: ${message}`);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); loadUsers(); }, [loadStats, loadUsers]);

  const handleApprove = (id: string, status: QuestionStatus) => {
    const q = questions.find((x) => x.id === id);
    if (!q) return;
    updateQuestion({ ...q, status, updatedAt: new Date().toISOString() });
    toast.success(status === "published" ? "อนุมัติและเผยแพร่แล้ว" : "ปฏิเสธและเก็บถาวรแล้ว");
  };

  const handleAddTopic = () => {
    if (!newTopic.title.trim()) { toast.error("กรุณากรอกชื่อหัวข้อ"); return; }
    addTopic({ id: `t-${Date.now()}`, title: newTopic.title, gradeLevel: newTopic.grade });
    setNewTopic({ title: "", grade: "ม.4" });
    toast.success("เพิ่มหัวข้อแล้ว");
  };

  const handleChangeRole = async (u: DbUser, role: Role) => {
    if (u.is_super_admin) { toast.error("ไม่สามารถเปลี่ยนบทบาท Super Admin"); return; }
    const { error } = await supabase.rpc("admin_set_role", { _user_id: u.id, _role: role });
    if (error) { toast.error(error.message); return; }
    toast.success(`เปลี่ยนบทบาท ${u.full_name} เป็น ${roleLabel[role]}`);
    loadUsers(); loadStats();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const u = pendingDelete;
    setPendingDelete(null);
    const { error } = await supabase.rpc("admin_delete_user", { _user_id: u.id });
    if (error) { toast.error(`ลบไม่สำเร็จ: ${error.message}`); return; }
    toast.success(`ลบผู้ใช้ ${u.full_name} เรียบร้อย`);
    loadUsers(); loadStats();
  };

  return (
    <AppLayout title="ศูนย์ควบคุมผู้ดูแลระบบ" breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "ศูนย์ผู้ดูแล" }]}>
      <Card className="p-5 mb-4 border-primary/30 bg-primary-soft/30">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">สถิติทั้งโรงเรียน</h3>
        </div>
        {statsError && (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>{statsError}</span>
            <Button variant="outline" size="sm" onClick={loadStats} className="gap-1.5 self-start sm:self-auto">
              <RefreshCw className="w-3.5 h-3.5" /> ลองใหม่
            </Button>
          </div>
        )}
        {statsLoading && !primaryStats ? (
          <div className="text-xs text-muted-foreground">กำลังโหลดสถิติ...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: "ผู้ดูแล", value: primaryStats?.admins },
              { label: "ครู", value: primaryStats?.teachers },
              { label: "นักเรียน", value: primaryStats?.students },
              { label: "ห้องเรียน", value: primaryStats?.classes },
              { label: "ข้อสอบในคลัง", value: secondaryStats?.questions, secondary: true },
              { label: "ชุดข้อสอบ", value: secondaryStats?.exams, secondary: true },
              { label: "การส่งทั้งหมด", value: secondaryStats?.attempts, secondary: true },
              { label: "คะแนนเฉลี่ย %", value: secondaryStats?.avgScore, secondary: true },
            ].map((s) => (
              <div key={s.label} className="bg-card rounded-md p-3 border border-border">
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
                <div className="text-xl font-semibold tabular-nums">{s.value ?? (s.secondary ? "-" : "โหลดไม่ได้")}</div>
              </div>
            ))}
          </div>
        )}
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
                  <div className="text-xs text-muted-foreground">{q.gradeLevel} • {q.difficulty} • สถานะ: {q.status}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => handleApprove(q.id, "published")} className="gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> อนุมัติ
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleApprove(q.id, "archived")}>ปฏิเสธ</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> ผู้ใช้ทั้งหมด ({dbUsers.length})
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            สมัครสมาชิกใหม่ผ่านหน้าเข้าสู่ระบบ จากนั้นมาอนุมัติที่หน้า "อนุมัติผู้ใช้"
          </p>

          <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>บทบาท</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">กำลังโหลด...</TableCell></TableRow>
                ) : dbUsers.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">ยังไม่มีผู้ใช้</TableCell></TableRow>
                ) : dbUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <div className="text-sm flex items-center gap-1.5">
                        {u.is_super_admin && <Crown className="w-3.5 h-3.5 text-warning" aria-label="Super Admin" />}
                        {u.full_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(v: Role) => handleChangeRole(u, v)} disabled={u.is_super_admin}>
                        <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">{roleLabel.admin}</SelectItem>
                          <SelectItem value="teacher">{roleLabel.teacher}</SelectItem>
                          <SelectItem value="student">{roleLabel.student}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <span className={`chip ${
                        u.approval_status === "approved" ? "bg-success/10 text-success" :
                        u.approval_status === "pending" ? "bg-warning/10 text-warning" :
                        "bg-destructive/10 text-destructive"
                      }`}>
                        {u.approval_status === "approved" ? "อนุมัติแล้ว" : u.approval_status === "pending" ? "รออนุมัติ" : "ถูกปฏิเสธ"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={u.is_super_admin || u.id === me?.id}
                        onClick={() => setPendingDelete(u)}
                        aria-label={`ลบผู้ใช้ ${u.full_name}`}
                        title={u.is_super_admin ? "ลบ Super Admin ไม่ได้" : u.id === me?.id ? "ลบตัวเองไม่ได้" : "ลบผู้ใช้"}
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
                    variant="ghost" size="icon"
                    onClick={() => {
                      if (count > 0) { toast.error(`ลบไม่ได้: มี ${count} ข้อใช้หัวข้อนี้`); return; }
                      deleteTopic(t.id);
                      toast.success("ลบหัวข้อแล้ว");
                    }}
                    aria-label={`ลบหัวข้อ ${t.title}`}
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

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันลบผู้ใช้</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบ <span className="font-semibold">{pendingDelete?.full_name}</span> ({pendingDelete?.email}) ออกจากระบบใช่หรือไม่?
              การลบนี้จะลบบัญชีและข้อมูลที่เกี่ยวข้องทั้งหมดอย่างถาวร
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบถาวร
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
