import { ReactNode, useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, profile, loading, signOut, repairProfile } = useAuth();
  const location = useLocation();
  const repairTried = useRef(false);

  // Auto-repair profile silently if missing
  useEffect(() => {
    if (!loading && user && !profile && !repairTried.current) {
      repairTried.current = true;
      repairProfile();
    }
  }, [loading, user, profile, repairProfile]);

  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> กำลังโหลด...
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace state={{ from: location }} />;

  if (profile && profile.approval_status && profile.approval_status !== "approved") {
    const status = profile.approval_status;
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full text-center space-y-4 border rounded-lg p-6 bg-card">
          <h1 className="text-lg font-semibold">
            {status === "pending" ? "บัญชีของคุณรอการอนุมัติ" : "บัญชีนี้ถูกปฏิเสธ"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {status === "pending"
              ? "ผู้ดูแลระบบจะตรวจสอบและอนุมัติบัญชีของคุณเร็ว ๆ นี้ กรุณาลองเข้าสู่ระบบใหม่ภายหลัง"
              : "หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อผู้ดูแลระบบ"}
          </p>
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3 text-left">
            <div><span className="font-medium">อีเมล:</span> <span className="font-mono">{user.email}</span></div>
            <div><span className="font-medium">บทบาทที่ขอ:</span> {profile.requested_role || profile.role}</div>
          </div>
          <Button onClick={() => signOut()} variant="outline" className="w-full">ออกจากระบบ</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
