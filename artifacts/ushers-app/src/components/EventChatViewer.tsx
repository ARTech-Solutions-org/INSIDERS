import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { getAuthToken } from "@/lib/auth";

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '';

interface EventChatViewerProps {
  eventId: number;
}

export function EventChatViewer({ eventId }: EventChatViewerProps) {
  const [open, setOpen] = useState(false);

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["event-chats", eventId],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/api/events/${eventId}/chats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch chats");
      return res.json();
    },
    enabled: open,
    refetchInterval: open ? 5000 : false, // Poll for new messages every 5s while open
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20 hover:text-primary-foreground">
          <MessageSquare className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] h-[500px] flex flex-col p-4 rounded-2xl mx-4">
        <DialogHeader>
          <DialogTitle className="text-xl">Event Announcements</DialogTitle>
          <DialogDescription className="text-xs">
            Important updates from the event admins.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 w-full border rounded-xl p-4 bg-muted/30">
          {isLoading ? (
            <div className="text-center text-muted-foreground p-4 text-sm">Loading announcements...</div>
          ) : chats.length === 0 ? (
            <div className="text-center text-muted-foreground p-4 text-sm">No announcements yet.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {chats.map((chat: any) => (
                <div key={chat.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-primary">{chat.adminName || "Admin"}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(chat.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <div className="bg-primary/10 text-primary p-3 rounded-xl border border-primary/20 text-sm">
                    {chat.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
