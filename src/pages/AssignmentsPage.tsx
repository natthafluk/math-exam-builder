import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, BarChart3, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  draft: "ฉบับร่าง", assigned: "เปิดทำ", closed: "ปิดแล้ว",
};
const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  assigned: "bg-success/10 text-success",
  closed: "bg-destructive/10 text-destructive",
};

interface ExamRow {
  id: string;
  title: string;
  description: string;
  status: "draft" | "assigned" | "closed";
  due_date: string | null;
  teacher_id: string | null;
  classNames: string[];
  studentTotal: number;
  attemptCount: number;
}

export default function AssignmentsPage() {
  const { profile } = useAuth();
  const [exams, setExams] = useState<ExamRow[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      // Exams visible to user (RLS already filters: admin sees all, teacher sees own + assigned)
      const examsRes = await supabase
        .from("exams")
        .select("id, title, description, status, due_date, teacher_id")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (examsRes.error) {
        toast.error("โหลดข้อสอบไม่สำเร็จ: " + examsRes.error.message);
        setExams([]);
        return;
      }
      const rows = (examsRes.data ?? []) as any[];
      const examIds = rows.map((r) => r.id);
      if (examIds.length === 0) { setExams([]); return; }

      const [assRes, attRes] = await Promise.all([
        supabase.from("assignments").select("id, exam_id, class_id, classes(name), due_date").in("exam_id", examIds),
        supabase.from("attempts").select("id, assignment_id, status").in("assignment_id",
          // placeholder, replace after fetching assignments
          ["00000000-0000-0000-0000-000000000000"]),
      ]);

      // attempts need assignment ids known after assRes — refetch
      const assignments = (assRes.data ?? []) as any[];
      const assIds = assignments.map((a) => a.id);
      let attempts: any[] = [];
      if (assIds.length) {
        const a2 = await supabase.from("attempts").select("id, assignment_id, status").in("assignment_id", assIds);
        attempts = a2.data ?? [];
      }
      void attRes;

      // Aggregate per exam
      const studentCountByClass = new Map<string, number>();
      const classIds = Array.from(new Set(assignments.map((a) => a.class_id)));
      if (classIds.length) {
        const csRes = await supabase.from("class_students").select("class_id").in("class_id", classIds);
        for (const r of (csRes.data ?? []) as any[]) {
          studentCountByClass.set(r.class_id, (studentCountByClass.get(r.class_id) ?? 0) + 1);
        }
      }

      const enriched: ExamRow[] = rows.map((e) => {
        const myAss = assignments.filter((a) => a.exam_id === e.id);
        const classNames = myAss.map((a) => a.classes?.name).filter(Boolean) as string[];
        const studentTotal = myAss.reduce((s, a) => s + (studentCountByClass.get(a.class_id) ?? 0), 0);
        const myAssIds = new Set(myAss.map((a) => a.id));
        const attemptCount = attempts.filter((at) => myAssIds.has(at.assignment_id) && at.status === "submitted").length;
        return {
          id: e.id, title: e.title, description: e.description ?? "",
          status: e.status, due_date: e.due_date, teacher_id: e.teacher_id,
          classNames, studentTotal, attemptCount,
        };
      });
      if (!cancelled) setExams(enriched);
    })();
    return () => { cancelled = true; };
  }, [profile]);

  if (exams === null) {
    return <AppLayout title="งานที่มอบหมาย"><Card className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></Card></AppLayout>;
  }

  const groups = (["assigned", "draft", "closed"] as const).map((status) => ({
    status,
    items: exams.filter((e) => e.status === status),
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
              <Card className="p-6 text-center text-sm text-muted-foreground">ไม่มีรายการ</Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {g.items.map((e) => {
                  const pct = e.studentTotal ? Math.round((e.attemptCount / e.studentTotal) * 100) : 0;
                  const due = e.due_date ? new Date(e.due_date) : null;
                  const overdue = due && due < new Date() && e.status === "assigned";
                  return (
                    <Card key={e.id} className="p-5 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold leading-tight">{e.title}</h3>
                        <span className={`chip ${STATUS_TONE[e.status]} shrink-0`}>{STATUS_LABEL[e.status]}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{e.description}</p>
                      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          กำหนดส่ง: {due ? due.toLocaleDateString("th-TH") : "—"}
                          {overdue && <span className="text-destructive font-medium ml-1">เลยกำหนด</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3 h-3" />
                          {e.classNames.join(", ") || "—"} ({e.studentTotal} คน)
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">ความคืบหน้า</span>
                          <span className="tabular-nums font-medium">{e.attemptCount}/{e.studentTotal} • {pct}%</span>
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
