import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { useStore, roleLabel } from "@/lib/store";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function AppLayout({ children, title, actions }: {
  children: ReactNode; title?: string; actions?: ReactNode;
}) {
  const { currentUser } = useStore();
  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/70 backdrop-blur flex items-center gap-4 px-4 md:px-6">
          <div className="flex-1 min-w-0">
            {title && <h1 className="text-lg font-semibold truncate">{title}</h1>}
          </div>
          <div className="hidden lg:flex items-center gap-2 max-w-xs flex-1">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="ค้นหาเร็ว..." className="pl-8 h-9 bg-muted/50 border-transparent" />
            </div>
          </div>
          {actions}
          <button className="relative p-2 rounded-md hover:bg-muted transition-colors" aria-label="การแจ้งเตือน">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent" />
          </button>
          <div className="flex items-center gap-2.5 pl-2 border-l border-border">
            <div className={`w-8 h-8 rounded-full ${currentUser.avatarColor ?? "bg-primary"} text-white flex items-center justify-center text-xs font-semibold`}>
              {currentUser.name.slice(0, 1)}
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-medium">{currentUser.name}</div>
              <div className="text-[11px] text-muted-foreground">{roleLabel[currentUser.role]}</div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden">
          <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
