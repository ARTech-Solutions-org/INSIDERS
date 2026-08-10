import React from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'wouter';
import { useListMyNotifications } from '@workspace/api-client-react';

export function Header() {
  const { data: notifications } = useListMyNotifications({ unread: true }, { query: { queryKey: ['notifications', 'unread'] }});
  const unreadCount = notifications?.length || 0;

  return (
    <header className="fixed top-0 left-0 right-0 bg-primary text-primary-foreground h-16 z-50 flex items-center justify-between px-4 shadow-md">
      <Link href="/" className="font-bold tracking-widest text-xl flex items-center gap-2 outline-none">
        {/* Abstract shape representing Artech */}
        <div className="w-6 h-6 bg-secondary rounded-sm rotate-45 flex items-center justify-center">
          <div className="w-2 h-2 bg-primary rounded-full" />
        </div>
        ARTECH
      </Link>
      
      <Link href="/notifications" className="relative p-2 rounded-full hover:bg-primary-foreground/10 transition-colors">
        <Bell className="w-5 h-5 text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-destructive border-2 border-primary rounded-full" />
        )}
      </Link>
    </header>
  );
}
