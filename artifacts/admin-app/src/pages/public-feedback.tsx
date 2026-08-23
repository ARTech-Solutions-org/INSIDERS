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
import { Loader2, CheckCircle2, ChevronRight, User } from "lucide-react";
import { cn } from "@/lib/utils";

// Custom Star Icon for a unique look
function CustomStar({ filled, className }: { filled: boolean, className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill={filled ? "currentColor" : "none"} 
      stroke="currentColor" 
      strokeWidth={filled ? "0" : "1.5"}
      className={className}
    >
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
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onMouseEnter={() => setHover(star)}
          onClick={() => onChange(star)}
          className={cn(
            "p-1 transition-all duration-300 ease-out outline-none rounded-full",
            disabled ? "cursor-not-allowed opacity-50" : "hover:scale-110 active:scale-95",
            (hover || value) >= star ? "text-amber-400" : "text-zinc-300"
          )}
        >
          <CustomStar filled={(hover || value) >= star} className={cn(sizeClasses[size], "transition-all duration-300")} />
        </button>
      ))}
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
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-sm border border-zinc-100 text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">Link Unavailable</h2>
          <p className="text-zinc-500 leading-relaxed">
            {/* @ts-expect-error - axios error format */}
            {error?.response?.data?.error || "This feedback link is invalid, expired, or has already been submitted."}
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-sm border border-zinc-100 text-center animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-semibold text-zinc-900 tracking-tight mb-3">Thank You</h2>
          <p className="text-zinc-500 leading-relaxed">
            Your feedback for <strong className="text-zinc-800 font-medium">{event.title}</strong> has been successfully submitted. We appreciate your time and insights.
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
    <div className="min-h-screen bg-[#FDFCFB] font-sans selection:bg-zinc-200">
      {/* Header Banner */}
      <header className="pt-16 pb-12 px-6 text-center max-w-2xl mx-auto">
        <div className={cn("transition-all duration-1000 ease-out transform", mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
          <p className="text-zinc-500 font-medium tracking-widest uppercase text-xs mb-4">Event Feedback</p>
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 tracking-tight leading-tight">
            {event.title}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pb-32">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-12">
          
          {/* Step 1: Overall Rating */}
          <div className={cn("transition-all duration-700 ease-out transform", mounted ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0", "delay-100")}>
            <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-100/80">
              <h2 className="text-2xl font-medium text-center text-zinc-800 mb-8">How was your overall experience?</h2>
              
              <div className="mb-10">
                <StarRating value={generalRating} onChange={setGeneralRating} size="lg" disabled={submitMutation.isPending} />
              </div>

              <div className="space-y-3">
                <label htmlFor="general-comments" className="text-sm font-medium text-zinc-500 pl-2">Any additional thoughts?</label>
                <Textarea
                  id="general-comments"
                  placeholder="What stood out to you?"
                  className="bg-zinc-50/50 border-zinc-200 resize-none min-h-[120px] rounded-2xl focus-visible:ring-zinc-400 p-4 text-base placeholder:text-zinc-400"
                  value={generalComments}
                  onChange={(e) => setGeneralComments(e.target.value)}
                  disabled={submitMutation.isPending}
                />
              </div>
            </div>
          </div>

          {/* Step 2: Teams & Ushers */}
          {hasTeams && generalRating > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-10">
              <div className="text-center px-4">
                <h2 className="text-xl font-medium text-zinc-800">Team Performance</h2>
                <p className="text-zinc-500 text-sm mt-2">Rate specific teams or individuals if they made an impact.</p>
              </div>

              {event.teams.map((team) => (
                <div key={team.id} className="bg-white rounded-3xl p-6 sm:p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-zinc-100/80 space-y-8">
                  {/* Team Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pb-6 border-b border-zinc-100">
                    <div className="text-center sm:text-left">
                      <h3 className="text-lg font-semibold text-zinc-900">{team.name} Team</h3>
                      <p className="text-zinc-500 text-sm mt-1">{team.ushers.length} {team.ushers.length === 1 ? 'member' : 'members'}</p>
                    </div>
                    <div className="bg-zinc-50 rounded-full px-6 py-3">
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
                    <div className="animate-in fade-in duration-300 space-y-2">
                      <Textarea
                        placeholder={`Specific feedback for the ${team.name} team...`}
                        className="bg-zinc-50/50 border-zinc-200 resize-none rounded-2xl focus-visible:ring-zinc-400 text-sm"
                        value={teamRatings[team.id]?.comments || ""}
                        onChange={(e) => handleTeamCommentsChange(team.id, e.target.value)}
                        disabled={submitMutation.isPending}
                      />
                    </div>
                  )}

                  {/* Individual Ushers Grid */}
                  {team.ushers.length > 0 && (
                    <div className="pt-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4 px-2">Individuals</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {team.ushers.map((usher) => (
                          <div key={usher.id} className="group bg-zinc-50/50 hover:bg-zinc-50 rounded-2xl p-4 transition-colors border border-transparent hover:border-zinc-200">
                            <div className="flex justify-between items-center gap-3">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-8 h-8 rounded-full bg-zinc-200 flex-shrink-0 flex items-center justify-center text-zinc-500">
                                  <User className="w-4 h-4" />
                                </div>
                                <span className="font-medium text-zinc-700 text-sm truncate" title={usher.name}>{usher.name}</span>
                              </div>
                              <StarRating 
                                value={usherOverrides[usher.id]?.rating || 0} 
                                onChange={(r) => handleUsherRatingChange(usher.id, team.id, r)}
                                size="sm"
                                disabled={submitMutation.isPending} 
                              />
                            </div>
                            {usherOverrides[usher.id]?.rating > 0 && (
                              <div className="mt-3 animate-in fade-in duration-300">
                                <Textarea
                                  placeholder={`Note for ${usher.name}...`}
                                  className="bg-white border-zinc-200 resize-none min-h-[60px] rounded-xl text-sm"
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
      </main>

      {/* Floating Action Bar */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-[#FDFCFB] via-[#FDFCFB]/90 to-transparent flex justify-center pointer-events-none transition-all duration-500",
        generalRating > 0 ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
      )}>
        <Button 
          onClick={() => handleSubmit()}
          size="lg" 
          className="w-full max-w-sm rounded-full h-14 text-base font-medium shadow-xl pointer-events-auto bg-zinc-900 hover:bg-zinc-800 text-white transition-all active:scale-[0.98]"
          disabled={submitMutation.isPending || generalRating === 0}
        >
          {submitMutation.isPending ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <span className="flex items-center">
              Submit Feedback
              <ChevronRight className="w-5 h-5 ml-1 opacity-70" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
