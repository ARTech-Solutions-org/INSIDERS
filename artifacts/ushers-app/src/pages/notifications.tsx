import React from 'react';
import { useListMyNotifications, useMarkAllNotificationsRead, useMarkNotificationRead, getListMyNotificationsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CircleAlert, CalendarClock, ShieldAlert, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function Notifications() {
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useListMyNotifications({});
  const markAllMutation = useMarkAllNotificationsRead();
  const markReadMutation = useMarkNotificationRead();

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

  const getIcon = (type: string) => {
    switch (type) {
      case 'assignment': return <CalendarClock className="w-5 h-5 text-secondary" />;
      case 'balance': return <Banknote className="w-5 h-5 text-green-500" />;
      case 'penalty': return <ShieldAlert className="w-5 h-5 text-destructive" />;
      default: return <CircleAlert className="w-5 h-5 text-primary" />;
    }
  };

  const allNotifications = Array.isArray(notifications) ? notifications : [];
  const unreadCount = allNotifications.filter(n => !n.isRead).length;

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead} disabled={markAllMutation.isPending} className="text-xs h-8 text-secondary">
            <Check className="w-4 h-4 mr-1" /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : allNotifications.length === 0 ? (
        <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center mt-10">
          <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">You're all caught up</p>
          <p className="text-xs text-muted-foreground mt-1">No new notifications.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allNotifications.map(notification => (
            <div 
              key={notification.id} 
              onClick={() => !notification.isRead && handleMarkRead(notification.id)}
              className={`p-4 rounded-2xl border transition-colors ${notification.isRead ? 'bg-card border-border shadow-sm opacity-70' : 'bg-card border-secondary/30 shadow-md cursor-pointer relative overflow-hidden'}`}
            >
              {!notification.isRead && (
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-secondary" />
              )}
              <div className="flex gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${notification.isRead ? 'bg-muted' : 'bg-primary/5'}`}>
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className={`text-sm leading-snug ${notification.isRead ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {format(new Date(notification.sentAt), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
