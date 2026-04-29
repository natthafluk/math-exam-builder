import { AppLayout } from "@/components/AppLayout";
import { useStore, roleLabel } from "@/lib/store";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default function UsersPage() {
  const { users, classes } = useStore();
  return (
    <AppLayout title="ผู้ใช้และบทบาท">
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ</TableHead>
              <TableHead>อีเมล</TableHead>
              <TableHead>บทบาท</TableHead>
              <TableHead>หน่วยงาน / ชั้น</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const cls = classes.find((c) => c.id === u.classId);
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full ${u.avatarColor ?? "bg-primary"} text-white flex items-center justify-center text-xs font-semibold`}>
                        {u.name.slice(0, 1)}
                      </div>
                      {u.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <span className={`chip ${
                      u.role === "admin" ? "bg-primary-soft text-primary" :
                      u.role === "teacher" ? "bg-accent-soft text-accent" : "bg-success/10 text-success"
                    }`}>{roleLabel[u.role]}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.department ?? cls?.name ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
