import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { KeyRound, Save, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface SettingsRow {
  school_name: string;
  department: string;
  academic_year: string;
  semester: string;
  allow_teacher_create_topic: boolean;
  review_before_publish: boolean;
  show_explanations_after_submit: boolean;
  allow_print_exam: boolean;
}

const DEFAULTS: SettingsRow = {
  school_name: "โรงเรียนตัวอย่างวิทยา",
  department: "กลุ่มสาระการเรียนรู้คณิตศาสตร์",
  academic_year: "2568",
  semester: "1",
  allow_teacher_create_topic: false,
  review_before_publish: true,
  show_explanations_after_submit: true,
  allow_print_exam: true,
};

export default function Settings() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [data, setData] = useState<SettingsRow>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: row, error } = await supabase
        .from("school_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast.error("โหลดการตั้งค่าไม่สำเร็จ: " + error.message);
      } else if (row) {
        setData({
          school_name: row.school_name ?? DEFAULTS.school_name,
          department: row.department ?? DEFAULTS.department,
          academic_year: row.academic_year ?? DEFAULTS.academic_year,
          semester: row.semester ?? DEFAULTS.semester,
          allow_teacher_create_topic: row.allow_teacher_create_topic,
          review_before_publish: row.review_before_publish,
          show_explanations_after_submit: row.show_explanations_after_submit,
          allow_print_exam: row.allow_print_exam,
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const update = <K extends keyof SettingsRow>(key: K, value: SettingsRow[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const save = async () => {
    if (!isAdmin) { toast.error("เฉพาะผู้ดูแลระบบเท่านั้นที่บันทึกได้"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("school_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", true);
    setSaving(false);
    if (error) toast.error("บันทึกไม่สำเร็จ: " + error.message);
    else toast.success("บันทึกการตั้งค่าเรียบร้อย");
  };

  if (loading) {
    return (
      <AppLayout title="ตั้งค่าระบบ">
        <Card className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="ตั้งค่าระบบ">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">ข้อมูลโรงเรียน</h3>
          <div>
            <Label>ชื่อโรงเรียน</Label>
            <Input
              value={data.school_name}
              onChange={(e) => update("school_name", e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>กลุ่มสาระ</Label>
            <Input
              value={data.department}
              onChange={(e) => update("department", e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>ปีการศึกษา</Label>
              <Input
                value={data.academic_year}
                onChange={(e) => update("academic_year", e.target.value)}
                disabled={!isAdmin}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>ภาคเรียน</Label>
              <Select
                value={data.semester}
                onValueChange={(v) => update("semester", v)}
                disabled={!isAdmin}
              >
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">ภาคเรียนที่ 1</SelectItem>
                  <SelectItem value="2">ภาคเรียนที่ 2</SelectItem>
                  <SelectItem value="ฤดูร้อน">ภาคฤดูร้อน</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">ค่าเริ่มต้นของระบบ</h3>
          <Row
            label="เปิดให้ครูสร้างหัวข้อใหม่"
            checked={data.allow_teacher_create_topic}
            onChange={(v) => update("allow_teacher_create_topic", v)}
            disabled={!isAdmin}
          />
          <Row
            label="ตรวจสอบข้อสอบก่อนเผยแพร่"
            checked={data.review_before_publish}
            onChange={(v) => update("review_before_publish", v)}
            disabled={!isAdmin}
          />
          <Row
            label="แสดงเฉลยอัตโนมัติหลังส่ง"
            checked={data.show_explanations_after_submit}
            onChange={(v) => update("show_explanations_after_submit", v)}
            disabled={!isAdmin}
          />
          <Row
            label="อนุญาตการพิมพ์ข้อสอบ"
            checked={data.allow_print_exam}
            onChange={(v) => update("allow_print_exam", v)}
            disabled={!isAdmin}
          />
        </Card>

        <Card className="p-5 space-y-3">
          <h3 className="font-semibold">บัญชีของฉัน</h3>
          <p className="text-sm text-muted-foreground">เปลี่ยนรหัสผ่านสำหรับเข้าสู่ระบบของคุณ</p>
          <Button asChild variant="outline">
            <Link to="/reset-password">
              <KeyRound className="w-4 h-4 mr-2" />
              เปลี่ยนรหัสผ่าน
            </Link>
          </Button>
        </Card>

        {isAdmin && (
          <Card className="p-5 lg:col-span-2 flex justify-end">
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึกการตั้งค่า
            </Button>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function Row({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
