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
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[500px] h-[80vh] sm:h-[600px] flex flex-col p-0 gap-0 overflow-hidden rounded-[1.5rem] border-border/50 shadow-2xl">
        <DialogHeader className="p-5 pb-4 border-b border-border/50 bg-card/80 backdrop-blur-md shrink-0">
          <DialogTitle className="text-xl font-black tracking-tight text-foreground">Announcements</DialogTitle>
          <DialogDescription className="text-xs font-medium text-muted-foreground">
            Important updates from the event admins.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 w-full bg-gradient-to-b from-muted/30 to-muted/10">
          {isLoading ? (
            <div className="h-full min-h-[200px] flex items-center justify-center text-muted-foreground text-sm font-medium animate-pulse">
              Loading announcements...
            </div>
          ) : chats.length === 0 ? (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-muted-foreground gap-3">
              <MessageSquare className="w-8 h-8 opacity-20" />
              <p className="text-sm font-medium">No announcements yet.</p>
            </div>
          ) : (
            <div className="p-5 flex flex-col gap-6">
              {chats.map((chat: any) => (
                <div key={chat.id} className="flex flex-col gap-1.5 w-[90%] sm:w-[85%]">
                  <div className="flex items-baseline gap-2 ml-1">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-primary">
                      {chat.adminName || "Admin"}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {format(new Date(chat.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <div className="bg-card text-foreground p-4 rounded-2xl rounded-tl-sm border border-border shadow-sm text-sm font-medium leading-relaxed relative">
                    <div className="absolute top-0 -left-2 w-2 h-3 bg-card border-l border-t border-border clip-path-triangle" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}></div>
                    <p className="whitespace-pre-wrap break-words">{chat.message}</p>
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
