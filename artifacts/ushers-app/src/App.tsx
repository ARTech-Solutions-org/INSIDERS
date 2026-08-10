import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';

// Pages
import Login from '@/pages/login';
import Register from '@/pages/register';
import Pending from '@/pages/pending';
import Dashboard from '@/pages/dashboard';
import Events from '@/pages/events';
import EventDetail from '@/pages/event-detail';
import Balance from '@/pages/balance';
import Notifications from '@/pages/notifications';
import Profile from '@/pages/profile';
import Documents from '@/pages/documents';
import Ratings from '@/pages/ratings';
import Payouts from '@/pages/payouts';

const queryClient = new QueryClient();

function ProtectedRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/events" component={Events} />
        <Route path="/events/:id" component={EventDetail} />
        <Route path="/balance" component={Balance} />
        <Route path="/payouts" component={Payouts} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/profile" component={Profile} />
        <Route path="/documents" component={Documents} />
        <Route path="/ratings" component={Ratings} />
        
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/pending" component={Pending} />
      
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
        <Toaster position="top-center" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
