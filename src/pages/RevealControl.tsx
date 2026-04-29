import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Calendar, Hand, Users } from "lucide-react";

interface Row {
  exam_id: string;
  title: string;
  status: string;
  reveal_mode: "manual" | "after_due";
  revealed_at: string | null;
  due_date: string | null;
  attempts_count: number;
}

export default function RevealControl() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.rpc("teacher_list_exams_reveal");
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => { load(); }, []);

  const update = async (r: Row, patch: Partial<Pick<Row, "reveal_mode" | "revealed_at">>) => {
    setBusy(r.exam_id);
    const mode = patch.reveal_mode ?? r.reveal_mode;
    const revealed = "revealed_at" in patch ? !!patch.revealed_at : !!r.revealed_at;
    const { error } = await supabase.rpc("teacher_set_exam_reveal", {
      _exam_id: r.exam_id, _mode: mode, _revealed: revealed,
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกแล้ว");
    load();
  };

  return (
    <AppLayout title="ควบคุมการแสดงผลข้อสอบ">
      <p className="text-sm text-muted-foreground mb-4">
        เลือกได้ว่าจะให้นักเรียนเห็นคะแนนและเฉลยเมื่อไหร่ — กดเปิดเองด้วยมือ หรือเปิดอัตโนมัติเมื่อเลยกำหนดส่ง
      </p>
      {rows === null ? (
        <Card className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></Card>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">ยังไม่มีข้อสอบในระบบ</Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const isManual = r.reveal_mode === "manual";
            const revealedNow = isManual
              ? !!r.revealed_at
              : !!r.due_date && new Date(r.due_date) <= new Date();
            return (
              <Card key={r.exam_id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2">
                      {revealedNow ? <Eye className="w-4 h-4 text-success" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                      {r.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                      <span className="capitalize">สถานะ: {r.status}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {r.attempts_count} ครั้ง</span>
                      {r.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          กำหนดส่ง {new Date(r.due_date).toLocaleString("th-TH")}
                        </span>
                      )}
                      {r.revealed_at && (
                        <span className="text-success">เปิดเผยเมื่อ {new Date(r.revealed_at).toLocaleString("th-TH")}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">โหมด</Label>
                      <Select
                        value={r.reveal_mode}
                        onValueChange={(v) => update(r, { reveal_mode: v as Row["reveal_mode"] })}
                      >
                        <SelectTrigger className="w-44 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">
                            <span className="flex items-center gap-2"><Hand className="w-3.5 h-3.5" /> ครูเปิดเอง</span>
                          </SelectItem>
                          <SelectItem value="after_due">
                            <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> หลังเลยกำหนดส่ง</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {isManual && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">เปิดเผยตอนนี้</Label>
                        <Switch
                          checked={!!r.revealed_at}
                          disabled={busy === r.exam_id}
                          onCheckedChange={(v) => update(r, { revealed_at: v ? new Date().toISOString() : null })}
                        />
                      </div>
                    )}
                    {!isManual && (
                      <div className="text-xs text-muted-foreground">
                        {r.due_date
                          ? (revealedNow ? "เปิดเผยอัตโนมัติแล้ว" : "จะเปิดเผยเมื่อเลยกำหนดส่ง")
                          : "ยังไม่กำหนดวันส่ง"}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
