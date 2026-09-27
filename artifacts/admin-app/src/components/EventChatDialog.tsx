import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getAuthToken } from "@/lib/auth";

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '';

interface EventChatDialogProps {
  eventId: number;
}

export function EventChatDialog({ eventId }: EventChatDialogProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();

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

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async (msg: string) => {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/api/events/${eventId}/chats`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: msg })
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["event-chats", eventId] });
      toast.success("Message sent to all ushers");
    },
    onError: () => {
      toast.error("Failed to send message");
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMessage(message);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Event Chat/Announcements">
          <MessageSquare className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Event Announcements</DialogTitle>
          <DialogDescription>
            Messages sent here will notify all ushers assigned to this event. Only admins can write messages.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 w-full border rounded-md p-4 bg-muted/20">
          {isLoading ? (
            <div className="text-center text-muted-foreground p-4">Loading messages...</div>
          ) : chats.length === 0 ? (
            <div className="text-center text-muted-foreground p-4">No messages yet.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {chats.map((chat: any) => (
                <div key={chat.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{chat.adminName || "Admin"}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(chat.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <div className="bg-primary text-primary-foreground p-3 rounded-lg rounded-tl-none w-fit max-w-[90%]">
                    {chat.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <form onSubmit={handleSend} className="flex items-center gap-2 mt-4">
          <Input 
            placeholder="Type an announcement..." 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isPending}
          />
          <Button type="submit" size="icon" disabled={isPending || !message.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
