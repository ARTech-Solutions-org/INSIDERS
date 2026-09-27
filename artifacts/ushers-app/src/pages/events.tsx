import React, { useState, useEffect } from 'react';
import { useListMyAssignments, MyAssignment, useListEvents, useGetMyUsherProfile } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Clock, ArrowUpRight, AlertTriangle, ShieldOff } from 'lucide-react';
import { format } from 'date-fns';


function OpenEventList() {
  const { data: eventsData, isLoading } = useListEvents();
  const events = Array.isArray(eventsData)
    ? eventsData
    : (Array.isArray((eventsData as any)?.data) ? (eventsData as any).data : []);

  if (isLoading) {
    return (
      <div className="space-y-4 mt-6">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="border border-border/50 bg-card/40 rounded-2xl p-10 text-center mt-6 flex flex-col items-center justify-center relative overflow-hidden">
        <p className="brand-meta text-foreground/60 relative z-10 mb-1">NO OPEN EVENTS</p>
        <p className="text-xs text-muted-foreground relative z-10">Check back later for new opportunities.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      {events.map((event: any) => {
        const startDate = new Date(event.startTime);
        return (
          <Link key={event.id} href={`/events/${event.id}`} className="block">
            <div className="bg-card border border-border/80 rounded-2xl overflow-hidden hover:shadow-md transition-shadow active:scale-[0.99] transform duration-150 flex items-stretch min-h-[110px]">
              <div className="w-20 border-r border-border/40 flex flex-col items-center justify-center p-2 bg-foreground/[0.02]">
                <span className="brand-display text-4xl leading-none text-foreground">{format(startDate, 'dd')}</span>
                <span className="brand-meta text-muted-foreground mt-1">{format(startDate, 'MMM')}</span>
              </div>
              <div className="flex-1 p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="brand-display text-lg text-foreground line-clamp-2 pr-2 leading-tight tracking-wide">{event.title}</h3>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground font-medium">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-foreground/40" />
                    <span>{format(startDate, 'h:mm a')} - {format(new Date(event.endTime), 'h:mm a')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
                      <span className="line-clamp-1">{event.eventLocName || 'Location TBA'}</span>
                    </div>
                  </div>
                  {event.deductionRules && event.deductionRules.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="bg-destructive/10 text-destructive text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider border border-destructive/20 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Rules Apply
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function AssignmentList({ status, colorClass }: { status: string, colorClass: string }) {
  const { data: assignmentsData, isLoading } = useListMyAssignments({ status });
  const assignments: MyAssignment[] = Array.isArray(assignmentsData)
    ? assignmentsData
    : (Array.isArray((assignmentsData as any)?.data) ? (assignmentsData as any).data : []);

  if (isLoading) {
    return (
      <div className="space-y-4 mt-6">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="border border-border/50 bg-card/40 rounded-2xl p-10 text-center mt-6 flex flex-col items-center justify-center relative overflow-hidden">
        <p className="brand-meta text-foreground/60 relative z-10 mb-1">NO EVENTS FOUND</p>
        <p className="text-xs text-muted-foreground relative z-10">Check back later for new assignments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      {assignments.map((assignment) => {
        const startDate = new Date(assignment.event.startTime);
        return (
          <Link key={assignment.id} href={`/events/${assignment.eventId}`} className="block">
            <div className="bg-card border border-border/80 rounded-2xl overflow-hidden hover:shadow-md transition-shadow active:scale-[0.99] transform duration-150 flex items-stretch min-h-[110px]">
              {/* Date Block */}
              <div className="w-20 border-r border-border/40 flex flex-col items-center justify-center p-2 bg-foreground/[0.02]">
                <span className="brand-display text-4xl leading-none text-foreground">{format(startDate, 'dd')}</span>
                <span className="brand-meta text-muted-foreground mt-1">{format(startDate, 'MMM')}</span>
              </div>
              {/* Event Info */}
              <div className="flex-1 p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="brand-display text-lg text-foreground line-clamp-2 pr-2 leading-tight tracking-wide">{assignment.event.title}</h3>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground font-medium">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-foreground/40" />
                    <span>{format(startDate, 'h:mm a')} - {format(new Date(assignment.event.endTime), 'h:mm a')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
                      <span className="line-clamp-1">{assignment.event.eventLocName || 'Location TBA'}</span>
                    </div>
                    {assignment.event.eventLocName && (
                      <div className="shrink-0 ml-2 bg-background border border-border px-2 py-0.5 rounded-sm flex items-center gap-1">
                        MAPS <ArrowUpRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  {assignment.event.deductionRules && assignment.event.deductionRules.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="bg-destructive/10 text-destructive text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider border border-destructive/20 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Rules Apply
                      </span>
                    </div>
                  )}
                </div>
                {assignment.isTeamLead && (
                  <div className="mt-3">
                    <span className="brand-meta px-2 py-1 bg-primary text-primary-foreground rounded-md">
                      TEAM LEAD
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function SuspendedScreen({ suspendedUntil }: { suspendedUntil?: string | null }) {
  const endDate = suspendedUntil ? new Date(suspendedUntil) : null;

  const getTimeLeft = () => {
    if (!endDate) return null;
    const diff = endDate.getTime() - Date.now();
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return { days, hours, minutes, seconds };
  };

  const [timeLeft, setTimeLeft] = useState(getTimeLeft());

  useEffect(() => {
    if (!endDate) return;
    const timer = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [suspendedUntil]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center">
      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
        <ShieldOff className="w-10 h-10 text-red-500" />
      </div>

      {/* Title */}
      <h2 className="brand-display text-2xl uppercase tracking-wider text-foreground mb-2">
        Account Suspended
      </h2>
      <p className="text-muted-foreground text-sm mb-6 max-w-xs leading-relaxed">
        Your account has been suspended due to repeated reliability issues. You cannot view or apply for events during this period.
      </p>

      {/* Countdown or Indefinite */}
      {endDate && timeLeft ? (
        <div className="w-full max-w-xs mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3">Suspension ends in</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Days', value: timeLeft.days },
              { label: 'Hrs', value: timeLeft.hours },
              { label: 'Min', value: timeLeft.minutes },
              { label: 'Sec', value: timeLeft.seconds },
            ].map(({ label, value }) => (
              <div key={label} className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 flex flex-col items-center">
                <span className="brand-display text-2xl text-red-500 leading-none">
                  {String(value).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : endDate ? (
        <div className="mb-6 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-sm text-green-600 font-semibold">Suspension period has ended — contact admin to reactivate</p>
        </div>
      ) : (
        <div className="mb-6 px-4 py-2 bg-red-500/5 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-500 font-semibold">Indefinite suspension — no end date set</p>
        </div>
      )}

      {/* Info Card */}
      <div className="w-full max-w-xs bg-red-500/5 border border-red-500/20 rounded-2xl p-5 text-left space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3">What this means</p>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          <p className="text-xs text-muted-foreground">All upcoming assignments have been cancelled</p>
        </div>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          <p className="text-xs text-muted-foreground">You cannot apply for new events</p>
        </div>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          <p className="text-xs text-muted-foreground">Contact the admin team to appeal or resolve this</p>
        </div>
      </div>
    </div>
  );
}

export default function Events() {
  const [activeTab, setActiveTab] = useState('pending');
  const { data: profileData } = useGetMyUsherProfile();
  const profile = (profileData as any)?.data ?? profileData;
  const isSuspended = profile?.status === 'suspended';
  const suspendedUntil: string | null = profile?.suspendedUntil ?? null;

  return (
    <div className="p-5 flex flex-col h-full relative overflow-hidden">
      <div className="pt-2 mb-6">
        <h1 className="brand-display text-4xl text-foreground mb-1 tracking-wider uppercase">MY EVENTS</h1>
        <p className="text-muted-foreground font-medium">Every call time, in one place.</p>
      </div>

      {isSuspended ? (
        <SuspendedScreen suspendedUntil={suspendedUntil} />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
          <TabsList className="w-full h-auto flex flex-wrap bg-transparent border-b border-border/50 p-0 rounded-none justify-start">
            <TabsTrigger
              value="open"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground text-xs uppercase tracking-wider font-bold py-3 px-4"
            >
              Open
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-foreground text-xs uppercase tracking-wider font-bold py-3 px-4"
            >
              Pending
            </TabsTrigger>
            <TabsTrigger
              value="accepted"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-muted data-[state=active]:bg-transparent data-[state=active]:text-foreground text-xs uppercase tracking-wider font-bold py-3 px-4"
            >
              Accepted
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent data-[state=active]:text-foreground text-xs uppercase tracking-wider font-bold py-3 px-4"
            >
              Completed
            </TabsTrigger>
            <TabsTrigger
              value="cancelled"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-destructive data-[state=active]:bg-transparent data-[state=active]:text-foreground text-xs uppercase tracking-wider font-bold py-3 px-4"
            >
              Past/Cancel
            </TabsTrigger>
            <TabsTrigger
              value="rejected"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-destructive data-[state=active]:bg-transparent data-[state=active]:text-foreground text-xs uppercase tracking-wider font-bold py-3 px-4"
            >
              Rejected
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="flex-1 outline-none">
            <OpenEventList />
          </TabsContent>
          <TabsContent value="pending" className="flex-1 outline-none">
            <AssignmentList status="pending,assigned" colorClass="" />
          </TabsContent>
          <TabsContent value="accepted" className="flex-1 outline-none">
            <AssignmentList status="accepted,checked_in" colorClass="" />
          </TabsContent>
          <TabsContent value="completed" className="flex-1 outline-none">
            <AssignmentList status="completed" colorClass="" />
          </TabsContent>
          <TabsContent value="cancelled" className="flex-1 outline-none">
            <AssignmentList status="cancelled,no_show,declined" colorClass="" />
          </TabsContent>
          <TabsContent value="rejected" className="flex-1 outline-none">
            <AssignmentList status="rejected" colorClass="" />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
