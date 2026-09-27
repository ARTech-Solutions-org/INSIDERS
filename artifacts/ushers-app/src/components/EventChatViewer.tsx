import { useState, useEffect } from "react";
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
  const [lastReadAt, setLastReadAt] = useState<number>(() => {
    return parseInt(localStorage.getItem(`event-chat-read-${eventId}`) || "0", 10);
  });

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
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (open && chats.length > 0) {
      const latestTime = new Date(chats[chats.length - 1].createdAt).getTime();
      setLastReadAt(latestTime);
      localStorage.setItem(`event-chat-read-${eventId}`, latestTime.toString());
    }
  }, [open, chats, eventId]);

  const unreadCount = chats.filter((c: any) => new Date(c.createdAt).getTime() > lastReadAt).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="relative inline-block mt-1 shrink-0">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20 hover:text-primary-foreground">
            <MessageSquare className="w-5 h-5" />
          </Button>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-primary">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
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
