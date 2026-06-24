import { TripPlan, TripStop, TransportOption, OptimizationOption, TripInputs } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { 
  MapPin, 
  Clock, 
  DollarSign, 
  Info, 
  Asterisk,
  ChevronRight, 
  Plane, 
  Car, 
  Bike, 
  Footprints,
  ExternalLink,
  Moon,
  Camera,
  Download,
  Table as TableIcon,
  LayoutList,
  Map as MapIcon,
  Globe,
  Settings2,
  Check,
  X,
  GripVertical,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Printer,
  Navigation,
  AlignLeft,
  CheckSquare,
  Eye,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import React, { useState, useMemo, useEffect } from 'react';
import { clsx } from 'clsx';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow,
  useAdvancedMarkerRef,
  useMap
} from '@vis.gl/react-google-maps';

import { 
  formatGPSToDMSString, 
  formatDayOfWeek, 
  formatDateOnly, 
  formatTime, 
  parseDurationToMins, 
  formatArrival, 
  formatDeparture, 
  formatTimeRange,
  parseTimeToMinutes, 
  formatMinsToHoursAndMins,
  isTomorrow
} from '../utils/itinerary';

function Polyline({ 
  path, 
  strokeColor = '#6366f1', 
  strokeOpacity = 1.0, 
  strokeWeight = 3 
}: { 
  path: google.maps.LatLngLiteral[], 
  strokeColor?: string, 
  strokeOpacity?: number, 
  strokeWeight?: number 
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor,
      strokeOpacity,
      strokeWeight,
    });

    polyline.setMap(map);

    // Fit bounds to show the whole route
    if (path.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      path.forEach(coord => bounds.extend(coord));
      map.fitBounds(bounds, 50); // 50px padding
    }

    return () => {
      polyline.setMap(null);
    };
  }, [map, path, strokeColor, strokeOpacity, strokeWeight]);

  return null;
}

interface Props {
  plan: TripPlan;
  onApplyOptimizations?: (selectedIds: string[], selectedAlternatives: Record<string, string>) => void;
  onRetry?: () => void;
  isLoading?: boolean;
  loadingTitle?: string;
  loadingStep?: number;
  loadingSteps?: string[];
  startPoint?: string;
  inputs?: TripInputs;
}

