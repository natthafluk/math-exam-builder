import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, FilePlus2, ClipboardList, Users,
  GraduationCap, Settings, BarChart3, Sigma,
} from "lucide-react";
import { useStore, roleLabel } from "@/lib/store";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const navByRole = {
  admin: [
    { to: "/", icon: LayoutDashboard, label: "แดชบอร์ด" },
    { to: "/users", icon: Users, label: "ผู้ใช้และบทบาท" },
    { to: "/questions", icon: BookOpen, label: "คลังข้อสอบ" },
    { to: "/exams", icon: ClipboardList, label: "ข้อสอบทั้งหมด" },
    { to: "/analytics", icon: BarChart3, label: "สถิติระบบ" },
    { to: "/settings", icon: Settings, label: "ตั้งค่า" },
  ],
  teacher: [
    { to: "/", icon: LayoutDashboard, label: "แดชบอร์ด" },
    { to: "/questions", icon: BookOpen, label: "คลังข้อสอบ" },
    { to: "/questions/new", icon: FilePlus2, label: "สร้างข้อสอบ" },
    { to: "/exams", icon: ClipboardList, label: "ชุดข้อสอบ" },
    { to: "/exams/new", icon: FilePlus2, label: "สร้างชุดข้อสอบ" },
    { to: "/analytics", icon: BarChart3, label: "ผลการเรียน" },
  ],
  student: [
    { to: "/", icon: LayoutDashboard, label: "หน้าหลัก" },
    { to: "/student/exams", icon: ClipboardList, label: "ข้อสอบของฉัน" },
    { to: "/student/results", icon: GraduationCap, label: "ผลคะแนน" },
  ],
} as const;

export function AppSidebar() {
  const { currentUser, setCurrentUserId, users } = useStore();
  const location = useLocation();
  const items = navByRole[currentUser.role];

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center text-accent-foreground">
          <Sigma className="w-5 h-5" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="font-semibold text-sm">MathBank Studio</div>
          <div className="text-[11px] text-sidebar-foreground/60">คลังข้อสอบคณิต</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {items.map((it) => {
          const active = location.pathname === it.to ||
            (it.to !== "/" && location.pathname.startsWith(it.to));
          return (
            <NavLink
              key={it.to}
              to={it.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <it.icon className="w-4 h-4" />
              {it.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="text-[11px] uppercase tracking-wide text-sidebar-foreground/50 px-1">
          สลับบทบาท (เดโม)
        </div>
        <Select value={currentUser.id} onValueChange={setCurrentUserId}>
          <SelectTrigger className="w-full bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                <span className="text-xs text-muted-foreground mr-1">[{roleLabel[u.role]}]</span>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </aside>
  );
}
