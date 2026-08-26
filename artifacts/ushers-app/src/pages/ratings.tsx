import React from 'react';
import { useListMyRatings, useGetMyUsherProfile } from '@workspace/api-client-react';
import { Star, MessageSquare, Calendar, Award } from 'lucide-react';
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

export default function Ratings() {
  const { data: ratings, isLoading: isLoadingRatings } = useListMyRatings();
  const { data: profile, isLoading: isLoadingProfile } = useGetMyUsherProfile();

  const isLoading = isLoadingRatings || isLoadingProfile;

  const renderStars = (value: number, size: string = 'w-4 h-4') => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={`${size} ${star <= value ? 'text-accent fill-accent' : 'text-muted fill-muted'}`}
        />
      ))}
    </div>
  );

  const safeRatings: any[] = Array.isArray(ratings) ? ratings : [];

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
            {renderStars(Math.round(avgRating ?? 0), 'w-5 h-5')}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">{safeRatings.length}</p>
            <p className="text-xs text-muted-foreground">rating{safeRatings.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      ) : safeRatings.length === 0 ? (
        <div className="bg-card/60 border border-dashed border-card-border rounded-3xl p-8 text-center mt-6">
          <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No ratings yet</p>
          <p className="text-xs text-muted-foreground mt-1">Complete events to get rated.</p>
        </div>
      ) : (
        <div className="space-y-3 pb-safe">
          {safeRatings.map((rating: any) => (
            <div key={rating.id} className="bg-card border border-card-border p-4 rounded-3xl shadow-sm">
              {/* Event info header */}
              {rating.eventTitle && (
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/60">
                  <Calendar className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground line-clamp-1">{rating.eventTitle}</p>
                    {rating.eventStartTime && (
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(rating.eventStartTime), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    {ratedByLabel(rating.ratedByType)}
                  </p>
                  {renderStars(rating.ratingValue)}
                </div>
                <div className={`font-bold text-xl px-3 py-1 rounded-lg ${rating.ratingValue >= 4 ? 'bg-green-500/10 text-green-600'
                    : rating.ratingValue >= 3 ? 'bg-accent/20 text-accent-foreground'
                      : 'bg-red-500/10 text-red-600'
                  }`}>
                  {rating.ratingValue?.toFixed(1) || '0.0'}
                </div>
              </div>

              {rating.comment && (
                <div className="mt-3 bg-muted/50 p-3 rounded-xl flex gap-3 text-sm italic text-muted-foreground">
                  <MessageSquare className="w-4 h-4 shrink-0 mt-0.5 opacity-50" />
                  <p>"{rating.comment}"</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
