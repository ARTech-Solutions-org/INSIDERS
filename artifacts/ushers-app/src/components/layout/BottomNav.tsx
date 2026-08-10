import React from 'react';
import { Link, useLocation } from 'wouter';
import { Home, Calendar, Wallet, Bell, User } from 'lucide-react';
import { useListMyNotifications } from '@workspace/api-client-react';

export function BottomNav() {
  const [location] = useLocation();
  const { data: notifications } = useListMyNotifications({ unread: true }, { query: { queryKey: ['notifications', 'unread'] }});
  const unreadCount = Array.isArray(notifications) ? notifications.length : 0;

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/events', icon: Calendar, label: 'Events' },
    { href: '/balance', icon: Wallet, label: 'Balance' },
    { href: '/notifications', icon: Bell, label: 'Alerts', badge: unreadCount },
    { href: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border pb-safe z-[1001] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex justify-between items-center px-2 h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = item.href === '/' ? location === '/' : location.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link key={item.href} href={item.href} className="flex-1 flex flex-col items-center justify-center h-full relative outline-none tap-highlight-transparent">
              <div className={`relative flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${isActive ? 'text-secondary' : 'text-muted-foreground'}`}>
                {isActive && (
                  <span className="absolute top-0 w-8 h-1 bg-secondary rounded-b-full animate-in fade-in slide-in-from-top-1" />
                )}
                <Icon className={`w-6 h-6 mb-1 ${isActive ? 'fill-secondary/20' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
                {(item.badge ?? 0) > 0 && (
                  <span className="absolute top-2 right-[calc(50%-18px)] w-4 h-4 bg-destructive text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-card">
                    {(item.badge ?? 0) > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
