import React from 'react';
import { useGetMyUsherProfile, useListMyAssignments, MyAssignment, useListMyWaitlists, useAcceptWaitlist, useRejectWaitlist, getListMyWaitlistsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Star, ChevronRight, MapPin, Calendar, Clock, Banknote, ArrowUpRight, Check, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Dashboard() {
  const { data: profile, isLoading: isProfileLoading } = useGetMyUsherProfile();
  const queryClient = useQueryClient();
  const { data: assignmentsData, isLoading: isAssignmentsLoading } = useListMyAssignments({ status: 'pending,assigned,accepted,checked_in' });
  const { data: waitlists, isLoading: isWaitlistsLoading } = useListMyWaitlists();
  
  const { mutate: acceptWaitlist, isPending: isAccepting } = useAcceptWaitlist({
    mutation: {
      onSuccess: () => {
        toast.success("Waitlist accepted!");
        queryClient.invalidateQueries({ queryKey: getListMyWaitlistsQueryKey() as any });
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to accept waitlist");
      }
    }
  });

  const { mutate: rejectWaitlist, isPending: isRejecting } = useRejectWaitlist({
    mutation: {
      onSuccess: () => {
        toast.success("Waitlist declined.");
        queryClient.invalidateQueries({ queryKey: getListMyWaitlistsQueryKey() as any });
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to decline waitlist");
      }
    }
  });

  const upcomingAssignments: MyAssignment[] = Array.isArray(assignmentsData)
    ? assignmentsData.slice(0, 3)
    : (Array.isArray((assignmentsData as any)?.data) ? (assignmentsData as any).data.slice(0, 3) : []);

  const firstName = profile?.fullName?.split(' ')[0] || 'USHER';

  return (
    <div className="p-5 space-y-7">

      {/* Greeting */}
      <div>
        <h1 className="brand-display text-2xl text-foreground mb-1 uppercase tracking-wider">
          {isProfileLoading ? <Skeleton className="h-10 w-48 rounded-xl" /> : `HELLO, ${firstName}`}
        </h1>
        <p className="text-muted-foreground font-medium">Ready for your next event?</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Balance Card - CALM GREEN */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 group hover:-translate-y-1 transition-all duration-300 shadow-md hover:shadow-lg bg-primary/10">
          {/* The Glow */}
          <div className="absolute w-48 h-48 bg-accent/40 blur-[50px] -left-8 -top-8 group-hover:bg-accent/60 transition-colors duration-500 z-0 pointer-events-none"></div>
          
          <div className="relative z-10 bg-gradient-to-br from-primary/95 to-[#1c3a32]/95 backdrop-blur-md p-5 flex flex-col justify-between min-h-[120px] h-full overflow-hidden">
            {/* Decorative Pattern Bottom Right */}
            <div 
              className="absolute -right-4 -bottom-4 w-32 h-32 opacity-20 pointer-events-none transition-transform duration-500 group-hover:scale-110 group-hover:opacity-30 z-0" 
              style={{ 
                backgroundImage: 'radial-gradient(circle, currentColor 1.5px, transparent 1.5px)', 
                backgroundSize: '12px 12px',
                color: 'hsl(var(--primary-foreground))',
                maskImage: 'radial-gradient(circle at bottom right, black, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(circle at bottom right, black, transparent 70%)'
              }} 
            />
            
            <div className="relative z-10">
              <span className="brand-meta text-primary-foreground/70 tracking-widest">BALANCE</span>
            </div>
            <div className="mt-4 relative z-10">
              {isProfileLoading ? (
                <Skeleton className="h-8 w-24 bg-primary-foreground/20 rounded-xl" />
              ) : (
                <p className="brand-display text-3xl tracking-wide text-primary-foreground group-hover:scale-[1.02] origin-left transition-transform duration-300">
                  EGP {profile?.balance?.toLocaleString() || '0.00'}
                </p>
              )}
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase mt-2 text-primary-foreground/80 tracking-wider">
                <ArrowUpRight className="w-3 h-3 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform duration-300" /> AVAILABLE NOW
              </div>
            </div>
          </div>
        </div>

        {/* Rating Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border group hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-md bg-card/50">
          {/* The Glow */}
          <div className="absolute w-48 h-48 bg-accent/40 blur-[50px] -left-8 -top-8 group-hover:bg-accent/60 transition-colors duration-500 z-0 pointer-events-none"></div>
          
          <div className="relative z-10 bg-card/90 backdrop-blur-md p-5 flex flex-col justify-between min-h-[120px] h-full">
            <div className="flex items-center justify-between mb-1 relative z-10">
              <span className="brand-meta text-muted-foreground tracking-widest">RATING</span>
              <div className="w-8 h-8 rounded-full border border-accent/30 bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors duration-300">
                <Star className="w-4 h-4 text-accent fill-accent/50 group-hover:scale-110 group-hover:fill-accent transition-all duration-300" />
              </div>
            </div>
            <div className="mt-4 relative z-10">
              {isProfileLoading ? (
                <Skeleton className="h-8 w-16 rounded-xl" />
              ) : (
                <p className="brand-display text-4xl text-foreground group-hover:text-accent transition-colors duration-300">{profile?.avgRating?.toFixed(1) || 'N/A'}</p>
              )}
              <p className="brand-meta text-muted-foreground mt-2">YOUR FLOOR SCORE</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/events" className="relative overflow-hidden rounded-xl border border-border group hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-md block bg-card/50">
          <div className="absolute w-32 h-32 bg-primary/20 blur-[30px] -left-8 -top-8 group-hover:bg-primary/40 transition-colors duration-500 z-0 pointer-events-none"></div>
          <div className="relative z-10 bg-card/90 backdrop-blur-md p-4 flex flex-col items-center justify-center gap-3 h-full group-hover:bg-card/95 transition-colors">
            <Calendar className="w-5 h-5 text-foreground/80 group-hover:scale-110 group-hover:text-primary transition-all duration-300" strokeWidth={1.5} />
            <span className="brand-meta group-hover:text-primary transition-colors">MY EVENTS</span>
          </div>
        </Link>
        <Link href="/balance" className="relative overflow-hidden rounded-xl border border-border group hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-md block bg-card/50">
          <div className="absolute w-32 h-32 bg-primary/20 blur-[30px] -left-8 -top-8 group-hover:bg-primary/40 transition-colors duration-500 z-0 pointer-events-none"></div>
          <div className="relative z-10 bg-card/90 backdrop-blur-md p-4 flex flex-col items-center justify-center gap-3 h-full group-hover:bg-card/95 transition-colors">
            <Banknote className="w-5 h-5 text-foreground/80 group-hover:scale-110 group-hover:text-primary transition-all duration-300" strokeWidth={1.5} />
            <span className="brand-meta text-center group-hover:text-primary transition-colors">TRANSACTIONS</span>
          </div>
        </Link>
        <Link href="/ratings" className="relative overflow-hidden rounded-xl border border-border group hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-md block bg-card/50">
          <div className="absolute w-32 h-32 bg-accent/20 blur-[30px] -left-8 -top-8 group-hover:bg-accent/40 transition-colors duration-500 z-0 pointer-events-none"></div>
          <div className="relative z-10 bg-card/90 backdrop-blur-md p-4 flex flex-col items-center justify-center gap-3 h-full group-hover:bg-card/95 transition-colors">
            <Star className="w-5 h-5 text-foreground/80 group-hover:scale-110 group-hover:text-primary transition-all duration-300" strokeWidth={1.5} />
            <span className="brand-meta group-hover:text-primary transition-colors">RATINGS</span>
          </div>
        </Link>
      </div>

      {/* Upcoming Events */}
      <div className="space-y-4 pb-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <h2 className="brand-display text-xl tracking-wider">UPCOMING ASSIGNMENTS</h2>
          <Link href="/events" className="brand-meta text-secondary flex items-center hover:underline">
            SEE ALL <ChevronRight className="w-3 h-3 ml-1" />
          </Link>
        </div>

        {isAssignmentsLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
          </div>
        ) : upcomingAssignments.length > 0 ? (
          <div className="space-y-3">
            {upcomingAssignments.map((assignment) => (
              <Link key={assignment.id} href={`/events/${assignment.eventId}`} className="block">
                <div className="relative overflow-hidden rounded-2xl border border-border group hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-md active:scale-[0.98] bg-card/50">
                  <div className="absolute w-48 h-48 bg-primary/20 blur-[50px] -left-12 -top-12 group-hover:bg-primary/40 transition-colors duration-500 z-0 pointer-events-none"></div>
                  
                  <div className="relative z-10 bg-card/90 backdrop-blur-md p-4 h-full overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/40 group-hover:bg-primary transition-colors duration-300 z-20" />

                    <div className="flex justify-between items-start mb-3 relative z-10">
                      <h3 className="brand-display text-lg text-foreground line-clamp-1 flex-1 pr-2 tracking-wide pl-2 group-hover:text-primary transition-colors duration-300">{assignment.event.title}</h3>
                      {(assignment.status === 'pending' || assignment.status === 'assigned') && (
                        <span className="brand-meta px-2 py-1 bg-accent/20 text-accent-foreground border border-accent/30 rounded-md">
                          NEEDS ACTION
                        </span>
                      )}
                      {assignment.status === 'accepted' && (
                        <span className="brand-meta px-2 py-1 bg-muted/20 text-muted-foreground border border-muted/30 rounded-md">
                          CONFIRMED
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground font-medium pl-2 relative z-10">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-foreground/40 group-hover:text-primary/60 transition-colors duration-300" />
                        <span>{format(new Date(assignment.event.startTime), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-foreground/40 group-hover:text-primary/60 transition-colors duration-300" />
                        <span>{format(new Date(assignment.event.startTime), 'h:mm a')} - {format(new Date(assignment.event.endTime), 'h:mm a')}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-foreground/40 group-hover:text-primary/60 transition-colors duration-300" />
                        <span className="line-clamp-1">{assignment.event.eventLocName || 'Location TBA'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-card border border-border border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center min-h-[160px]">
            <Calendar className="w-10 h-10 text-foreground/20 mb-3" strokeWidth={1} />
            <p className="brand-meta text-foreground/60 mb-1">NO UPCOMING ASSIGNMENTS</p>
            <p className="text-xs text-muted-foreground">Enjoy your free time!</p>
          </div>
        )}
      </div>

      {waitlists && waitlists.length > 0 && (
        <div className="mt-8 animate-fade-in" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Waitlisted Events
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {waitlists.map((waitlist: any) => (
              <div key={waitlist.id} className="group relative overflow-hidden rounded-2xl bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_8px_30px_rgb(245,158,11,0.08)] transition-all duration-300 transform hover:-translate-y-1">
                <div className="p-5 flex flex-col h-full relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <Link to={`/events/${waitlist.eventId}`}>
                      <h3 className="font-bold text-lg leading-tight group-hover:text-amber-600 transition-colors duration-300 line-clamp-2 pr-2 relative z-10 cursor-pointer">
                        {waitlist.event.title}
                      </h3>
                    </Link>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                        Position: #{waitlist.priorityOrder}
                      </Badge>
                      {waitlist.status === 'accepted' && (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 mt-1">
                          Accepted
                        </Badge>
                      )}
                      {waitlist.status === 'rejected' && (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 mt-1">
                          Declined
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground font-medium pl-2 relative z-10 mb-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-foreground/40 group-hover:text-amber-500/60 transition-colors duration-300" />
                      <span>{format(new Date(waitlist.event.startTime), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-foreground/40 group-hover:text-amber-500/60 transition-colors duration-300" />
                      <span className="line-clamp-1">{waitlist.event.eventLocName || 'Location TBA'}</span>
                    </div>
                  </div>

                  {waitlist.status === 'pending' && new Date(waitlist.event.startTime) > new Date() && (
                    <div className="mt-auto pt-4 border-t border-amber-500/10 flex gap-2">
                      <button 
                        onClick={() => acceptWaitlist({ waitlistId: waitlist.id })}
                        disabled={isAccepting || isRejecting}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-4 rounded-xl text-sm transition-colors disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => rejectWaitlist({ waitlistId: waitlist.id })}
                        disabled={isAccepting || isRejecting}
                        className="flex-1 bg-background hover:bg-muted text-foreground border border-input font-medium py-2 px-4 rounded-xl text-sm transition-colors disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {waitlist.status === 'accepted' && new Date(waitlist.event.startTime) > new Date() && (
                    <div className="mt-auto pt-4 border-t border-amber-500/10 flex gap-2">
                      <button 
                        onClick={() => rejectWaitlist({ waitlistId: waitlist.id })}
                        disabled={isRejecting}
                        className="flex-1 bg-destructive/10 hover:bg-destructive/20 text-destructive font-medium py-2 px-4 rounded-xl text-sm transition-colors disabled:opacity-50"
                      >
                        Cancel Waitlist
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
