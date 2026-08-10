import React, { useState } from 'react';
import { useListMyAssignments, MyAssignment } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Calendar, Clock, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

function AssignmentList({ status }: { status: string }) {
  const { data: assignmentsData, isLoading } = useListMyAssignments({ status });
  const assignments: MyAssignment[] = Array.isArray(assignmentsData) 
    ? assignmentsData 
    : (Array.isArray((assignmentsData as any)?.data) ? (assignmentsData as any).data : []);

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center mt-4">
        <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground font-medium">No events found</p>
        <p className="text-xs text-muted-foreground mt-1">Check back later for new assignments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      {assignments.map((assignment) => (
        <Link key={assignment.id} href={`/events/${assignment.eventId}`} className="block">
          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow active:scale-[0.98] transform duration-150">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-foreground line-clamp-2 pr-2 leading-tight">{assignment.event.title}</h3>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </div>
            
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary/60" />
                <span>{format(new Date(assignment.event.startTime), 'EEEE, MMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary/60" />
                <span>{format(new Date(assignment.event.startTime), 'h:mm a')} - {format(new Date(assignment.event.endTime), 'h:mm a')}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <MapPin className="w-4 h-4 text-primary/60 shrink-0" />
                  <span className="line-clamp-1">{assignment.event.eventLocName || 'Location TBA'}</span>
                </div>
                {assignment.event.eventLocName && (
                  <a 
                    href={
                      assignment.event.eventLocUrl ||
                      (assignment.event.venueLat && assignment.event.venueLng
                        ? `https://www.google.com/maps/search/?api=1&query=${assignment.event.venueLat},${assignment.event.venueLng}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(assignment.event.eventLocName + ', Egypt')}`)
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-semibold text-secondary hover:underline shrink-0 ml-2 bg-secondary/10 px-2 py-0.5 rounded-full flex items-center gap-1"
                  >
                    Maps ↗
                  </a>
                )}
              </div>
            </div>
            
            {assignment.isTeamLead && (
              <div className="mt-3 inline-flex px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide rounded-md">
                Team Lead
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function Events() {
  const [activeTab, setActiveTab] = useState('pending');

  return (
    <div className="p-4 flex flex-col h-full">
      <h1 className="text-2xl font-bold text-foreground mb-4">My Events</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
        <TabsList className="w-full h-auto flex flex-wrap bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="pending" className="flex-1 text-xs rounded-lg py-2">Pending</TabsTrigger>
          <TabsTrigger value="accepted" className="flex-1 text-xs rounded-lg py-2">Accepted</TabsTrigger>
          <TabsTrigger value="completed" className="flex-1 text-xs rounded-lg py-2">Completed</TabsTrigger>
          <TabsTrigger value="cancelled" className="flex-1 text-xs rounded-lg py-2">Past/Cancel</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending" className="flex-1 outline-none">
          <AssignmentList status="pending,assigned" />
        </TabsContent>
        <TabsContent value="accepted" className="flex-1 outline-none">
          <AssignmentList status="accepted,checked_in" />
        </TabsContent>
        <TabsContent value="completed" className="flex-1 outline-none">
          <AssignmentList status="completed" />
        </TabsContent>
        <TabsContent value="cancelled" className="flex-1 outline-none">
          <AssignmentList status="cancelled,no_show,declined" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
