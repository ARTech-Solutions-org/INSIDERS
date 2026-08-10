import React from 'react';
import { useGetMyUsherProfile, useListMyAssignments, MyAssignment } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Star, ChevronRight, MapPin, Calendar, Clock, Banknote } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function Dashboard() {
  const { data: profile, isLoading: isProfileLoading } = useGetMyUsherProfile();
  const { data: assignmentsData, isLoading: isAssignmentsLoading } = useListMyAssignments({ status: 'pending,assigned,accepted,checked_in' });
  
  const upcomingAssignments: MyAssignment[] = Array.isArray(assignmentsData)
    ? assignmentsData.slice(0, 3)
    : (Array.isArray((assignmentsData as any)?.data) ? (assignmentsData as any).data.slice(0, 3) : []);

  return (
    <div className="p-4 space-y-6">
      {/* Greeting & Quick Stats */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isProfileLoading ? <Skeleton className="h-8 w-48" /> : `Hello, ${profile?.fullName?.split(' ')[0] || 'Usher'}`}
          </h1>
          <p className="text-muted-foreground">Ready for your next event?</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-primary text-primary-foreground p-4 rounded-2xl shadow-md relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
            <div className="flex items-center gap-2 mb-2 text-primary-foreground/80">
              <Banknote className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Balance</span>
            </div>
            {isProfileLoading ? (
              <Skeleton className="h-8 w-24 bg-primary-foreground/20" />
            ) : (
              <p className="text-2xl font-bold">EGP {profile?.balance?.toLocaleString() || '0'}</p>
            )}
          </div>

          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rating</span>
              <Star className="w-4 h-4 text-secondary fill-secondary" />
            </div>
            {isProfileLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{profile?.avgRating?.toFixed(1) || 'N/A'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/events" className="bg-card border border-border rounded-xl p-3 flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-colors">
          <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-secondary" />
          </div>
          <span className="text-xs font-medium">My Events</span>
        </Link>
        <Link href="/balance" className="bg-card border border-border rounded-xl p-3 flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-colors">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Banknote className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xs font-medium">Transactions</span>
        </Link>
        <Link href="/profile" className="bg-card border border-border rounded-xl p-3 flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-colors">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Star className="w-5 h-5 text-muted-foreground" />
          </div>
          <span className="text-xs font-medium">Ratings</span>
        </Link>
      </div>

      {/* Upcoming Events */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Upcoming Assignments</h2>
          <Link href="/events" className="text-sm font-medium text-secondary flex items-center">
            See all <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        {isAssignmentsLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
          </div>
        ) : upcomingAssignments.length > 0 ? (
          <div className="space-y-3">
            {upcomingAssignments.map((assignment) => (
              <Link key={assignment.id} href={`/events/${assignment.eventId}`} className="block">
                <div className="bg-card border border-border p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow active:scale-[0.98] transform duration-150">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-foreground line-clamp-1 flex-1 pr-2">{assignment.event.title}</h3>
                    {(assignment.status === 'pending' || assignment.status === 'assigned') && (
                      <span className="px-2 py-0.5 rounded-full bg-secondary/20 text-secondary text-[10px] font-bold uppercase tracking-wide shrink-0">
                        Needs Action
                      </span>
                    )}
                    {assignment.status === 'accepted' && (
                      <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-[10px] font-bold uppercase tracking-wide shrink-0">
                        Confirmed
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1.5 text-sm text-muted-foreground mt-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary/50" />
                      <span>{format(new Date(assignment.event.startTime), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary/50" />
                      <span>{format(new Date(assignment.event.startTime), 'h:mm a')} - {format(new Date(assignment.event.endTime), 'h:mm a')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary/50" />
                      <span className="line-clamp-1">{assignment.event.eventLocName || 'Location TBA'}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No upcoming assignments</p>
            <p className="text-xs text-muted-foreground mt-1">Enjoy your free time!</p>
          </div>
        )}
      </div>
    </div>
  );
}
