import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Check, X, Shield, ShieldOff, UserCog } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "teacher" | "student";
  requested_role: "admin" | "teacher" | "student" | null;
  approval_status: "pending" | "approved" | "rejected";
  is_super_admin: boolean;
  created_at: string;
};

export default function Approvals() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  // Start with loading=false — only show spinner once we confirm isAdmin and start fetching
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.rpc("admin_list_users", {
        _status: filter === "all" ? null : filter,
      });
      if (error) {
        setLoadError("โหลดรายชื่อไม่สำเร็จ: " + error.message);
        toast.error("โหลดรายชื่อไม่สำเร็จ: " + error.message);
        return;
      }
      setRows((data ?? []) as Row[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
      setLoadError(msg);
      toast.error("โหลดรายชื่อไม่สำเร็จ: " + msg);
    } finally {
      // Always runs — prevents infinite loading spinner
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { if (isAdmin) load(); }, [load, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex">
        <AppSidebar />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          เฉพาะผู้ดูแลระบบเท่านั้น
        </div>
      </div>
    );
  }

  const approve = async (id: string, role?: Row["role"]) => {
    setBusyId(id);
    const { error } = await supabase.rpc("admin_approve_user", { _user_id: id, _role: role ?? undefined });
    setBusyId(null);
    if (error) toast.error(error.message);
    else { toast.success("อนุมัติแล้ว"); load(); }
  };

  const reject = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("admin_reject_user", { _user_id: id });
    setBusyId(null);
    if (error) toast.error(error.message);
    else { toast.success("ปฏิเสธแล้ว"); load(); }
  };

  const setRole = async (id: string, role: Row["role"]) => {
    setBusyId(id);
    const { error } = await supabase.rpc("admin_set_role", { _user_id: id, _role: role });
    setBusyId(null);
    if (error) toast.error(error.message);
    else { toast.success("เปลี่ยนบทบาทแล้ว"); load(); }
  };

  const filters: Array<{ key: typeof filter; label: string }> = [
    { key: "pending", label: "รออนุมัติ" },
    { key: "approved", label: "อนุมัติแล้ว" },
    { key: "rejected", label: "ปฏิเสธแล้ว" },
    { key: "all", label: "ทั้งหมด" },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <div className="flex-1 p-6 space-y-4 overflow-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><UserCog className="w-6 h-6" />อนุมัติผู้ใช้งาน</h1>
            <p className="text-sm text-muted-foreground">จัดการคำขอสมัครจากครูและผู้ดูแลระบบ</p>
          </div>
          <Button onClick={load} variant="outline" size="sm">รีเฟรช</Button>
        </div>

        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          {filters.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={cn("px-3 py-1.5 text-sm rounded-md transition-colors",
                filter === f.key ? "bg-background shadow-sm font-medium" : "text-muted-foreground")}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" />กำลังโหลด...</div>
        ) : loadError ? (
          <Card className="p-8 text-center space-y-3">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" onClick={load}>ลองใหม่</Button>
          </Card>
        ) : rows.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">ไม่มีรายการ</Card>
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => (
              <Card key={r.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.full_name}</span>
                    {r.is_super_admin && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-semibold inline-flex items-center gap-1">
                        <Shield className="w-3 h-3" />SUPER ADMIN
                      </span>
                    )}
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold",
                      r.approval_status === "pending" && "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
                      r.approval_status === "approved" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                      r.approval_status === "rejected" && "bg-destructive/15 text-destructive")}>
                      {r.approval_status === "pending" ? "รออนุมัติ" : r.approval_status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono break-all">{r.email}</div>
                  <div className="text-xs text-muted-foreground">
                    บทบาท: <span className="font-medium">{r.role}</span>
                    {r.requested_role && r.requested_role !== r.role && <> • ขอเป็น: {r.requested_role}</>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.is_super_admin ? (
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <ShieldOff className="w-3 h-3" />ปกป้อง — แก้ไขไม่ได้
                    </span>
                  ) : r.approval_status === "pending" ? (
                    <>
                      <Button size="sm" disabled={busyId === r.id} onClick={() => approve(r.id)}>
                        <Check className="w-4 h-4 mr-1" />อนุมัติ
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => reject(r.id)}>
                        <X className="w-4 h-4 mr-1" />ปฏิเสธ
                      </Button>
                    </>
                  ) : (
                    <>
                      <select
                        value={r.role}
                        disabled={busyId === r.id}
                        onChange={(e) => setRole(r.id, e.target.value as Row["role"])}
                        className="text-xs border rounded-md px-2 py-1.5 bg-background"
                      >
                        <option value="teacher">ครู</option>
                        <option value="admin">ผู้ดูแล</option>
                        <option value="student">นักเรียน</option>
                      </select>
                      {r.approval_status === "rejected" && (
                        <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => approve(r.id)}>
                          <Check className="w-4 h-4 mr-1" />อนุมัติใหม่
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
