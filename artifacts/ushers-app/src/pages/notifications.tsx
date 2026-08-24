import React, { useState } from 'react';
import { useListMyNotifications, useMarkAllNotificationsRead, useMarkNotificationRead, getListMyNotificationsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CircleAlert, CalendarClock, ShieldAlert, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { Notification } from '@workspace/api-client-react';

export default function Notifications() {
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useListMyNotifications({});
  const markAllMutation = useMarkAllNotificationsRead();
  const markReadMutation = useMarkNotificationRead();
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const handleMarkAllRead = () => {
    markAllMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMyNotificationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
      }
    });
  };

  const handleMarkRead = (id: number) => {
    markReadMutation.mutate({ notificationId: id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMyNotificationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
      }
    });
  };

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    if (!notification.isRead) {
      handleMarkRead(notification.id);
    }
  };

  const getIcon = (type: string, className?: string) => {
    const sizeClass = className || "w-5 h-5";
    switch (type) {
      case 'assignment': return <CalendarClock className={`${sizeClass} text-secondary`} />;
      case 'balance': return <Banknote className={`${sizeClass} text-green-600`} />;
      case 'penalty': return <ShieldAlert className={`${sizeClass} text-destructive`} />;
      default: return <CircleAlert className={`${sizeClass} text-foreground`} />;
    }
  };

  const allNotifications = Array.isArray(notifications) ? notifications : [];
  const unreadCount = allNotifications.filter(n => !n.isRead).length;

  return (
    <div className="p-5 flex flex-col h-full relative min-h-screen">
      <div className="flex items-end justify-between pt-2 mb-6 relative z-10 border-b border-border/50 pb-4">
        <div>
          <h1 className="brand-display text-4xl text-foreground mb-1 uppercase tracking-widest">ALERTS</h1>
          <p className="text-muted-foreground font-medium">Stay in the loop</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead} disabled={markAllMutation.isPending} className="text-[10px] font-bold uppercase tracking-widest h-8 text-secondary rounded-xl border border-secondary hover:bg-secondary/10 hover:text-secondary">
            <Check className="w-3 h-3 mr-1" /> MARK ALL READ
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4 relative z-10">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl border border-border" />)}
        </div>
      ) : allNotifications.length === 0 ? (
        <div className="border border-border/50 bg-card p-10 text-center mt-6 flex flex-col items-center justify-center relative overflow-hidden z-10 rounded-2xl shadow-sm">
          <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3 relative z-10" />
          <p className="brand-meta text-foreground/60 relative z-10 mb-1">YOU'RE ALL CAUGHT UP</p>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest relative z-10">NO NEW NOTIFICATIONS</p>
        </div>
      ) : (
        <div className="space-y-3 relative z-10 pb-safe">
          {allNotifications.map(notification => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`p-4 transition-colors bg-card border rounded-2xl shadow-sm relative overflow-hidden ${notification.isRead ? 'opacity-60 bg-muted/30 border-border/50' : 'cursor-pointer hover:border-secondary border-border'}`}
            >
              {!notification.isRead && (
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-secondary" />
              )}
              <div className="flex gap-4 items-start">
                <div className={`w-10 h-10 border rounded-full flex items-center justify-center shrink-0 ${notification.isRead ? 'bg-muted/50 border-border' : 'bg-background border-border'}`}>
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className={`text-sm leading-snug tracking-wide line-clamp-2 ${notification.isRead ? 'text-muted-foreground font-medium' : 'text-foreground font-bold'}`}>
                    {notification.message}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
                    {format(new Date(notification.sentAt), 'MMM d, h:mm a').toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border/50 rounded-3xl w-[90vw] max-w-[400px]">
          <div className="bg-muted/30 p-8 flex flex-col items-center justify-center text-center border-b border-border/50 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/20 pointer-events-none" />
            <div className="w-20 h-20 border-2 rounded-full flex items-center justify-center shrink-0 bg-background border-border mb-5 shadow-sm relative z-10">
              {selectedNotification && getIcon(selectedNotification.type, "w-10 h-10")}
            </div>
            <DialogTitle className="uppercase tracking-[0.2em] text-2xl font-bold brand-display relative z-10">
              Alert Detail
            </DialogTitle>
          </div>
          <div className="p-8">
            <p className="text-[15px] leading-relaxed text-foreground/90 font-medium text-center">
              {selectedNotification?.message}
            </p>
          </div>
          <DialogFooter className="bg-muted/10 p-5 border-t border-border/50 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest text-center sm:text-left w-full sm:w-auto">
              {selectedNotification && format(new Date(selectedNotification.sentAt), 'MMM d, yyyy h:mm a')}
            </span>
            <Button type="button" variant="default" onClick={() => setSelectedNotification(null)} className="uppercase tracking-widest text-xs font-bold w-full sm:w-auto rounded-xl">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
