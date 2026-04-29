import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, FilePlus2, ClipboardList, Users,
  GraduationCap, Settings, BarChart3, Sigma, ShieldCheck, Upload, Eye,
} from "lucide-react";
import { useStore, roleLabel } from "@/lib/store";
import { cn } from "@/lib/utils";

const navByRole = {
  admin: [
    { to: "/", icon: LayoutDashboard, label: "แดชบอร์ด" },
    { to: "/admin", icon: ShieldCheck, label: "ศูนย์ผู้ดูแล" },
    { to: "/users", icon: Users, label: "ผู้ใช้และบทบาท" },
    { to: "/classes", icon: GraduationCap, label: "ห้องเรียน" },
    { to: "/questions", icon: BookOpen, label: "คลังข้อสอบ" },
    { to: "/exams", icon: ClipboardList, label: "ข้อสอบทั้งหมด" },
    { to: "/results", icon: BarChart3, label: "ผลคะแนนรวม" },
    { to: "/analytics", icon: BarChart3, label: "สถิติระบบ" },
    { to: "/settings", icon: Settings, label: "ตั้งค่า" },
  ],
  teacher: [
    { to: "/", icon: LayoutDashboard, label: "แดชบอร์ด" },
    { to: "/questions", icon: BookOpen, label: "คลังข้อสอบ" },
    { to: "/questions/new", icon: FilePlus2, label: "สร้างข้อสอบ" },
    { to: "/questions/import", icon: Upload, label: "นำเข้าข้อสอบ" },
    { to: "/exams", icon: ClipboardList, label: "ชุดข้อสอบ" },
    { to: "/exams/new", icon: FilePlus2, label: "สร้างชุดข้อสอบ" },
    { to: "/assignments", icon: ClipboardList, label: "งานที่มอบหมาย" },
    { to: "/classes", icon: GraduationCap, label: "ห้องเรียน" },
    { to: "/results", icon: BarChart3, label: "ผลคะแนน" },
  ],
  student: [
    { to: "/", icon: LayoutDashboard, label: "หน้าหลัก" },
    { to: "/student/exams", icon: ClipboardList, label: "ข้อสอบของฉัน" },
    { to: "/student/results", icon: GraduationCap, label: "ผลคะแนน" },
  ],
} as const;

const roleTone: Record<string, string> = {
  admin: "bg-destructive/15 text-destructive",
  teacher: "bg-primary-soft text-primary",
  student: "bg-accent-soft text-accent",
};

export function AppSidebar() {
  const { currentUser } = useStore();
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

      <div className="px-3 pt-3">
        <div className={cn("text-[10px] uppercase tracking-wider px-2 py-1 rounded-md inline-flex items-center gap-1.5 font-semibold", roleTone[currentUser.role])}>
          โหมด: {roleLabel[currentUser.role]}
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
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

      <div className="p-3 border-t border-sidebar-border">
        <div className="text-[11px] text-sidebar-foreground/50 px-1 leading-relaxed">
          เข้าสู่ระบบในชื่อ
          <div className="text-sm text-sidebar-foreground font-medium mt-0.5 truncate">{currentUser.name}</div>
        </div>
      </div>
    </aside>
  );
}
