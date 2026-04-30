import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Printer, Users, Clock, BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface ExamRow {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  time_limit_minutes: number;
  classNames: string[];
  submissions: number;
  questionCount: number;
}

export default function ExamList() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [rows, setRows] = useState<ExamRow[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      setRows(null);
      const examsRes = await supabase
        .from("exams")
        .select("id, title, description, due_date, time_limit_minutes, created_at")
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (examsRes.error) {
        console.error("[exam-list] DB load failed", { error: examsRes.error.message });
        toast.error("โหลดชุดข้อสอบจากฐานข้อมูลไม่สำเร็จ: " + examsRes.error.message);
        setRows([]);
        return;
      }

      const exams = (examsRes.data ?? []) as any[];
      const examIds = exams.map((e) => e.id);
      console.info("[exam-list] DB load success", { source: "exams", rowCount: exams.length });
      if (examIds.length === 0) {
        setRows([]);
        return;
      }

      const [eqRes, assRes] = await Promise.all([
        supabase.from("exam_questions").select("exam_id").in("exam_id", examIds),
        supabase.from("assignments").select("id, exam_id, class_id, classes(name)").in("exam_id", examIds),
      ]);

      const assignments = (assRes.data ?? []) as any[];
      const assignmentIds = assignments.map((a) => a.id);
      let attempts: any[] = [];
      if (assignmentIds.length > 0) {
        const attRes = await supabase.from("attempts").select("assignment_id, status").in("assignment_id", assignmentIds);
        attempts = attRes.data ?? [];
      }

      const questionCount = new Map<string, number>();
      for (const r of (eqRes.data ?? []) as any[]) questionCount.set(r.exam_id, (questionCount.get(r.exam_id) ?? 0) + 1);

      const enriched = exams.map((e): ExamRow => {
        const mine = assignments.filter((a) => a.exam_id === e.id);
        const assIds = new Set(mine.map((a) => a.id));
        return {
          id: e.id,
          title: e.title,
          description: e.description ?? "",
          due_date: e.due_date,
          time_limit_minutes: e.time_limit_minutes,
          classNames: mine.map((a) => a.classes?.name).filter(Boolean),
          submissions: attempts.filter((a) => assIds.has(a.assignment_id) && a.status === "submitted").length,
          questionCount: questionCount.get(e.id) ?? 0,
        };
      });
      if (!cancelled) setRows(enriched);
    })();
    return () => { cancelled = true; };
  }, [profile]);

  return (
    <AppLayout
      title="ชุดข้อสอบ"
      actions={
        <Button onClick={() => navigate("/exams/new")} className="gap-1.5">
          <Plus className="w-4 h-4" /> สร้างชุดใหม่
        </Button>
      }
    >
      {rows === null ? (
        <Card className="p-10 text-center text-muted-foreground md:col-span-2">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {rows.map((e) => {
            const due = e.due_date ? new Date(e.due_date) : null;
            return (
              <Card key={e.id} className="p-5 flex flex-col">
                <div className="mb-2">
                  <h3 className="font-semibold">{e.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{e.description}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground"><Clock className="w-3.5 h-3.5" /> {e.time_limit_minutes} นาที</div>
                  <div className="flex items-center gap-1.5 text-muted-foreground"><Users className="w-3.5 h-3.5" /> {e.classNames.join(", ") || "—"}</div>
                  <div className="flex items-center gap-1.5 text-muted-foreground"><BarChart3 className="w-3.5 h-3.5" /> {e.submissions} ครั้ง</div>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {e.questionCount} ข้อ • กำหนดส่ง {due ? due.toLocaleDateString("th-TH") : "—"}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link to={`/exams/${e.id}`}>แก้ไข</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" aria-label={`พิมพ์ข้อสอบ ${e.title}`} title="พิมพ์ / PDF">
                    <Link to={`/exams/${e.id}/print`}><Printer className="w-4 h-4" /></Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" aria-label={`ดูผลคะแนน ${e.title}`} title="ผลคะแนน">
                    <Link to={`/exams/${e.id}/results`}><BarChart3 className="w-4 h-4" /></Link>
                  </Button>
                </div>
              </Card>
            );
          })}
          {rows.length === 0 && (
            <Card className="p-10 text-center text-muted-foreground md:col-span-2">
              ยังไม่มีชุดข้อสอบ — กดปุ่ม “สร้างชุดใหม่” เพื่อเริ่มต้น
            </Card>
          )}
        </div>
      )}
    </AppLayout>
  );
}
