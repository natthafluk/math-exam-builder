import { ReactNode, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, profile, loading, signOut, profileStatus, repairProfile, refreshProfile } = useAuth();
  const location = useLocation();
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> กำลังโหลด...
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace state={{ from: location }} />;

  if (!profile) {
    const handleRepair = async () => {
      setBusy(true);
      const { error } = await repairProfile();
      setBusy(false);
      if (error) toast.error("ซ่อมโปรไฟล์ไม่สำเร็จ: " + error);
      else {
        toast.success("ซ่อมโปรไฟล์สำเร็จ");
        window.location.replace("/");
      }
    };
    const handleRetry = async () => {
      setBusy(true);
      await refreshProfile();
      setBusy(false);
    };
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full text-center space-y-4 border rounded-lg p-6 bg-card">
          <h1 className="text-lg font-semibold">ไม่พบโปรไฟล์ผู้ใช้</h1>
          <div className="text-sm text-muted-foreground space-y-1 text-left bg-muted/40 rounded-md p-3">
            <div><span className="font-medium">อีเมล:</span> <span className="font-mono">{user.email}</span></div>
            <div><span className="font-medium">User ID:</span> <span className="font-mono text-xs break-all">{user.id}</span></div>
            <div><span className="font-medium">สถานะการค้นหา:</span> {profileStatus.state}</div>
            {profileStatus.message ? (
              <div><span className="font-medium">ข้อความ:</span> {profileStatus.message}</div>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Button onClick={handleRepair} disabled={busy} className="w-full">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wrench className="w-4 h-4 mr-2" />}
              ซ่อมโปรไฟล์บัญชีนี้
            </Button>
            <Button onClick={handleRetry} variant="outline" disabled={busy} className="w-full">ลองค้นหาใหม่</Button>
            <Button onClick={() => signOut()} variant="ghost" disabled={busy} className="w-full">ออกจากระบบ</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            ปุ่ม "ซ่อมโปรไฟล์" จะสร้าง/อัปเดตแถวในตาราง profiles ตาม id ของบัญชีที่เข้าสู่ระบบอยู่ และเลือกบทบาทจากอีเมล (@example.com)
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
