import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useEffect } from 'react';
import { useGetMe } from '@workspace/api-client-react';

// Pages
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import Ushers from '@/pages/ushers';
import UsherDetails from '@/pages/usher-details';
import Events from '@/pages/events';
import EventsNew from '@/pages/events-new';
import EventDetails from '@/pages/event-details';
import Broadcasts from '@/pages/broadcasts';
import AuditLog from '@/pages/audit-log';
import Financials from '@/pages/financials';

const queryClient = new QueryClient();

/** Renders children only when the logged-in admin is a super_admin.
 *  Otherwise redirects to "/" immediately. */
function SuperAdminOnly({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetMe();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user && user.type === 'admin' && user.role !== 'super_admin') {
      setLocation('/');
    }
  }, [isLoading, user, setLocation]);

  if (isLoading) return null;
  if (!user || user.type !== 'admin' || user.role !== 'super_admin') return null;
  return <>{children}</>;
}

function ProtectedRoutes() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/events/new" component={EventsNew} />
        <Route path="/events/:id" component={EventDetails} />
        <Route path="/events" component={Events} />
        <Route path="/ushers/:id" component={UsherDetails} />
        <Route path="/ushers" component={Ushers} />
        <Route path="/broadcasts" component={Broadcasts} />
        <Route path="/audit-log" component={() => <SuperAdminOnly><AuditLog /></SuperAdminOnly>} />
        <Route path="/financials" component={() => <SuperAdminOnly><Financials /></SuperAdminOnly>} />
        <Route path="/settings" component={() => <SuperAdminOnly><div>Settings</div></SuperAdminOnly>} />
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="*">
        <ProtectedRoutes />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="brand-app min-h-[100dvh]">
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
