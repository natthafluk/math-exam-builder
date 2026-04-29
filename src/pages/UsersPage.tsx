import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { roleLabel } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Loader2, Crown } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/types";
import { toast } from "sonner";

type DbUser = {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  approval_status: string;
  is_super_admin: boolean;
};

export default function UsersPage() {
  const [users, setUsers] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("admin_list_users", { _status: null });
      if (cancelled) return;
      if (error) toast.error("โหลดผู้ใช้ไม่สำเร็จ: " + error.message);
      // Show only auth users (admin/teacher). Students are managed via "ห้องเรียน".
      const filtered = ((data ?? []) as DbUser[]).filter((u) => u.role === "admin" || u.role === "teacher");
      setUsers(filtered);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AppLayout title="ผู้ใช้และบทบาท">
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">ยังไม่มีผู้ใช้ในระบบ</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>อีเมล</TableHead>
                <TableHead>บทบาท</TableHead>
                <TableHead>สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                        {(u.full_name || "?").slice(0, 1)}
                      </div>
                      <span className="flex items-center gap-1.5">
                        {u.is_super_admin && <Crown className="w-3.5 h-3.5 text-warning" aria-label="Super Admin" />}
                        {u.full_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <span className={`chip ${
                      u.role === "admin" ? "bg-primary-soft text-primary" :
                      u.role === "teacher" ? "bg-accent-soft text-accent" : "bg-success/10 text-success"
                    }`}>{roleLabel[u.role]}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`chip ${
                      u.approval_status === "approved" ? "bg-success/10 text-success" :
                      u.approval_status === "pending" ? "bg-warning/10 text-warning" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {u.approval_status === "approved" ? "อนุมัติแล้ว" :
                       u.approval_status === "pending" ? "รออนุมัติ" : "ถูกปฏิเสธ"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </AppLayout>
  );
}
