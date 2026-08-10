import { useState } from "react";
import { useCreateEvent } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MapPin, Calendar as CalendarIcon, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LocationPicker } from "@/components/ui/location-picker";

export default function EventsNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
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

  const { mutate: createEvent, isPending } = useCreateEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Event created successfully!" });
        setLocation(`/events`);
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Error creating event",
          description: (err as any).response?.data?.error || "Unknown error",
        });
      },
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Combine dates and times
    const startDateTime = new Date(`${formData.startDate}T${formData.startTime || '00:00'}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime || '00:00'}`);
    
    createEvent({
      data: {
        title: formData.title,
        eventLocName: formData.eventLocName,
        venueLat: parseFloat(formData.venueLat),
        venueLng: parseFloat(formData.venueLng),
        checkinRadiusM: parseInt(formData.checkinRadiusM, 10) || 100,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        dressCode: formData.dressCode || undefined,
        instructions: formData.instructions || undefined,
        eventBudget: parseInt(formData.eventBudget) || undefined,
        status: 'draft',
      },
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Link href="/events">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Event</h1>
          <p className="text-muted-foreground">Setup a new event for ushers to apply for.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information & Location</CardTitle>
            <CardDescription>What is the event, where is it happening, and allowed arrival range?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title <span className="text-destructive">*</span></Label>
              <Input 
                id="title" 
                name="title" 
                placeholder="e.g., Tech Conference 2026" 
                value={formData.title} 
                onChange={handleChange} 
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

            {/* Allowed Geofence Radius */}
            <div className="pt-2 border-t border-border space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="checkinRadiusM" className="font-semibold text-sm flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  Allowed Arrival & Leave Geofence Range (Meters)
                </Label>
                <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                  {formData.checkinRadiusM || 100} meters
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Input
                  id="checkinRadiusM"
                  name="checkinRadiusM"
                  type="number"
                  min="20"
                  max="5000"
                  placeholder="100"
                  value={formData.checkinRadiusM}
                  onChange={handleChange}
                  className="w-32 font-bold"
                />
                <span className="text-xs text-muted-foreground">meters radius</span>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-xs text-muted-foreground flex items-center mr-1">Presets:</span>
                {[50, 100, 150, 250, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, checkinRadiusM: String(preset) }))}
                    className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-colors ${
                      formData.checkinRadiusM === String(preset)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted text-muted-foreground border-input"
                    }`}
                  >
                    {preset}m
                  </button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Ushers must be within this distance from the event location coordinates to mark arrival (Check-in) and departure (Check-out).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>When does the event start and end?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" /> Start
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Date <span className="text-destructive">*</span></Label>
                  <Input type="date" id="startDate" name="startDate" value={formData.startDate} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Time <span className="text-destructive">*</span></Label>
                  <Input type="time" id="startTime" name="startTime" value={formData.startTime} onChange={handleChange} required />
                </div>
              </div>
              <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" /> End
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Date <span className="text-destructive">*</span></Label>
                  <Input type="date" id="endDate" name="endDate" value={formData.endDate} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">Time <span className="text-destructive">*</span></Label>
                  <Input type="time" id="endTime" name="endTime" value={formData.endTime} onChange={handleChange} required />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details & Requirements</CardTitle>
            <CardDescription>Additional information for the assigned ushers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dressCode">Dress Code</Label>
              <Input 
                id="dressCode" 
                name="dressCode" 
                placeholder="e.g., Black trousers, white shirt" 
                value={formData.dressCode} 
                onChange={handleChange} 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea 
                id="instructions" 
                name="instructions" 
                placeholder="Any specific instructions for ushers..." 
                className="min-h-[100px]"
                value={formData.instructions} 
                onChange={handleChange} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventBudget">Event Budget (EGP)</Label>
              <Input 
                id="eventBudget" 
                name="eventBudget" 
                type="number"
                placeholder="e.g., 5000" 
                value={formData.eventBudget} 
                onChange={handleChange} 
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Link href="/events">
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Event Draft
          </Button>
        </div>
      </form>
    </div>
  );
}
