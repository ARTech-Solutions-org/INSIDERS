import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AdminLayout } from '@/components/layout/AdminLayout';

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

const queryClient = new QueryClient();

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
        <Route path="/audit-log" component={AuditLog} />
        <Route path="/settings" component={() => <div>Settings</div>} />
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
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
