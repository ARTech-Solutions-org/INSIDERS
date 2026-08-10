import React from 'react';
import { Link, useLocation } from 'wouter';
import { Home, Calendar, Wallet, Bell, User } from 'lucide-react';
import { useListMyNotifications } from '@workspace/api-client-react';

export function BottomNav() {
  const [location] = useLocation();
  const { data: notifications } = useListMyNotifications({ unread: true }, { query: { queryKey: ['notifications', 'unread'] } });
  const unreadCount = Array.isArray(notifications) ? notifications.length : 0;

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/events', icon: Calendar, label: 'Events' },
    { href: '/balance', icon: Wallet, label: 'Balance' },
    { href: '/notifications', icon: Bell, label: 'Alerts', badge: unreadCount },
    { href: '/profile', icon: User, label: 'Profile' },
  ];

  const activeIndex = navItems.findIndex(item => item.href === '/' ? location === '/' : location.startsWith(item.href));
  const safeActiveIndex = activeIndex === -1 ? 0 : activeIndex;

  return (
    <nav className="fixed bottom-4 left-0 right-0 z-[1001] flex justify-center pb-safe px-4 pointer-events-none">
      <div className="bg-card/95 backdrop-blur-xl border border-border rounded-[22px] shadow-lg flex relative overflow-hidden h-[75px] w-full max-w-[380px] p-[6px] pointer-events-auto">
        
        {/* Sliding Highlight */}
        <div 
          className="absolute top-[6px] bottom-[6px] z-0 pointer-events-none"
          style={{ 
            width: `calc((100% - 12px) / ${navItems.length})`, 
            transform: `translateX(${safeActiveIndex * 100}%)`,
            transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' 
          }}
        >
          <div className="w-full h-full rounded-[14px] bg-primary shadow-[0_4px_12px_rgba(37,77,67,0.4)] relative">
             <div className="absolute top-0 left-[10%] w-[80%] h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-80" />
          </div>
        </div>

        {navItems.map((item, index) => {
          const isActive = index === safeActiveIndex;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href} className="flex-1 flex flex-col items-center justify-center h-full relative z-10 outline-none tap-highlight-transparent group">
              
              <div className={`flex flex-col items-center justify-center transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] ${isActive ? 'scale-110' : 'group-active:scale-95'}`}>
                <Icon 
                  className={`transition-colors duration-400 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} 
                  strokeWidth={isActive ? 2 : 1.5} 
                  size={24} 
                />
              </div>
              
              <span className={`brand-meta text-[8.5px] mt-1 transition-all duration-400 ${isActive ? 'text-primary-foreground font-bold' : 'text-muted-foreground group-hover:text-foreground'}`}>
                {item.label}
              </span>

              {(item.badge ?? 0) > 0 && (
                <span className={`absolute top-1 right-[calc(50%-20px)] w-4 h-4 text-[9px] font-bold flex items-center justify-center rounded-full border-2 shadow-sm z-20 ${isActive ? 'bg-accent text-accent-foreground border-primary' : 'bg-accent text-accent-foreground border-card'}`}>
                  {(item.badge ?? 0) > 9 ? '9+' : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