type ViewMode = 'timeline' | 'table' | 'map';
type StopWithMeta = TripStop & { dayNumber: number; stopKey: string; date: string; prevOvernight?: string };

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export default function ItineraryDisplay({ 
  plan, 
  onApplyOptimizations,
  onRetry,
  isLoading = false,
  loadingTitle = "",
  loadingStep = 0,
  loadingSteps = [],
  startPoint,
  inputs
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [selectedMarker, setSelectedMarker] = useState<StopWithMeta | null>(null);
  const [tableDensity, setTableDensity] = useState<'compact' | 'normal' | 'spacious'>('normal');
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOptimizations, setSelectedOptimizations] = useState<Set<string>>(new Set());
  const [selectedAlternatives, setSelectedAlternatives] = useState<Record<string, string>>({});
  const [showOptimizations, setShowOptimizations] = useState(true);
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'travel' | 'stay' | 'explore'>('all');
  const [skippedStops, setSkippedStops] = useState<Record<string, boolean>>({});
  const [acceptedViolations, setAcceptedViolations] = useState<Record<number, boolean>>({});

  const baseItinerary = useMemo(() => {
    if (!plan.itinerary) return [] as StopWithMeta[];
    let lastOvernight = "";
    return [...plan.itinerary]
      .filter(Boolean)
      .sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0))
      .flatMap(day => 
        (day.stops?.filter(Boolean) || []).map((stop, stopIdx) => {
          const stopWithMeta = { 
            ...stop, 
            dayNumber: day.dayNumber, 
            date: day.date,
            prevOvernight: lastOvernight,
            stopKey: `${day.dayNumber}-${stopIdx}-${stop.location || 'unknown'}`
          };
          if (stop.type === 'overnight') {
            lastOvernight = stop.location;
          }
          return stopWithMeta;
        })
      ) || [];
  }, [plan.itinerary]);

  const allStops = useMemo(() => {
    return baseItinerary.filter(s => s && s.coordinates && typeof s.coordinates.lat === 'number' && typeof s.coordinates.lng === 'number');
  }, [baseItinerary]);

  const stopToMapLabel = useMemo(() => {
    const map: Record<string, string> = {};
    let letterCounter = 0;
    let numberCounter = 1;

    // Filter out stops that don't get a label (travel, action) to identify first/last
    const validStops = baseItinerary.filter(s => s.type === 'visit' || s.type === 'overnight');
    
    baseItinerary.forEach((stop) => {
      if (stop.type !== 'visit' && stop.type !== 'overnight') {
        map[stop.stopKey] = "";
        return;
      }

      const isFirst = stop === validStops[0];
      const isLast = stop === validStops[validStops.length - 1];
      const isStay = stop.type === 'overnight';

      if (isFirst || isLast || isStay) {
        // Use letters for arrival, departure, and stays
        let label = "";
        let n = letterCounter;
        while (n >= 0) {
          label = String.fromCharCode(65 + (n % 26)) + label;
          n = Math.floor(n / 26) - 1;
        }
        map[stop.stopKey] = label;
        letterCounter++;
      } else {
        // Use numbers for other visits
        map[stop.stopKey] = (numberCounter++).toString();
      }
    });
    return map;
  }, [baseItinerary]);

  const routePath = useMemo(() => {
    return allStops.map(s => s.coordinates!);
  }, [allStops]);

  useEffect(() => {
    setShowOptimizations(true);
  }, [plan]);

  const toggleOptimization = (id: string) => {
    const next = new Set(selectedOptimizations);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOptimizations(next);
  };

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    dayNumber: true,
    dayName: true,
    date: true,
    mapSpot: true,
    location: true,
    type: true,
    transportation: true,
    departure: true,
    arrival: true,
    tripDuration: true,
    explorationTime: true,
    fees: true,
    hours: true,
    suggestedSpots: true,
    gps: true,
    importantInfo: true,
    officialSite: true,
    parkingInfo: true,
    additionalInfo: true,
  });

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    dayNumber: 60,
    dayName: 70,
    date: 90,
    mapSpot: 80,
    location: 200,
    type: 100,
    transportation: 120,
    departure: 100,
    arrival: 100,
    tripDuration: 120,
    explorationTime: 150,
    fees: 100,
    hours: 120,
    suggestedSpots: 250,
    gps: 150,
    importantInfo: 250,
    officialSite: 150,
    parkingInfo: 200,
    additionalInfo: 200,
  });

  const columns = [
    { id: 'dayNumber', label: 'Day #' },
    { id: 'dayName', label: 'Day' },
    { id: 'date', label: 'Date' },
    { id: 'mapSpot', label: 'MAP SPOT' },
    { id: 'location', label: 'DESTINATION' },
    { id: 'type', label: 'Type' },
    { id: 'transportation', label: 'Transportation' },
    { id: 'arrival', label: 'START' },
    { id: 'departure', label: 'FINISH' },
    { id: 'tripDuration', label: 'Trip Duration' },
    { id: 'explorationTime', label: 'Suggested Exploration Time' },
    { id: 'fees', label: 'Fees' },
    { id: 'hours', label: 'Hours' },
    { id: 'suggestedSpots', label: 'Suggested Spots' },
    { id: 'gps', label: 'GPS Coordinates' },
    { id: 'importantInfo', label: 'Important Info' },
    { id: 'officialSite', label: 'Official Site' },
    { id: 'parkingInfo', label: 'Parking Suggestion' },
    { id: 'additionalInfo', label: 'Additional Info' },
  ];

  const handleResize = (columnId: string, startX: number, startWidth: number) => {
    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(1, startWidth + (e.clientX - startX));
      setColumnWidths(prev => ({ ...prev, [columnId]: newWidth }));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const flatItinerary = useMemo(() => {
    // Apply filters
    let filtered = baseItinerary.filter(stop => {
      return Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        const stopValue = String((stop as any)[key] || '').toLowerCase();
        return stopValue.includes((value as string).toLowerCase());
      });
    });

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(stop => {
        if (typeFilter === 'travel') return stop.type === 'travel';
        if (typeFilter === 'stay') return stop.type === 'overnight';
        if (typeFilter === 'explore') return stop.type === 'visit' || stop.type === 'ACTION';
        return true;
      });
    }

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aVal = (a as any)[sortConfig.key];
        const bVal = (b as any)[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [baseItinerary, sortConfig, filters, typeFilter]);

  const totals = useMemo(() => {
    let totalMins = 0;
    let totalCost = 0;
    let totalFees = 0;

    plan.itinerary?.forEach(day => {
      day.stops?.filter(Boolean).forEach((stop, stopIdx) => {
        const originalIdx = (day.stops || []).findIndex(item => item === stop);
        const stopKey = `${day.dayNumber}-${originalIdx}-${stop.location || 'unknown'}`;
        if (!skippedStops[stopKey]) {
          // Parse travel time
          if (stop.travelTime) {
            totalMins += parseDurationToMins(stop.travelTime);
          }
          // Parse cost
          if (stop.cost) {
            const costMatch = stop.cost.replace(/[^0-9.]/g, '');
            totalCost += parseFloat(costMatch) || 0;
          }
          // Parse fees
          if (stop.fees) {
            const feeMatch = stop.fees.replace(/[^0-9.]/g, '');
            const feeVal = parseFloat(feeMatch);
            if (!isNaN(feeVal)) totalFees += feeVal;
          }
        }
      });
    });

    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    const travelTimeStr = `${h}h ${m}m`;

    return {
      travelTime: travelTimeStr,
      cost: totalCost > 0 ? `$${totalCost.toLocaleString()}` : plan.totalCost,
      fees: totalFees > 0 ? `$${totalFees.toLocaleString()}` : null
    };
  }, [plan]);

  const getDailyLimits = () => {
    const startTimeStr = inputs?.dailyStartTime || "09:30";
    const endTimeStr = inputs?.dailyEndTime || "21:30";
    const startMins = parseTimeToMinutes(startTimeStr);
    const endMins = parseTimeToMinutes(endTimeStr);
    let allowedMins = endMins - startMins;
    if (allowedMins < 0) {
      allowedMins += 24 * 60; // Crossing midnight
    }
    return { startTimeStr, endTimeStr, allowedMins };
  };

  const getDayTiming = (day: any) => {
    let travelMins = 0;
    let exploreMins = 0;

    day.stops?.filter(Boolean).forEach((s: any, idx: number) => {
      const originalIdx = (day.stops || []).findIndex(item => item === s);
      const stopKey = `${day.dayNumber}-${originalIdx}-${s.location || 'unknown'}`;
      if (!skippedStops[stopKey]) {
        if (s.travelTime) {
          travelMins += parseDurationToMins(s.travelTime);
        }
        if (s.type === 'visit' && s.duration) {
          exploreMins += parseDurationToMins(s.duration);
        }
      }
    });

    return { travelMins, exploreMins };
  };

  const getTransportVerb = (mode?: string) => {
    if (!mode) return "driving";
    switch(mode) {
      case 'car': return 'driving';
      case 'hike': return 'walking';
      case 'bike': return 'cycling';
      case 'air': return 'flying';
      default: return 'traveling';
    }
  };

  const aggressiveClean = (loc: string) => {
    if (!loc) return "";
    let cleaned = loc.trim();
    
    // Recursive stripping of "Travel from: ... to: "
    // Use word-boundary \bto\b to avoid splitting "Historic"
    let prev;
    do {
      prev = cleaned;
      const travelMatch = cleaned.match(/^Travel from:.*?\bto\b:?\s+(.*)$/i);
      if (travelMatch) {
        cleaned = travelMatch[1].trim();
      }
      cleaned = cleaned.replace(/^Travel from:?\s*/i, "").trim();
    } while (cleaned !== prev);

    cleaned = cleaned
      .replace(/^(Drive to|Travel to|Fly to|Arrive at|Stay at|Visit|Explore|Action Required:?)\s+/i, "")
      .trim();
      
    return cleaned;
  };

  const formatDestination = (stop: any) => {
    if (stop.type === 'travel') {
      const day = plan.itinerary?.find(d => d.dayNumber === stop.dayNumber);
      if (day && day.stops) {
        const stopIdx = day.stops.findIndex((s: any) => s && s.location === stop.location && s.arrivalTime === stop.arrivalTime);
        if (stopIdx !== -1) {
          const fromTo = getTravelFromTo(day, stop, stopIdx, plan.itinerary || []);
          return `Travel from ${fromTo.from} to ${fromTo.to}`;
        }
      }
      const verb = getTransportVerb(stop.transportMode);
      let cleanLoc = aggressiveClean(stop.location || '');
      return `Travel to ${cleanLoc} (${verb})`;
    }
    return aggressiveClean(stop.location);
  };

  const getTravelFromTo = (day: any, stop: any, stopIdx: number, itinerary: any[]) => {
    let from = startPoint || "Start";
    let to = stop.location || "Destination";

    // Check if the backend already formatted this as "Travel from: A to: B"
    const match = to.match(/^Travel from:?\s*(.*?)\s*\bto\b:?\s*(.*)$/i);
    if (match) {
      from = aggressiveClean(match[1]);
      to = aggressiveClean(match[2]);
    } else {
      to = aggressiveClean(to);

      if (stopIdx > 0) {
        const prevStop = day.stops[stopIdx - 1];
        if (prevStop) {
          from = prevStop.location || startPoint || "Start";
        }
      } else {
        const prevDay = itinerary?.find(d => d.dayNumber === day.dayNumber - 1);
        if (prevDay && prevDay.stops && prevDay.stops.length > 0) {
          const lastStop = prevDay.stops[prevDay.stops.length - 1];
          if (lastStop) {
            from = lastStop.location || "Previous Location";
          }
        }
      }

      from = aggressiveClean(from);

      if (from === "Start" && startPoint) {
        from = startPoint;
      }
    }

    return { from, to };
  };

  const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={i} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-emerald-600 hover:underline break-all"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const transportIcons = {
    air: <Plane className="w-4 h-4" />,
    car: <Car className="w-4 h-4" />,
    bike: <Bike className="w-4 h-4" />,
    hike: <Footprints className="w-4 h-4" />,
  };

  const downloadCSV = () => {
    const headers = ['Day', 'Day of Week', 'Date', 'Map Spot', 'Location', 'Type', 'Transportation', 'Arrival', 'Trip Duration', 'Suggested Exploration Time', 'Fees', 'Hours', 'Suggested Spots', 'GPS Coordinates', 'Important Info', 'Official Site', 'Additional Info'];
    const rows = plan.itinerary?.filter(Boolean).flatMap(day => 
      (day.stops?.filter(Boolean) || []).map((stop, stopIdx) => {
        const stopKey = `${day.dayNumber}-${stopIdx}-${stop.location || 'unknown'}`;
        const mapLabel = stopToMapLabel[stopKey] || '';
        return [
          day.dayNumber,
          formatDayOfWeek(day.date),
          formatDateOnly(day.date),
          mapLabel,
          `"${(formatDestination({ ...stop, dayNumber: day.dayNumber }) || '').replace(/"/g, '""')}"`,
          stop.type,
          stop.type === 'overnight' ? 'Stay' : (stop.type === 'ACTION' ? '' : (stop.type === 'visit' ? 'Hike' : (stop.transportMode || 'Hike'))),
          formatArrival(stop.arrivalTime || ''),
          formatTime(stop.travelTime || ''),
          stop.type === 'visit' ? (stop.duration || '') : '',
          `"${stop.fees && stop.fees !== 'N/A' && stop.fees !== '--' ? stop.fees.replace(/"/g, '""') : ''}"`,
          `"${stop.operationHours && stop.operationHours !== 'N/A' && stop.operationHours !== '--' ? stop.operationHours.replace(/"/g, '""') : ''}"`,
          `"${stop.suggestedSpots?.replace(/"/g, '""') || ''}"`,
          `"${formatGPSToDMSString(stop.gpsCoordinates, stop.coordinates)}"`,
          `"${stop.importantInfo?.replace(/"/g, '""') || ''}"`,
          stop.officialSite || '',
          `"${[...(stop.suggestions || []), ...(stop.warnings || []), stop.notes].filter(Boolean).join('; ').replace(/"/g, '""')}"`
        ];
      })
    ) || [];

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `trip_itinerary_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const StopIcon = ({ type }: { type: TripStop['type'] }) => {
    switch (type) {
      case 'overnight': return <Moon className="w-5 h-5 text-indigo-600" />;
      case 'visit': return <Camera className="w-5 h-5 text-emerald-600" />;
      case 'travel': return <NavigationIcon />;
      case 'ACTION': return <AlertCircle className="w-5 h-5 text-red-600 animate-pulse" />;
      default: return <MapPin className="w-5 h-5 text-slate-700" />;
    }
  };

  const NavigationIcon = () => (
    <div className="w-5 h-5 flex items-center justify-center">
      <div className="w-1 h-1 bg-slate-600 rounded-full" />
    </div>
  );

  const SummarySection = () => (
    <div className="card bg-white border-slate-200 p-6 md:p-8 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
        <AlignLeft className="w-4 h-4 text-slate-400" /> Summary
      </h3>
      <div className="text-slate-800 leading-relaxed font-normal text-sm prose prose-sm max-w-none prose-slate">
        <Markdown>{plan.summary}</Markdown>
      </div>
    </div>
  );

  const PreparationSection = () => plan.preparationInfo ? (
    <div className="card bg-white border-slate-200 p-6 md:p-8 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-blue-600/90 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-500" /> Preparation Tips
      </h3>
      <div className="text-slate-800 leading-relaxed font-normal text-sm prose prose-sm max-w-none prose-slate">
        <Markdown>{plan.preparationInfo}</Markdown>
      </div>
    </div>
  ) : null;

  const FeasibilitySection = () => (
    <div className="card bg-white border-slate-200 p-6 md:p-8 space-y-6">
      <h3 className="text-xs font-bold uppercase tracking-widest text-amber-600/90 flex items-center gap-2">
        <CheckSquare className="w-4 h-4 text-amber-500" /> Suggestions on Optimization & Feasibility
      </h3>

      {plan.feasibility && (
        <div className={clsx(
          "p-5 rounded-xl border flex flex-col gap-4 shadow-sm",
          plan.feasibility.feasible 
            ? "bg-emerald-50/50 border-emerald-100" 
            : plan.feasibility.score >= 70 
              ? "bg-amber-50/40 border-amber-100" 
              : "bg-rose-50/40 border-rose-100"
        )}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-100">
            <div className="flex items-center gap-3">
              <div className={clsx(
                "w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-lg shadow-sm border",
                plan.feasibility.feasible 
                  ? "bg-emerald-100 border-emerald-200 text-emerald-800" 
                  : plan.feasibility.score >= 70
                    ? "bg-amber-100 border-amber-200 text-amber-800"
                    : "bg-rose-100 border-rose-200 text-rose-800"
              )}>
                {plan.feasibility.score}%
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 tracking-tight text-sm">
                  Route Feasibility Status: {plan.feasibility.feasible ? (
                    <span className="text-emerald-700 font-semibold">Fully Feasible</span>
                  ) : (
                    <span className="text-amber-700 font-semibold">Logistical Adjustments Recommended</span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 font-medium">Derived from travel window, driving limits, and coordinates</p>
              </div>
            </div>
          </div>

          {plan.feasibility.reasons && plan.feasibility.reasons.length > 0 && (
            <div className="text-xs text-slate-700 leading-relaxed font-medium space-y-1">
              <p className="font-bold text-slate-900 mb-1 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <Info className="w-3.5 h-3.5 text-slate-500" /> Feasibility Overview & Optimization Strategies
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {plan.feasibility.reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {((plan.feasibility.bottlenecks && plan.feasibility.bottlenecks.length > 0) || 
            (plan.feasibility.unreachablePlaces && plan.feasibility.unreachablePlaces.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
              {plan.feasibility.bottlenecks && plan.feasibility.bottlenecks.length > 0 && (
                <div className="p-4 bg-amber-50/70 border border-amber-100 rounded-lg space-y-2">
                  <p className="text-[10px] font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4 text-amber-600" /> Detected Constraints / Bottlenecks:
                  </p>
                  <ul className="text-xs text-amber-805 list-disc pl-5 space-y-1">
                    {plan.feasibility.bottlenecks.map((bName, idx) => (
                      <li key={idx} className="font-medium text-amber-900">{bName}</li>
                    ))}
                  </ul>
                </div>
              )}

              {plan.feasibility.unreachablePlaces && plan.feasibility.unreachablePlaces.length > 0 && (
                <div className="p-4 bg-rose-50/70 border border-rose-100 rounded-lg space-y-2">
                  <p className="text-[10px] font-bold text-rose-900 flex items-center gap-1.5 uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4 text-rose-600" /> Omitted Locations (Out of Reach):
                  </p>
                  <ul className="text-xs text-rose-805 list-disc pl-5 space-y-1">
                    {plan.feasibility.unreachablePlaces.map((uPlace, idx) => (
                      <li key={idx} className="font-semibold text-rose-900">{uPlace}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {plan.optimizationSuggestions && showOptimizations && (
        <div className="p-5 bg-amber-50/30 border border-amber-100 rounded-xl space-y-4 relative overflow-hidden shadow-sm">
          <button 
            onClick={() => setShowOptimizations(false)}
            className="absolute top-4 right-4 p-1 hover:bg-amber-100 rounded-full transition-colors text-amber-700 z-10"
            title="Dismiss suggestions"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center justify-between pr-8 border-b border-amber-200/50 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-amber-700 flex items-center gap-2">
              <Asterisk className="w-3.5 h-3.5 text-amber-500" /> Optimization Suggestions
            </h4>
            {onApplyOptimizations && plan.optimizations && plan.optimizations.length > 0 && (
              <button
                onClick={() => onApplyOptimizations(Array.from(selectedOptimizations), selectedAlternatives)}
                disabled={selectedOptimizations.size === 0}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-amber-600/15"
              >
                Apply Selected Changes
              </button>
            )}
          </div>
          
          <div className="text-sm text-slate-800 leading-relaxed prose prose-sm max-w-none">
            <Markdown>{plan.optimizationSuggestions}</Markdown>
          </div>

          {plan.optimizations && plan.optimizations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              {plan.optimizations.filter(Boolean).map((opt) => (
                <div 
                  key={opt.id}
                  onClick={() => toggleOptimization(opt.id)}
                  className={clsx(
                    "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all",
                    selectedOptimizations.has(opt.id) 
                      ? "bg-amber-100 border-amber-300" 
                      : "bg-white border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className={clsx(
                    "mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors",
                    selectedOptimizations.has(opt.id) ? "bg-amber-600 border-amber-600" : "border-slate-300 bg-white"
                  )}>
                    {selectedOptimizations.has(opt.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                        opt.type === 'remove' ? "bg-red-100 text-red-700" : 
                        opt.type === 'replace' ? "bg-blue-100 text-blue-700" : 
                        opt.type === 'adjust' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      )}>
                        {opt.type}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {opt.type === 'adjust' ? (
                          opt.parameter === 'dailyTimeLimit' ? 'Daily Travel Limit' : 
                          opt.parameter === 'dailyStartTime' ? 'Daily Start Time' :
                          opt.parameter === 'dailyEndTime' ? 'Daily End Time' :
                          opt.parameter === 'startTime' ? 'Start Time' :
                          opt.parameter === 'endTime' ? 'End Time' :
                          (opt.location || 'Adjustment')
                        ) : opt.location}
                      </span>
                      {(opt.replacement || selectedAlternatives[opt.id] || (opt.type === 'adjust' && opt.newValue)) && (
                        <>
                          <ChevronRight className="w-3 h-3 text-slate-600" />
                          <span className="text-xs font-bold text-emerald-700">
                            {opt.type === 'adjust' ? (
                              opt.parameter === 'dailyTimeLimit' ? `${opt.newValue}h` : opt.newValue
                            ) : (selectedAlternatives[opt.id] || opt.replacement)}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{opt.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="space-y-6 pb-12 print:hidden animate-fade-in">
        {/* Name of the Trip */}
        <div className="card bg-white border-slate-200 p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> {plan.feasibility?.feasible ? 'Feasible Route' : 'Logistics Optimized'}
              </div>
              <h1 className="text-3xl md:text-3xl font-extrabold tracking-tight text-slate-900 mt-2">
                {plan.tripName || "Your Optimized Journey"}
              </h1>
            </div>
            {plan.totalDistance && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 shadow-sm">
                <Navigation className="w-4 h-4 text-emerald-600" />
                <span>Total Distance: <span className="text-slate-900">{plan.totalDistance}</span></span>
              </div>
            )}
          </div>
        </div>

        <SummarySection />
        <PreparationSection />
        <FeasibilitySection />

        {/* View and Save Options Section (Collapsible) */}
        <div className="card bg-white border-slate-200 overflow-hidden">
          <button
            onClick={() => setIsToolbarOpen(!isToolbarOpen)}
            className="w-full px-6 py-4 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50/85 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="p-2 bg-slate-100 rounded-xl text-slate-700">
                <Eye className="w-4 h-4 text-slate-500" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-800">View & Save Options</h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Toggle between layouts or download spreadsheets/PDF</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-slate-400">
              <span className="text-[10px] text-emerald-800 font-extrabold tracking-widest bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg shadow-sm">
                {viewMode === 'timeline' ? 'LIST TIMELINE' : viewMode === 'table' ? 'GRID TABLE' : 'INTERACTIVE MAP'} VIEW
              </span>
              {isToolbarOpen ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-600" />}
            </div>
          </button>

          <AnimatePresence initial={false}>
            {isToolbarOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden bg-white border-t border-slate-100"
              >
                <div className="p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6 w-full xl:w-auto">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Layout View:</span>
                      <div className="flex p-1 bg-slate-100/80 rounded-xl border border-slate-200">
                        <button
                          onClick={() => setViewMode('timeline')}
                          className={clsx(
                            "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
                            viewMode === 'timeline' ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <LayoutList className="w-3.5 h-3.5 text-slate-500" /> List Timeline
                        </button>
                        <button
                          onClick={() => setViewMode('table')}
                          className={clsx(
                            "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
                            viewMode === 'table' ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <TableIcon className="w-3.5 h-3.5 text-slate-500" /> Grid Table
                        </button>
                        <button
                          onClick={() => setViewMode('map')}
                          className={clsx(
                            "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
                            viewMode === 'map' ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <MapIcon className="w-3.5 h-3.5 text-slate-500" /> Interactive Map
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Filter by Type:</span>
                      <div className="flex p-1 bg-slate-100/80 rounded-xl border border-slate-200">
                        {([
                          { key: 'all', label: 'All', icon: LayoutList },
                          { key: 'travel', label: 'Travel', icon: Car },
                          { key: 'stay', label: 'Stay', icon: Moon },
                          { key: 'explore', label: 'Explore', icon: Camera }
                        ] as const).map((t) => {
                          const Icon = t.icon;
                          const active = typeFilter === t.key;
                          return (
                            <button
                              key={t.key}
                              onClick={() => setTypeFilter(t.key)}
                              className={clsx(
                                "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
                                active ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-600 hover:text-slate-900"
                              )}
                            >
                              <Icon className="w-3.5 h-3.5 text-slate-400" /> {t.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full xl:w-auto justify-end">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Export & Save:</span>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={downloadCSV}
                        className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center gap-2 transition-all shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" /> Spreadsheet (CSV)
                      </button>
                      <button
                        onClick={handlePrint}
                        className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex items-center justify-center gap-2 transition-all shadow-sm"
                      >
                        <Printer className="w-3.5 h-3.5" /> PDF / Print
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
  
        {(plan.mapsLinks?.length ?? 0) > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-700 mb-3">Google Maps References</h4>
            <div className="flex flex-wrap gap-3">
              {Array.from(new globalThis.Map<string, { title: string; uri: string }>(
                (plan.mapsLinks || []).map(link => [link.uri, link])
              ).values()).map((link, i) => (
                <a
                  key={i}
                  href={link.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm text-slate-700 transition-colors border border-slate-200"
                >
                  <MapPin className="w-3 h-3" />
                  {link.title}
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
              ))}
            </div>
          </div>
        )}

      <AnimatePresence mode="wait">
        {(!plan.itinerary || plan.itinerary.length === 0) ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card p-12 text-center space-y-4"
          >
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-600">
              <Info className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">No Itinerary Data</h3>
              <p className="text-slate-700 max-w-md mx-auto">
                The AI generated a summary but couldn't create a detailed day-by-day plan. 
                Try being more specific with your locations or dates.
              </p>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                Try Again
              </button>
            )}
          </motion.div>
        ) : viewMode === 'timeline' ? (
          <motion.div
            key="timeline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-16"
          >
            {plan.itinerary?.filter(Boolean).map((day, dayIdx) => (
              <motion.div
                key={`${day.dayNumber}-${dayIdx}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dayIdx * 0.1 }}
                className="relative"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div className="flex items-baseline gap-4">
                    <div className="bg-slate-900 text-white px-4 py-1 rounded-full text-sm font-bold">
                      Day {day.dayNumber}
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800">
                      {day.date ? format(parseISO(day.date), 'EEEE, MMMM do') : 'Date TBD'}
                    </h3>
                  </div>
                  
                  {/* Daily Summary Row */}
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Leave: <span className="text-slate-900">{formatArrival(
                        day.stops?.[0]?.type === 'travel' 
                          ? (day.stops?.[0]?.departureTime || day.stops?.[0]?.arrivalTime || '')
                          : (day.stops?.[0]?.arrivalTime || day.stops?.[0]?.departureTime || '')
                      )}</span></span>
                    </div>
                    <div className="w-px h-3 bg-slate-200" />
                    <div className="flex items-center gap-1.5">
                      <Moon className="w-3 h-3 text-slate-400" />
                      <span>Arrive: <span className="text-slate-900">{formatDeparture(day.stops?.[day.stops.length - 1]?.arrivalTime || day.stops?.[day.stops.length - 1]?.departureTime || '')}</span></span>
                    </div>
                    <div className="w-px h-3 bg-slate-200" />
                    <div className="flex items-center gap-1.5">
                      <Car className="w-3 h-3 text-slate-400" />
                      <span>Travel Time: <span className="text-emerald-600">{(() => {
                        let dailyMins = 0;
                        day.stops?.filter(Boolean).forEach((s: any) => {
                          const originalIdx = (day.stops || []).findIndex((item: any) => item === s);
                          const stopKey = `${day.dayNumber}-${originalIdx}-${s.location || 'unknown'}`;
                          if (!skippedStops[stopKey] && s.travelTime) {
                            dailyMins += parseDurationToMins(s.travelTime);
                          }
                        });
                        return formatTime(`${Math.floor(dailyMins / 60)}h ${dailyMins % 60}m`);
                      })()}</span></span>
                    </div>
                    {day.stops?.some(s => s && s.type === 'visit') && (
                      <>
                        <div className="w-px h-3 bg-slate-200" />
                        <div className="flex items-center gap-1.5">
                          <Camera className="w-3 h-3 text-slate-400" />
                          <span>Exploration Time: <span className="text-emerald-600">{(() => {
                            let dailyMins = 0;
                            day.stops?.filter(Boolean).forEach((s: any) => {
                              const originalIdx = (day.stops || []).findIndex((item: any) => item === s);
                              const stopKey = `${day.dayNumber}-${originalIdx}-${s.location || 'unknown'}`;
                              if (!skippedStops[stopKey] && s.type === 'visit' && s.duration) {
                                dailyMins += parseDurationToMins(s.duration);
                              }
                            });
                            return formatTime(`${Math.floor(dailyMins / 60)}h ${dailyMins % 60}m`);
                          })()}</span></span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Day Time Limit Warning Banner */}
                {(() => {
                  const dayTiming = getDayTiming(day);
                  const totalActiveMins = dayTiming.travelMins + dayTiming.exploreMins;
                  const { startTimeStr, endTimeStr, allowedMins } = getDailyLimits();
                  const isViolated = totalActiveMins > allowedMins;
                  const isAccepted = acceptedViolations[day.dayNumber];

                  if (isViolated) {
                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={clsx(
                          "mb-6 p-4 rounded-xl border font-sans mr-4 ml-6 transition-all",
                          isAccepted 
                            ? "bg-slate-50 border-slate-200 text-slate-700" 
                            : "bg-red-50 border-red-100 text-red-900 shadow-sm"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <AlertCircle className={clsx("w-5 h-5 flex-shrink-0 mt-0.5", isAccepted ? "text-slate-400" : "text-red-500")} />
                          <div className="flex-1 space-y-3">
                            <div>
                              <h4 className="text-sm font-bold flex items-center gap-2">
                                {isAccepted ? (
                                  <>
                                    <span className="text-slate-500 uppercase tracking-wide text-xs">Limit Violation Acknowledged</span>
                                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md text-[10px] uppercase font-bold tracking-wider">Accepted</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-red-800 uppercase tracking-wide text-xs">Desired Active Timeframe Exceeded</span>
                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-md text-[10px] uppercase font-bold tracking-wider animate-pulse">Warning</span>
                                  </>
                                )}
                              </h4>
                              <p className="text-xs mt-1.5 leading-relaxed text-slate-600">
                                Today's active travel ({formatMinsToHoursAndMins(dayTiming.travelMins)}) and exploration ({formatMinsToHoursAndMins(dayTiming.exploreMins)}) totals <strong className="text-slate-800">{formatMinsToHoursAndMins(totalActiveMins)}</strong>, exceeding your desired active timeframe of <strong className="text-slate-800">{formatMinsToHoursAndMins(allowedMins)}</strong> (from {formatArrival(startTimeStr)} to {formatArrival(endTimeStr)}) by <strong className="text-red-600 font-bold">{formatMinsToHoursAndMins(totalActiveMins - allowedMins)}</strong>.
                              </p>
                            </div>

                            {/* Section for actions */}
                            <div className="flex flex-wrap items-center gap-3">
                              {isAccepted ? (
                                <button
                                  onClick={() => setAcceptedViolations(prev => ({ ...prev, [day.dayNumber]: false }))}
                                  className="px-3 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                                >
                                  Re-evaluate warning
                                </button>
                              ) : (
                                <button
                                  onClick={() => setAcceptedViolations(prev => ({ ...prev, [day.dayNumber]: true }))}
                                  className="px-3 py-1 bg-red-600 text-white hover:bg-red-700 rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 mb-1"
                                >
                                  <Check className="w-3.5 h-3.5" /> Accept Limit Violation
                                </button>
                              )}
                            </div>

                            {/* Sacrifice options */}
                            {!isAccepted && (
                              <div className="bg-white/80 border border-red-100/40 rounded-lg p-3 space-y-2 mt-2">
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
                                  Sacrifice a place to visit today to save time:
                                </span>
                                <div className="space-y-1.5">
                                  {day.stops?.filter((s: any) => s && s.type === 'visit').map((s: any) => {
                                    const originalIdx = (day.stops || []).findIndex((item: any) => item === s);
                                    const stopKey = `${day.dayNumber}-${originalIdx}-${s.location || 'unknown'}`;
                                    const isSkipped = skippedStops[stopKey];
                                    const savedTimeMins = parseDurationToMins(s.duration || "1h 30m");

                                    return (
                                      <div key={stopKey} className="flex items-center justify-between text-xs py-1 border-b border-slate-100/80 last:border-0 gap-4">
                                        <span className={clsx("font-medium", isSkipped ? "text-slate-400 line-through" : "text-slate-700")}>
                                          {s.location} <span className="text-slate-400">({s.duration || "1h 30m"})</span>
                                        </span>
                                        <button
                                          onClick={() => {
                                            setSkippedStops(prev => ({ ...prev, [stopKey]: !prev[stopKey] }));
                                            setAcceptedViolations(prev => ({ ...prev, [day.dayNumber]: false }));
                                          }}
                                          className={clsx(
                                            "px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border",
                                            isSkipped
                                              ? "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                                              : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                                          )}
                                        >
                                          {isSkipped ? "Undo Sacrifice" : `Sacrifice (-${formatMinsToHoursAndMins(savedTimeMins)})`}
                                        </button>
                                      </div>
                                    );
                                  })}
                                  {day.stops?.filter((s: any) => s && s.type === 'visit').length === 0 && (
                                    <p className="text-[11px] text-slate-400 italic">No visit places scheduled to sacrifice for today.</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  }
                  return null;
                })()}

                <div className="space-y-0 ml-6 border-l-2 border-slate-100">
                  {(() => {
                    const filteredStops = (day.stops?.filter(Boolean) || []).filter(stop => {
                      if (typeFilter === 'all') return true;
                      if (typeFilter === 'travel') return stop.type === 'travel';
                      if (typeFilter === 'stay') return stop.type === 'overnight';
                      if (typeFilter === 'explore') return stop.type === 'visit' || stop.type === 'ACTION';
                      return true;
                    });

                    if (filteredStops.length === 0) {
                      return (
                        <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200 ml-4">
                          <p className="text-sm font-medium italic">No {typeFilter !== 'all' ? typeFilter + ' ' : ''}Stops planned for this day.</p>
                        </div>
                      );
                    }

                    return filteredStops.map((stop, stopIdx) => {
                      const originalIdx = (day.stops || []).findIndex((s: any) => s === stop);
                      const stopKey = `${day.dayNumber}-${originalIdx}-${stop.location || 'unknown'}`;
                      const mapLabel = stopToMapLabel[stopKey];
                      const fromTo = getTravelFromTo(day, stop, originalIdx === -1 ? stopIdx : originalIdx, plan.itinerary || []);
                      const isSkipped = skippedStops[stopKey];

                    return (
                      <div key={stopKey} className={clsx(
                        "relative pl-10 pb-10 group last:pb-0 font-sans transition-all duration-300",
                        isSkipped ? "opacity-35 line-through decoration-slate-400 decoration-1" : ""
                      )}>
                        {/* Timeline Dot */}
                        <div className={clsx(
                          "absolute left-[-11px] top-1.5 w-5 h-5 bg-white border-2 rounded-full transition-colors flex items-center justify-center z-10 shadow-sm",
                          mapLabel ? "border-slate-400 bg-slate-50 font-bold" : "border-slate-200 group-hover:border-slate-400"
                        )}>
                          {mapLabel ? (
                            <span className="text-[10px] font-bold text-slate-700">{mapLabel}</span>
                          ) : (
                            <StopIcon type={stop.type} />
                          )}
                        </div>

                        <div className="space-y-4">
                          {/* Stop Header based on segment type */}
                          {stop.type === 'travel' ? (
                            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-amber-100/60 pb-3">
                              <div className="space-y-1.5">
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-[10px] font-black uppercase tracking-wider select-none shadow-sm">
                                  <Car className="w-3.5 h-3.5 text-amber-505" /> TRAVEL
                                </div>
                                <h4 className="text-base md:text-lg font-bold text-slate-900 leading-tight">
                                  Travel from: <span className="text-amber-800 font-extrabold underline decoration-amber-400 decoration-2">{fromTo.from}</span> to: <span className="text-amber-800 font-extrabold underline decoration-amber-400 decoration-2">{fromTo.to}</span>
                                </h4>
                                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                                  {stop.departureTime && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5 text-slate-400" /> Leave: {formatArrival(stop.departureTime)}
                                    </span>
                                  )}
                                  {stop.arrivalTime && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5 text-slate-400" /> Arrive: {formatArrival(stop.arrivalTime)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {stop.transportMode && (
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50/50 text-amber-800 rounded-lg text-xs font-extrabold uppercase tracking-wider border border-amber-100 shadow-sm">
                                  {transportIcons[stop.transportMode]}
                                  {stop.transportMode}
                                  {stop.travelTime && <span className="text-amber-600 ml-1">• {formatTime(stop.travelTime)}</span>}
                                </div>
                              )}
                            </div>
                          ) : stop.type === 'overnight' ? (
                            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rose-100/60 pb-3">
                              <div className="space-y-1.5">
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-800 text-[10px] uppercase font-black tracking-wider rounded-md select-none shadow-sm">
                                  <Moon className="w-3.5 h-3.5 text-rose-500" /> STAY at
                                </div>
                                <h4 className="text-base md:text-lg font-bold text-slate-900 leading-tight">
                                  {stop.location}
                                </h4>
                                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                                  {stop.arrivalTime && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5 text-slate-400" /> Arrive: {formatArrival(stop.arrivalTime)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest leading-none mb-1">Nights</span>
                                <span className="text-xs font-black text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1 shadow-sm font-mono whitespace-nowrap">
                                  {(() => {
                                    try {
                                      const checkIn = parseISO(day.date);
                                      const checkOut = addDays(checkIn, 1);
                                      return `${format(checkIn, 'MMM d')} - ${format(checkOut, 'MMM d')}`;
                                    } catch(e) {
                                      return 'Day Stay';
                                    }
                                  })()}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-emerald-100/60 pb-3">
                              <div className="space-y-1.5 flex-1">
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-md select-none shadow-sm">
                                  <Camera className="w-3.5 h-3.5 text-emerald-600" /> EXPLORE
                                </div>
                                <h4 className={clsx(
                                  "text-base md:text-lg font-bold leading-tight",
                                  stop.location?.startsWith('ACTION REQUIRED') ? "text-red-600" : "text-slate-900",
                                  isSkipped ? "line-through text-slate-400" : ""
                                )}>
                                  {stop.location}
                                </h4>
                                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                                  {stop.arrivalTime && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5 text-slate-400" /> Arrive: {formatArrival(stop.arrivalTime)}
                                    </span>
                                  )}
                                  {stop.duration && (
                                    <span className="flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded text-xs font-extrabold font-mono shadow-sm">
                                      Explore Time: {formatTime(stop.duration)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setSkippedStops(prev => ({ ...prev, [stopKey]: !prev[stopKey] }));
                                  setAcceptedViolations(prev => ({ ...prev, [day.dayNumber]: false }));
                                }}
                                className={clsx(
                                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border shadow-xs self-start whitespace-nowrap",
                                  isSkipped
                                    ? "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                                )}
                              >
                                {isSkipped ? "✓ Restore Place" : "✗ Sacrifice Place"}
                              </button>
                            </div>
                          )}

                          {/* Stop Details Grid - Content filtered by segment type */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Display general fields for everything EXCEPT Travel stops (no hours or fees for transit) */}
                            {stop.type !== 'travel' && (
                              <>
                                {stop.operationHours && (
                                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Hours</p>
                                    <p className="text-sm font-medium text-slate-800">{formatTimeRange(stop.operationHours)}</p>
                                  </div>
                                )}
                                {stop.fees && (
                                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Fees</p>
                                    <p className="text-sm font-medium text-slate-800">{stop.fees}</p>
                                  </div>
                                )}
                                {stop.suggestedSpots && (
                                  <div className="p-3 bg-slate-55 rounded-xl border border-slate-100">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Suggested Spots</p>
                                    <p className="text-sm font-medium text-slate-800">{stop.suggestedSpots}</p>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Driving directions for travel stop, normal notes otherwise */}
                            {stop.notes && (
                              <div className={clsx(
                                "p-3 rounded-xl border",
                                stop.type === 'travel' 
                                  ? "bg-amber-50/50 text-amber-900 border-amber-200/50 md:col-span-2 lg:col-span-2" 
                                  : "bg-slate-50/50 text-slate-800 border-slate-200/40 md:col-span-2 lg:col-span-1"
                              )}>
                                <p className={clsx(
                                  "text-[10px] uppercase tracking-wider font-bold mb-1",
                                  stop.type === 'travel' ? "text-amber-700" : "text-slate-500"
                                )}>
                                  {stop.type === 'travel' ? 'Driving / Transit Directions' : 'Notes'}
                                </p>
                                <p className="text-sm leading-relaxed">{renderTextWithLinks(stop.notes)}</p>
                              </div>
                            )}

                             {/* Standard shared parameters */}
                             {(stop.gpsCoordinates || stop.coordinates) && (
                               <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/80">
                                 <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">GPS Coordinates</p>
                                 <p className="text-sm font-mono font-medium text-slate-700">
                                   {formatGPSToDMSString(stop.gpsCoordinates, stop.coordinates)}
                                 </p>
                               </div>
                             )}

                             {stop.exploreGoogleMapsLink && (
                               <div className="p-3 bg-indigo-50/30 rounded-xl border border-indigo-100 md:col-span-2 lg:col-span-1 shadow-sm hover:bg-indigo-50/50 transition-colors">
                                 <p className="text-[10px] uppercase tracking-wider text-indigo-600 font-bold mb-1 flex items-center gap-1.5">
                                   <MapIcon className="w-3.5 h-3.5 text-indigo-400" /> Explore on Google Maps
                                 </p>
                                 <a 
                                   href={stop.exploreGoogleMapsLink} 
                                   target="_blank" 
                                   rel="noopener noreferrer"
                                   className="text-xs text-indigo-700 font-extrabold hover:underline flex items-center gap-1 mt-0.5"
                                 >
                                   Open Google Maps Link <ExternalLink className="w-3.5 h-3.5" />
                                 </a>
                               </div>
                             )}

                            {stop.importantInfo && (
                              <div className={clsx(
                                "p-3 rounded-xl border md:col-span-2 lg:col-span-1 shadow-sm",
                                isTomorrow(day.date) || stop.type === 'ACTION' || stop.importantInfo?.toLowerCase().includes('action required') 
                                  ? "bg-red-50 text-red-800 border-red-100 animate-pulse" 
                                  : "bg-amber-50 text-amber-800 border-amber-100"
                              )}>
                                <p className={clsx(
                                  "text-[10px] uppercase tracking-wider font-bold mb-1 flex items-center gap-1",
                                  isTomorrow(day.date) || stop.type === 'ACTION' || stop.importantInfo?.toLowerCase().includes('action required') ? "text-red-500" : "text-amber-600"
                                )}>
                                  <Asterisk className="w-3 h-3" /> Important Info
                                  {(isTomorrow(day.date) || stop.type === 'ACTION' || stop.importantInfo?.toLowerCase().includes('action required')) && (
                                    <span className="ml-auto text-red-650">Required!</span>
                                  )}
                                </p>
                                <p className="text-sm leading-relaxed">{renderTextWithLinks(stop.importantInfo)}</p>
                              </div>
                            )}

                            {stop.officialSite && (
                              <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/20 md:col-span-2 lg:col-span-1 shadow-sm">
                                <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold mb-1 flex items-center gap-1">
                                  <ExternalLink className="w-3.5 h-3.5" /> Official Site
                                </p>
                                <a 
                                  href={stop.officialSite} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-emerald-700 font-extrabold hover:underline flex items-center gap-1 mt-0.5"
                                >
                                  Visit Website <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}

                            {stop.parkingInfo && (
                              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 md:col-span-2 lg:col-span-1 shadow-sm">
                                <p className="text-[10px] uppercase tracking-wider text-blue-600 font-bold mb-1 flex items-center gap-1.5">
                                  <Car className="w-3.5 h-3.5 text-blue-400" /> Parking Suggestion
                                </p>
                                <p className="text-xs text-blue-900 font-medium leading-relaxed">{renderTextWithLinks(stop.parkingInfo)}</p>
                              </div>
                            )}
                          </div>

                          {/* Suggestions & Warnings */}
                          {((stop.suggestions?.length ?? 0) > 0 || (stop.warnings?.length ?? 0) > 0) && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {stop.suggestions?.filter(Boolean).map((s, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs bg-blue-50/60 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100/50 shadow-sm leading-tight">
                                  <Info className="w-3 h-3 text-blue-500" /> {renderTextWithLinks(s)}
                                </div>
                              ))}
                              {stop.warnings?.filter(Boolean).map((w, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs bg-red-50 text-red-700 px-3 py-1.5 rounded-lg border border-red-100/50 shadow-sm leading-tight font-bold">
                                  <Asterisk className="w-3 h-3 text-red-500 animate-bounce" /> {renderTextWithLinks(w)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : viewMode === 'table' ? (
          <motion.div
            id="itinerary-table-container"
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="card overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Density</span>
                  <div className="flex p-1 bg-white rounded-lg border border-slate-200">
                    {(['compact', 'normal', 'spacious'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setTableDensity(d)}
                        className={clsx(
                          "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                          tableDensity === d ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowColumnSettings(!showColumnSettings)}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all",
                      showColumnSettings ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                    )}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    Columns
                  </button>

                  {showColumnSettings && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-4 max-h-[400px] overflow-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Visible Columns</h4>
                        <button onClick={() => setShowColumnSettings(false)} className="text-slate-600 hover:text-slate-800">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {columns.map(col => (
                          <label key={col.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={visibleColumns[col.id]}
                              onChange={() => setVisibleColumns(prev => ({ ...prev, [col.id]: !prev[col.id] }))}
                              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-xs font-medium text-slate-700">{col.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all",
                    showFilters ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  )}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  Filter
                </button>
              </div>
              <div className="text-[10px] text-slate-600 font-medium italic flex items-center gap-2">
                <GripVertical className="w-3 h-3" />
                Tip: Click headers to sort • Drag edges to resize • Toggle filters to search
              </div>
            </div>
            <div className="overflow-auto max-h-[800px]">
              {flatItinerary.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  <p>No itinerary stops found to display in table.</p>
                </div>
              ) : (
                <table id="itinerary-table" className="w-full text-left border-separate border-spacing-0 table-fixed">
                <thead className="sticky top-0 z-30">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {columns.map(col => visibleColumns[col.id] && (
                      <th 
                        key={col.id}
                        style={{ width: columnWidths[col.id] }}
                        className="group relative bg-slate-50 p-0 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-r border-slate-200 last:border-r-0 overflow-hidden"
                      >
                        <div 
                          onClick={() => {
                            setSortConfig(prev => ({
                              key: col.id,
                              direction: prev?.key === col.id && prev.direction === 'asc' ? 'desc' : 'asc'
                            }));
                          }}
                          className="p-3 break-words hyphens-auto leading-tight cursor-pointer hover:bg-slate-100 transition-colors flex items-center justify-between"
                        >
                          {col.label}
                          {sortConfig?.key === col.id && (
                            <span className="ml-1 text-emerald-500">
                              {sortConfig.direction === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        {showFilters && (
                          <div className="px-2 pb-2">
                            <input
                              type="text"
                              placeholder={`Filter...`}
                              value={filters[col.id] || ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setFilters(prev => ({ ...prev, [col.id]: e.target.value }))}
                              className="w-full px-2 py-1 text-[10px] bg-white border border-slate-200 rounded focus:outline-none focus:border-emerald-500 font-normal"
                            />
                          </div>
                        )}
                        {/* Resize Handle */}
                        <div 
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResize(col.id, e.clientX, columnWidths[col.id]);
                          }}
                          className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-emerald-400/50 transition-colors z-10"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {flatItinerary.map((stop, idx) => {
                    const isAction = stop.type === 'ACTION' || stop.location?.startsWith('ACTION REQUIRED');
                    const isLastOfDay = idx === flatItinerary.length - 1 || flatItinerary[idx + 1].dayNumber !== stop.dayNumber;

                    return (
                      <React.Fragment key={`${stop.dayNumber}-${idx}`}>
                        <tr className="hover:bg-slate-50/50 transition-colors group">
                          {visibleColumns.dayNumber && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              <span className="font-bold text-slate-900">{stop.dayNumber}</span>
                            </td>
                          )}
                          {visibleColumns.dayName && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              <span className="text-sm text-slate-700">{formatDayOfWeek(stop.date)}</span>
                            </td>
                          )}
                          {visibleColumns.date && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              <span className="text-sm text-slate-700">{formatDateOnly(stop.date)}</span>
                            </td>
                          )}
                          {visibleColumns.mapSpot && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              {stopToMapLabel[stop.stopKey] && (
                                <div className={clsx(
                                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm",
                                  stop.type === 'overnight' ? 'bg-indigo-500' : stop.type === 'visit' ? 'bg-emerald-500' : 'bg-slate-400'
                                )}>
                                  {stopToMapLabel[stop.stopKey]}
                                </div>
                              )}
                            </td>
                          )}
                          {visibleColumns.location && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              <span className={clsx(
                                "font-medium break-words",
                                isAction ? "text-red-600 font-bold" : "text-slate-900"
                              )}>
                                {formatDestination(stop)}
                              </span>
                            </td>
                          )}
                          {visibleColumns.type && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              <span className={clsx(
                                "text-xs capitalize",
                                isAction ? "text-red-600 font-bold" : "text-slate-700"
                              )}>
                                {isAction ? 'ACTION' : stop.type}
                              </span>
                            </td>
                          )}
                          {visibleColumns.transportation && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              <span className="text-xs text-slate-800 font-medium capitalize">
                                {isAction ? '' : (stop.type === 'overnight' ? 'Stay' : (stop.type === 'visit' ? 'Hike' : (stop.transportMode || 'Hike')))}
                              </span>
                            </td>
                          )}
                          {visibleColumns.arrival && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              <span className="text-sm text-slate-700">{isAction ? '' : formatArrival(stop.arrivalTime || '')}</span>
                            </td>
                          )}
                          {visibleColumns.departure && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              <span className="text-sm text-slate-700">{isAction ? '' : formatDeparture(stop.departureTime || '')}</span>
                            </td>
                          )}
                          {visibleColumns.tripDuration && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              <span className="text-sm text-slate-700">{isAction ? '' : formatTime(stop.travelTime || '')}</span>
                            </td>
                          )}
                          {visibleColumns.explorationTime && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              <span className="text-sm text-slate-700">{!isAction && stop.type === 'visit' ? formatTime(stop.duration || '') : ''}</span>
                            </td>
                          )}
                          {visibleColumns.fees && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              <span className="text-xs text-slate-700">{!isAction && stop.fees && stop.fees !== 'N/A' && stop.fees !== '--' ? stop.fees : ''}</span>
                            </td>
                          )}
                          {visibleColumns.hours && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              <span className="text-xs text-slate-700">{!isAction && stop.operationHours && stop.operationHours !== 'N/A' && stop.operationHours !== '--' ? stop.operationHours : ''}</span>
                            </td>
                          )}
                          {visibleColumns.suggestedSpots && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              <div className="text-xs text-slate-700 leading-relaxed break-words">
                                {stop.suggestedSpots}
                              </div>
                            </td>
                          )}
                          {visibleColumns.gps && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              <div className="flex flex-col gap-1.5 justify-start items-start">
                                <span className="text-xs font-mono text-slate-700">
                                  {formatGPSToDMSString(stop.gpsCoordinates, stop.coordinates)}
                                </span>
                                {stop.exploreGoogleMapsLink && (
                                  <a
                                    href={stop.exploreGoogleMapsLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded border border-indigo-100 hover:underline transition-colors"
                                  >
                                    <MapIcon className="w-2.5 h-2.5 text-indigo-500" /> Explore
                                  </a>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.importantInfo && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              {stop.importantInfo && (
                                <div className={clsx(
                                  "p-2 rounded-lg text-xs leading-relaxed break-words",
                                  isTomorrow(stop.date) || stop.type === 'ACTION' || stop.importantInfo?.toLowerCase().includes('action required') ? "bg-red-50 text-red-800 border border-red-100 animate-pulse" : "bg-amber-50 text-amber-800 border border-amber-100"
                                )}>
                                  <div className={clsx(
                                    "flex items-center gap-1 font-bold uppercase text-[10px] mb-1",
                                    isTomorrow(stop.date) || stop.type === 'ACTION' || stop.importantInfo?.toLowerCase().includes('action required') ? "text-red-500" : "text-amber-500"
                                  )}>
                                    <Asterisk className="w-3 h-3" /> Important
                                    {(isTomorrow(stop.date) || stop.type === 'ACTION' || stop.importantInfo?.toLowerCase().includes('action required')) && <span className="ml-auto text-red-600">Action Required!</span>}
                                  </div>
                                  {renderTextWithLinks(stop.importantInfo)}
                                </div>
                              )}
                            </td>
                          )}
                          {visibleColumns.officialSite && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              {stop.officialSite ? (
                                <a 
                                  href={stop.officialSite} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-xs font-medium break-all"
                                >
                                  <Globe className="w-3 h-3 flex-shrink-0" /> {stop.officialSite}
                                </a>
                              ) : ''}
                            </td>
                          )}
                          {visibleColumns.parkingInfo && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              {stop.parkingInfo ? (
                                <div className="flex items-start gap-1 p-1 bg-blue-50/50 rounded border border-blue-100 text-slate-800">
                                  <Car className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5" />
                                  <span className="text-[10px] sm:text-xs leading-tight">{renderTextWithLinks(stop.parkingInfo)}</span>
                                </div>
                              ) : ''}
                            </td>
                          )}
                          {visibleColumns.additionalInfo && (
                            <td className={clsx(
                              "align-top border-b border-r border-slate-100 last:border-r-0",
                              tableDensity === 'compact' ? 'p-2' : tableDensity === 'spacious' ? 'p-8' : 'p-4'
                            )}>
                              <div className="space-y-2">
                                {stop.notes && (
                                  <div className="p-2 bg-amber-50 rounded border border-amber-100">
                                    <p className="text-[8px] uppercase font-bold text-amber-500 mb-0.5">Notes</p>
                                    <p className="text-[10px] text-amber-800 leading-tight">{renderTextWithLinks(stop.notes)}</p>
                                  </div>
                                )}
                                {stop.suggestions?.map((s, i) => (
                                  <div key={i} className="flex items-center gap-1.5 text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">
                                    <Info className="w-3 h-3 flex-shrink-0" /> {renderTextWithLinks(s)}
                                  </div>
                                ))}
                                {stop.warnings?.map((w, i) => (
                                  <div key={i} className="flex items-center gap-1.5 text-[10px] bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100">
                                    <Asterisk className="w-3 h-3 flex-shrink-0" /> {renderTextWithLinks(w)}
                                  </div>
                                ))}
                              </div>
                            </td>
                          )}
                        </tr>
                        {isLastOfDay && (
                          <tr key={`summary-${stop.dayNumber}`} className="bg-slate-50/80 font-bold border-t-2 border-slate-200">
                            {visibleColumns.dayNumber && <td className="p-2 border-b border-r border-slate-100"></td>}
                            {visibleColumns.dayName && <td className="p-2 border-b border-r border-slate-100"></td>}
                            {visibleColumns.date && <td className="p-2 border-b border-r border-slate-100"></td>}
                            {visibleColumns.mapSpot && <td className="p-2 border-b border-r border-slate-100"></td>}
                            {visibleColumns.location && (
                              <td className="p-2 border-b border-r border-slate-100 text-right text-[10px] uppercase tracking-wider text-slate-500">
                                Daily Summary
                              </td>
                            )}
                            {visibleColumns.type && <td className="p-2 border-b border-r border-slate-100"></td>}
                            {visibleColumns.transportation && <td className="p-2 border-b border-r border-slate-100"></td>}
                            {visibleColumns.arrival && (
                              <td className="p-2 border-b border-r border-slate-100 text-xs text-slate-900">
                                Start: {(() => {
                                  const day = plan.itinerary?.find(d => d.dayNumber === stop.dayNumber);
                                  return formatArrival(day?.stops?.[0]?.arrivalTime || day?.stops?.[0]?.departureTime || '');
                                })()}
                              </td>
                            )}
                            {visibleColumns.departure && (
                              <td className="p-2 border-b border-r border-slate-100 text-xs text-slate-900">
                                Finish: {(() => {
                                  const day = plan.itinerary?.find(d => d.dayNumber === stop.dayNumber);
                                  const lastStop = day?.stops?.[day.stops.length - 1];
                                  return formatDeparture(lastStop?.arrivalTime || lastStop?.departureTime || '');
                                })()}
                              </td>
                            )}
                            {visibleColumns.tripDuration && (
                              <td className="p-2 border-b border-r border-slate-100 text-xs text-emerald-600">
                                Travel Time: {(() => {
                                  const day = plan.itinerary?.find(d => d.dayNumber === stop.dayNumber);
                                  let dailyMins = 0;
                                  day?.stops?.filter(Boolean).forEach(s => {
                                    if (s.travelTime) {
                                      dailyMins += parseDurationToMins(s.travelTime);
                                    }
                                  });
                                  return formatTime(`${Math.floor(dailyMins / 60)}h ${dailyMins % 60}m`);
                                })()}
                              </td>
                            )}
                            {visibleColumns.explorationTime && (
                              <td className="p-2 border-b border-r border-slate-100 text-xs text-emerald-600">
                                Exploration Time: {(() => {
                                  const day = plan.itinerary?.find(d => d.dayNumber === stop.dayNumber);
                                  let dailyMins = 0;
                                  day?.stops?.filter(Boolean).forEach(s => {
                                    if (s.type === 'visit' && s.duration) {
                                      dailyMins += parseDurationToMins(s.duration);
                                    }
                                  });
                                  return formatTime(`${Math.floor(dailyMins / 60)}h ${dailyMins % 60}m`);
                                })()}
                              </td>
                            )}
                            {visibleColumns.fees && <td className="p-2 border-b border-r border-slate-100"></td>}
                            {visibleColumns.hours && <td className="p-2 border-b border-r border-slate-100"></td>}
                            {visibleColumns.suggestedSpots && <td className="p-2 border-b border-r border-slate-100"></td>}
                            {visibleColumns.gps && <td className="p-2 border-b border-r border-slate-100"></td>}
                            {visibleColumns.importantInfo && <td className="p-2 border-b border-r border-slate-100"></td>}
                            {visibleColumns.officialSite && <td className="p-2 border-b border-r border-slate-100"></td>}
                            {visibleColumns.parkingInfo && <td className="p-2 border-b border-r border-slate-100"></td>}
                            {visibleColumns.additionalInfo && <td className="p-2 border-b border-r border-slate-100"></td>}
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            id="itinerary-map-container"
            key="map"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="card h-[600px] relative overflow-hidden"
          >
            {GOOGLE_MAPS_API_KEY ? (
              <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                <Map
                  defaultCenter={{ lat: 0, lng: 0 }}
                  defaultZoom={2}
                  mapId="trip_map"
                  className="w-full h-full"
                >
                  {allStops.filter(stop => {
                    if (typeFilter === 'all') return stop.type === 'visit' || stop.type === 'overnight';
                    if (typeFilter === 'travel') return stop.type === 'travel';
                    if (typeFilter === 'stay') return stop.type === 'overnight';
                    if (typeFilter === 'explore') return stop.type === 'visit' || stop.type === 'ACTION';
                    return true;
                  }).map((stop) => (
                    <AdvancedMarker
                      key={stop.stopKey}
                      position={stop.coordinates!}
                      onClick={() => setSelectedMarker(stop)}
                    >
                      <Pin 
                        background={stop.type === 'overnight' ? '#6366f1' : (stop.type === 'visit' ? '#10b981' : '#f59e0b')} 
                        borderColor={'#fff'} 
                        glyphColor={'#fff'}
                        glyph={stopToMapLabel[stop.stopKey]}
                        scale={1.1}
                      />
                    </AdvancedMarker>
                  ))}
                  <Polyline 
                    path={routePath} 
                    strokeColor="#6366f1"
                    strokeOpacity={0.6}
                    strokeWeight={3}
                  />

                  {selectedMarker && (
                    <InfoWindow
                      position={selectedMarker.coordinates}
                      onCloseClick={() => setSelectedMarker(null)}
                    >
                      <div className="p-2 max-w-xs">
                        <h4 className="font-bold text-slate-900">
                          {stopToMapLabel[selectedMarker.stopKey] && (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] mr-2 align-middle">
                              {stopToMapLabel[selectedMarker.stopKey]}
                            </span>
                          )}
                          {selectedMarker.location}
                        </h4>
                        <p className="text-xs text-slate-700 mt-1">{selectedMarker.notes}</p>
                        {selectedMarker.officialSite && (
                          <a 
                            href={selectedMarker.officialSite} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-emerald-600 text-xs block mt-1 hover:underline"
                          >
                            Official Website
                          </a>
                        )}
                        {selectedMarker.exploreGoogleMapsLink && (
                          <a 
                            href={selectedMarker.exploreGoogleMapsLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-indigo-600 text-xs font-bold block mt-1 hover:underline"
                          >
                            🧭 Explore on Google Maps
                          </a>
                        )}
                      </div>
                    </InfoWindow>
                  )}
                </Map>
                
                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur p-3 rounded-xl border border-slate-200 shadow-lg space-y-2 z-10">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Legend</h5>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-indigo-500" />
                    <span className="text-slate-700 font-medium">Overnight Stay</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-slate-700 font-medium">Place to Visit</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-slate-700 font-medium">Travel Segment</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-5 h-1 bg-indigo-500 rounded" />
                    <span className="text-slate-700 font-medium">Route Path</span>
                  </div>
                  <div className="pt-1 border-t border-slate-200">
                    <p className="text-[9px] text-slate-500 italic">Markers show stop sequence (A, B, C...)</p>
                  </div>
                </div>
              </APIProvider>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-600 p-8 text-center">
                <MapIcon className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">Google Maps API Key required to view interactive map.</p>
                <p className="text-xs opacity-60 mt-2">Please set VITE_GOOGLE_MAPS_API_KEY in your environment.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    {/* PRINT-ONLY PRESTIGE VIEW */}
    <div className="hidden print:block bg-white text-slate-900 p-10 max-w-4xl mx-auto space-y-10 font-sans">
      {/* Elegant Header */}
      <div className="border-b-4 border-slate-900 pb-6 space-y-3">
        <div className="flex justify-between items-baseline">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Your Travel Itinerary Plan</h1>
          <span className="text-xs font-mono text-slate-500 font-bold">Generated by Explorer App</span>
        </div>
        <div className="text-sm font-medium text-slate-600 flex flex-wrap gap-x-6 gap-y-1">
          {plan.itinerary && plan.itinerary.length > 0 && (
            <>
              <span><strong>Duration:</strong> {plan.itinerary.length} Day(s)</span>
              <span><strong>Starting Point:</strong> {plan.itinerary[0]?.stops?.[0]?.location || 'N/A'}</span>
            </>
          )}
          {plan.totalDistance && <span><strong>Total Distance:</strong> {plan.totalDistance}</span>}
          {plan.totalCost && <span><strong>Estimated Cost:</strong> {plan.totalCost}</span>}
        </div>
      </div>

      {/* Overall Itinerary Summary */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold border-b border-slate-300 pb-1 text-slate-900 uppercase tracking-wide">Overall Journey Summary</h2>
        <div className="text-sm text-slate-800 leading-relaxed prose max-w-none prose-slate">
          <Markdown>{plan.summary}</Markdown>
        </div>
      </div>

      {/* Preparation and Guides */}
      {plan.preparationInfo && (
        <div className="space-y-4 p-5 bg-slate-50 rounded-xl border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">Preparation Guide & Critical Requirements</h2>
          <div className="text-xs text-slate-800 leading-relaxed prose max-w-none prose-slate">
            <Markdown>{plan.preparationInfo}</Markdown>
          </div>
        </div>
      )}

      {/* Daily Schedule breakdown */}
      <div className="space-y-10">
        <h2 className="text-xl font-bold border-b border-slate-300 pb-1 text-slate-900 uppercase tracking-wide">Day-by-Day Schedule</h2>
        {plan.itinerary?.filter(Boolean).map((day) => (
          <div key={day.dayNumber} className="space-y-4 break-inside-avoid my-6" style={{ pageBreakInside: 'avoid' }}>
            <div className="flex items-baseline justify-between bg-slate-100 p-3 rounded border border-slate-200">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Day {day.dayNumber} - {day.date ? format(parseISO(day.date), 'EEEE, MMMM do') : 'TBD'}
              </h3>
              <div className="text-xs font-semibold text-slate-600 space-x-4">
                <span>Start: {formatArrival(day.stops?.[0]?.arrivalTime || '')}</span>
                <span>Finish: {formatDeparture(day.stops?.[day.stops.length - 1]?.arrivalTime || day.stops?.[day.stops.length - 1]?.departureTime || '')}</span>
              </div>
            </div>

            {/* Daily schedule items */}
            <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
              {day.stops?.filter(Boolean).map((stop, sIdx) => {
                const isTravel = stop.type === 'travel';
                const isAction = stop.type === 'ACTION';
                const stopLabelType = stop.type === 'overnight' ? 'Stay' : (stop.type === 'visit' ? 'Stop' : stop.type);
                
                return (
                  <div key={sIdx} className="py-4 space-y-2 break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
                    <div className="flex items-baseline justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded uppercase">
                          {stopLabelType}
                        </span>
                        <h4 className={`text-xs font-bold ${isAction ? 'text-red-700 font-extrabold' : 'text-slate-950'}`}>
                          {formatDestination(stop)}
                        </h4>
                      </div>
                      <div className="text-[10px] font-semibold text-slate-700 flex-shrink-0">
                        {stop.arrivalTime && <span>Arrive: {formatArrival(stop.arrivalTime)}</span>}
                        {stop.departureTime && <span> &bull; Depart: {formatDeparture(stop.departureTime)}</span>}
                      </div>
                    </div>

                    <div className="pl-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-slate-600">
                      {stop.duration && <span><strong>Exploration Time:</strong> {stop.duration}</span>}
                      {stop.travelTime && <span><strong>Travel time:</strong> {stop.travelTime} {stop.distance && `(${stop.distance})`}</span>}
                      {stop.fees && stop.fees !== 'N/A' && stop.fees !== '--' && <span><strong>Fees/Cost:</strong> {stop.fees}</span>}
                      {stop.operationHours && stop.operationHours !== 'N/A' && stop.operationHours !== '--' && <span><strong>Hours:</strong> {stop.operationHours}</span>}
                      {stop.suggestedSpots && <span className="col-span-2"><strong>Suggested Highlights:</strong> {stop.suggestedSpots}</span>}
                      {stop.importantInfo && <span className="col-span-2 text-amber-800"><strong>Important Info:</strong> {stop.importantInfo}</span>}
                      {stop.notes && <span className="col-span-2 text-slate-500 italic"><strong>Notes:</strong> {stop.notes}</span>}
                      {stop.parkingInfo && <span className="col-span-2 text-blue-800"><strong>Parking Suggestion:</strong> {stop.parkingInfo}</span>}
                      {(stop.gpsCoordinates || stop.coordinates) && <span className="col-span-2 text-slate-705"><strong>GPS Coordinates:</strong> {formatGPSToDMSString(stop.gpsCoordinates, stop.coordinates)}</span>}
                      {stop.exploreGoogleMapsLink && <span className="col-span-2 text-indigo-700 font-medium"><strong>Explore on Google Maps:</strong> {stop.exploreGoogleMapsLink}</span>}
                      {stop.officialSite && <span className="col-span-2 text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap"><strong>Website:</strong> {stop.officialSite}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  </>
  );
}
