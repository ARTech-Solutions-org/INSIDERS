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
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg border border-border">
          <Clock className="w-10 h-10 text-secondary" />
        </div>
        
        <h1 className="text-2xl font-bold text-primary mb-4">Application Pending</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Your Artech application is currently under review by our team. We'll be in touch soon once your account is verified.
        </p>

        <div className="bg-card p-4 rounded-xl border border-card-border mb-8 shadow-sm">
          <p className="text-sm text-card-foreground font-medium">Need help?</p>
          <p className="text-sm text-muted-foreground mt-1">Contact your coordinator.</p>
        </div>

        <Button variant="outline" className="w-full h-12 text-primary border-primary hover:bg-primary/5" onClick={handleLogout} disabled={logoutMutation.isPending}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
