import React from 'react';
import { useListMyRatings, useGetMyUsherProfile } from '@workspace/api-client-react';
import { Star, StarHalf, MessageSquare, Calendar, Award } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

function ratedByLabel(type: string) {
  switch (type) {
    case 'admin': return 'Admin Review';
    case 'system': return 'Auto-Rating';
    case 'holder': return 'Event Holder';
    default: return type;
  }
}

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Helper to group by key
function groupBy<T, K extends string | number | symbol>(array: T[], keyFn: (item: T) => K): Record<K, T[]> {
  return array.reduce((result, item) => {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
    return result;
  }, {} as Record<K, T[]>);
}

export default function Ratings() {
  const { data: ratings, isLoading: isLoadingRatings } = useListMyRatings();
  const { data: profile, isLoading: isLoadingProfile } = useGetMyUsherProfile();

  const isLoading = isLoadingRatings || isLoadingProfile;

  const renderStars = (value: number, size: string = 'w-4 h-4') => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => {
        if (value >= star) {
          return <Star key={star} className={`${size} text-accent fill-accent`} />;
        } else if (value >= star - 0.5) {
          return (
            <div key={star} className="relative">
              <Star className={`${size} text-muted fill-muted`} />
              <div className="absolute top-0 left-0 overflow-hidden w-[50%]">
                <Star className={`${size} text-accent fill-accent`} />
              </div>
            </div>
          );
        } else {
          return <Star key={star} className={`${size} text-muted fill-muted`} />;
        }
      })}
    </div>
  );

  const safeRatings: any[] = Array.isArray(ratings) ? ratings : [];
  
  // Group ratings by assignment ID (event)
  const groupedRatings = groupBy(safeRatings, r => r.eventAssignmentId);
  
  // Prepare an array of "Event Ratings" for the UI
  const eventRatings = Object.entries(groupedRatings).map(([assignmentIdStr, eventGroup]) => {
    const assignmentId = parseInt(assignmentIdStr, 10);
    // Grab event metadata from the first rating in the group
    const eventTitle = eventGroup[0]?.eventTitle;
    const eventStartTime = eventGroup[0]?.eventStartTime;
    
    // Average the rating values across all sources (System, Client, Admin)
    const totalScore = eventGroup.reduce((sum, r) => sum + (r.ratingValue || 0), 0);
    const avgScore = eventGroup.length > 0 ? totalScore / eventGroup.length : 0;
    
    return {
      assignmentId,
      eventTitle,
      eventStartTime,
      avgScore,
      breakdown: eventGroup
    };
  });
  
  // Sort events by start time descending (most recent first)
  eventRatings.sort((a, b) => {
    const timeA = a.eventStartTime ? new Date(a.eventStartTime).getTime() : 0;
    const timeB = b.eventStartTime ? new Date(b.eventStartTime).getTime() : 0;
    return timeB - timeA;
  });

  const avgRating = profile?.avgRating ?? null;

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="brand-display text-4xl text-foreground">My Ratings</h1>
      </div>

      {/* Summary card */}
      {!isLoading && avgRating !== null && (
        <div className="bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 rounded-3xl p-5 flex items-center gap-5 mb-5 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
            <Award className="w-7 h-7 text-accent" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Overall Score</p>
            <p className="text-3xl font-bold text-foreground leading-none">
              {avgRating !== null ? avgRating.toFixed(2) : '—'}
              <span className="text-sm font-normal text-muted-foreground ml-1">/ 5.00</span>
            </p>
            {renderStars(avgRating ?? 0, 'w-5 h-5')}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">{eventRatings.length}</p>
            <p className="text-xs text-muted-foreground">event{eventRatings.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      ) : eventRatings.length === 0 ? (
        <div className="bg-card/60 border border-dashed border-card-border rounded-3xl p-8 text-center mt-6">
          <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No ratings yet</p>
          <p className="text-xs text-muted-foreground mt-1">Complete events to get rated.</p>
        </div>
      ) : (
        <div className="space-y-3 pb-safe">
          <Accordion type="single" collapsible className="w-full space-y-3">
            {eventRatings.map((ev) => (
              <AccordionItem key={ev.assignmentId} value={`item-${ev.assignmentId}`} className="bg-card border border-card-border rounded-3xl shadow-sm overflow-hidden px-1">
                <AccordionTrigger className="hover:no-underline p-4 py-5 group data-[state=open]:pb-2">
                  <div className="flex flex-col w-full text-left gap-1 pr-2">
                    {/* Event info header */}
                    {ev.eventTitle && (
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-foreground line-clamp-1">{ev.eventTitle}</p>
                          {ev.eventStartTime && (
                            <p className="text-[10px] text-muted-foreground font-normal">
                              {format(new Date(ev.eventStartTime), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center w-full mt-1">
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Event Rating
                        </p>
                        {renderStars(ev.avgScore)}
                      </div>
                      <div className={`font-bold text-xl px-3 py-1 rounded-lg mr-2 ${
                        ev.avgScore >= 4 ? 'bg-green-500/10 text-green-600'
                          : ev.avgScore >= 3 ? 'bg-accent/20 text-accent-foreground'
                          : 'bg-red-500/10 text-red-600'
                        }`}>
                        {ev.avgScore.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                
                <AccordionContent className="px-4 pb-4 pt-1 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-3 mt-2 border-t border-border/60 pt-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Rating Breakdown</p>
                    {ev.breakdown.map((rating: any) => (
                      <div key={rating.id} className="bg-muted/30 p-3 rounded-xl border border-border/50">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs font-medium text-foreground">
                            {ratedByLabel(rating.ratedByType)}
                          </p>
                          <div className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                            rating.ratingValue >= 4 ? 'bg-green-500/10 text-green-600'
                            : rating.ratingValue >= 3 ? 'bg-accent/20 text-accent-foreground'
                            : 'bg-red-500/10 text-red-600'
                          }`}>
                            {rating.ratingValue.toFixed(1)} / 5.0
                          </div>
                        </div>
                        {rating.comment && (
                          <div className="flex gap-2 text-sm italic text-muted-foreground bg-background/50 p-2 rounded-lg">
                            <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-50" />
                            <p className="text-xs leading-relaxed">"{rating.comment}"</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  );
}
