import { useState, useMemo } from "react";
import { useGetAdminDashboard, useGetMe, getGetAdminDashboardQueryKey } from "@workspace/api-client-react";
import { Users, Calendar, AlertTriangle, Activity, CheckCircle, Clock, TrendingUp, Star, CreditCard, Banknote, ClipboardList, CheckSquare, XSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subMonths } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Dashboard() {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  
  const monthOptions = useMemo(() => {
    const arr = [{ value: "all", label: "All Time" }];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = subMonths(now, i);
      arr.push({ value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") });
    }
    return arr;
  }, []);

  const { data, isLoading } = useGetAdminDashboard(
    { month: selectedMonth === "all" ? undefined : selectedMonth },
    { query: { queryKey: [...getGetAdminDashboardQueryKey(), selectedMonth], refetchInterval: 30000 } }
  );
  
  const { data: me } = useGetMe();

  const isSuper = me?.type === "admin" && me?.role === "super_admin";
  const hasFinanceAccess = isSuper || (me?.type === "admin" && me?.canManageFinance);

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
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of system operations and upcoming events.</p>
        </div>
        
        <div className="w-[200px]">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger>
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-8">
        {/* Users & Operations Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight border-b pb-2">Users & Operations</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <CardTitle className="text-sm font-medium">Waitlist</CardTitle>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.pendingApprovals || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">people in queue</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Usher Rating</CardTitle>
                <Star className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.avgUsherRating?.toFixed(1) || "0.0"}</div>
                <p className="text-xs text-muted-foreground mt-1">out of 5.0</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Events & Assignments Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight border-b pb-2">Events & Assignments</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{selectedMonth === "all" ? "Total Events" : "Events Started"}</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.totalEvents || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">{selectedMonth === "all" ? "all time events" : "in selected month"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary">Ongoing Events</CardTitle>
                <CheckCircle className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{data?.ongoingEvents || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">happening today</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.upcomingEventsThisWeek || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">events in next 7 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-600">Jobs Completed</CardTitle>
                <CheckSquare className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{data?.completedJobsCount || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">{selectedMonth === "all" ? "successful shifts" : "in selected month"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-destructive">Cancellations</CardTitle>
                <XSquare className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{data?.cancelledJobsCount || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">{selectedMonth === "all" ? "cancelled or no-show" : "in selected month"}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Finance Section — super_admin only */}
        {hasFinanceAccess && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight border-b pb-2">Financials</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-destructive">Balance Owed</CardTitle>
                  <Banknote className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">EGP {data?.totalBalanceOwed?.toLocaleString() || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">total usher balance</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-amber-500">Pending Payouts</CardTitle>
                  <Clock className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-500">{data?.pendingPayouts || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">requests waiting</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-600">{selectedMonth === "all" ? "Paid This Month" : "Paid Out"}</CardTitle>
                  <CreditCard className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">EGP {data?.totalPaidOutThisMonth?.toLocaleString() || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">{selectedMonth === "all" ? "completed payouts this month" : "in selected month"}</p>
                </CardContent>
              </Card>
            </div>
          </section>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className={hasFinanceAccess ? "col-span-4" : "col-span-7"}>
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
        {hasFinanceAccess && (
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
