import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sigma, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Allow access if recovery link present OR user already signed in
    const hash = window.location.hash || "";
    if (hash.includes("type=recovery")) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else {
        toast.error("ต้องเข้าสู่ระบบก่อนถึงจะเปลี่ยนรหัสผ่านได้");
        nav("/auth", { replace: true });
      }
    });
  }, [nav]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return toast.error("กรุณากรอกรหัสผ่านใหม่");
    if (password !== confirm) return toast.error("รหัสผ่านยืนยันไม่ตรงกัน");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error("เปลี่ยนรหัสผ่านไม่สำเร็จ: " + error.message);
      return;
    }
    toast.success("เปลี่ยนรหัสผ่านเรียบร้อย");
    nav("/", { replace: true });
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-xl bg-accent items-center justify-center text-accent-foreground mx-auto">
            <Sigma className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold">เปลี่ยนรหัสผ่าน</h1>
          <p className="text-sm text-muted-foreground">ตั้งรหัสผ่านใหม่เพื่อใช้งานต่อ</p>
        </div>
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">รหัสผ่านใหม่</Label>
              <Input id="new-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-new">ยืนยันรหัสผ่านใหม่</Label>
              <Input id="confirm-new" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••" />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
              บันทึกรหัสผ่านใหม่
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
