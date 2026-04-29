import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Printer, Users, Clock, BarChart3 } from "lucide-react";

export default function ExamList() {
  const navigate = useNavigate();
  const { exams, classes, attempts, currentUser } = useStore();
  const visible = currentUser.role === "admin" ? exams : exams.filter((e) => e.teacherId === currentUser.id);

  return (
    <AppLayout
      title="ชุดข้อสอบ"
      actions={
        <Button onClick={() => navigate("/exams/new")} className="gap-1.5">
          <Plus className="w-4 h-4" /> สร้างชุดใหม่
        </Button>
      }
    >
      <div className="grid md:grid-cols-2 gap-4">
        {visible.map((e) => {
          const cls = classes.filter((c) => e.classIds.includes(c.id));
          const submissions = attempts.filter((a) => a.examId === e.id).length;
          return (
            <Card key={e.id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-semibold">{e.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{e.description}</p>
                </div>
                <span className="chip bg-primary-soft text-primary capitalize">{e.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground"><Clock className="w-3.5 h-3.5" /> {e.timeLimitMinutes} นาที</div>
                <div className="flex items-center gap-1.5 text-muted-foreground"><Users className="w-3.5 h-3.5" /> {cls.map(c => c.name).join(", ") || "—"}</div>
                <div className="flex items-center gap-1.5 text-muted-foreground"><BarChart3 className="w-3.5 h-3.5" /> {submissions} ครั้ง</div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {e.questions.length} ข้อ • กำหนดส่ง {new Date(e.dueDate).toLocaleDateString("th-TH")}
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
        {visible.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground md:col-span-2">
            ยังไม่มีชุดข้อสอบ — กดปุ่ม "สร้างชุดใหม่" เพื่อเริ่มต้น
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
