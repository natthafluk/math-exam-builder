import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, BarChart3, Plus } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  draft: "ฉบับร่าง", assigned: "เปิดทำ", closed: "ปิดแล้ว",
};
const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  assigned: "bg-success/10 text-success",
  closed: "bg-destructive/10 text-destructive",
};

export default function AssignmentsPage() {
  const { exams, classes, attempts, currentUser } = useStore();
  const visible = currentUser.role === "admin"
    ? exams
    : exams.filter((e) => e.teacherId === currentUser.id);

  const groups = (["assigned", "draft", "closed"] as const).map((status) => ({
    status,
    items: visible.filter((e) => e.status === status),
  }));

  return (
    <AppLayout
      title="งานที่มอบหมาย"
      actions={
        <Button asChild className="gap-1.5">
          <Link to="/exams/new"><Plus className="w-4 h-4" /> สร้างใหม่</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.status}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold">{STATUS_LABEL[g.status]}</h2>
              <span className="text-sm text-muted-foreground">({g.items.length})</span>
            </div>

            {g.items.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                ไม่มีรายการ
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {g.items.map((e) => {
                  const cls = classes.filter((c) => e.classIds.includes(c.id));
                  const totalStudents = cls.reduce((s, c) => s + c.studentIds.length, 0);
                  const submitted = attempts.filter((a) => a.examId === e.id).length;
                  const pct = totalStudents ? Math.round((submitted / totalStudents) * 100) : 0;
                  const due = new Date(e.dueDate);
                  const overdue = due < new Date() && e.status === "assigned";

                  return (
                    <Card key={e.id} className="p-5 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold leading-tight">{e.title}</h3>
                        <span className={`chip ${STATUS_TONE[e.status]} shrink-0`}>
                          {STATUS_LABEL[e.status]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{e.description}</p>

                      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          กำหนดส่ง: {due.toLocaleDateString("th-TH")}
                          {overdue && <span className="text-destructive font-medium ml-1">เลยกำหนด</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3 h-3" />
                          {cls.map((c) => c.name).join(", ") || "—"} ({totalStudents} คน)
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">ความคืบหน้า</span>
                          <span className="tabular-nums font-medium">{submitted}/{totalStudents} • {pct}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${pct >= 70 ? "bg-success" : pct >= 30 ? "bg-warning" : "bg-destructive"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button asChild variant="outline" size="sm" className="flex-1">
                          <Link to={`/exams/${e.id}`}>แก้ไข</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" aria-label="ดูผลคะแนน">
                          <Link to={`/exams/${e.id}/results`}><BarChart3 className="w-4 h-4" /></Link>
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </AppLayout>
  );
}
