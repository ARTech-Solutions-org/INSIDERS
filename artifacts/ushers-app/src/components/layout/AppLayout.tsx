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
    }
  }, [isError, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <Header />
      <main className="flex-1 w-full max-w-md mx-auto overflow-x-hidden pt-16 pb-20 relative">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
