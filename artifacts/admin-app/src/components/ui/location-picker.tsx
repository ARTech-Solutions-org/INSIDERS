import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, Navigation, Loader2, Check } from "lucide-react";
import { GeofenceMap } from "@/components/ui/geofence-map";

interface LocationValue {
  address: string;
  lat: number | null;
  lng: number | null;
}

interface LocationPickerProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  radiusMeters?: number;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  isCustom?: boolean;
}

const EGYPT_PRESETS = [
  { name: "Cairo International Convention Centre", lat: 30.0718, lng: 31.3175 },
  { name: "El Gouna Arena, Red Sea", lat: 27.3371, lng: 33.6775 },
  { name: "Egypt International Exhibition Center (EIEC)", lat: 30.0248, lng: 31.4050 },
  { name: "The Grand Egyptian Museum, Giza", lat: 29.9950, lng: 31.1197 },
  { name: "New Capital Sports City", lat: 29.9800, lng: 31.6800 },
];

export function LocationPicker({ value, onChange, radiusMeters = 100 }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState(value.address || "");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Sync searchQuery when value address updates from parent
  useEffect(() => {
    if (value.address && value.address !== searchQuery) {
      setSearchQuery(value.address);
    }
  }, [value.address]);

  // Debounce logic
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!searchQuery || searchQuery.length < 3) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '';
        let url = `${baseUrl}/api/places/search?q=${encodeURIComponent(searchQuery)}`;
        if (value.lat && value.lng) {
          url += `&lat=${value.lat}&lng=${value.lng}`;
        }
        
        const res = await fetch(url);
        if (res.ok) {
          const data: SearchResult[] = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error("Places search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(handler);
  }, [searchQuery, value.lat, value.lng]);

  const handleSelectResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    onChange({
      address: result.display_name.split(",")[0],
      lat,
      lng,
    });
    setSearchQuery(result.display_name.split(",")[0]);
    setSearchResults([]);
  };

  const handleSelectPreset = (preset: typeof EGYPT_PRESETS[0]) => {
    onChange({
      address: preset.name,
      lat: preset.lat,
      lng: preset.lng,
    });
    setSearchQuery(preset.name);
    setSearchResults([]);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await res.json();
          const addressName = data.display_name ? data.display_name.split(",")[0] : `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
          onChange({ address: addressName, lat, lng });
          setSearchQuery(addressName);
        } catch {
          onChange({ address: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`, lat, lng });
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        setIsLocating(false);
      }
    );
  };

  const handleMapClick = async (clickedLat: number, clickedLng: number) => {
    const formattedLat = Number(clickedLat.toFixed(5));
    const formattedLng = Number(clickedLng.toFixed(5));

    const initialName = searchQuery || `Location (${formattedLat}, ${formattedLng})`;
    onChange({
      address: initialName,
      lat: formattedLat,
      lng: formattedLng,
    });

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${formattedLat}&lon=${formattedLng}`
      );
      const data = await res.json();
      if (data.display_name) {
        const addressName = data.display_name.split(",")[0];
        onChange({
          address: addressName,
          lat: formattedLat,
          lng: formattedLng,
        });
        setSearchQuery(addressName);
      }
    } catch {
      // Fallback already assigned
    }
  };

  const lat = value.lat ?? 30.0444; // Default Cairo
  const lng = value.lng ?? 31.2357;

  return (
    <div className="space-y-4">
      {/* Location Search Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-primary" /> Venue Name / Location *
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary gap-1"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
          >
            {isLocating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
            Use My Location
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
            <Search className="w-4 h-4" />
          </div>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type venue name or search location (e.g. Cairo International Center)..."
            className="pl-9 pr-9"
          />
          {isSearching && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}

          {/* Autocomplete Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
              <div className="max-h-[260px] overflow-y-auto overscroll-contain flex flex-col divide-y divide-border">
                {searchResults.map((result) => (
                  <button
                    key={result.place_id}
                    type="button"
                    onClick={() => handleSelectResult(result)}
                    className="w-full text-left p-3 text-sm hover:bg-accent transition-colors flex items-start gap-2.5 shrink-0"
                  >
                    <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${result.isCustom ? 'text-green-500' : 'text-primary'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{result.display_name.split(",")[0]}</p>
                        {result.isCustom && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 bg-green-500/10 text-green-600 border-green-200">Recommended</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{result.display_name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preset Popular Venue Pills */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Popular Venues</span>
        <div className="flex flex-wrap gap-1.5">
          {EGYPT_PRESETS.map((preset) => (
            <Badge
              key={preset.name}
              variant="outline"
              className={`cursor-pointer transition-all hover:bg-primary/10 ${
                value.address === preset.name ? "bg-primary/15 border-primary text-primary" : "bg-muted/40"
              }`}
              onClick={() => handleSelectPreset(preset)}
            >
              {value.address === preset.name && <Check className="w-3 h-3 mr-1" />}
              {preset.name.split(",")[0]}
            </Badge>
          ))}
        </div>
      </div>

      {/* Interactive Map with Geofence Circle & Auto-Extracted Coordinates Display */}
      <div className="border border-border rounded-2xl overflow-hidden bg-muted/20">
        <div className="p-2 bg-primary/10 border-b border-border text-[11px] font-semibold text-primary flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            💡 Tip: Click anywhere on the map to set event location pin
          </span>
          <span className="text-[10px] text-muted-foreground">Zoom & Drag enabled</span>
        </div>
        <div className="h-56 w-full relative">
          <GeofenceMap
            lat={lat}
            lng={lng}
            radiusMeters={radiusMeters}
            venueName={value.address || "Venue Location"}
            className="h-56 w-full"
            onMapClick={handleMapClick}
          />
        </div>

        {/* Latitude and Longitude Fields */}
        <div className="p-3 bg-card border-t border-border grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Extracted Latitude</Label>
            <Input
              type="number"
              step="any"
              value={value.lat !== null && value.lat !== undefined ? value.lat : ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  lat: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
              placeholder="e.g. 30.0718"
              className="h-8 text-xs font-mono"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Extracted Longitude</Label>
            <Input
              type="number"
              step="any"
              value={value.lng !== null && value.lng !== undefined ? value.lng : ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  lng: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
              placeholder="e.g. 31.3175"
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
