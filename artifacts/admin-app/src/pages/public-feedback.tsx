import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { 
  useGetPublicEventFeedback, 
  useSubmitPublicEventFeedback,
  getGetPublicEventFeedbackQueryKey,
  PublicFeedbackSubmitBody
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, ChevronRight, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

// Custom premium star
function CustomStar({ filled, className }: { filled: boolean, className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill={filled ? "url(#gold-gradient)" : "none"} 
      stroke={filled ? "none" : "currentColor"} 
      strokeWidth={filled ? "0" : "1"}
      className={className}
    >
      <defs>
        <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

function StarRating({ value, onChange, disabled, size = "md" }: { value: number; onChange: (v: number) => void; disabled?: boolean; size?: "sm" | "md" | "lg" }) {
  const [hover, setHover] = useState(0);
  
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-12 h-12 md:w-16 md:h-16"
  };

  return (
    <div className="flex gap-2 justify-center" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = (hover || value) >= star;
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onMouseEnter={() => setHover(star)}
            onClick={() => onChange(star)}
            className={cn(
              "p-1 transition-all duration-500 ease-out outline-none rounded-full",
              disabled ? "cursor-not-allowed opacity-50" : "hover:scale-110 active:scale-95",
              isFilled ? "text-primary drop-shadow-md" : "text-foreground/20 hover:text-foreground/40"
            )}
          >
            <CustomStar filled={isFilled} className={cn(sizeClasses[size], "transition-all duration-500")} />
          </button>
        );
      })}
    </div>
  );
}

