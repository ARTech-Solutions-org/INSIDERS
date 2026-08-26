import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { 
  useGetEvent, 
  useGetSmartCandidates, 
  useAssignUsherToEvent,
  useRemoveAssignment,
  useUpdateEvent,
  useListEventTeams,
  useCreateEventTeam,
  useDeleteEventTeam,
  useGetTeamLeaderSuggestions,
  useUpdateAssignment,
  useSmartAssignBatch,
  getGetEventQueryKey,
  getListEventsQueryKey,
  getGetTeamLeaderSuggestionsQueryKey,
  useListWaitlist,
  useAddToWaitlist,
  useRemoveFromWaitlist,
  usePromoteWaitlist,
  getListEventAssignmentsQueryKey,
  getListWaitlistQueryKey,
  useGetEventFeedbackLink,
  useCreateEventFeedbackLink,
  getGetEventFeedbackLinkQueryKey,
  useAdminCheckout
} from "@workspace/api-client-react";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowLeft,
  Shield,
  Crown,
  Trash2,
  UserCog,
  X,
  Link as LinkIcon,
  Copy,
  RefreshCw,
  MessageSquare,
  LogOut
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { LocationPicker } from "@/components/ui/location-picker";

function AssignmentPayInput({ assignment, updateAssignment, eventId }: { assignment: any, updateAssignment: any, eventId: number }) {
  const [val, setVal] = useState(assignment.overriddenPay ?? "");

  // Sync with external updates
  useEffect(() => {
    setVal(assignment.overriddenPay ?? "");
  }, [assignment.overriddenPay]);

  const handleBlur = () => {
    const newVal = val === "" ? null : parseInt(val as string, 10);
    if (!isNaN(newVal as any) && newVal !== (assignment.overriddenPay ?? null)) {
      updateAssignment({ 
        id: eventId, 
        assignmentId: assignment.id, 
        data: { 
          usherId: assignment.usherId,
          overriddenPay: newVal 
        } 
      });
    }
  };

  return (
    <Input
      type="number"
      className="h-6 w-16 text-xs px-1.5 py-0 bg-muted/20"
      placeholder="Pay"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

const getImageUrl = (key?: string | null) => {
  if (!key) return undefined;
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '';
  return `${baseUrl}/api/uploads/read?key=${encodeURIComponent(key)}`;
};

export default function EventDetails() {
  const [, params] = useRoute("/events/:id");
  const eventId = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const isSuperAdmin = user?.role === "super_admin";

  const { data: event, isLoading: isEventLoading, refetch } = useGetEvent(
    eventId,
    { query: { enabled: !!eventId, queryKey: getGetEventQueryKey(eventId) as any } as any }
  );

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [ratingAssignment, setRatingAssignment] = useState<any>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");

  const isFieldLocked = (fieldName: string) => {
    if (isSuperAdmin) return false;
    return event?.superAdminLockedFields?.includes(fieldName) ?? false;
  };
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // ─── FEEDBACK LINK ───────────────────────────────────────────────────────
  const { data: feedbackLink, isLoading: isFeedbackLinkLoading } = useGetEventFeedbackLink(
    eventId,
    { query: { enabled: !!eventId, retry: false, queryKey: getGetEventFeedbackLinkQueryKey(eventId) as any } as any }
  );
  
  const createFeedbackLinkMutation = useCreateEventFeedbackLink({
    mutation: {
      onSuccess: () => {
        toast({ title: "Feedback link generated successfully." });
        queryClient.invalidateQueries({ queryKey: getGetEventFeedbackLinkQueryKey(eventId) as any });
      },
      onError: (err: any) => {
        toast({ title: "Failed to generate link.", description: err.response?.data?.error || err.message, variant: "destructive" });
      }
    }
  });

  const handleCopyFeedbackLink = () => {
    if (!feedbackLink) return;
    const url = `${window.location.origin}/feedback/${feedbackLink.token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied to clipboard." });
  };

  // ─── WAITLIST ────────────────────────────────────────────────────────────
  const { data: waitlist } = useListWaitlist(eventId, {
    query: {
      enabled: !!eventId,
    } as any
  });

  
  const totalSpent = (event?.assignments || []).reduce((acc: number, a: any) => {
    if (!['assigned', 'accepted', 'checked_in', 'completed'].includes(a.status)) return acc;
    const baseRate = a.role === 'leader' || a.isTeamLead ? (event?.leaderRate || 0) : (event?.regularRate || 0);
    const pay = a.overriddenPay != null ? Number(a.overriddenPay) : baseRate;
    return acc + pay;
  }, 0);
  
  const isBudgetExceeded = event?.budget && totalSpent > event.budget;

  const { mutate: addToWaitlist, isPending: isAddingToWaitlist } = useAddToWaitlist({
    mutation: {
      onSuccess: () => {
        toast({ title: "Waitlisted", description: "Usher added to waitlist." });
        queryClient.invalidateQueries({ queryKey: getListWaitlistQueryKey(eventId) as any });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    }
  });

  const { mutate: removeFromWaitlist } = useRemoveFromWaitlist({
    mutation: {
      onSuccess: () => {
        toast({ title: "Removed", description: "Usher removed from waitlist." });
        queryClient.invalidateQueries({ queryKey: getListWaitlistQueryKey(eventId) as any });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    }
  });

  const { mutate: promoteWaitlist } = usePromoteWaitlist({
    mutation: {
      onSuccess: () => {
        toast({ title: "Promoted", description: "Usher promoted to assigned." });
        queryClient.invalidateQueries({ queryKey: getListWaitlistQueryKey(eventId) as any });
        queryClient.invalidateQueries({ queryKey: getListEventAssignmentsQueryKey(eventId) as any });
        refetch();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    }
  });

  const { mutate: adminCheckout, isPending: isAdminCheckingOut } = useAdminCheckout({
    mutation: {
      onSuccess: () => {
        toast({ title: "Checked out successfully." });
        queryClient.invalidateQueries({ queryKey: getListEventAssignmentsQueryKey(eventId) as any });
        refetch();
      },
      onError: (err: any) => {
        toast({ title: "Failed to checkout.", description: err.response?.data?.error || err.message, variant: "destructive" });
      }
    }
  });

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
        let errorData: any = {};
        try {
          errorData = await res.json();
        } catch (e) {
          errorData = { error: `Server returned status ${res.status}` };
        }
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



  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamInstructions, setNewTeamInstructions] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const { data: teams, refetch: refetchTeams } = useListEventTeams(eventId, { query: { enabled: !!eventId } as any });
  
  const { mutate: createTeam, isPending: isCreatingTeam } = useCreateEventTeam({
    mutation: {
      onSuccess: () => {
        toast({ title: "Team created!" });
        setNewTeamName("");
        setNewTeamInstructions("");
        refetchTeams();
      }
    }
  });

  const { mutate: deleteTeam } = useDeleteEventTeam({
    mutation: {
      onSuccess: () => {
        toast({ title: "Team deleted!" });
        if (selectedTeamId !== null) setSelectedTeamId(null);
        refetchTeams();
        refetch(); // to refresh assignments
      }
    }
  });

  const { data: leaderSuggestions } = useGetTeamLeaderSuggestions(eventId, selectedTeamId || 0, {
    query: { enabled: !!eventId && !!selectedTeamId } as any
  });

  const { mutate: updateAssignment } = useUpdateAssignment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Assignment updated!" });
        refetch();
        if (selectedTeamId) {
          queryClient.invalidateQueries({ queryKey: getGetTeamLeaderSuggestionsQueryKey(eventId, selectedTeamId) as any });
        }
      }
    }
  });

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

  const [isAutoAssignOpen, setIsAutoAssignOpen] = useState(false);
  const [autoAssignFilters, setAutoAssignFilters] = useState<any>({
    count: 5,
    gender: "",
    minRating: 0,
    minCompletedEvents: 0,
    requiresLeadershipExp: false,
    maxDistanceMeters: 0,
  });

  const { mutate: autoAssign, isPending: isAutoAssigning } = useSmartAssignBatch({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) as any });
        setIsAutoAssignOpen(false);
      }
    }
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
    budget: "",
    leaderRate: "",
    regularRate: "",
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
        budget: event.budget ? String(event.budget) : "",
          leaderRate: event.leaderRate ? String(event.leaderRate) : "",
          regularRate: event.regularRate ? String(event.regularRate) : "",
      });
    }
  }, [event]);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startDateTime = new Date(`${formData.startDate}T${formData.startTime || '00:00'}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime || '00:00'}`);

    if (endDateTime <= startDateTime) {
      toast({
        variant: "destructive",
        title: "Invalid Schedule",
        description: "Event end time must be after the start time.",
      });
      return;
    }

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
        budget: isSuperAdmin && formData.budget ? parseFloat(formData.budget) : undefined,
          leaderRate: formData.leaderRate ? parseFloat(formData.leaderRate) : undefined,
          regularRate: formData.regularRate ? parseFloat(formData.regularRate) : undefined,
        version: event?.version
      }
    });
  };

  const handlePublishToggle = () => {
    if (user?.role !== "super_admin") {
      toast({ title: "Forbidden", description: "Only Super Admins can publish events.", variant: "destructive" });
      return;
    }
    const newStatus = event?.status === "published" ? "draft" : "published";
    updateEvent({
      id: eventId,
      data: { status: newStatus as any, version: event?.version }
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
  const hasStarted = isCompleted || new Date(event.startTime) <= new Date();

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
                isCompleted 
                  ? "bg-slate-500/10 text-slate-600 border-slate-200 capitalize"
                  : event.status === "published" 
                    ? "bg-green-500/10 text-green-600 border-green-200 capitalize" 
                    : "bg-amber-500/10 text-amber-600 border-amber-200 capitalize"
              }
            >
              {isCompleted ? "completed" : event.status}
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

                  
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="leaderRate">Leader Pay Rate (EGP)</Label>
                        <Input 
                          id="leaderRate" 
                          type="number" 
                          value={formData.leaderRate} 
                          onChange={e => setFormData(p => ({ ...p, leaderRate: e.target.value }))}
                          disabled={isFieldLocked('leaderRate')}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="regularRate">Regular Pay Rate (EGP)</Label>
                        <Input 
                          id="regularRate" 
                          type="number" 
                          value={formData.regularRate} 
                          onChange={e => setFormData(p => ({ ...p, regularRate: e.target.value }))}
                          disabled={isFieldLocked('regularRate')}
                        />
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <div className="grid grid-cols-1 gap-2">
                        <Label htmlFor="budget">Total Event Budget (EGP)</Label>
                        <Input 
                          id="budget" 
                          type="number" 
                          value={formData.budget} 
                          onChange={e => setFormData(p => ({ ...p, budget: e.target.value }))}
                        />
                      </div>
                    )}
  

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
            disabled={isUpdating || isCompleted || user?.role !== "super_admin"}
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

      <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0 pb-6 mt-4">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 space-x-6">
          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3">Overview</TabsTrigger>
          <TabsTrigger value="staffing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3">Staff & Teams</TabsTrigger>
          <TabsTrigger value="waitlist" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3">Waitlist</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 min-h-0 flex-1 overflow-auto">
          {/* Details */}
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
                    <span className="font-medium">EGP {event.budget?.toLocaleString() || "Not set"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Leader Pay Rate</span>
                    <span className="font-medium">EGP {event.leaderRate?.toLocaleString() || "Not set"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Regular Pay Rate</span>
                    <span className="font-medium">EGP {event.regularRate?.toLocaleString() || "Not set"}</span>
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Rate Event Link
                </CardTitle>
                <CardDescription>
                  Share this public link with the client so they can rate the event and its teams.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isFeedbackLinkLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : feedbackLink ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input 
                        readOnly 
                        value={`${window.location.origin}/feedback/${feedbackLink.token}`} 
                        className="font-mono text-sm"
                      />
                      <Button variant="outline" size="icon" onClick={handleCopyFeedbackLink} title="Copy Link">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Status:</span>
                      {feedbackLink.submittedAt ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle className="w-3 h-3 mr-1" /> Submitted
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600 dark:text-yellow-500 dark:border-yellow-500">
                          Waiting for submission
                        </Badge>
                      )}
                    </div>
                    {(!isFieldLocked("budget") || isSuperAdmin) && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="w-full mt-2" 
                        onClick={() => createFeedbackLinkMutation.mutate({ id: eventId })}
                        disabled={createFeedbackLinkMutation.isPending}
                      >
                        {createFeedbackLinkMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Regenerate Link
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-sm text-muted-foreground">No feedback link generated yet.</p>
                    <Button 
                      onClick={() => createFeedbackLinkMutation.mutate({ id: eventId })}
                      disabled={createFeedbackLinkMutation.isPending || (isFieldLocked("budget") && !isSuperAdmin)}
                      className="w-full"
                    >
                      {createFeedbackLinkMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LinkIcon className="w-4 h-4 mr-2" />}
                      Generate Link
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Details Column 2 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Attendance Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const totalAssigned = event.assignments?.length || 0;
                  const checkedInCount = event.assignments?.filter((a: any) => ["checked_in", "completed"].includes(a.status)).length || 0;
                  const pendingCount = event.assignments?.filter((a: any) => ["assigned", "accepted"].includes(a.status)).length || 0;
                  const canceledCount = event.assignments?.filter((a: any) => a.status === "cancelled").length || 0;
                  const lateCount = event.assignments?.filter((a: any) => a.lateArrivalMinutes > 0).length || 0;

                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold">{totalAssigned}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Total Assigned</div>
                      </div>
                      <div className="bg-primary/10 text-primary rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold">{checkedInCount}</div>
                        <div className="text-xs uppercase tracking-wider mt-1">Checked In</div>
                      </div>
                      <div className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold">{pendingCount}</div>
                        <div className="text-xs uppercase tracking-wider mt-1">Pending</div>
                      </div>
                      <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold">{lateCount}</div>
                        <div className="text-xs uppercase tracking-wider mt-1">Late / No-Show</div>
                      </div>
                      {canceledCount > 0 && (
                        <div className="bg-muted rounded-lg p-4 text-center col-span-2">
                          <div className="text-xl font-bold text-muted-foreground">{canceledCount}</div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Canceled</div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="staffing" className="grid md:grid-cols-3 gap-6 mt-6 min-h-0 flex-1 overflow-auto">
          {/* Teams Col */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3 border-b border-primary/10">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Teams
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-4 space-y-4">
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input 
                    placeholder="New Team Name" 
                    value={newTeamName} 
                    onChange={e => setNewTeamName(e.target.value)} 
                  />
                  <Button 
                    disabled={!newTeamName.trim() || isCreatingTeam} 
                    onClick={() => createTeam({ id: eventId, data: { name: newTeamName, instructions: newTeamInstructions || undefined } })}
                  >
                    Add
                  </Button>
                </div>
                <Textarea 
                  placeholder="Team Instructions (Optional)" 
                  value={newTeamInstructions} 
                  onChange={e => setNewTeamInstructions(e.target.value)} 
                  className="text-sm min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <div 
                  className={`p-3 rounded border cursor-pointer transition-colors ${selectedTeamId === null ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                  onClick={() => setSelectedTeamId(null)}
                >
                  <div className="font-medium text-sm">All Staff (Unassigned)</div>
                </div>
                {teams?.map((team: any) => (
                  <div 
                    key={team.id}
                    className={`p-3 rounded border cursor-pointer transition-colors flex justify-between items-center ${selectedTeamId === team.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    <div className="font-medium text-sm">{team.name}</div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete team ${team.name}? Ushes will become unassigned.`)) {
                          deleteTeam({ id: eventId, teamId: team.id });
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {selectedTeamId && leaderSuggestions && leaderSuggestions.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500" /> Leader Suggestions
                  </h4>
                  <div className="space-y-2">
                    {leaderSuggestions.map((sug: any) => (
                      <div key={sug.id} className="flex justify-between items-center border p-2 rounded text-xs bg-amber-50/50">
                        <span>{sug.fullName} <span className="text-muted-foreground ml-1">({(sug.matchScore * 100).toFixed(0)}% match)</span></span>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-6 px-2 text-[10px]"
                          onClick={() => {
                            const assignment = event.assignments?.find((a: any) => a.usherId === sug.id);
                            if (assignment) {
                              updateAssignment({ id: eventId, assignmentId: assignment.id, data: { usherId: assignment.usherId, eventTeamId: selectedTeamId, isTeamLead: true, role: 'leader' } });
                            }
                          }}
                        >
                          Make Lead
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Middle Col - Assigned Ushers */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3 border-b border-primary/10">
              <CardTitle className="flex items-center justify-between">
                
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Assigned Staff ({event.assignments?.filter((a: any) => selectedTeamId === null ? true : a.eventTeamId === selectedTeamId).length || 0})
                  </span>
                  {event.budget && (
                    <span className={`text-xs font-normal ${isBudgetExceeded ? 'text-destructive' : 'text-muted-foreground'}`}>
                      Budget: EGP {totalSpent.toLocaleString()} / {event.budget.toLocaleString()} 
                      {isBudgetExceeded && ' (Exceeded)'}
                    </span>
                  )}
                </div>
  
                {selectedTeamId !== null && (
                  <Badge variant="outline" className="text-xs bg-primary/10">
                    {teams?.find((t: any) => t.id === selectedTeamId)?.name}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <div className="divide-y">
                {event.assignments?.filter((a: any) => selectedTeamId === null ? true : a.eventTeamId === selectedTeamId).map((assignment: any) => (
                  <div key={assignment.id} className="p-4 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={getImageUrl(assignment.usher?.profilePhotoKey) || assignment.usher?.profilePhotoUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {assignment.usher?.fullName?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {assignment.usher?.fullName}
                            {assignment.isTeamLead && <Badge variant="secondary" className="text-[10px] h-4 bg-amber-100 text-amber-800 hover:bg-amber-100">Lead</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                            <span className="flex items-center">
                              <Star className="w-3 h-3 text-secondary mr-1 fill-current" />
                              {assignment.usher?.avgRating?.toFixed(1) || 'N/A'}
                            </span>
                            <span className="capitalize text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{assignment.status === 'assigned' ? 'Pending' : assignment.status.replace('_', ' ')}</span>
                            {event.status === 'completed' && assignment.checkinTime && !assignment.checkoutTime && (
                              <Badge variant="destructive" className="text-[9px] h-4 px-1.5 leading-none shadow-sm animate-pulse">
                                MISSED CHECKOUT
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          {assignment.checkinTime && !assignment.checkoutTime && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs gap-1 text-primary hover:bg-primary/10"
                              disabled={isAdminCheckingOut}
                              onClick={() => {
                                if (confirm(`Force checkout for ${assignment.usher?.fullName}?`)) {
                                  adminCheckout({ id: eventId, assignmentId: assignment.id });
                                }
                              }}
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              Checkout
                            </Button>
                          )}
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
                            disabled={hasStarted || (assignment.status !== 'assigned' && assignment.status !== 'accepted')}
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
                        
                        {selectedTeamId === null && teams && teams.length > 0 && !hasStarted && (
                          <select 
                            className="text-[10px] border rounded px-1 py-0.5 mt-1 bg-muted/20"
                            value={assignment.eventTeamId || ""}
                            onChange={(e) => {
                              const tid = e.target.value ? parseInt(e.target.value, 10) : null;
                              updateAssignment({ id: eventId, assignmentId: assignment.id, data: { usherId: assignment.usherId, eventTeamId: tid, isTeamLead: false, role: 'regular' } });
                            }}
                          >
                            <option value="">Assign to team...</option>
                            {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        )}
                        {!hasStarted && (
                          <div className="flex items-center gap-1 mt-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-6 w-6 rounded-full shrink-0 ${(assignment.isTeamLead || assignment.role === 'leader') ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 hover:text-amber-600' : 'text-muted-foreground hover:bg-muted'}`}
                              onClick={() => {
                                const isCurrentlyLead = assignment.isTeamLead || assignment.role === 'leader';
                                updateAssignment({ 
                                  id: eventId, 
                                  assignmentId: assignment.id, 
                                  data: { 
                                    usherId: assignment.usherId,
                                    eventTeamId: assignment.eventTeamId,
                                    role: isCurrentlyLead ? 'regular' : 'leader',
                                    isTeamLead: !isCurrentlyLead,
                                  } 
                                });
                              }}
                              title={(assignment.isTeamLead || assignment.role === 'leader') ? "Team Leader (Click to demote)" : "Make Team Leader"}
                            >
                              <Crown className="w-4 h-4" />
                            </Button>
                            <AssignmentPayInput assignment={assignment} updateAssignment={updateAssignment} eventId={eventId} />
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                ))}
                {(!event.assignments || event.assignments.filter((a: any) => selectedTeamId === null ? true : a.eventTeamId === selectedTeamId).length === 0) && (
                  <div className="p-6 text-center text-sm text-muted-foreground">No ushers assigned.</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right Col - Smart Match */}
          <Card className="flex flex-col border-primary/20 bg-primary/5">
            <CardHeader className="pb-3 border-b border-primary/10">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Star className="w-5 h-5" />
                    Smart Match
                  </CardTitle>
                  <CardDescription>Suggested ushers based on rating, skills, and availability.</CardDescription>
                </div>
                <Dialog open={isAutoAssignOpen} onOpenChange={setIsAutoAssignOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm" className="gap-2" disabled={hasStarted}>
                      🪄 Auto Assign
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Smart Auto Assign</DialogTitle>
                      <DialogDescription>
                        Automatically assign the best available ushers based on specific criteria.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="count" className="text-right">Count</Label>
                        <Input
                          id="count"
                          type="number"
                          className="col-span-3"
                          value={autoAssignFilters.count}
                          onChange={(e) => setAutoAssignFilters({ ...autoAssignFilters, count: parseInt(e.target.value) || 1 })}
                          min={1}
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="gender" className="text-right">Gender</Label>
                        <select
                          id="gender"
                          className="col-span-3 flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={autoAssignFilters.gender}
                          onChange={(e) => setAutoAssignFilters({ ...autoAssignFilters, gender: e.target.value })}
                        >
                          <option value="">Any</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="minRating" className="text-right">Min Rating</Label>
                        <Input
                          id="minRating"
                          type="number"
                          step="0.1"
                          className="col-span-3"
                          value={autoAssignFilters.minRating}
                          onChange={(e) => setAutoAssignFilters({ ...autoAssignFilters, minRating: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="minEvents" className="text-right">Min Events</Label>
                        <Input
                          id="minEvents"
                          type="number"
                          className="col-span-3"
                          value={autoAssignFilters.minCompletedEvents}
                          onChange={(e) => setAutoAssignFilters({ ...autoAssignFilters, minCompletedEvents: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="maxDist" className="text-right">Max Dist (m)</Label>
                        <Input
                          id="maxDist"
                          type="number"
                          className="col-span-3"
                          placeholder="e.g. 5000"
                          value={autoAssignFilters.maxDistanceMeters || ""}
                          onChange={(e) => setAutoAssignFilters({ ...autoAssignFilters, maxDistanceMeters: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <div className="col-start-2 col-span-3 flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="leadership"
                            className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                            checked={autoAssignFilters.requiresLeadershipExp}
                            onChange={(e) => setAutoAssignFilters({ ...autoAssignFilters, requiresLeadershipExp: e.target.checked })}
                          />
                          <Label htmlFor="leadership" className="font-normal cursor-pointer">
                            Requires Leadership Experience
                          </Label>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAutoAssignOpen(false)}>Cancel</Button>
                      <Button 
                        disabled={isAutoAssigning}
                        onClick={() => {
                          const payload: any = { count: autoAssignFilters.count };
                          if (selectedTeamId) payload.eventTeamId = selectedTeamId;
                          if (autoAssignFilters.gender) payload.gender = autoAssignFilters.gender;
                          if (autoAssignFilters.minRating) payload.minRating = autoAssignFilters.minRating;
                          if (autoAssignFilters.minCompletedEvents) payload.minCompletedEvents = autoAssignFilters.minCompletedEvents;
                          if (autoAssignFilters.requiresLeadershipExp) payload.requiresLeadershipExp = true;
                          if (autoAssignFilters.maxDistanceMeters) payload.maxDistanceMeters = autoAssignFilters.maxDistanceMeters;
                          autoAssign({ id: eventId, data: payload });
                        }}
                      >
                        {isAutoAssigning ? "Assigning..." : "Assign"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0 pt-2">
              {isCandidatesLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading candidates...</div>
              ) : (
                <div className="divide-y divide-primary/10">
                  {candidates?.map((candidate: any) => {
                    const isAssigned = event.assignments?.some((a: any) => a.usherId === candidate.id);
                    if (isAssigned) return null;

                    return (
                      <div key={candidate.id} className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8 border border-background">
                            <AvatarFallback className="text-xs">{candidate.fullName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium leading-none">{candidate.fullName}</p>
                              {!candidate.isAvailable && (
                                <Badge variant="destructive" className="text-[10px] h-4 px-1.5 leading-none">
                                  Busy
                                </Badge>
                              )}
                            </div>
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
                          disabled={hasStarted || !candidate.isAvailable}
                          onClick={() => assignUsher({ id: eventId, data: { usherId: candidate.id, eventTeamId: selectedTeamId || undefined, isTeamLead: false } })}
                        >
                          <UserPlus className="w-3 h-3 mr-1" />
                          Assign {selectedTeamId !== null ? 'to Team' : ''}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waitlist" className="grid md:grid-cols-2 gap-6 mt-6 min-h-0 flex-1 overflow-auto">
          {/* Candidates for Waitlist */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3 border-b border-primary/10">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Available Candidates
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-4 space-y-4">
              <div className="space-y-4">
                {candidates?.map((data: any) => {
                  const isAssigned = event?.assignments?.some((a: any) => a.usherId === data.id);
                  const isWaitlisted = waitlist?.some((w: any) => w.usherId === data.id);
                  
                  if (isAssigned || isWaitlisted) return null;

                  return (
                    <div key={data.id} className="flex justify-between items-center p-3 rounded-xl border hover:border-primary/50 hover:bg-muted/30 transition-all">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-primary/10">
                          <AvatarImage src={getImageUrl(data.profilePhotoKey) || data.profilePhotoUrl || undefined} />
                          <AvatarFallback className="bg-primary/5 text-primary">{data.fullName?.substring(0,2)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-sm">{data.fullName}</div>
                          <div className="text-xs text-muted-foreground">{data.email}</div>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        disabled={hasStarted || isAddingToWaitlist}
                        onClick={() => addToWaitlist({ id: eventId, data: { usherId: data.id, priorityOrder: (waitlist?.length || 0) + 1 } })}
                      >
                        Waitlist
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Current Waitlist */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3 border-b border-primary/10">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Waitlisted Ushers
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-4 space-y-4">
              {(!waitlist || waitlist.length === 0) ? (
                <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-xl">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No ushers on the waitlist yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {waitlist.map((w: any, index: number) => (
                    <div key={w.id} className="flex justify-between items-center p-3 rounded-xl border border-primary/10 bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {index + 1}
                        </div>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={getImageUrl(w.usher?.profilePhotoKey) || w.usher?.profilePhotoUrl || undefined} />
                          <AvatarFallback>{w.usher?.fullName?.substring(0,2)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {w.usher?.fullName}
                            {w.status === 'accepted' && <Badge className="h-5 px-1.5 text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20" variant="outline">Accepted</Badge>}
                            {w.status === 'rejected' && <Badge className="h-5 px-1.5 text-[10px] bg-destructive/10 text-destructive border-destructive/20" variant="outline">Declined</Badge>}
                            {w.status === 'pending' && <Badge className="h-5 px-1.5 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20" variant="outline">Pending</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{w.usher?.phone}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm"
                          variant="outline"
                          disabled={hasStarted}
                          className="h-8 border-emerald-500/20 text-emerald-600 hover:bg-emerald-50"
                          onClick={() => promoteWaitlist({ id: eventId, waitlistId: w.id, data: { isTeamLead: false } })}
                        >
                          Promote
                        </Button>
                        <Button 
                          size="sm"
                          variant="ghost"
                          disabled={hasStarted}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeFromWaitlist({ id: eventId, waitlistId: w.id })}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


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
