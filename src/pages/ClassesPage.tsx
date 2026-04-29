import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ClipboardList, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function ClassesPage() {
  const { classes, users, exams, attempts } = useStore();

  return (
    <AppLayout title="ห้องเรียน">
      <div className="grid md:grid-cols-2 gap-4">
        {classes.map((c) => {
          const teacher = users.find((u) => u.id === c.teacherId);
          const students = users.filter((u) => c.studentIds.includes(u.id));
          const classExams = exams.filter((e) => e.classIds.includes(c.id));
          const submissions = attempts.filter((a) =>
            classExams.some((e) => e.id === a.examId) && c.studentIds.includes(a.studentId)
          );
          const totalPossible = classExams.length * c.studentIds.length || 1;
          const completionPct = Math.round((submissions.length / totalPossible) * 100);

          return (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-lg">{c.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ครูประจำชั้น: {teacher?.name ?? "—"} • {c.gradeLevel}
                  </p>
                </div>
                <span className="chip bg-primary-soft text-primary">
                  <Users className="w-3 h-3" /> {c.studentIds.length} คน
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div className="p-2 rounded-md bg-muted/50">
                  <div className="text-lg font-semibold tabular-nums">{classExams.length}</div>
                  <div className="text-[11px] text-muted-foreground">ข้อสอบ</div>
                </div>
                <div className="p-2 rounded-md bg-muted/50">
                  <div className="text-lg font-semibold tabular-nums">{submissions.length}</div>
                  <div className="text-[11px] text-muted-foreground">ส่งแล้ว</div>
                </div>
                <div className="p-2 rounded-md bg-muted/50">
                  <div className="text-lg font-semibold tabular-nums">{completionPct}%</div>
                  <div className="text-[11px] text-muted-foreground">เสร็จสิ้น</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-muted-foreground mb-1.5">นักเรียน</div>
                <div className="flex -space-x-2">
                  {students.slice(0, 6).map((s) => (
                    <div
                      key={s.id}
                      title={s.name}
                      className={`w-8 h-8 rounded-full ${s.avatarColor ?? "bg-primary"} text-white border-2 border-card flex items-center justify-center text-xs font-semibold`}
                    >
                      {s.name.slice(0, 1)}
                    </div>
                  ))}
                  {students.length === 0 && (
                    <span className="text-xs text-muted-foreground">ยังไม่มีนักเรียน</span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link to="/exams">
                    <ClipboardList className="w-4 h-4 mr-1.5" /> ดูข้อสอบ
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success(`เปิดการจัดการห้อง ${c.name} (เดโม)`)}
                  aria-label={`จัดการห้อง ${c.name}`}
                >
                  จัดการ <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}
