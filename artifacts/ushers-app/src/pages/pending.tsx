import React from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useLogout } from '@workspace/api-client-react';
import { clearAuthToken } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMeQueryKey } from '@workspace/api-client-react';
import { Clock, LogOut } from 'lucide-react';

export default function Pending() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        clearAuthToken();
        queryClient.removeQueries();
        setLocation('/login');
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-5 relative overflow-hidden">
      <div className="max-w-sm w-full text-center relative z-10">
        <div className="w-24 h-24 bg-background border-2 border-secondary rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
          <Clock className="w-10 h-10 text-secondary" strokeWidth={1.5} />
        </div>

        <p className="brand-meta text-muted-foreground uppercase tracking-widest text-xs mb-2">ALMOST THERE</p>
        <h1 className="brand-display text-4xl text-foreground mb-4 uppercase tracking-widest leading-none">APPLICATION<br />PENDING</h1>
        <p className="text-muted-foreground mb-8 text-sm leading-relaxed border-y border-border/50 py-4">
          Your application is currently under review by our team. We'll be in touch soon once your account is verified.
        </p>

        <div className="bg-card p-5 border border-border rounded-2xl mb-8 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-widest">NEED HELP?</p>
          <p className="text-xs text-muted-foreground mt-1">CONTACT YOUR COORDINATOR.</p>
        </div>

        <Button variant="outline" className="w-full h-12 rounded-xl border-border text-foreground hover:bg-secondary/10 hover:text-secondary hover:border-secondary transition-colors text-xs font-bold uppercase tracking-widest" onClick={handleLogout} disabled={logoutMutation.isPending}>
          <LogOut className="w-4 h-4 mr-2" />
          SIGN OUT
        </Button>
      </div>
    </div>
  );
}
