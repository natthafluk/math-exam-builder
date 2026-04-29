import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useStudentSession } from "@/lib/studentSession";

export function RequireStudent({ children }: { children: ReactNode }) {
  const { session } = useStudentSession();
  const location = useLocation();
  if (!session) return <Navigate to="/student-login" replace state={{ from: location }} />;
  return <>{children}</>;
}
