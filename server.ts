import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { TripInputs, TripPlan } from "./src/types";

// Load environment variables for local dev if any
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Server-side initialization of Gemini using the AI Studio developer API key.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});


// Adaptive Model Management
const MODEL_HIERARCHY = [
  "gemini-3.1-flash-lite", 
  "gemini-1.5-flash",
  "gemini-flash-latest"
];
let preferredModelIndex = 0; 

// Helper to repair truncated JSON
const repairTruncatedJson = (json: string): string => {
  let str = json.trim();
  let inString = false;
  let escaped = false;
  let cleanStr = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (inString) {
      if (char === '"' && !escaped) inString = false;
      else if (char === '\\' && !escaped) escaped = true;
      else escaped = false;
    } else {
      if (char === '"') inString = true;
    }
    cleanStr += char;
  }
  if (inString) cleanStr += '"';
  cleanStr = cleanStr.replace(/[:,\s]+$/, '');
  const stack: string[] = [];
  for (let i = 0; i < cleanStr.length; i++) {
    const char = cleanStr[i];
    if (char === '"') {
      let j = i + 1;
      while (j < cleanStr.length && (cleanStr[j] !== '"' || cleanStr[j-1] === '\\')) j++;
      i = j;
      continue;
    }
    if (char === '{' || char === '[') stack.push(char);
    else if (char === '}') stack.pop();
    else if (char === ']') stack.pop();
  }
  while (stack.length > 0) {
    const last = stack.pop();
    if (last === '{') cleanStr += '}';
    else if (last === '[') cleanStr += ']';
  }
  return cleanStr;
};

const robustParse = (text: string): any => {
  let cleanText = text.trim();
  if (cleanText.startsWith('```')) {
    const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) cleanText = match[1].trim();
    else cleanText = cleanText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    try {
      const repaired = repairTruncatedJson(cleanText);
      return JSON.parse(repaired);
    } catch (innerE) {
      throw e;
    }
  }
};

const timeToMins = (time: string): number => {
  if (!time || time === "N/A") return -1;
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return -1;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3]?.toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h * 60 + m;
};

