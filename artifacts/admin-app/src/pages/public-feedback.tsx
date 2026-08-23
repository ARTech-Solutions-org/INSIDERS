import { useParams } from "wouter";
import { useState } from "react";
import { 
  useGetPublicEventFeedback, 
  useSubmitPublicEventFeedback,
  getGetPublicEventFeedbackQueryKey,
  PublicFeedbackSubmitBody
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Star, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Reusable star rating component
function StarRating({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={cn(
            "p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm transition-colors",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <Star
            className={cn(
              "w-8 h-8",
              star <= value ? "fill-primary text-primary" : "text-muted-foreground hover:text-primary/50"
            )}
          />
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
  
  // Team Ratings: map of teamId -> { rating, comments }
  const [teamRatings, setTeamRatings] = useState<Record<number, { rating: number, comments: string }>>({});
  
  // Usher Overrides: map of usherId -> { teamId, rating, comments }
  const [usherOverrides, setUsherOverrides] = useState<Record<number, { teamId: number, rating: number, comments: string }>>({});

  const { data: event, isLoading, error } = useGetPublicEventFeedback(token, {
    query: {
      enabled: !!token,
      retry: false, // Don't retry if token is invalid or revoked
      queryKey: getGetPublicEventFeedbackQueryKey(token) as any
    }
  });

  const submitMutation = useSubmitPublicEventFeedback();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If the link is invalid, revoked, or already submitted, the API will return 404/403
  if (error || !event) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive text-center">Unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            {/* @ts-expect-error - axios error format */}
            {error?.response?.data?.error || "This feedback link is invalid, expired, or has already been submitted."}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-primary text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-16 h-16 text-primary" />
            </div>
            <CardTitle>Thank You!</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Your feedback for <strong>{event.title}</strong> has been successfully submitted. We appreciate your time.
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (generalRating === 0) {
      alert("Please provide a general rating for the event.");
      return;
    }

    const payload: PublicFeedbackSubmitBody = {
      generalRating,
      generalComments: generalComments.trim() || undefined,
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
      onSuccess: () => {
        setSubmitted(true);
      },
      onError: (err: any) => {
        alert(err.response?.data?.error || "Failed to submit feedback. Please try again.");
      }
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

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Event Feedback</h1>
          <p className="text-muted-foreground text-lg">We'd love to hear about your experience at {event.title}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Event Feedback */}
          <Card className="border-primary/20 shadow-md">
            <CardHeader className="bg-primary/5 pb-4 border-b">
              <CardTitle>General Experience</CardTitle>
              <CardDescription>How was the overall event?</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-3">
                <Label className="text-base">Overall Rating <span className="text-destructive">*</span></Label>
                <StarRating value={generalRating} onChange={setGeneralRating} disabled={submitMutation.isPending} />
              </div>
              <div className="space-y-3">
                <Label htmlFor="general-comments" className="text-base">Additional Comments</Label>
                <Textarea
                  id="general-comments"
                  placeholder="Tell us what went well or what could be improved..."
                  rows={4}
                  value={generalComments}
                  onChange={(e) => setGeneralComments(e.target.value)}
                  disabled={submitMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>

          {/* Team Feedback */}
          {event.teams && event.teams.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight mt-8">Team Feedback (Optional)</h2>
              <p className="text-muted-foreground text-sm">Rate specific teams or individual ushers if they stood out.</p>
              
              <div className="space-y-6">
                {event.teams.map((team) => (
                  <Card key={team.id} className="overflow-hidden">
                    <CardHeader className="bg-muted/50 pb-4 border-b">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <CardTitle className="text-lg">{team.name} Team</CardTitle>
                          <CardDescription>{team.ushers.length} ushers</CardDescription>
                        </div>
                        <StarRating 
                          value={teamRatings[team.id]?.rating || 0} 
                          onChange={(r) => handleTeamRatingChange(team.id, r)}
                          disabled={submitMutation.isPending} 
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      {teamRatings[team.id]?.rating > 0 && (
                        <div className="space-y-2 pb-4 border-b">
                          <Label htmlFor={`team-comments-${team.id}`}>Comments for {team.name} Team</Label>
                          <Textarea
                            id={`team-comments-${team.id}`}
                            placeholder={`Feedback for the entire ${team.name} team...`}
                            rows={2}
                            value={teamRatings[team.id]?.comments || ""}
                            onChange={(e) => handleTeamCommentsChange(team.id, e.target.value)}
                            disabled={submitMutation.isPending}
                          />
                        </div>
                      )}

                      <div className="space-y-4">
                        <Label className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Individual Ushers</Label>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {team.ushers.map((usher) => (
                            <div key={usher.id} className="border rounded-md p-3 space-y-3 bg-background">
                              <div className="flex justify-between items-center gap-2">
                                <span className="font-medium text-sm truncate" title={usher.name}>{usher.name}</span>
                                <StarRating 
                                  value={usherOverrides[usher.id]?.rating || 0} 
                                  onChange={(r) => handleUsherRatingChange(usher.id, team.id, r)}
                                  disabled={submitMutation.isPending} 
                                />
                              </div>
                              {usherOverrides[usher.id]?.rating > 0 && (
                                <Textarea
                                  placeholder={`Comments for ${usher.name}...`}
                                  rows={1}
                                  className="h-auto resize-none min-h-[40px] text-sm"
                                  value={usherOverrides[usher.id]?.comments || ""}
                                  onChange={(e) => handleUsherCommentsChange(usher.id, team.id, e.target.value)}
                                  disabled={submitMutation.isPending}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="pt-6 sticky bottom-6 z-10 flex justify-end">
            <Button 
              type="submit" 
              size="lg" 
              className="w-full sm:w-auto shadow-lg"
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Feedback
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
