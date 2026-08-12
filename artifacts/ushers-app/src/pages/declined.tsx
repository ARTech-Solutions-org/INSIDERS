import React from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useLogout } from '@workspace/api-client-react';
import { clearAuthToken } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, LogOut, Phone } from 'lucide-react';

export default function Declined() {
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
        <div className="w-24 h-24 bg-destructive/10 border-2 border-destructive rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
          <ShieldAlert className="w-10 h-10 text-destructive" strokeWidth={1.5} />
        </div>

        <p className="brand-meta text-destructive uppercase tracking-widest text-xs mb-2">STATUS UPDATE</p>
        <h1 className="brand-display text-4xl text-foreground mb-4 uppercase tracking-widest leading-none">APPLICATION<br />DECLINED</h1>
        
        <div className="text-muted-foreground mb-6 text-sm leading-relaxed border-y border-border/50 py-4 space-y-4">
          <p>
            We appreciate your interest in joining our team. Unfortunately, we cannot proceed with your application at this time.
          </p>
          <p className="text-foreground/80 font-medium">
            Don't worry! We will keep your profile on file. If an opportunity arises that matches your profile in the future, our team will definitely reach out to you.
          </p>
        </div>

        <div className="bg-card p-5 border border-border rounded-2xl mb-8 shadow-sm text-left">
          <div className="flex items-start space-x-3">
            <Phone className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-bold uppercase tracking-widest">Think there's a mistake?</p>
              <p className="text-xs text-muted-foreground mt-1 mb-2 leading-relaxed">
                If you believe your application was declined by mistake, please contact our support team.
              </p>
              <a href="tel:+201000000000" className="text-primary font-bold text-sm tracking-wider hover:underline">
                +20 100 000 0000
              </a>
            </div>
          </div>
        </div>

        <Button variant="outline" className="w-full h-12 rounded-xl border-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-colors text-xs font-bold uppercase tracking-widest" onClick={handleLogout} disabled={logoutMutation.isPending}>
          <LogOut className="w-4 h-4 mr-2" />
          SIGN OUT
        </Button>
      </div>
    </div>
  );
}
