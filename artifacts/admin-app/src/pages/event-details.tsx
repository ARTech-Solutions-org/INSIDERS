import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { 
  useGetEvent, 
  useGetSmartCandidates, 
  useAssignUsherToEvent,
  useRemoveAssignment,
  useUpdateEvent,
  getGetEventQueryKey,
  getListEventsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  MapPin, 
  Calendar, 
  Clock, 
  Users, 
  Star,
  CheckCircle,
  XCircle,
  UserPlus,
  UserMinus,
  Edit,
  Globe,
  Loader2,
  ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { LocationPicker } from "@/components/ui/location-picker";

export default function EventDetails() {
  const [, params] = useRoute("/events/:id");
  const eventId = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [ratingAssignment, setRatingAssignment] = useState<any>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const handleOpenRating = (assignment: any) => {
    setRatingAssignment(assignment);
    setRatingValue(5);
    setRatingComment("");
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingAssignment) return;
    setIsSubmittingRating(true);

    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("artech_admin_token")}`
        },
        body: JSON.stringify({
          eventAssignmentId: ratingAssignment.id,
          ratedByType: "admin",
          ratingValue,
          comment: ratingComment || undefined
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to submit rating");
      }

      toast({ title: "Usher rated successfully!" });
      setRatingAssignment(null);
      refetch();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Rating Failed",
        description: err.message || "Failed to submit rating",
      });
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const { data: event, isLoading: isEventLoading, refetch } = useGetEvent(
    eventId,
    { query: { enabled: !!eventId, queryKey: getGetEventQueryKey(eventId) as any } as any }
  );

  const { data: candidates, isLoading: isCandidatesLoading } = useGetSmartCandidates(
    eventId,
    undefined,
    { query: { enabled: !!eventId } as any }
  );

  const { mutate: assignUsher } = useAssignUsherToEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Usher assigned successfully!" });
        refetch();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error assigning usher", description: err.response?.data?.error || err.message });
      },
    },
  });

  const { mutate: removeUsher } = useRemoveAssignment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Usher removed successfully!" });
        refetch();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error removing usher", description: err.response?.data?.error || err.message });
      },
    },
  });

  const { mutate: updateEvent, isPending: isUpdating } = useUpdateEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Event updated successfully!" });
        queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) as any });
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() as any });
        setIsEditDialogOpen(false);
        refetch();
      },
      onError: (err: any) => {
        toast({ 
          variant: "destructive", 
          title: "Update Failed", 
          description: err.response?.data?.error || err.message || "Failed to update event" 
        });
      }
    }
  });

  // Edit form state
  const [formData, setFormData] = useState({
    title: "",
    eventLocName: "",
    venueLat: "",
    venueLng: "",
    checkinRadiusM: "100",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    dressCode: "",
    instructions: "",
    eventBudget: "",
  });

  useEffect(() => {
    if (event) {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      
      setFormData({
        title: event.title || "",
        eventLocName: event.eventLocName || "",
        venueLat: event.venueLat ? String(event.venueLat) : "",
        venueLng: event.venueLng ? String(event.venueLng) : "",
        checkinRadiusM: event.checkinRadiusM ? String(event.checkinRadiusM) : "100",
        startDate: format(start, "yyyy-MM-dd"),
        startTime: format(start, "HH:mm"),
        endDate: format(end, "yyyy-MM-dd"),
        endTime: format(end, "HH:mm"),
        dressCode: event.dressCode || "",
        instructions: event.instructions || "",
        eventBudget: event.eventBudget ? String(event.eventBudget) : "",
      });
    }
  }, [event]);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startDateTime = new Date(`${formData.startDate}T${formData.startTime || '00:00'}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime || '00:00'}`);

    updateEvent({
      id: eventId,
      data: {
        title: formData.title,
        eventLocName: formData.eventLocName,
        venueLat: formData.venueLat ? parseFloat(formData.venueLat) : undefined,
        venueLng: formData.venueLng ? parseFloat(formData.venueLng) : undefined,
        checkinRadiusM: formData.checkinRadiusM ? parseInt(formData.checkinRadiusM, 10) : 100,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        dressCode: formData.dressCode || undefined,
        instructions: formData.instructions || undefined,
        eventBudget: formData.eventBudget ? parseInt(formData.eventBudget, 10) : undefined,
      }
    });
  };

  const handlePublishToggle = () => {
    const newStatus = event?.status === "published" ? "draft" : "published";
    updateEvent({
      id: eventId,
      data: { status: newStatus as any }
    });
  };

  if (isEventLoading) {
    return <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
      <Loader2 className="w-5 h-5 animate-spin" /> Loading event details...
    </div>;
  }

  if (!event) {
    return <div className="p-8 text-center text-muted-foreground">Event not found.</div>;
  }

  const isCompleted = event.status === "completed" || new Date(event.endTime) < new Date();

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      {/* Top Header */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Link href="/events">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
            <Badge 
              variant="outline" 
              className={
                event.status === "published" 
                  ? "bg-green-500/10 text-green-600 border-green-200 capitalize" 
                  : "bg-amber-500/10 text-amber-600 border-amber-200 capitalize"
              }
            >
              {event.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground ml-11">
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {event.eventLocName}</span>
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {format(new Date(event.startTime), 'MMM d, yyyy')}</span>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex gap-2">
          {!isCompleted && (
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Edit className="w-4 h-4" /> Edit Event
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleEditSubmit}>
                <DialogHeader>
                  <DialogTitle>Edit Event</DialogTitle>
                  <DialogDescription>Update event parameters and details.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 gap-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input 
                      id="title" 
                      value={formData.title} 
                      onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                      required 
                    />
                  </div>

                  <LocationPicker
                    radiusMeters={formData.checkinRadiusM ? parseInt(formData.checkinRadiusM, 10) : 100}
                    value={{
                      address: formData.eventLocName,
                      lat: formData.venueLat ? parseFloat(formData.venueLat) : null,
                      lng: formData.venueLng ? parseFloat(formData.venueLng) : null,
                    }}
                    onChange={(loc) => {
                      setFormData((prev) => ({
                        ...prev,
                        eventLocName: loc.address,
                        venueLat: loc.lat !== null ? String(loc.lat) : "",
                        venueLng: loc.lng !== null ? String(loc.lng) : "",
                      }));
                    }}
                  />

                  {/* Geofence Range */}
                  <div className="p-3 border rounded-lg bg-muted/20 space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="checkinRadiusM" className="font-semibold text-xs flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        Arrival & Leave Geofence Range (Meters)
                      </Label>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {formData.checkinRadiusM || 100}m
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id="checkinRadiusM"
                        type="number"
                        min="20"
                        max="5000"
                        value={formData.checkinRadiusM}
                        onChange={(e) => setFormData((p) => ({ ...p, checkinRadiusM: e.target.value }))}
                        className="w-28 font-bold text-sm"
                      />
                      <span className="text-xs text-muted-foreground">meters max distance</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[50, 100, 150, 250, 500, 1000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, checkinRadiusM: String(preset) }))}
                          className={`text-[11px] px-2 py-0.5 rounded border font-medium ${
                            formData.checkinRadiusM === String(preset)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {preset}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate">Start Date *</Label>
                      <Input 
                        id="startDate" 
                        type="date" 
                        value={formData.startDate} 
                        onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))}
                        required 
                      />
                    </div>
                    <div>
                      <Label htmlFor="startTime">Start Time *</Label>
                      <Input 
                        id="startTime" 
                        type="time" 
                        value={formData.startTime} 
                        onChange={e => setFormData(p => ({ ...p, startTime: e.target.value }))}
                        required 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="endDate">End Date *</Label>
                      <Input 
                        id="endDate" 
                        type="date" 
                        value={formData.endDate} 
                        onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))}
                        required 
                      />
                    </div>
                    <div>
                      <Label htmlFor="endTime">End Time *</Label>
                      <Input 
                        id="endTime" 
                        type="time" 
                        value={formData.endTime} 
                        onChange={e => setFormData(p => ({ ...p, endTime: e.target.value }))}
                        required 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <Label htmlFor="eventBudget">Budget (EGP)</Label>
                    <Input 
                      id="eventBudget" 
                      type="number" 
                      value={formData.eventBudget} 
                      onChange={e => setFormData(p => ({ ...p, eventBudget: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <Label htmlFor="dressCode">Dress Code</Label>
                    <Input 
                      id="dressCode" 
                      value={formData.dressCode} 
                      onChange={e => setFormData(p => ({ ...p, dressCode: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <Label htmlFor="instructions">Instructions</Label>
                    <Textarea 
                      id="instructions" 
                      rows={3} 
                      value={formData.instructions} 
                      onChange={e => setFormData(p => ({ ...p, instructions: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          )}

          <Button 
            variant={event.status === "published" ? "outline" : "default"} 
            className="gap-2"
            disabled={isUpdating || isCompleted}
            onClick={handlePublishToggle}
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Globe className="w-4 h-4" />
            )}
            {event.status === "published" ? "Unpublish (Set Draft)" : "Publish Event"}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 flex-1 min-h-0 overflow-auto pb-6">
        {/* Left Col - Details */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule & Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Start Time</span>
                <span className="font-medium">{format(new Date(event.startTime), 'h:mm a')}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">End Time</span>
                <span className="font-medium">{format(new Date(event.endTime), 'h:mm a')}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Budget</span>
                <span className="font-medium">EGP {event.eventBudget?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Geofence Range</span>
                <span className="font-semibold text-primary">{event.checkinRadiusM || 100} meters</span>
              </div>
              <div className="pt-2">
                <h4 className="font-medium mb-1">Dress Code</h4>
                <p className="text-muted-foreground">{event.dressCode || "None specified"}</p>
              </div>
              <div className="pt-2">
                <h4 className="font-medium mb-1">Instructions</h4>
                <p className="text-muted-foreground whitespace-pre-wrap">{event.instructions || "None specified"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deduction Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {event.deductionRules?.map((rule: any) => (
                <div key={rule.id} className="flex justify-between items-center text-sm border p-2 rounded bg-muted/20">
                  <span>{rule.ruleType}</span>
                  <span className="text-destructive font-medium">- EGP {rule.amount}</span>
                </div>
              ))}
              {(!event.deductionRules || event.deductionRules.length === 0) && (
                <div className="text-sm text-muted-foreground">No rules defined.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Middle Col - Assigned Ushers */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Assigned Staff ({event.assignments?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <div className="divide-y">
              {event.assignments?.map((assignment: any) => (
                <div key={assignment.id} className="p-4 hover:bg-muted/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={assignment.usher?.profilePhotoUrl || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {assignment.usher?.fullName?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {assignment.usher?.fullName}
                          {assignment.isTeamLead && <Badge variant="secondary" className="text-[10px] h-4">Lead</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="flex items-center">
                            <Star className="w-3 h-3 text-secondary mr-1 fill-current" />
                            {assignment.usher?.avgRating?.toFixed(1) || 'N/A'}
                          </span>
                          <span className="capitalize text-[10px] bg-muted px-1.5 rounded-full">{assignment.status.replace('_', ' ')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 text-xs gap-1 text-amber-600 hover:bg-amber-50"
                        onClick={() => handleOpenRating(assignment)}
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        Rate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1 text-destructive hover:bg-destructive/10"
                        disabled={isCompleted}
                        onClick={() => {
                          if (confirm("Are you sure you want to unassign this usher?")) {
                            removeUsher({ id: eventId, assignmentId: assignment.id });
                          }
                        }}
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {(!event.assignments || event.assignments.length === 0) && (
                <div className="p-6 text-center text-sm text-muted-foreground">No ushers assigned yet.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Col - Smart Assignment */}
        <Card className="flex flex-col border-primary/20 bg-primary/5">
          <CardHeader className="pb-3 border-b border-primary/10">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Star className="w-5 h-5" />
              Smart Match
            </CardTitle>
            <CardDescription>Suggested ushers based on rating, skills, and availability.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0 pt-2">
            {isCandidatesLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading candidates...</div>
            ) : (
              <div className="divide-y divide-primary/10">
                {candidates?.map((candidate: any) => {
                  const isAssigned = event.assignments?.some((a: any) => a.usherId === candidate.id);
                  if (isAssigned) return null; // Don't show already assigned

                  return (
                    <div key={candidate.id} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8 border border-background">
                          <AvatarFallback className="text-xs">{candidate.fullName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium leading-none">{candidate.fullName}</p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center">
                             <Star className="w-3 h-3 text-secondary mr-1 fill-current" />
                             {candidate.avgRating?.toFixed(1)} match
                          </p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-7 text-xs"
                        disabled={isCompleted}
                        onClick={() => assignUsher({ id: eventId, data: { usherId: candidate.id, isTeamLead: false } })}
                      >
                        <UserPlus className="w-3 h-3 mr-1" />
                        Assign
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Rate Usher Dialog */}
      <Dialog open={!!ratingAssignment} onOpenChange={(open) => !open && setRatingAssignment(null)}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSubmitRating}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                Rate Usher: {ratingAssignment?.usher?.fullName}
              </DialogTitle>
              <DialogDescription>
                Provide a performance score and feedback for this assignment.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Star Selector */}
              <div className="space-y-2 text-center">
                <Label className="text-sm font-semibold">Rating Score</Label>
                <div className="flex justify-center items-center gap-2 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingValue(star)}
                      className="p-1.5 transition-transform hover:scale-125 focus:outline-none"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          star <= ratingValue
                            ? "text-amber-500 fill-amber-500"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground font-semibold">
                  {ratingValue === 5 && "⭐ Excellent - Exceeded Expectations"}
                  {ratingValue === 4 && "👍 Very Good - Professional & Reliable"}
                  {ratingValue === 3 && "👌 Good - Satisfactory"}
                  {ratingValue === 2 && "⚠️ Below Average - Needs Improvement"}
                  {ratingValue === 1 && "❌ Poor - Unacceptable Performance"}
                </p>
              </div>

              {/* Feedback Comment */}
              <div className="space-y-2">
                <Label htmlFor="comment">Feedback / Comments (Optional)</Label>
                <Textarea
                  id="comment"
                  rows={3}
                  placeholder="e.g. Arrived on time, led the team exceptionally well..."
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRatingAssignment(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingRating} className="bg-amber-600 hover:bg-amber-700 text-white">
                {isSubmittingRating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Submit Rating
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
