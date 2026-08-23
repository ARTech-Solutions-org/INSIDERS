import { useListEvents, useDeleteEvent, useGetEventFeedbackLink, useCreateEventFeedbackLink, getGetEventFeedbackLinkQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MoreVertical, Eye, MapPin, Calendar, Trash2, Link as LinkIcon, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

function EventFeedbackButton({ eventId, eventStatus }: { eventId: number, eventStatus: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: feedbackLink, isLoading } = useGetEventFeedbackLink(eventId, {
    query: {
      enabled: !!eventId && eventStatus === "completed",
      retry: false,
      queryKey: getGetEventFeedbackLinkQueryKey(eventId) as any
    }
  });

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

  if (eventStatus !== "completed") {
    return null;
  }

  if (isLoading) {
    return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto" />;
  }

  if (!feedbackLink) {
    return (
      <Button 
        variant="outline" 
        size="sm"
        disabled={createFeedbackLinkMutation.isPending}
        onClick={() => createFeedbackLinkMutation.mutate({ id: eventId })}
        title="Generate Feedback Link"
      >
        {createFeedbackLinkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LinkIcon className="w-4 h-4 mr-2" />}
        Generate
      </Button>
    );
  }

  const isSubmitted = !!feedbackLink.submittedAt;

  const handleCopy = () => {
    if (isSubmitted) return;
    const url = `${window.location.origin}/feedback/${feedbackLink.token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied to clipboard." });
  };

  return (
    <Button 
      variant={isSubmitted ? "secondary" : "default"} 
      size="sm"
      className={isSubmitted ? "bg-muted text-muted-foreground hover:bg-muted cursor-default" : ""}
      onClick={isSubmitted ? undefined : handleCopy}
      title={isSubmitted ? "Feedback already submitted" : "Copy Feedback Link"}
    >
      {isSubmitted ? <Check className="w-4 h-4 mr-2" /> : <LinkIcon className="w-4 h-4 mr-2" />}
      {isSubmitted ? "Rated" : "Copy Link"}
    </Button>
  );
}

export default function Events() {
  const [status, setStatus] = useState<string>("");
  const { data, isLoading, refetch } = useListEvents({ status: status || undefined });
  const { toast } = useToast();

  const { mutate: deleteEvent } = useDeleteEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Event deleted successfully" });
        refetch();
      },
    },
  });

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500/10 text-green-600">Published</Badge>;
      case 'draft':
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">Draft</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-muted-foreground">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Events</h1>
            <p className="text-muted-foreground">Manage events, assign ushers, and track attendance.</p>
          </div>
          <Link href="/events/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Event
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between">
         <div className="flex items-center gap-2">
           <select 
             className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
             value={status}
             onChange={(e) => setStatus(e.target.value)}
           >
             <option value="">All Statuses</option>
             <option value="draft">Drafts</option>
             <option value="published">Published</option>
             <option value="completed">Completed</option>
           </select>
        </div>
      </div>

      <div className="border rounded-md bg-card overflow-hidden flex-1 flex flex-col">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead>Event Title</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead className="text-center">Feedback</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Loading events...
                  </TableCell>
                </TableRow>
              ) : data?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No events found.
                  </TableCell>
                </TableRow>
              ) : (
                data?.data?.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">
                      {event.title}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center text-foreground">
                          <Calendar className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                          {format(new Date(event.startTime), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground ml-4.5">
                          {format(new Date(event.startTime), 'h:mm a')} - {format(new Date(event.endTime), 'h:mm a')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                        <span className="line-clamp-1">{event.eventLocName || 'TBA'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(event.status || undefined)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      EGP {event.budget?.toLocaleString() || '0'}
                    </TableCell>
                    <TableCell className="text-center">
                      <EventFeedbackButton eventId={event.id} eventStatus={event.status || ''} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <Link href={`/events/${event.id}`}>
                            <DropdownMenuItem className="cursor-pointer">
                              <Eye className="w-4 h-4 mr-2" />
                              Manage Event
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuSeparator />
                          {event.status !== "completed" && new Date(event.endTime) > new Date() && (
                            <DropdownMenuItem 
                              className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
                                  deleteEvent({ id: event.id });
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Event
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="p-4 border-t border-border bg-muted/20 text-xs text-muted-foreground flex justify-between items-center">
          <span>Showing {data?.data?.length || 0} of {data?.total || 0} events</span>
        </div>
      </div>
    </div>
  );
}
