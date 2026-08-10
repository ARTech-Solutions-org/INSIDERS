import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Settings, 
  LogOut, 
  Bell, 
  ShieldAlert,
  Megaphone
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { clearAuthToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading, isError } = useGetMe();
  const { mutate: logout } = useLogout({
    mutation: { 
      onSuccess: () => {
        clearAuthToken();
        queryClient.invalidateQueries();
        setLocation("/login");
      }
    },
  });

  useEffect(() => {
    if (!isLoading && (isError || !user || user.type !== "admin")) {
      setLocation("/login");
    }
  }, [isLoading, isError, user, setLocation]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/20">Loading...</div>;
  }

  // Redirecting via useEffect if not admin
  if (isError || !user || user.type !== "admin") {
    return null;
  }

  const isSuper = user?.role === "super_admin";
  const isCoordinator = user?.role === "coordinator";

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, hide: isCoordinator },
    { name: "Events", href: "/events", icon: Calendar },
    { name: "Ushers", href: "/ushers", icon: Users, hide: isCoordinator },
    { name: "Broadcasts", href: "/broadcasts", icon: Megaphone, hide: isCoordinator },
    { name: "Audit Log", href: "/audit-log", icon: ShieldAlert, hide: !isSuper && !user },
    { name: "Settings", href: "/settings", icon: Settings, hide: !isSuper },
  ].filter(item => !item.hide);

  return (
    <div className="min-h-screen flex bg-muted/20">
      {/* Sidebar */}
      <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col hidden md:flex">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold font-serif">A</span>
            </div>
            <span className="font-bold text-lg text-sidebar-foreground uppercase tracking-wider">ARTech</span>
          </div>
          <div className="mt-1 text-xs text-sidebar-foreground/70 tracking-widest">LIVE THE EXPERIENCE</div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href}>
                <a className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`}>
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center justify-between mb-4">
            <div className="truncate">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-sidebar-foreground" onClick={() => logout()}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10 md:hidden">
           <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold font-serif">A</span>
            </div>
            <span className="font-bold text-foreground uppercase tracking-wider">ARTech</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => logout()}>
            <LogOut className="w-5 h-5" />
          </Button>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
