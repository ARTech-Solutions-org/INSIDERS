import { useGetAdminDashboard, useGetMe } from "@workspace/api-client-react";
import { Users, Calendar, AlertTriangle, Activity, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Dashboard() {
  const { data, isLoading } = useGetAdminDashboard({
    query: { refetchInterval: 30000 } // Auto-refresh every 30 seconds
  });
  const { data: me } = useGetMe();
  const isSuper = me?.type === "admin" && me?.role === "super_admin";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[60px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const trends = data?.eventTrends ?? [];
  const maxEventCount = Math.max(...trends.map((t: any) => t.eventCount), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of system operations and upcoming events.</p>
      </div>

      <div className={`grid gap-4 md:grid-cols-2 ${isSuper ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Ushers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalActiveUshers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">registered &amp; approved</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{data?.pendingApprovals || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">awaiting review</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming (This Week)</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.upcomingEventsThisWeek || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">events in next 7 days</p>
          </CardContent>
        </Card>

        {/* Balance Owed — super_admin only */}
        {isSuper && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-primary">Balance Owed</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">EGP {data?.totalBalanceOwed?.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">total usher balance</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className={isSuper ? "col-span-4" : "col-span-7"}>
          <CardHeader>
            <CardTitle>Event Trends (Last 6 Months)</CardTitle>
            <CardDescription>
              <span className="inline-flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-sm bg-primary/40" /> Total</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-sm bg-green-500/60" /> Completed</span>
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-44 flex items-end gap-2 px-2">
              {trends.map((trend: any, i: number) => {
                const totalHeight = maxEventCount > 0 ? Math.max((trend.eventCount / maxEventCount) * 100, 4) : 4;
                const doneHeight = maxEventCount > 0 && trend.eventCount > 0
                  ? Math.max((trend.completedCount / maxEventCount) * 100, 2) : 0;
                const monthLabel = trend.month ? trend.month.slice(5) : '';
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end gap-0.5 h-36 relative">
                      {/* Background bar (total) */}
                      <div
                        className="flex-1 bg-primary/20 rounded-t-sm transition-all duration-500"
                        style={{ height: `${totalHeight}%` }}
                        title={`${trend.eventCount} events`}
                      />
                      {/* Foreground bar (completed) */}
                      <div
                        className="flex-1 bg-green-500/50 rounded-t-sm transition-all duration-500"
                        style={{ height: `${doneHeight}%` }}
                        title={`${trend.completedCount} completed`}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground font-medium">{monthLabel}</span>
                    <span className="text-[9px] font-bold text-foreground">{trend.eventCount}</span>
                  </div>
                );
              })}
              {trends.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity — super_admin only */}
        {isSuper && (
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest actions taken by admins.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data?.recentActivity?.map((activity: any) => (
                  <div key={activity.id} className="flex items-start gap-4 text-sm">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {activity.adminName?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {activity.adminName} <span className="text-muted-foreground font-normal">performed {activity.actionType.toLowerCase().replace(/_/g, ' ')}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.targetTable} #{activity.targetId} · {format(new Date(activity.createdAt), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
                {(!data?.recentActivity || data.recentActivity.length === 0) && (
                  <div className="text-sm text-muted-foreground text-center py-4">No recent activity.</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
