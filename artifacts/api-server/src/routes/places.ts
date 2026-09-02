import { Router, type Request, type Response } from "express";
import { db, customPlacesTable } from "@workspace/db";
import { or, ilike } from "drizzle-orm";

const router = Router();

// GET /places/search
router.get("/places/search", async (req: Request, res: Response) => {
  const query = req.query.q as string;
  const latStr = req.query.lat as string;
  const lngStr = req.query.lng as string;

  if (!query || query.length < 2) {
    res.json([]);
    return;
  }

  try {
    // 1. Search DB for custom places
    const searchPattern = `%${query}%`;
    const dbPromise = db
      .select()
      .from(customPlacesTable)
      .where(
        or(
          ilike(customPlacesTable.name, searchPattern),
          ilike(customPlacesTable.keywords, searchPattern)
        )
      )
      .limit(10);

    // 2. Fetch from External API (LocationIQ with Nominatim fallback)
    const fetchNominatim = async (): Promise<any[]> => {
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=eg&limit=30&addressdetails=1`;
      if (latStr && lngStr) {
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        if (!isNaN(lat) && !isNaN(lng)) {
          const offset = 0.5;
          url += `&viewbox=${lng - offset},${lat + offset},${lng + offset},${lat - offset}`;
        }
      }
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'UsherManagementApp/1.0' }
      });
      if (res.status === 404) return [];
      if (!res.ok) throw new Error(`Nominatim error: ${res.statusText}`);
      return (await res.json()) as any[];
    };

    const locationIqKey = process.env.LOCATIONIQ_API_KEY;
    let externalPromise: Promise<any[]>;

    if (locationIqKey) {
      let locationIqUrl = `https://api.locationiq.com/v1/autocomplete?key=${locationIqKey}&q=${encodeURIComponent(query)}&countrycodes=eg&limit=30&format=json`;
      if (latStr && lngStr) {
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        if (!isNaN(lat) && !isNaN(lng)) {
          const offset = 0.5;
          locationIqUrl += `&viewbox=${lng - offset},${lat + offset},${lng + offset},${lat - offset}`;
        }
      }

      externalPromise = fetch(locationIqUrl, {
        headers: { 'Accept': 'application/json' }
      }).then(async res => {
        if (res.status === 404) return [];
        if (!res.ok) throw new Error(`LocationIQ error: ${res.statusText}`);
        return (await res.json()) as any[];
      }).catch(err => {
        console.error("LocationIQ search failed, falling back to Nominatim:", err);
        return fetchNominatim();
      });
    } else {
      externalPromise = fetchNominatim();
    }

    // Run both concurrently
    const [dbResult, externalResult] = await Promise.allSettled([dbPromise, externalPromise]);

    let customPlaces: any[] = [];
    if (dbResult.status === 'fulfilled') {
      customPlaces = dbResult.value.map(place => ({
        place_id: `custom-${place.id}`,
        display_name: place.name + (place.category ? ` (${place.category})` : ''),
        lat: place.lat.toString(),
        lon: place.lng.toString(),
        isCustom: true
      }));
    } else {
      console.error("DB custom places search error:", dbResult.reason);
    }

    let externalPlaces: any[] = [];
    if (externalResult.status === 'fulfilled') {
      externalPlaces = externalResult.value;
    } else {
      console.error("External search error:", externalResult.reason);
    }

    // Merge and deduplicate
    const merged = [...customPlaces];
    
    for (const extPlace of externalPlaces) {
      const extLat = parseFloat(extPlace.lat);
      const extLon = parseFloat(extPlace.lon);
      
      // Check if duplicate of any custom place (distance < ~100m)
      const isDuplicate = customPlaces.some(cp => {
        const cpLat = parseFloat(cp.lat);
        const cpLon = parseFloat(cp.lon);
        // Quick pythagorean approx for small distances
        const dist = Math.sqrt(Math.pow(cpLat - extLat, 2) + Math.pow(cpLon - extLon, 2));
        return dist < 0.001; // Roughly 100 meters
      });

      if (!isDuplicate) {
        merged.push({
          place_id: extPlace.place_id || `ext-${Math.random()}`,
          display_name: extPlace.display_name,
          lat: extPlace.lat,
          lon: extPlace.lon,
          isCustom: false
        });
      }
    }

    // Sort by relevance to query
    const qLower = query.toLowerCase().trim();
    merged.sort((a, b) => {
      const getScore = (name: string, isCustom: boolean) => {
        let score = 0;
        const lowerName = name.toLowerCase();
        const mainName = lowerName.split(',')[0].trim();
        
        if (mainName === qLower) score += 100;
        else if (mainName.startsWith(qLower)) score += 80;
        else if (mainName.includes(qLower)) score += 60;
        else if (lowerName.includes(qLower)) score += 30;
        
        if (isCustom) score += 20;
        return score;
      };
      
      const scoreA = getScore(a.display_name, a.isCustom);
      const scoreB = getScore(b.display_name, b.isCustom);
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      return a.display_name.localeCompare(b.display_name);
    });

    res.json(merged);
  } catch (error) {
    console.error("Places search error:", error);
    res.status(500).json({ error: "Internal server error during search" });
  }
});

export default router;
