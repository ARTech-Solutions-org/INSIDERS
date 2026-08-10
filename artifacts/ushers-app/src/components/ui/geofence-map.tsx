import { useEffect, useRef } from "react";

interface GeofenceMapProps {
  lat: number;
  lng: number;
  radiusMeters: number;
  usherLat?: number | null;
  usherLng?: number | null;
  venueName?: string;
  className?: string;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getZoomForRadius(radiusMeters: number): number {
  if (radiusMeters <= 100) return 17;
  if (radiusMeters <= 300) return 16;
  if (radiusMeters <= 700) return 15;
  if (radiusMeters <= 1500) return 14;
  return 13;
}

export function GeofenceMap({
  lat,
  lng,
  radiusMeters,
  usherLat,
  usherLng,
  venueName = "Event Venue",
  className = "h-64 w-full rounded-2xl overflow-hidden border border-border shadow-sm",
}: GeofenceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const initMap = () => {
      if (typeof window === "undefined" || !(window as any).L) return;
      const L = (window as any).L;

      if (!mapRef.current) {
        const map = L.map(containerRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          touchZoom: true,
        }).setView([lat, lng], getZoomForRadius(radiusMeters));

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        mapRef.current = map;
      }

      const map = mapRef.current;
      map.setView([lat, lng], map.getZoom() || getZoomForRadius(radiusMeters));
      setTimeout(() => { map.invalidateSize(); }, 250);

      map.eachLayer((layer: any) => {
        if (!layer._url) map.removeLayer(layer);
      });

      // Geofence Range Circle
      const circle = L.circle([lat, lng], {
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.2,
        weight: 2.5,
        radius: radiusMeters,
      }).addTo(map);

      circle.bindTooltip(`Allowed Range: ${radiusMeters}m`, {
        permanent: true,
        direction: "top",
        className: "bg-primary text-primary-foreground font-bold px-2 py-0.5 rounded text-xs shadow-md border-0",
      });

      // Venue Marker
      const venueIcon = L.divIcon({
        className: "custom-venue-pin",
        html: `<div style="background-color: #2563eb; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); border: 2px solid white;">📍</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([lat, lng], { icon: venueIcon })
        .addTo(map)
        .bindPopup(`<div style="padding:4px"><b>${venueName}</b><br><span style="font-size:11px;color:#666">Range: ${radiusMeters}m radius</span></div>`);

      // Usher Marker if present
      if (usherLat !== undefined && usherLat !== null && usherLng !== undefined && usherLng !== null) {
        const dist = haversineMeters(usherLat, usherLng, lat, lng);
        const inRange = dist <= radiusMeters;
        const color = inRange ? "#16a34a" : "#dc2626";

        const usherIcon = L.divIcon({
          className: "custom-usher-pin",
          html: `<div style="background-color: ${color}; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); border: 2px solid white;">🚶</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        L.marker([usherLat, usherLng], { icon: usherIcon })
          .addTo(map)
          .bindPopup(`<div style="padding:4px"><b>Your Location</b><br>${Math.round(dist)}m from venue (${inRange ? "IN RANGE ✅" : "OUT OF RANGE ❌"})</div>`)
          .openPopup();

        L.polyline([[usherLat, usherLng], [lat, lng]], {
          color: color,
          weight: 2.5,
          dashArray: "6, 8",
        }).addTo(map);

        const bounds = L.latLngBounds([[lat, lng], [usherLat, usherLng]]);
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    };

    if (!(window as any).L) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = initMap;
      document.body.appendChild(script);
    } else {
      initMap();
    }
  }, [lat, lng, radiusMeters, usherLat, usherLng, venueName]);

  return (
    <div style={{ isolation: 'isolate', position: 'relative' }} className={className}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