const minsToTime = (mins: number): string => {
  if (mins < 0) return "N/A";
  let h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const durationToMins = (dur: string): number => {
  if (!dur || dur === "N/A" || dur === "0") return 0;
  const hMatch = dur.match(/(\d+)\s*h/i);
  const mMatch = dur.match(/(\d+)\s*m/i);
  const pureMinsMatch = dur.match(/^(\d+)$/);
  if (pureMinsMatch) return parseInt(pureMinsMatch[1]);
  return (parseInt(hMatch?.[1] || "0") * 60) + parseInt(mMatch?.[1] || "0");
};

const formatMinsToHoursAndMins = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`.trim() || '0m';
};

const parseOperationRange = (range: string): { start: number, end: number } | null => {
  if (!range || range === "N/A" || range === "24/7" || range.toLowerCase().includes("24 hours")) return { start: 0, end: 1439 };
  const times = range.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/gi);
  if (times && times.length >= 2) {
    const start = timeToMins(times[0]);
    const end = timeToMins(times[1]);
    if (start !== -1 && end !== -1) return { start, end: end < start ? end + 1440 : end };
  }
  return null;
};

const calculateDistanceMiles = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3958.8; // Radius of Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1.3; // 1.3x multiplier for road winding
};

const aggressiveClean = (loc: string) => {
  if (!loc) return "";
  let cleaned = loc.trim();
  let prev;
  do {
    prev = cleaned;
    const travelMatch = cleaned.match(/^Travel from:.*?\bto\b:?\s+(.*)$/i);
    if (travelMatch) cleaned = travelMatch[1].trim();
    cleaned = cleaned.replace(/^Travel from:?\s*/i, "").trim();
  } while (cleaned !== prev);
  return cleaned.replace(/^(Drive to|Travel to|Fly to|Arrive at|Stay at|Visit|Explore|Action Required:?)\s+/i, "").trim();
};

// --- Multi-Engine Architecture Components ---

const locationResearchSchema = {
  type: Type.OBJECT,
  properties: {
    locations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          location: { type: Type.STRING },
          operationHours: { type: Type.STRING },
          averageExplorationTimeMins: { type: Type.INTEGER },
          fees: { type: Type.STRING },
          suggestedSpots: { type: Type.STRING },
          gpsCoordinates: {
            type: Type.OBJECT,
            properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } },
            required: ["lat", "lng"]
          },
          officialSite: { type: Type.STRING }
        },
        required: ["location", "operationHours", "averageExplorationTimeMins", "gpsCoordinates"]
      }
    }
  },
  required: ["locations"]
};

async function runResearchEngine(places: { location: string }[], modelName: string) {
  console.log(`[Research Engine] Gathering data for ${places.length} locations using ${modelName}...`);
  const researchPrompt = `
    Research the following locations and provide factual data for travel planning:
    ${places.map(p => `- ${p.location}`).join('\n')}

    For each location, provide:
    1. 'operationHours': Standard opening hours in 12-hour AM/PM format (e.g., 9:00 AM - 5:00 PM).
    2. 'averageExplorationTimeMins': The average number of minutes a typical tourist spends here (integer).
    3. 'fees': Brief description of entry fees or "Free".
    4. 'suggestedSpots': 2-3 highlights or trails.
    5. 'gpsCoordinates': Precise latitude and longitude.
    6. 'officialSite': URL to official website.

    IMPORTANT: Use real-world data. If specific hours are unavailable, provide a realistic estimate. Assume 'City Center' coordinates if a specific address is missing.
  `;
  const response = await ai.models.generateContent({
    model: modelName,
    contents: [{ role: "user", parts: [{ text: researchPrompt }] }],
    config: { responseMimeType: "application/json", responseSchema: locationResearchSchema as any, temperature: 0.1 },
  });
  return robustParse(response.text || "{}");
}

const routeOptimizationSchema = {
  type: Type.OBJECT,
  properties: {
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayNumber: { type: Type.INTEGER },
          sequence: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                location: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["visit", "overnight"] },
                estimatedTravelTimeMins: { type: Type.INTEGER }
              },
              required: ["location", "type", "estimatedTravelTimeMins"]
            }
          }
        },
        required: ["dayNumber", "sequence"]
      }
    }
  },
  required: ["days"]
};

async function runRouteEngine(inputs: TripInputs, researchData: any, diffDays: number, modelName: string) {
  console.log(`[Route Engine] Optimizing sequence for ${diffDays} days using ${modelName}...`);
  const routePrompt = `
    Optimize a ${diffDays}-day trip sequence starting from ${inputs.startPoint} and ending at ${inputs.tripType === 'round-trip' ? inputs.startPoint : (inputs.endPoint || inputs.startPoint)}.
    
    LOCATIONS TO VISIT (MUST INCLUDE ALL): ${JSON.stringify(researchData.locations.filter((l: any) => !l.location.toLowerCase().includes('overnight')).map((l: any) => l.location))}
    
    USER CONSTRAINTS:
    - Trip Type: ${inputs.tripType}
    - Preferred Overnights: ${JSON.stringify(inputs.preferredOvernights)}
    - Active Window: ${inputs.dailyStartTime} to ${inputs.dailyEndTime}
    
    INSTRUCTIONS (PO REQUIREMENTS):
    1. Organize into an efficient geographic sequence. You MUST include EVERY location requested by the user. Do not arbitrarily skip places.
    2. LATE START EXCEPTION: If the trip starts late in the day (e.g., after 5 PM), dedicate Day 1 PURELY to travel to the first 'overnight' location. DO NOT schedule 'visit' stops on a late-start day.
    3. START/END POINTS: DO NOT include the Start Point or End Point as 'visit' stops unless explicitly requested.
    4. MAXIMIZE DAY UTILIZATION: Fill the user's active window. Do not schedule an 'overnight' stop early in the afternoon if there are still locations to visit.
    5. ONLY provide 'visit' and 'overnight' stops. Do NOT include 'travel' stops.
    6. For every stop, provide an 'estimatedTravelTimeMins' from the previous stop.
    7. Each day MUST end with an 'overnight' stop, EXCEPT the final day if it returns to the start point.
  `;
  const response = await ai.models.generateContent({
    model: modelName,
    contents: [{ role: "user", parts: [{ text: routePrompt }] }],
    config: { responseMimeType: "application/json", responseSchema: routeOptimizationSchema as any, temperature: 0.3 },
  });
  return robustParse(response.text || "{}");
}

function runTimeEngine(inputs: TripInputs, routeData: any, researchData: any) {
  console.log("[Time Engine] Processing schedule with deterministic math...");
  const dailyLimitMins = timeToMins(inputs.dailyEndTime || "21:30");
  const paceScale = inputs.preferences.pace === 'relaxed' ? 1.5 : (inputs.preferences.pace === 'fast' ? 0.7 : 1.0);
  const minExplorationMins = 45;
  const itinerary: any[] = [];
  const unreachablePlaces: string[] = [];

  const finalDestinationClean = aggressiveClean(inputs.tripType === 'round-trip' ? inputs.startPoint : (inputs.endPoint || inputs.startPoint)).toLowerCase();

  // Add Start Point to research data if missing
  const startLocData = researchData.locations.find((l: any) => 
    aggressiveClean(l.location).toLowerCase() === aggressiveClean(inputs.startPoint).toLowerCase()
  ) || {
    location: inputs.startPoint,
    gpsCoordinates: researchData.locations[0]?.gpsCoordinates || { lat: 0, lng: 0 }
  };

  let lastLocData = startLocData;

  routeData.days.forEach((dayData: any) => {
    let timelineMins = timeToMins(dayData.dayNumber === 1 ? (inputs.startTime || inputs.dailyStartTime) : inputs.dailyStartTime);
    if (timelineMins === -1) timelineMins = 540;
    const dayStops: any[] = [];
    
    dayData.sequence.forEach((item: any) => {
      const currentCleanLoc = aggressiveClean(item.location);
      const isFinalDestination = currentCleanLoc.toLowerCase() === finalDestinationClean;
      
      // Skip redundant stays at the trip's absolute end point
      if (item.type === 'overnight' && isFinalDestination && dayData.dayNumber === routeData.days.length) {
        return;
      }

      // SKIP if the proposed stop is the same as where we already are
      if (currentCleanLoc.toLowerCase() === aggressiveClean(lastLocData.location).toLowerCase() && dayStops.length > 0) {
        return;
      }

      // 1. Find metadata
      const metadata = researchData.locations.find((l: any) => 
        aggressiveClean(l.location).toLowerCase().includes(currentCleanLoc.toLowerCase()) || 
        currentCleanLoc.toLowerCase().includes(aggressiveClean(l.location).toLowerCase())
      ) || { location: item.location, averageExplorationTimeMins: 60, operationHours: "9:00 AM - 9:00 PM", gpsCoordinates: { lat: 0, lng: 0 } };

      // 2. Calculate Travel Time
      let travelMins = item.estimatedTravelTimeMins || 30; // Default estimate
      if (lastLocData.gpsCoordinates && metadata.gpsCoordinates && lastLocData.gpsCoordinates.lat !== 0 && metadata.gpsCoordinates.lat !== 0) {
        const miles = calculateDistanceMiles(lastLocData.gpsCoordinates.lat, lastLocData.gpsCoordinates.lng, metadata.gpsCoordinates.lat, metadata.gpsCoordinates.lng);
        // Use 40mph average for realistic pacing
        travelMins = Math.max(10, Math.round((miles / 40) * 60));
      }

      // 3. Keep track of timeline before travel
      const travelStart = timelineMins;
      
      // 4. Calculate Visit Duration
      const baseDuration = metadata.averageExplorationTimeMins || 60;
      const scaledDuration = item.type === 'overnight' ? 0 : Math.max(minExplorationMins, Math.round(baseDuration * paceScale));

      // 5. Tentative Timing
      const arrivalTime = timelineMins + travelMins;
      const departureTime = arrivalTime + scaledDuration;
      const warnings: string[] = [];

      // 6. Feasibility Check (WARNING LOGIC, NO SPILLOVER)
      if (item.type === 'visit') {
        const opRange = parseOperationRange(metadata.operationHours);
        if (opRange) {
          if (arrivalTime < opRange.start || departureTime > opRange.end) {
            warnings.push(`CLOSED: This location's hours are ${metadata.operationHours}, but you are here from ${minsToTime(arrivalTime)} to ${minsToTime(departureTime)}.`);
          }
        }
        
        if (departureTime > dailyLimitMins) {
          warnings.push(`TIME VIOLATION: This exploration ends at ${minsToTime(departureTime)}, exceeding your ${inputs.dailyEndTime} limit.`);
        }

        if (warnings.length > 0 && !unreachablePlaces.includes(item.location)) {
          unreachablePlaces.push(item.location);
        }
      }

      // 7. Interpolate the travel stop
      timelineMins += travelMins;
      dayStops.push({
        type: 'travel',
        location: `Travel to ${metadata.location}`,
        arrivalTime: minsToTime(timelineMins),
        departureTime: minsToTime(travelStart),
        travelTime: formatMinsToHoursAndMins(travelMins),
        duration: "N/A",
        transportMode: inputs.defaultTransport || 'car'
      });
      
      // 8. Interpolate the actual stop
      dayStops.push({
        type: item.type,
        location: item.location,
        arrivalTime: minsToTime(arrivalTime),
        departureTime: minsToTime(departureTime),
        duration: item.type === 'overnight' ? 'N/A' : formatMinsToHoursAndMins(scaledDuration),
        operationHours: metadata.operationHours,
        fees: metadata.fees,
        suggestedSpots: metadata.suggestedSpots,
        coordinates: metadata.gpsCoordinates,
        officialSite: metadata.officialSite,
        transportMode: inputs.defaultTransport || 'car',
        warnings: warnings.length > 0 ? warnings : undefined
      });

      timelineMins = departureTime;
      lastLocData = metadata;
    });

    itinerary.push({
      dayNumber: dayData.dayNumber,
      date: new Date(new Date(inputs.startDate).getTime() + (dayData.dayNumber - 1) * 86400000).toISOString().split('T')[0],
      stops: dayStops
    });
  });

  return { itinerary, unreachablePlaces };
}

