import React, { useState } from 'react';
import { GeofenceMap } from '@/components/ui/geofence-map';
import { useRoute } from 'wouter';
import { 
  useGetEvent, 
  useListMyAssignments, 
  useAcceptAssignment, 
  useDeclineAssignment,
  useUsherCheckin,
  useUsherCheckout,
  useCancelAssignment,
  getListMyAssignmentsQueryKey,
  MyAssignment
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { 
  MapPin, Calendar, Clock, Navigation, AlertTriangle, 
  CheckCircle2, XCircle, Info, ShieldAlert, Phone, LocateFixed
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';

export default function EventDetail() {
  const [, params] = useRoute('/events/:id');
  const eventId = params?.id ? parseInt(params.id, 10) : 0;
  const queryClient = useQueryClient();

  const { data: assignmentsData, isLoading: isAssignmentsLoading } = useListMyAssignments({});
  const assignmentsList: MyAssignment[] = Array.isArray(assignmentsData) 
    ? assignmentsData 
    : (Array.isArray((assignmentsData as any)?.data) ? (assignmentsData as any).data : []);
  const assignment = assignmentsList.find(a => a.eventId === eventId);
  const assignmentId = assignment?.id;

  const { data: event, isLoading: isEventLoading } = useGetEvent(eventId, {
    query: { enabled: !!eventId && !assignment?.event, queryKey: ['events', eventId] }
  });

  const eventDetails = assignment?.event || event;

  const acceptMutation = useAcceptAssignment();
  const declineMutation = useDeclineAssignment();
  const cancelMutation = useCancelAssignment();
  const checkinMutation = useUsherCheckin();
  const checkoutMutation = useUsherCheckout();

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [showLocationDialog, setShowLocationDialog] = useState(false);

  // Check and request location permission on mount
  React.useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationPermission('denied');
      return;
    }
    const alreadyAsked = sessionStorage.getItem('locationAsked');
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setLocationPermission(result.state as any);
        if (result.state === 'granted') {
          // Already granted — silently get position
          navigator.geolocation.getCurrentPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => {},
            { enableHighAccuracy: true, timeout: 5000 }
          );
        } else if (!alreadyAsked) {
          // Show our dialog for 'prompt' or 'denied' if user hasn't seen it this session
          setShowLocationDialog(true);
        }
        result.onchange = () => {
          setLocationPermission(result.state as any);
          if (result.state === 'granted') {
            setShowLocationDialog(false);
            navigator.geolocation.getCurrentPosition(
              (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              () => {},
              { enableHighAccuracy: true, timeout: 5000 }
            );
          }
        };
      });
    } else if (!alreadyAsked) {
      setShowLocationDialog(true);
    }
  }, []);

  const requestLocationPermission = () => {
    sessionStorage.setItem('locationAsked', '1');
    setShowLocationDialog(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationPermission('granted');
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocationPermission('denied');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const dismissLocationDialog = () => {
    sessionStorage.setItem('locationAsked', '1');
    setShowLocationDialog(false);
    setLocationPermission('denied');
  };

  if (isAssignmentsLoading || (isEventLoading && !assignment?.event)) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-60 w-full rounded-2xl" />
      </div>
    );
  }

  if (!eventDetails) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Event not found.
      </div>
    );
  }

  const handleAccept = () => {
    if (!assignmentId) return;
    acceptMutation.mutate({ assignmentId }, {
      onSuccess: () => {
        toast.success('Assignment accepted!');
        queryClient.invalidateQueries({ queryKey: getListMyAssignmentsQueryKey() });
      },
      onError: (err) => toast.error(err.message || 'Failed to accept')
    });
  };

  const handleDecline = () => {
    if (!assignmentId) return;
    declineMutation.mutate({ assignmentId, data: { reason: 'User declined' } }, {
      onSuccess: () => {
        toast.success('Assignment declined');
        queryClient.invalidateQueries({ queryKey: getListMyAssignmentsQueryKey() });
      },
      onError: (err) => toast.error(err.message || 'Failed to decline')
    });
  };

  const handleCancel = () => {
    if (!assignmentId) return;
    cancelMutation.mutate({ assignmentId, data: { reason: 'User cancelled' } }, {
      onSuccess: () => {
        toast.success('Assignment cancelled');
        setShowCancelDialog(false);
        queryClient.invalidateQueries({ queryKey: getListMyAssignmentsQueryKey() });
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to cancel');
        setShowCancelDialog(false);
      }
    });
  };

  const getPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            resolve(pos);
          },
          reject,
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    });
  };

  function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const handleCheckin = async () => {
    if (!assignmentId) return;
    setGpsLoading(true);
    try {
      const pos = await getPosition();
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;
      const allowedRadius = eventDetails?.checkinRadiusM || 100;

      if (eventDetails?.venueLat && eventDetails?.venueLng) {
        const dist = Math.round(haversineMeters(userLat, userLng, eventDetails.venueLat, eventDetails.venueLng));
        if (dist > allowedRadius) {
          toast.error(`Out of range! You are ${dist}m away from the venue. Admin requires you to be within ${allowedRadius}m to check in.`);
          setGpsLoading(false);
          return;
        }
      }

      checkinMutation.mutate({ assignmentId, data: { lat: userLat, lng: userLng } }, {
        onSuccess: () => {
          toast.success('Checked in successfully!');
          queryClient.invalidateQueries({ queryKey: getListMyAssignmentsQueryKey() });
        },
        onError: (err: any) => toast.error(err.response?.data?.error || err.message || 'Check-in failed. Are you near the venue?')
      });
    } catch (err: any) {
      toast.error('GPS unavailable — please enable location services or contact your coordinator.');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!assignmentId) return;
    setGpsLoading(true);
    try {
      const pos = await getPosition();
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;
      const allowedRadius = eventDetails?.checkinRadiusM || 100;

      if (eventDetails?.venueLat && eventDetails?.venueLng) {
        const dist = Math.round(haversineMeters(userLat, userLng, eventDetails.venueLat, eventDetails.venueLng));
        if (dist > allowedRadius) {
          toast.error(`Out of range! You are ${dist}m away from the venue. Admin requires you to be within ${allowedRadius}m to check out.`);
          setGpsLoading(false);
          return;
        }
      }

      checkoutMutation.mutate({ assignmentId, data: { lat: userLat, lng: userLng } }, {
        onSuccess: () => {
          toast.success('Checked out successfully!');
          queryClient.invalidateQueries({ queryKey: getListMyAssignmentsQueryKey() });
        },
        onError: (err: any) => toast.error(err.response?.data?.error || err.message || 'Check-out failed. Are you near the venue?')
      });
    } catch (err: any) {
      toast.error('GPS unavailable — please enable location services or contact your coordinator.');
    } finally {
      setGpsLoading(false);
    }
  };

  const status = assignment?.status;
  const isPending = status === 'pending' || status === 'assigned';
  const isAccepted = status === 'accepted';
  const hasCheckedIn = !!assignment?.checkinTime;
  const hasCheckedOut = !!assignment?.checkoutTime;

  return (
    <div className="pb-24">
      {/* Location Permission Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader className="items-center text-center gap-2">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-1">
              <LocateFixed className="w-7 h-7 text-primary" />
            </div>
            <DialogTitle className="text-lg font-bold">Allow Location Access</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This app uses your GPS location to verify you are within the event's geofence zone before checking in or out. Your location is only used during check-in and check-out.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 mt-2">
            <Button className="w-full" onClick={requestLocationPermission}>
              <LocateFixed className="w-4 h-4 mr-2" />
              Allow Location
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={dismissLocationDialog}>
              Not Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Denied Banner */}
      {locationPermission === 'denied' && (
        <div className="mx-4 mt-4 flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Location access denied</p>
            <p className="text-destructive/80 text-xs mt-0.5">Check-in and check-out require location. Please enable it in your browser settings.</p>
          </div>
        </div>
      )}

      {/* Hero Header */}

      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
        <h1 className="text-2xl font-bold mb-2 relative z-10">{eventDetails.title}</h1>
        {assignment?.isTeamLead && (
          <span className="inline-flex px-2.5 py-1 bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-wide rounded-md mb-3 relative z-10">
            Team Lead
          </span>
        )}
        <div className="flex flex-col gap-2 text-primary-foreground/90 mt-4 relative z-10">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-secondary" />
            <span className="font-medium">{format(new Date(eventDetails.startTime), 'EEEE, MMMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-secondary" />
            <span className="font-medium">{format(new Date(eventDetails.startTime), 'h:mm a')} - {format(new Date(eventDetails.endTime), 'h:mm a')}</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Action Card based on Status */}
        {assignment && (
          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
            {isPending && (
              <div className="space-y-3">
                <p className="font-semibold text-foreground text-center mb-2">You've been assigned to this event!</p>
                <div className="flex gap-3">
                  <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12" onClick={handleAccept} disabled={acceptMutation.isPending}>
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Accept
                  </Button>
                  <Button variant="outline" className="flex-1 h-12 text-destructive border-destructive hover:bg-destructive/10" onClick={handleDecline} disabled={declineMutation.isPending}>
                    <XCircle className="w-5 h-5 mr-2" />
                    Decline
                  </Button>
                </div>
              </div>
            )}

            {isAccepted && !hasCheckedIn && (
              <div className="space-y-3">
                <Button className="w-full h-14 text-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-lg" onClick={handleCheckin} disabled={checkinMutation.isPending || gpsLoading}>
                  {(checkinMutation.isPending || gpsLoading) ? (
                    <div className="w-6 h-6 border-2 border-secondary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Navigation className="w-6 h-6 mr-2" />
                      GPS Check-in
                    </>
                  )}
                </Button>
                <Button variant="ghost" className="w-full text-destructive" onClick={() => setShowCancelDialog(true)}>
                  Cancel Assignment
                </Button>
              </div>
            )}

            {hasCheckedIn && !hasCheckedOut && (
              <div className="space-y-3">
                <div className="bg-green-500/10 text-green-700 p-3 rounded-xl flex items-center justify-between font-semibold mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Checked in at {format(new Date(assignment.checkinTime!), 'h:mm a')}
                  </div>
                  {(assignment as any).lateArrivalMinutes > 0 && (
                    <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      +{(assignment as any).lateArrivalMinutes}m late
                    </span>
                  )}
                </div>
                <Button className="w-full h-14 text-lg bg-primary hover:bg-primary/90 shadow-lg" onClick={handleCheckout} disabled={checkoutMutation.isPending || gpsLoading}>
                  {(checkoutMutation.isPending || gpsLoading) ? (
                    <div className="w-6 h-6 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Navigation className="w-6 h-6 mr-2" />
                      GPS Check-out
                    </>
                  )}
                </Button>
              </div>
            )}

            {hasCheckedOut && (
              <div className="bg-muted p-4 rounded-xl text-center">
                <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="font-bold text-foreground">Assignment Completed</p>
                <p className="text-sm text-muted-foreground mt-1">Great job!</p>
              </div>
            )}

            {status === 'cancelled' && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-xl text-center">
                <XCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="font-bold">Assignment Cancelled</p>
              </div>
            )}

            {status === 'no_show' && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-xl text-center">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                <p className="font-bold">Missed Event</p>
                <p className="text-sm mt-1">You did not check in before the event ended.</p>
              </div>
            )}
          </div>
        )}

        {/* Location & Navigation Card */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" /> Location & Navigation
            </h2>
          </div>

          <div className="space-y-3">
            <div>
              <p className="font-bold text-base text-foreground">{eventDetails.eventLocName || 'Location TBA'}</p>
              {eventDetails.venueLat && eventDetails.venueLng && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Coordinates: {eventDetails.venueLat.toFixed(4)}, {eventDetails.venueLng.toFixed(4)}
                </p>
              )}
            </div>

            {/* Geofence Range Banner */}
            <div className="bg-primary/5 border border-primary/15 p-3 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Navigation className="w-4 h-4 text-primary shrink-0" />
                <span>Geofence Range:</span>
              </div>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                Within {eventDetails.checkinRadiusM || 100}m of venue
              </span>
            </div>

            {/* Interactive Map with Geofence Range Circle */}
            {eventDetails.venueLat && eventDetails.venueLng && (
              <GeofenceMap
                lat={eventDetails.venueLat}
                lng={eventDetails.venueLng}
                radiusMeters={eventDetails.checkinRadiusM || 100}
                usherLat={userLocation?.lat}
                usherLng={userLocation?.lng}
                venueName={eventDetails.title || eventDetails.eventLocName || "Venue"}
                className="h-56 w-full rounded-xl overflow-hidden border border-border"
              />
            )}

            {/* Action Buttons: Open in Google Maps & Get Directions */}
            <div className="flex gap-2 pt-1">
              <a 
                href={
                  eventDetails.eventLocUrl ||
                  (eventDetails.venueLat && eventDetails.venueLng 
                    ? `https://www.google.com/maps/search/?api=1&query=${eventDetails.venueLat},${eventDetails.venueLng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((eventDetails.eventLocName || '') + ', Egypt')}`)
                } 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex-1"
              >
                <Button className="w-full h-11 bg-primary text-primary-foreground gap-2 font-semibold">
                  <Navigation className="w-4 h-4" />
                  Open in Google Maps
                </Button>
              </a>

              {eventDetails.venueLat && eventDetails.venueLng && (
                <a 
                  href={`https://www.google.com/maps/dir/?api=1&destination=${eventDetails.venueLat},${eventDetails.venueLng}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="h-11 px-3 gap-1 font-semibold">
                    Directions
                  </Button>
                </a>
              )}
            </div>
          </div>

          {(eventDetails.meetingPointLat && eventDetails.meetingPointLng) && (
            <div className="flex items-start gap-3 pt-3 border-t border-border">
              <div className="mt-1 p-2 bg-secondary/20 rounded-full">
                <Navigation className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="font-semibold text-sm text-muted-foreground">Meeting Point</p>
                <p className="text-sm mt-0.5">Please gather here before check-in.</p>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${eventDetails.meetingPointLat},${eventDetails.meetingPointLng}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm text-secondary font-medium hover:underline mt-1 inline-block"
                >
                  Navigate to Meeting Point
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Instructions & Dress Code */}
        {(eventDetails.dressCode || eventDetails.instructions) && (
          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-4">
            <h2 className="font-bold text-lg">Details</h2>
            
            {eventDetails.dressCode && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Dress Code</p>
                <p className="text-sm bg-muted p-3 rounded-xl">{eventDetails.dressCode}</p>
              </div>
            )}
            
            {eventDetails.instructions && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Instructions</p>
                <p className="text-sm bg-muted p-3 rounded-xl">{eventDetails.instructions}</p>
              </div>
            )}
          </div>
        )}

        {/* Contact Person */}
        {(eventDetails.contactName || eventDetails.contactPhone) && (
          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
            <h2 className="font-bold text-lg mb-3">Event Contact</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{eventDetails.contactName || 'Coordinator'}</p>
                {eventDetails.contactPhone && <p className="text-sm text-muted-foreground mt-0.5">{eventDetails.contactPhone}</p>}
              </div>
              {eventDetails.contactPhone && (
                <a href={`tel:${eventDetails.contactPhone}`} className="p-3 bg-primary text-primary-foreground rounded-full shadow-md">
                  <Phone className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Team Members */}
        {assignment?.teamMembers && assignment.teamMembers.length > 0 && (
          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
            <h2 className="font-bold text-lg mb-3">Team</h2>
            <div className="space-y-3">
              {assignment.teamMembers.map(member => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {member.profilePhotoUrl ? (
                      <img src={member.profilePhotoUrl} alt={member.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">{member.fullName.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {member.fullName} {member.isTeamLead && <span className="text-secondary text-[10px] ml-1 font-bold uppercase">(Lead)</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center text-destructive">
              <ShieldAlert className="w-5 h-5 mr-2" />
              Cancel Assignment
            </DialogTitle>
            <DialogDescription className="pt-2 text-foreground">
              Are you sure you want to cancel? 
              <span className="block mt-2 font-semibold text-destructive">
                Cancelling within 24 hours of the event may incur a penalty on your balance and rating.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row sm:justify-between gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1">Back</Button>
            </DialogClose>
            <Button variant="destructive" className="flex-1" onClick={handleCancel} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
