import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> กำลังโหลด...
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace state={{ from: location }} />;
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-lg font-semibold">ไม่พบโปรไฟล์ผู้ใช้</h1>
          <p className="text-sm text-muted-foreground">
            บัญชีทดสอบเดิมอาจถูกสร้างใหม่แล้ว กรุณาออกจากระบบแล้วเข้าสู่ระบบด้วยบัญชี @example.com อีกครั้ง
          </p>
          <Button onClick={() => signOut()} className="w-full">ออกจากระบบเพื่อเข้าสู่ระบบใหม่</Button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
