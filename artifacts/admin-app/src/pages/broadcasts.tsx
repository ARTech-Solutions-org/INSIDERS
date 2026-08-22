import { useState } from "react";
import { useListBroadcasts, useSendBroadcast } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Send, Loader2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format } from "date-fns";

export default function Broadcasts() {
  const { data, isLoading, refetch } = useListBroadcasts();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    message: "",
    targetFilter: "all_ushers" as string | null,
  });

  const { mutate: sendBroadcast, isPending } = useSendBroadcast({
    mutation: {
      onSuccess: () => {
        toast({ title: "Broadcast sent successfully!" });
        setFormData({ message: "", targetFilter: "all_ushers" });
        refetch();
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Error sending broadcast",
          description: (err as any).response?.data?.error || "Unknown error",
        });
      },
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendBroadcast({ data: { message: formData.message, targetFilter: formData.targetFilter } });
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Broadcasts</h1>
        <p className="text-muted-foreground">Send mass communications to ushers and view past messages.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 flex-1 overflow-hidden">
        
        {/* Send Broadcast Form */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              New Broadcast
            </CardTitle>
            <CardDescription>
              This will send a notification or email to the selected group of ushers.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="targetFilter">Target Audience</Label>
                <select 
                  id="targetFilter"
                  name="targetFilter"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={formData.targetFilter ?? ""}
                  onChange={handleChange}
                >
                  <option value="all_ushers">All Active Ushers</option>
                  <option value="pending_ushers">Pending Ushers</option>
                  <option value="suspended_ushers">Suspended Ushers</option>
                  <option value="rejected_ushers">Rejected Ushers</option>
                  <option value="male_ushers">Male Ushers (Active)</option>
                  <option value="female_ushers">Female Ushers (Active)</option>
                  <option value="high_rating">Top Rated (≥4.5)</option>
                  <option value="no_payment_method">No Payment Method Configured</option>
                  <option value="pending_payouts">Ushers with Pending Payouts</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea 
                  id="message" 
                  name="message" 
                  placeholder="Type your message here..." 
                  className="min-h-[150px]"
                  value={formData.message} 
                  onChange={handleChange} 
                  required 
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Broadcast
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Broadcast History */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
              History
            </CardTitle>
            <CardDescription>
              Recently sent broadcast messages.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground">Loading history...</div>
            ) : data?.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No broadcasts sent yet.</div>
            ) : (
              <div className="divide-y">
                {data?.map((msg) => (
                  <div key={msg.id} className="p-4 hover:bg-muted/10 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-sm">{msg.message.substring(0, 40)}{msg.message.length > 40 ? '...' : ''}</h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                        {format(new Date(msg.sentAt), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-primary mb-2 capitalize">
                      To: {(msg.targetFilter ?? 'all').replace('_', ' ')}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {msg.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
