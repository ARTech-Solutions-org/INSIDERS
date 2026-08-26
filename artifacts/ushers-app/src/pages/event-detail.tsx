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
  useTeamCheckinMember,
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
  const { mutateAsync: teamCheckinMember } = useTeamCheckinMember();
  const checkoutMutation = useUsherCheckout();
  const checkinMutation = useUsherCheckin();

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
            () => { },
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
              () => { },
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

      if (eventDetails?.venueLat != null && eventDetails?.venueLng != null) {
        const dist = Math.round(haversineMeters(userLat, userLng, eventDetails.venueLat, eventDetails.venueLng));
        if (dist > allowedRadius) {
          toast.error(`Out of range! You are ${dist}m away from the venue. Admin requires you to be within ${allowedRadius}m to check in.`);
          setGpsLoading(false);
          return;
        }
      } else {
        toast.error('Event location is not set on the map. Cannot verify your location.');
        setGpsLoading(false);
        return;
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

      if (eventDetails?.venueLat != null && eventDetails?.venueLng != null) {
        const dist = Math.round(haversineMeters(userLat, userLng, eventDetails.venueLat, eventDetails.venueLng));
        if (dist > allowedRadius) {
          toast.error(`Out of range! You are ${dist}m away from the venue. Admin requires you to be within ${allowedRadius}m to check out.`);
          setGpsLoading(false);
          return;
        }
      } else {
        toast.error('Event location is not set on the map. Cannot verify your location.');
        setGpsLoading(false);
        return;
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

  const windowMinutes = (eventDetails as any)?.checkinWindowMinutes ?? 5;
  const msRemaining = eventDetails?.startTime ? new Date(eventDetails.startTime).getTime() - (windowMinutes * 60000) - currentTime.getTime() : 0;
  const isTooEarly = msRemaining > 0;

  const allowedRadius = eventDetails?.checkinRadiusM || 100;
  let isOutOfRange = false;
  let distToVenue = -1;
  if (userLocation && eventDetails?.venueLat != null && eventDetails?.venueLng != null) {
    distToVenue = Math.round(haversineMeters(userLocation.lat, userLocation.lng, eventDetails.venueLat, eventDetails.venueLng));
    isOutOfRange = distToVenue > allowedRadius;
  }

  const isGpsMissing = locationPermission === 'denied' || !userLocation;

  const formatCountdown = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const payAmount = assignment?.overriddenPay ?? ((assignment?.role === 'leader' || assignment?.isTeamLead) ? eventDetails?.leaderRate : eventDetails?.regularRate) ?? 0;

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

        {/* Hero Header */}
        <div className="bg-primary rounded-2xl p-6 pb-8 mx-5 mt-2 relative overflow-hidden shadow-sm">
          <div className="relative z-10">
            <p className="brand-meta text-primary-foreground/70 mb-3 tracking-widest">LIVE ASSIGNMENT</p>
            <h1 className="brand-display text-4xl mb-3 text-primary-foreground tracking-wide uppercase leading-tight">{eventDetails.title}</h1>
            {assignment?.isTeamLead && (
              <span className="inline-flex px-3 py-1 bg-secondary text-secondary-foreground text-[10px] font-bold uppercase tracking-widest rounded-md mb-4">
                TEAM LEAD
              </span>
            )}
            <span className="inline-flex px-3 py-1 bg-green-500/20 text-green-100 border border-green-500/30 text-[10px] font-bold uppercase tracking-widest rounded-md mb-4 mr-2">
              {payAmount} EGP
            </span>
            <div className="flex flex-col gap-3 text-primary-foreground/90 mt-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary-foreground/60" strokeWidth={1.5} />
                <span className="font-semibold tracking-wide text-sm">{format(new Date(eventDetails.startTime), 'EEEE, MMM d, yyyy').toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary-foreground/60" strokeWidth={1.5} />
                <span className="font-semibold tracking-wide text-sm">{format(new Date(eventDetails.startTime), 'h:mm a')} - {format(new Date(eventDetails.endTime), 'h:mm a')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5 -mt-4 relative z-20">
          {/* Action Card based on Status */}
          {assignment && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm mt-4">
              {isPending && (
                <div className="space-y-4">
                  <p className="brand-meta text-foreground text-center mb-2 text-sm tracking-wider">YOU'VE BEEN ASSIGNED TO THIS EVENT</p>
                  <div className="flex gap-3">
                    <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12 rounded-xl" onClick={handleAccept} disabled={acceptMutation.isPending}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      ACCEPT
                    </Button>
                    <Button variant="outline" className="flex-1 h-12 text-destructive border-destructive hover:bg-destructive/10 rounded-xl" onClick={handleDecline} disabled={declineMutation.isPending}>
                      <XCircle className="w-4 h-4 mr-2" />
                      DECLINE
                    </Button>
                  </div>
                </div>
              )}

              {isAccepted && !hasCheckedIn && (
                <div className="space-y-4">
                  {isGpsMissing ? (
                    <div className="w-full bg-destructive/10 border-2 border-dashed border-destructive/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center">
                      <LocateFixed className="w-6 h-6 text-destructive mb-1" />
                      <span className="text-[10px] text-destructive font-bold tracking-widest uppercase">GPS REQUIRED</span>
                      <span className="text-xs font-medium text-destructive/90">Please enable GPS, allow location permissions, and turn off any VPN (e.g. iCloud Private Relay on iOS).</span>
                      {locationPermission !== 'granted' && (
                        <Button variant="outline" size="sm" className="mt-2 text-xs h-8 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={requestLocationPermission}>
                          REQUEST PERMISSION
                        </Button>
                      )}
                    </div>
                  ) : isTooEarly ? (
                    <div className="w-full h-14 bg-card border-2 border-dashed border-primary/40 rounded-xl flex items-center justify-center gap-3">
                      <Clock className="w-5 h-5 text-primary" />
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">CHECK-IN OPENS IN</span>
                        <span className="brand-display text-lg tracking-widest text-foreground">{formatCountdown(msRemaining)}</span>
                      </div>
                    </div>
                  ) : isOutOfRange ? (
                    <div className="w-full h-14 bg-destructive/5 border-2 border-dashed border-destructive/30 rounded-xl flex items-center justify-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <div className="flex flex-col text-center">
                        <span className="text-[10px] text-destructive font-bold tracking-widest uppercase">OUT OF RANGE</span>
                        <span className="text-[10px] text-destructive/80 font-bold uppercase">{distToVenue}M AWAY (MAX {allowedRadius}M)</span>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      className="w-full h-14 text-sm tracking-widest bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-sm rounded-xl uppercase font-bold animate-in fade-in zoom-in duration-300" 
                      onClick={handleCheckin} 
                      disabled={checkinMutation.isPending || gpsLoading}
                    >
                      {(checkinMutation.isPending || gpsLoading) ? (
                        <div className="w-5 h-5 border-2 border-secondary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Navigation className="w-5 h-5 mr-2" />
                          GPS CHECK-IN
                        </>
                      )}
                    </Button>
                  )}
                  <Button variant="ghost" className="w-full text-destructive rounded-xl text-xs tracking-wider" onClick={() => setShowCancelDialog(true)}>
                    CANCEL ASSIGNMENT
                  </Button>
                </div>
              )}

              {hasCheckedIn && !hasCheckedOut && (
                <div className="space-y-4">
                  <div className="bg-green-500/10 border border-green-500/20 text-green-700 p-3 rounded-xl flex items-center justify-between font-bold text-xs uppercase tracking-wider mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      CHECKED IN AT {format(new Date(assignment.checkinTime!), 'h:mm a')}
                    </div>
                    {(assignment as any).lateArrivalMinutes > 0 && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md">
                        +{(assignment as any).lateArrivalMinutes}M LATE
                      </span>
                    )}
                  </div>
                  {isGpsMissing ? (
                    <div className="w-full bg-destructive/10 border-2 border-dashed border-destructive/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center mt-4">
                      <LocateFixed className="w-6 h-6 text-destructive mb-1" />
                      <span className="text-[10px] text-destructive font-bold tracking-widest uppercase">GPS REQUIRED</span>
                      <span className="text-xs font-medium text-destructive/90">Please enable GPS, allow location permissions, and turn off any VPN (e.g. iCloud Private Relay on iOS).</span>
                      {locationPermission !== 'granted' && (
                        <Button variant="outline" size="sm" className="mt-2 text-xs h-8 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={requestLocationPermission}>
                          REQUEST PERMISSION
                        </Button>
                      )}
                    </div>
                  ) : isOutOfRange ? (
                    <div className="w-full h-14 bg-destructive/5 border-2 border-dashed border-destructive/30 rounded-xl flex items-center justify-center gap-3 mt-4">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <div className="flex flex-col text-center">
                        <span className="text-[10px] text-destructive font-bold tracking-widest uppercase">OUT OF RANGE</span>
                        <span className="text-[10px] text-destructive/80 font-bold uppercase">{distToVenue}M AWAY (MAX {allowedRadius}M)</span>
                      </div>
                    </div>
                  ) : (
                    <Button className="w-full h-14 text-sm tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm rounded-xl uppercase font-bold mt-4 animate-in fade-in zoom-in duration-300" onClick={handleCheckout} disabled={checkoutMutation.isPending || gpsLoading}>
                      {(checkoutMutation.isPending || gpsLoading) ? (
                        <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Navigation className="w-5 h-5 mr-2" />
                          GPS CHECK-OUT
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {hasCheckedOut && (
                <div className="bg-muted/30 border border-border p-5 rounded-xl text-center mt-2">
                  <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-3" />
                  <p className="brand-display text-xl text-foreground tracking-wide uppercase">ASSIGNMENT COMPLETED</p>
                  <p className="brand-meta text-muted-foreground mt-2">GREAT JOB!</p>
                </div>
              )}

              {status === 'cancelled' && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl text-destructive p-5 text-center mt-2">
                  <XCircle className="w-8 h-8 mx-auto mb-3" />
                  <p className="brand-display text-xl tracking-wide uppercase">ASSIGNMENT CANCELLED</p>
                </div>
              )}

              {status === 'no_show' && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl text-destructive p-5 text-center mt-2">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-3" />
                  <p className="brand-display text-xl tracking-wide uppercase">MISSED EVENT</p>
                  <p className="brand-meta mt-2 text-xs">YOU DID NOT CHECK IN BEFORE THE EVENT ENDED.</p>
                </div>
              )}
            </div>
          )}

          {/* Location & Navigation Card */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h2 className="brand-display text-xl flex items-center gap-2 uppercase tracking-wide">
                <MapPin className="w-5 h-5 text-secondary" /> LOCATION
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <p className="font-bold text-sm tracking-wide uppercase text-foreground">{eventDetails.eventLocName || 'Location TBA'}</p>
                {eventDetails.venueLat != null && eventDetails.venueLng != null && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    {eventDetails.venueLat.toFixed(4)}, {eventDetails.venueLng.toFixed(4)}
                  </p>
                )}
              </div>

              {/* Geofence Range Banner */}
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-foreground">
                  <Navigation className="w-4 h-4 text-primary shrink-0" />
                  <span>GEOFENCE RANGE</span>
                </div>
                <span className="brand-meta text-primary bg-primary/10 rounded-md px-2 py-1">
                  WITHIN {eventDetails.checkinRadiusM || 100}M
                </span>
              </div>

              {/* Interactive Map with Geofence Range Circle */}
              {eventDetails.venueLat != null && eventDetails.venueLng != null && (
                <div className="border border-border rounded-xl p-1 bg-background overflow-hidden">
                  <GeofenceMap
                    lat={eventDetails.venueLat}
                    lng={eventDetails.venueLng}
                    radiusMeters={eventDetails.checkinRadiusM || 100}
                    usherLat={userLocation?.lat}
                    usherLng={userLocation?.lng}
                    venueName={eventDetails.title || eventDetails.eventLocName || "Venue"}
                    className="h-56 w-full rounded-lg"
                  />
                </div>
              )}

              {/* Action Buttons: Open in Google Maps & Get Directions */}
              <div className="flex gap-2 pt-2">
                <a
                  href={
                    eventDetails.eventLocUrl ||
                    (eventDetails.venueLat != null && eventDetails.venueLng != null
                      ? `https://www.google.com/maps/search/?api=1&query=${eventDetails.venueLat},${eventDetails.venueLng}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((eventDetails.eventLocName || '') + ', Egypt')}`)
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button className="w-full h-11 bg-primary text-primary-foreground gap-2 font-bold text-xs tracking-wider uppercase rounded-xl">
                    <Navigation className="w-4 h-4" />
                    OPEN MAPS
                  </Button>
                </a>

                {eventDetails.venueLat != null && eventDetails.venueLng != null && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${eventDetails.venueLat},${eventDetails.venueLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="h-11 px-4 gap-1 font-bold text-xs tracking-wider uppercase rounded-xl border-border hover:bg-muted">
                      DIRECTIONS
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {(eventDetails.meetingPointLat != null && eventDetails.meetingPointLng != null) && (
              <div className="flex items-start gap-4 pt-4 border-t border-border/50">
                <div className="mt-1 p-2 bg-secondary/10 border border-secondary/20">
                  <Navigation className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="brand-meta text-muted-foreground mb-1">MEETING POINT</p>
                  <p className="text-xs font-medium text-foreground mb-2">Please gather here before check-in.</p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${eventDetails.meetingPointLat},${eventDetails.meetingPointLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="brand-meta text-secondary hover:underline inline-block border-b border-secondary/30 pb-0.5"
                  >
                    NAVIGATE TO POINT
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Instructions & Dress Code */}
          {(eventDetails.dressCode || eventDetails.instructions) && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
              <h2 className="brand-display text-xl uppercase tracking-wide border-b border-border/50 pb-3">DETAILS</h2>

              {eventDetails.dressCode && (
                <div>
                  <p className="brand-meta text-muted-foreground mb-2">DRESS CODE</p>
                  <p className="text-sm bg-background border border-border rounded-xl p-4 font-medium leading-relaxed">{eventDetails.dressCode}</p>
                </div>
              )}

              {eventDetails.instructions && (
                <div>
                  <p className="brand-meta text-muted-foreground mb-2 mt-4">INSTRUCTIONS</p>
                  <p className="text-sm bg-background border border-border rounded-xl p-4 font-medium leading-relaxed">{eventDetails.instructions}</p>
                </div>
              )}
            </div>
          )}

          {/* Contact Person */}
          {(eventDetails.contactName || eventDetails.contactPhone) && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="brand-meta text-muted-foreground mb-1">EVENT CONTACT</p>
                <p className="font-bold text-sm uppercase tracking-wide">{eventDetails.contactName || 'COORDINATOR'}</p>
                {eventDetails.contactPhone && <p className="text-xs text-muted-foreground mt-1 font-mono">{eventDetails.contactPhone}</p>}
              </div>
              {eventDetails.contactPhone && (
                <a href={`tel:${eventDetails.contactPhone}`} className="p-3 bg-primary rounded-xl text-primary-foreground border border-primary/20 hover:bg-primary/90 transition-colors">
                  <Phone className="w-5 h-5" />
                </a>
              )}
            </div>
          )}

          {/* Team Members */}
          {(assignment as any)?.allTeams && (assignment as any).allTeams.length > 0 && (
            <div className="space-y-4">
              {(assignment as any).allTeams.map((t: any) => {
                const teamMembers = (assignment as any).allEventMembers?.filter((m: any) => m.eventTeamId === t.id) || [];
                return (
                  <div key={t.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                    <h2 className="brand-display text-xl uppercase tracking-wide border-b border-border/50 pb-3 mb-2">
                      {t.name}
                    </h2>
                    {t.instructions && (
                      <p className="text-sm text-muted-foreground mb-4 bg-muted/30 p-3 rounded-lg border border-border/40">
                        <span className="font-bold text-foreground block mb-1">INSTRUCTIONS:</span>
                        {t.instructions}
                      </p>
                    )}
                    <div className="space-y-4 mt-2">
                      {teamMembers.map((member: any) => (
                        <div key={member.id} className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-muted rounded-full overflow-hidden flex items-center justify-center border border-border shrink-0">
                            {member.profilePhotoUrl ? (
                              <img src={member.profilePhotoUrl} alt={member.fullName} className="w-full h-full object-cover" />
                            ) : (
                              <span className="brand-display text-sm text-muted-foreground">{member.fullName.charAt(0)}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm tracking-wide uppercase truncate">
                              {member.fullName} {member.id === assignment?.event?.usherId ? '(You)' : ''}
                            </p>
                            {member.isTeamLead && <span className="brand-meta text-secondary mt-0.5 block">TEAM LEAD</span>}
                            {member.status === 'checked_in' && !member.isTeamLead && (
                              <span className="brand-meta text-emerald-500 mt-0.5 block">CHECKED IN</span>
                            )}
                          </div>
                          {assignment?.isTeamLead && !member.isTeamLead && (member.status === 'accepted' || member.status === 'assigned') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg shrink-0 border-primary/20 text-primary hover:bg-primary/10"
                              onClick={async () => {
                                try {
                                  await teamCheckinMember({ assignmentId: assignment.id, usherId: member.id });
                                  queryClient.invalidateQueries({ queryKey: getListMyAssignmentsQueryKey() });
                                  toast.success(`Checked in ${member.fullName}`);
                                } catch (err: any) {
                                  toast.error(err.response?.data?.error || `Failed to check in ${member.fullName}`);
                                }
                              }}
                            >
                              Check In
                            </Button>
                          )}
                          {((assignment?.isTeamLead && member.phone) || (member.isTeamLead && member.phone)) && (
                            <a href={`tel:${member.phone}`} className="p-2 bg-primary/10 rounded-xl text-primary border border-primary/20 hover:bg-primary/20 transition-colors shrink-0">
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      ))}
                      {teamMembers.length === 0 && (
                        <p className="text-sm text-muted-foreground italic">No members assigned.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Deduction Rules */}
          {eventDetails.deductionRules && eventDetails.deductionRules.length > 0 && (
            <div className="bg-card border border-destructive/20 rounded-2xl p-5 shadow-sm">
              <h2 className="brand-display text-xl text-destructive uppercase tracking-wide border-b border-destructive/20 pb-3 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                DEDUCTION RULES
              </h2>
              <div className="space-y-3">
                {eventDetails.deductionRules.map((rule: any) => (
                  <div key={rule.id} className="flex justify-between items-center bg-destructive/5 p-3 rounded-xl border border-destructive/10">
                    <span className="text-sm font-semibold text-destructive/90">{rule.description}</span>
                    <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-md">-{rule.deductionAmount} EGP</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent className="w-[90vw] max-w-[400px] rounded-2xl border border-border p-6 bg-card">
            <DialogHeader>
              <DialogTitle className="flex items-center text-destructive brand-display text-2xl uppercase tracking-wide">
                <ShieldAlert className="w-6 h-6 mr-3" />
                CANCEL ASSIGNMENT
              </DialogTitle>
              <DialogDescription className="pt-4 text-foreground text-sm font-medium leading-relaxed">
                Are you sure you want to cancel?
                <span className="block mt-3 p-3 bg-destructive/10 text-destructive border border-destructive/20 font-bold uppercase rounded-xl text-[10px] tracking-wider">
                  Cancelling within 24 hours of the event may incur a penalty on your balance and rating.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-row sm:justify-between gap-3 mt-6">
              <DialogClose asChild>
                <Button variant="outline" className="flex-1 rounded-xl border-border text-xs font-bold tracking-widest uppercase">BACK</Button>
              </DialogClose>
              <Button variant="destructive" className="flex-1 rounded-xl text-xs font-bold tracking-widest uppercase" onClick={handleCancel} disabled={cancelMutation.isPending}>
                {cancelMutation.isPending ? 'CANCELLING...' : 'CONFIRM'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
