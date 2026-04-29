import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useStore, roleLabel } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Bell, Search, Sigma, ChevronRight, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface Crumb { label: string; to?: string }

export function AppLayout({ children, title, actions, breadcrumbs }: {
  children: ReactNode; title?: string; actions?: ReactNode; breadcrumbs?: Crumb[];
}) {
  const { currentUser } = useStore();
  const { signOut } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => {
    await signOut();
    nav("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden h-14 border-b border-border bg-sidebar text-sidebar-foreground flex items-center gap-2 px-3">
          <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center text-accent-foreground">
            <Sigma className="w-4 h-4" strokeWidth={2.5} />
          </div>
          <div className="font-semibold text-sm flex-1 truncate">MathBank Studio</div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-sidebar-foreground hover:bg-sidebar-accent gap-1.5" aria-label="ออกจากระบบ">
            <LogOut className="w-4 h-4" /> <span className="text-xs">ออก</span>
          </Button>
        </div>

        <header className="h-16 border-b border-border bg-card/70 backdrop-blur flex items-center gap-3 px-4 md:px-6">
          <div className="flex-1 min-w-0">
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav aria-label="breadcrumb" className="hidden md:flex items-center text-xs text-muted-foreground gap-1 mb-0.5">
                {breadcrumbs.map((c, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="w-3 h-3" />}
                    {c.to ? <Link to={c.to} className="hover:text-foreground">{c.label}</Link> : <span>{c.label}</span>}
                  </span>
                ))}
              </nav>
            )}
            {title && <h1 className="text-base md:text-lg font-semibold truncate">{title}</h1>}
          </div>
          <div className="hidden lg:flex items-center gap-2 max-w-xs flex-1">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="ค้นหาเร็ว..." className="pl-8 h-9 bg-muted/50 border-transparent" />
            </div>
          </div>
          <div className="flex items-center gap-1.5">{actions}</div>
          <button className="relative p-2 rounded-md hover:bg-muted transition-colors hidden sm:inline-flex" aria-label="การแจ้งเตือน">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent" />
          </button>
          <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 hover:bg-muted rounded-md p-1 pr-2 transition-colors" aria-label="เมนูผู้ใช้">
                  <div className={`w-8 h-8 rounded-full ${currentUser.avatarColor ?? "bg-primary"} text-white flex items-center justify-center text-xs font-semibold`}>
                    {currentUser.name.slice(0, 1)}
                  </div>
                  <div className="hidden md:block leading-tight text-left">
                    <div className="text-sm font-medium">{currentUser.name}</div>
                    <div className="text-[11px] text-muted-foreground">{roleLabel[currentUser.role]}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium">{currentUser.name}</div>
                  <div className="text-xs text-muted-foreground font-normal">{currentUser.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> ออกจากระบบ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden">
          <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