export default function PublicFeedback() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";
  
  const [submitted, setSubmitted] = useState(false);
  const [generalRating, setGeneralRating] = useState<number>(0);
  const [generalComments, setGeneralComments] = useState<string>("");
  
  const [teamRatings, setTeamRatings] = useState<Record<number, { rating: number, comments: string }>>({});
  const [usherOverrides, setUsherOverrides] = useState<Record<number, { teamId: number, rating: number, comments: string }>>({});

  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { data: event, isLoading, error } = useGetPublicEventFeedback(token, {
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getGetPublicEventFeedbackQueryKey(token) as any
    }
  });

  const submitMutation = useSubmitPublicEventFeedback();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          <Loader2 className="w-8 h-8 animate-spin text-primary relative z-10" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-card backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-border text-center space-y-5">
          <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-serif text-foreground tracking-wide">Link Unavailable</h2>
          <p className="text-muted-foreground leading-relaxed text-sm">
            {/* @ts-expect-error - axios error format */}
            {error?.response?.data?.error || "This feedback link is invalid, expired, or has already been submitted."}
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 font-sans overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
        
        <div className="w-full max-w-md bg-card backdrop-blur-xl p-12 rounded-[2rem] shadow-2xl border border-border text-center animate-in fade-in zoom-in duration-1000 relative z-10">
          <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary text-foreground rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
            <Check className="w-10 h-10" strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-serif text-foreground tracking-wide mb-4">Exceptional.</h2>
          <p className="text-muted-foreground leading-relaxed">
            Your feedback for <strong className="text-foreground font-medium">{event.title}</strong> has been secured. We appreciate your insights in elevating our standards.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (generalRating === 0) {
      alert("Please provide an overall rating to continue.");
      return;
    }

    const payload: PublicFeedbackSubmitBody = {
      overallRating: generalRating,
      comment: generalComments.trim() || undefined,
      teamRatings: Object.entries(teamRatings).filter(([_, data]) => data.rating > 0).map(([teamId, data]) => ({
        teamId: Number(teamId),
        rating: data.rating,
        comments: data.comments.trim() || undefined,
      })),
      usherOverrides: Object.entries(usherOverrides).filter(([_, data]) => data.rating > 0).map(([usherId, data]) => ({
        usherId: Number(usherId),
        teamId: data.teamId,
        rating: data.rating,
        comments: data.comments.trim() || undefined,
      }))
    };

    submitMutation.mutate({ token, data: payload }, {
      onSuccess: () => setSubmitted(true),
      onError: (err: any) => alert(err.response?.data?.error || "Failed to submit feedback. Please try again.")
    });
  };

  const handleTeamRatingChange = (teamId: number, rating: number) => {
    setTeamRatings(prev => ({ ...prev, [teamId]: { ...prev[teamId], rating, comments: prev[teamId]?.comments || "" } }));
  };

  const handleTeamCommentsChange = (teamId: number, comments: string) => {
    setTeamRatings(prev => ({ ...prev, [teamId]: { ...prev[teamId], rating: prev[teamId]?.rating || 0, comments } }));
  };
  
  const handleUsherRatingChange = (usherId: number, teamId: number, rating: number) => {
    setUsherOverrides(prev => ({ ...prev, [usherId]: { ...prev[usherId], teamId, rating, comments: prev[usherId]?.comments || "" } }));
  };

  const handleUsherCommentsChange = (usherId: number, teamId: number, comments: string) => {
    setUsherOverrides(prev => ({ ...prev, [usherId]: { ...prev[usherId], teamId, rating: prev[usherId]?.rating || 0, comments } }));
  };

  const hasTeams = event.teams && event.teams.length > 0;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background text-foreground font-sans selection:bg-primary/30 relative pb-40">
      {/* Immersive Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-primary/10 to-transparent" />
        
        
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-20">
        
        {/* Header */}
        <header className="text-center mb-16">
          <div className={cn("transition-all duration-1000 ease-out transform", mounted ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card backdrop-blur-sm mb-6">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-foreground/80">Event Debrief</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif text-foreground tracking-tight leading-tight mb-4">
              {event.title}
            </h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto">
              Your feedback shapes our pursuit of excellence. Please share your experience.
            </p>
          </div>
        </header>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-12">
          
          {/* Step 1: Overall Rating */}
          <div className={cn("transition-all duration-1000 ease-out transform delay-200", mounted ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0")}>
            <div className="bg-card backdrop-blur-2xl rounded-[2rem] p-8 sm:p-14 border border-border shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              
              <h2 className="text-2xl md:text-3xl font-serif text-center text-foreground mb-10 tracking-wide">Overall Experience</h2>
              
              <div className="mb-12 relative z-10">
                <StarRating value={generalRating} onChange={setGeneralRating} size="lg" disabled={submitMutation.isPending} />
              </div>

              <div className="space-y-4 relative z-10">
                <label htmlFor="general-comments" className="text-xs font-medium tracking-widest uppercase text-muted-foreground pl-4">Executive Summary</label>
                <Textarea
                  id="general-comments"
                  placeholder="What details defined your experience?"
                  className="bg-muted border-border resize-none min-h-[140px] rounded-3xl focus-visible:ring-1 focus-visible:ring-primary/50 p-6 text-base placeholder:text-muted-foreground/50 text-foreground transition-all duration-300"
                  value={generalComments}
                  onChange={(e) => setGeneralComments(e.target.value)}
                  disabled={submitMutation.isPending}
                />
              </div>
            </div>
          </div>

          {/* Step 2: Teams & Ushers */}
          {hasTeams && generalRating > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 space-y-12 pt-8">
              <div className="text-center px-4 flex flex-col items-center">
                <div className="h-px w-24 bg-gradient-to-r from-transparent via-zinc-500 to-transparent mb-8" />
                <h2 className="text-2xl font-serif text-foreground tracking-wide">Team Performance</h2>
                <p className="text-muted-foreground text-sm mt-3 max-w-md mx-auto">Evaluate specific units or individuals who made an impact.</p>
              </div>

              {event.teams.map((team, index) => (
                <div key={team.id} className="bg-card backdrop-blur-xl rounded-[2rem] p-6 sm:p-10 border border-border shadow-xl space-y-8 animate-in fade-in slide-in-from-bottom-8" style={{ animationDelay: `${index * 150}ms`, animationFillMode: 'both' }}>
                  {/* Team Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pb-8 border-b border-border">
                    <div className="text-center sm:text-left">
                      <h3 className="text-xl font-medium text-foreground tracking-wide">{team.name}</h3>
                      <p className="text-muted-foreground text-xs tracking-widest uppercase mt-2">{team.ushers.length} {team.ushers.length === 1 ? 'MEMBER' : 'MEMBERS'}</p>
                    </div>
                    <div className="bg-muted border border-border rounded-full px-6 py-4 shadow-inner">
                      <StarRating 
                        value={teamRatings[team.id]?.rating || 0} 
                        onChange={(r) => handleTeamRatingChange(team.id, r)}
                        size="md"
                        disabled={submitMutation.isPending} 
                      />
                    </div>
                  </div>

                  {/* Team Comments */}
                  {teamRatings[team.id]?.rating > 0 && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-2">
                      <Textarea
                        placeholder={`Specific feedback for the ${team.name} team...`}
                        className="bg-muted border-border resize-none rounded-2xl focus-visible:ring-1 focus-visible:ring-primary/50 text-sm text-foreground placeholder:text-muted-foreground/50 p-5"
                        value={teamRatings[team.id]?.comments || ""}
                        onChange={(e) => handleTeamCommentsChange(team.id, e.target.value)}
                        disabled={submitMutation.isPending}
                      />
                    </div>
                  )}

                  {/* Individual Ushers Grid */}
                  {team.ushers.length > 0 && (
                    <div className="pt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-6 px-2 flex items-center gap-4">
                        <span>Individuals</span>
                        <span className="h-px flex-1 bg-card" />
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {team.ushers.map((usher) => (
                          <div key={usher.id} className="group bg-muted hover:bg-muted/50 rounded-2xl p-5 transition-all duration-300 border border-transparent hover:border-border">
                              <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                  {(usher as any).photoUrl ? (
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <img src={(usher as any).photoUrl} alt={usher.name} className="w-10 h-10 rounded-full object-cover border border-border cursor-pointer hover:opacity-80 transition-opacity" />
                                      </DialogTrigger>
                                      <DialogContent className="sm:max-w-md p-1 bg-transparent border-none shadow-none flex justify-center overflow-hidden">
                                        <img src={(usher as any).photoUrl} alt={usher.name} className="max-w-[90vw] max-h-[80vh] object-contain rounded-xl shadow-2xl ring-1 ring-white/10" />
                                      </DialogContent>
                                    </Dialog>
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-muted border border-border flex-shrink-0 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:border-primary/30 transition-colors">
                                      <User className="w-4 h-4" />
                                    </div>
                                  )}
                                  <span className="font-medium text-foreground/80 text-sm group-hover:text-foreground transition-colors break-words flex-1" title={usher.name}>{usher.name}</span>
                                </div>
                              <div className="flex justify-start pl-[52px]">
                                <StarRating 
                                  value={usherOverrides[usher.id]?.rating || 0} 
                                  onChange={(r) => handleUsherRatingChange(usher.id, team.id, r)}
                                  size="sm"
                                  disabled={submitMutation.isPending} 
                                />
                              </div>
                            </div>
                            {usherOverrides[usher.id]?.rating > 0 && (
                              <div className="mt-4 animate-in fade-in duration-500">
                                <Textarea
                                  placeholder={`Note for ${usher.name}...`}
                                  className="bg-input border-border resize-none min-h-[80px] rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/50 p-4"
                                  value={usherOverrides[usher.id]?.comments || ""}
                                  onChange={(e) => handleUsherCommentsChange(usher.id, team.id, e.target.value)}
                                  disabled={submitMutation.isPending}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* Action Bar */}
      <div className={cn(
        "mt-16 flex justify-center transition-all duration-700",
        generalRating > 0 ? "opacity-100" : "opacity-0 pointer-events-none hidden"
      )}>
        <Button 
          onClick={() => handleSubmit()}
          size="lg" 
          className="w-full max-w-md rounded-full h-16 text-base font-medium shadow-md bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground transition-all duration-300 active:scale-[0.98] border border-primary/20"
          disabled={submitMutation.isPending || generalRating === 0}
        >
          {submitMutation.isPending ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <span className="flex items-center tracking-wide">
              Submit Feedback
              <ChevronRight className="w-5 h-5 ml-2 opacity-80" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
