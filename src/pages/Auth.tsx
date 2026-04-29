import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Sigma, Loader2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TEST_ACCOUNTS = [
  { email: "admin@example.com", password: "123456", full_name: "ผู้ดูแลระบบ", role: "admin" as const },
  { email: "teacher@example.com", password: "123456", full_name: "ครูสมหญิง", role: "teacher" as const },
  { email: "student@example.com", password: "123456", full_name: "นักเรียนสมชาย", role: "student" as const },
];

type SeedResult = {
  email: string;
  role: "admin" | "teacher" | "student";
  status: "created" | "already_exists" | "failed";
  message: string;
};

export default function Auth() {
  const { user, signIn, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedResults, setSeedResults] = useState<SeedResult[]>([]);

  if (!loading && user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) toast.error("เข้าสู่ระบบไม่สำเร็จ: " + error);
    else {
      toast.success("ยินดีต้อนรับ");
      nav("/", { replace: true });
    }
  };

  const quickLogin = async (e: string, p: string) => {
    setEmail(e); setPassword(p);
    setBusy(true);
    const { error } = await signIn(e, p);
    setBusy(false);
    if (error) toast.error("กรุณากด 'สร้างบัญชีทดสอบ' ก่อน หากยังไม่ได้สร้าง");
    else nav("/", { replace: true });
  };

  const seedTestAccounts = async () => {
    setSeeding(true);
    setSeedResults([]);
    const { data, error } = await supabase.functions.invoke<{ results: SeedResult[] }>("seed-demo-users", {
      method: "POST",
    });
    setSeeding(false);

    if (error || !data?.results) {
      const message = error?.message ?? "ไม่ได้รับผลลัพธ์จากตัวช่วยสร้างบัญชี";
      setSeedResults(TEST_ACCOUNTS.map((acc) => ({ ...acc, status: "failed", message })));
      toast.error("สร้างบัญชีทดสอบไม่สำเร็จ: " + message);
      return;
    }

    setSeedResults(data.results);
    const failed = data.results.filter((result) => result.status === "failed").length;
    const created = data.results.filter((result) => result.status === "created").length;
    const existed = data.results.filter((result) => result.status === "already_exists").length;
    if (failed) toast.error(`สร้างบัญชีทดสอบบางรายการไม่สำเร็จ (${failed} รายการ)`);
    else toast.success(`บัญชีทดสอบพร้อมใช้งาน (ใหม่ ${created} / มีอยู่แล้ว ${existed})`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-xl bg-accent items-center justify-center text-accent-foreground mx-auto">
            <Sigma className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold">MathBank Studio</h1>
          <p className="text-sm text-muted-foreground">คลังข้อสอบคณิต — เข้าสู่ระบบ</p>
        </div>

        <Card className="p-6 space-y-4">
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">อีเมล</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@mathbank.local" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              เข้าสู่ระบบ
            </Button>
          </form>
        </Card>

        <Card className="p-5 space-y-3 border-dashed">
          <div className="flex items-center gap-2 text-sm font-medium">
            <UserCog className="w-4 h-4 text-accent" />
            บัญชีทดสอบ (สำหรับ QA)
          </div>
          <Button onClick={seedTestAccounts} variant="outline" className="w-full" disabled={seeding}>
            {seeding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            สร้างบัญชีทดสอบทั้งหมด (ครั้งแรกเท่านั้น)
          </Button>
          <div className="grid gap-1.5">
            {TEST_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => quickLogin(a.email, a.password)}
                disabled={busy}
                className="flex items-center justify-between text-left px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-xs transition-colors"
              >
                <span className="font-mono">{a.email}</span>
                <span className="chip bg-primary-soft text-primary">
                  {a.role === "admin" ? "ผู้ดูแล" : a.role === "teacher" ? "ครู" : "นักเรียน"}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            รหัสผ่านสำหรับทุกบัญชี: <span className="font-mono">123456</span>
          </p>
        </Card>
      </div>
    </div>
  );
}