async function runAdvisoryEngine(inputs: TripInputs, processedPlan: any, unreachable: string[], modelName: string) {
  const advisoryPrompt = `Generate summary for this trip: ${JSON.stringify(processedPlan)}. Unreachable: ${unreachable.join(', ')}`;
  const response = await ai.models.generateContent({
    model: modelName,
    contents: [{ role: "user", parts: [{ text: advisoryPrompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          tripName: { type: Type.STRING },
          summary: { type: Type.STRING },
          optimizationSuggestions: { type: Type.STRING },
          preparationInfo: { type: Type.STRING }
        },
        required: ["tripName", "summary", "optimizationSuggestions"]
      } as any,
    },
  });
  return robustParse(response.text || "{}");
}

app.post("/api/generate-trip-plan", async (req, res) => {
  try {
    const inputs: TripInputs = req.body;
    if (!inputs) return res.status(400).json({ error: "Missing trip inputs." });
    
    const diffDays = Math.ceil(Math.abs(new Date(inputs.endDate).getTime() - new Date(inputs.startDate).getTime()) / 86400000) + 1;
    let success = false;
    let attempts = 0;
    let lastError: any = null;
    let responseData: any = null;

    while (!success && attempts < MODEL_HIERARCHY.length) {
      const currentModelIdx = (preferredModelIndex + attempts) % MODEL_HIERARCHY.length;
      const model = MODEL_HIERARCHY[currentModelIdx];
      console.log(`[Orchestrator] Attempting generation with model: ${model} (attempt ${attempts + 1}/${MODEL_HIERARCHY.length})...`);
      
      try {
        // 1. Research Engine: Gather factual data for ALL locations (Visits + Overnights + Flights)
        const researchLocations = [
          ...inputs.placesToVisit,
          ...(inputs.preferredOvernights?.map(o => ({ location: o.location })) || []),
          ...(inputs.flights?.flatMap(f => [{ location: f.departureAirport }, { location: f.arrivalAirport }]) || [])
        ];
        
        // Deduplicate research locations by clean name
        const uniqueLocations = researchLocations.filter((v, i, a) => 
          a.findIndex(t => aggressiveClean(t.location).toLowerCase() === aggressiveClean(v.location).toLowerCase()) === i
        );

        const researchData = await runResearchEngine(uniqueLocations, model);

        // 2. Route Optimization Engine: Plan the sequence
        const routeData = await runRouteEngine(inputs, researchData, diffDays, model);

        // 3. Time Management Engine: Deterministic Waterfall & Limit Enforcement
        const { itinerary, unreachablePlaces } = runTimeEngine(inputs, routeData, researchData);

        // 4. Advisory Engine: Generate narrative and summaries
        const advisory = await runAdvisoryEngine(inputs, { itinerary }, unreachablePlaces, model);

        // Final Pass: Reconstruct Travel Labels for the UI
        itinerary.forEach((day, dayIdx) => {
          day.stops.forEach((stop, stopIdx) => {
            if (stop.type === 'travel') {
              let origin = "";
              if (stopIdx > 0) origin = aggressiveClean(day.stops[stopIdx - 1].location);
              else if (dayIdx > 0) {
                const prevDayStops = itinerary[dayIdx - 1].stops;
                if (prevDayStops.length > 0) origin = aggressiveClean(prevDayStops[prevDayStops.length - 1].location);
              }
              if (!origin) origin = inputs.startPoint;

              const destination = aggressiveClean(stop.location);
              if (origin === destination) stop.location = `Local transit in ${destination}`;
              else stop.location = `Travel from: ${origin} to: ${destination}`;
            }
          });
        });

        responseData = {
          tripName: advisory.tripName || "Optimized Journey",
          summary: advisory.summary,
          routeSequence: routeData.days.flatMap((d: any) => d.sequence.map((s: any) => s.location)),
          itinerary,
          optimizationSuggestions: advisory.optimizationSuggestions,
          preparationInfo: advisory.preparationInfo,
          feasibility: {
            feasible: unreachablePlaces.length === 0,
            score: Math.max(0, 100 - (unreachablePlaces.length * 20)),
            unreachablePlaces,
            reasons: unreachablePlaces.map(p => `Could not fit ${p} within ${inputs.dailyEndTime}.`),
            bottlenecks: []
          }
        };
        success = true;
        preferredModelIndex = currentModelIdx; // Update to the working model
      } catch (err: any) {
        console.warn(`[Orchestrator] Error with model ${model}:`, err.message || err);
        lastError = err;
        attempts++;
      }
    }

    if (success && responseData) {
      return res.json(responseData);
    } else {
      throw lastError || new Error("All models in the hierarchy failed to generate the trip plan.");
    }
  } catch (err: any) {
    console.error("Orchestration Error:", err);
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}
startServer();
