import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  Settings, 
  LogOut, 
  ShieldAlert,
  Megaphone,
  Wallet
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
    return <div className="min-h-screen flex items-center justify-center bg-background brand-display text-2xl">LOADING <span className="brand-slashes ml-3">//////</span></div>;
  }

  // Redirecting via useEffect if not admin
  if (isError || !user || user.type !== "admin") {
    return null;
  }

  const isSuper = user?.role === "super_admin";
  const hasFinanceAccess = isSuper || user?.canManageFinance;

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Events", href: "/events", icon: CalendarDays },
    { name: "Ushers", href: "/ushers", icon: Users },
    { name: "Broadcasts", href: "/broadcasts", icon: Megaphone },
    { name: "Financials", href: "/financials", icon: Wallet, hide: !hasFinanceAccess },
    { name: "Audit Log", href: "/audit-log", icon: ShieldAlert, hide: !isSuper },
    { name: "Settings", href: "/settings", icon: Settings, hide: !isSuper },
  ].filter(item => !item.hide);

  return (
    <div className="brand-app min-h-screen flex bg-background">
      {/* Sidebar */}
      <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col hidden md:flex">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
             <div className="h-16 w-auto flex items-center justify-start">
                <img src="/insiders-logo.png" alt="Insiders Logo" className="h-full w-auto object-contain brightness-0 invert" />
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href} className={`flex items-center gap-3 px-3 py-2 transition-colors border-l-2 ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium border-sidebar-primary' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-transparent'}`}>
                  <item.icon className="w-5 h-5" />
                  {item.name}
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
          <Button variant="outline" className="w-full justify-start text-sidebar-foreground uppercase tracking-wider font-bold rounded-none" onClick={() => logout()}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
          <div className="mt-4 flex flex-col items-center justify-center opacity-40">
            <span className="text-[9px] uppercase tracking-widest text-sidebar-foreground/60 mb-1">Powered By</span>
            <img src="/powered-by.png" alt="Powered By" className="h-6 object-contain brightness-0 dark:invert" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10 md:hidden">
           <div className="flex items-center gap-2">
            <div className="h-10 w-auto flex items-center justify-center">
              <img src="/insiders-logo.png" alt="Insiders Logo" className="h-full w-auto object-contain brightness-0 invert" />
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => logout()}>
            <LogOut className="w-5 h-5" />
          </Button>
        </header>

         <main className="flex-1 p-5 md:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
