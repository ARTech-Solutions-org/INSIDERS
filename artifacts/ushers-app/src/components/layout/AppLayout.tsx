import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { useGetMe } from '@workspace/api-client-react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe();

  useEffect(() => {
    if (isError) {
      setLocation('/login');
    } else if (user && user.status === 'pending') {
      setLocation('/pending');
    } else if (user && user.status === 'declined') {
      setLocation('/declined');
    }
  }, [isError, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="brand-display text-2xl text-primary">LOADING <span className="brand-slashes">//////</span></div>
      </div>
    );
  }

  return (
    <div className="brand-app min-h-[100dvh] text-foreground flex flex-col font-sans pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] relative overflow-hidden">
      <Header />
      <main className="flex-1 w-full max-w-md mx-auto overflow-x-hidden pt-[76px] pb-24 relative z-10">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
