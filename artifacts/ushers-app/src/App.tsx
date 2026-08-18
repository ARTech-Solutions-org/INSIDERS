import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Watermark } from '@/components/ui/watermark';
import { PWAInstallPrompt } from '@/components/pwa-install-prompt';
import { onForegroundMessage } from '@/lib/firebase';
import { useEffect } from 'react';

// Pages
import Login from '@/pages/login';
import Register from '@/pages/register';
import Pending from '@/pages/pending';
import Declined from '@/pages/declined';
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
      <Route path="/declined" component={Declined} />

      <Route path="*">
        <ProtectedRoutes />
      </Route>
    </Switch>
  );
}

function ForegroundNotifications() {
  useEffect(() => {
    return onForegroundMessage((payload: any) => {
      const title = payload.notification?.title ?? payload.data?.title ?? 'إشعار جديد';
      const body = payload.notification?.body ?? payload.data?.body ?? '';
      
      toast(title, {
        description: body,
        duration: 8000,
      });
    });
  }, []);
  
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="brand-app min-h-[100dvh]">
          <Watermark />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <PWAInstallPrompt />
          <ForegroundNotifications />
        </div>
        <Toaster position="top-center" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
