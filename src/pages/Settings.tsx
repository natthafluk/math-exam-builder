import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";
import { Link } from "react-router-dom";

export default function Settings() {
  return (
    <AppLayout title="ตั้งค่าระบบ">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">ข้อมูลโรงเรียน</h3>
          <div>
            <Label>ชื่อโรงเรียน</Label>
            <Input defaultValue="โรงเรียนตัวอย่างวิทยา" className="mt-1.5" />
          </div>
          <div>
            <Label>ปีการศึกษา</Label>
            <Input defaultValue="2568" className="mt-1.5" />
          </div>
        </Card>
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">ค่าเริ่มต้นของระบบ</h3>
          <Row label="เปิดให้ครูสร้างหัวข้อใหม่" />
          <Row label="ตรวจสอบข้อสอบก่อนเผยแพร่" defaultChecked />
          <Row label="แสดงเฉลยอัตโนมัติหลังส่ง" defaultChecked />
          <Row label="อนุญาตการพิมพ์ข้อสอบ" defaultChecked />
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
        <Card className="p-5 lg:col-span-2 flex justify-end">
          <Button>บันทึกการตั้งค่า</Button>
        </Card>
      </div>
    </AppLayout>
  );
}

function Row({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
