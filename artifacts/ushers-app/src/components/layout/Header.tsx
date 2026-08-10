import React from 'react';
import { Bell } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Link } from 'wouter';
import { useListMyNotifications } from '@workspace/api-client-react';

export function Header() {
  const { data: notifications } = useListMyNotifications({ unread: true }, { query: { queryKey: ['notifications', 'unread'] } });
  const unreadCount = notifications?.length || 0;

  return (
    <header className="fixed top-0 left-0 right-0 bg-primary text-primary-foreground h-[76px] z-50 flex items-center justify-between px-5 border-b border-primary-foreground/10">
      <Link href="/" className="flex items-center outline-none relative z-10">
        <Logo className="h-10 w-auto" color="white" />
      </Link>

      <Link href="/notifications" aria-label="Open notifications" className="relative w-10 h-10 rounded-xl bg-primary-foreground/10 border border-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors z-10">
        <Bell className="w-5 h-5 text-primary-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full shadow-sm" />
        )}
      </Link>
    </header>
  );
}
