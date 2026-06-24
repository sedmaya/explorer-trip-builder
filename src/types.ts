export type TransportOption = 'air' | 'car' | 'bike' | 'hike';
export type TripType = 'one-way' | 'round-trip';

export interface FlightSegment {
  id: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string; // ISO or human readable
  arrivalTime: string;
  isLayover: boolean;
}

export interface TransportOverride {
  id: string;
  from: string;
  to: string;
  mode: TransportOption;
}

export interface PlaceToVisit {
  id: string;
  location: string;
  date?: string; // Optional date for this specific location
}

export interface TripPreferences {
  experienceType: 'sightseeing' | 'hiking' | 'mixed' | 'quick-overlooks';
  hikingDifficulty: 'easy' | 'moderate' | 'strenuous' | 'none';
  infrastructureImportance: 'low' | 'medium' | 'high'; // Access to restaurants, etc.
  pace: 'relaxed' | 'moderate' | 'fast';
}

export interface TripInputs {
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  startPoint: string;
  endPoint?: string;
  tripType: TripType;
  involvesAir: boolean;
  flights: FlightSegment[];
  placesToVisit: PlaceToVisit[];
  defaultTransport: TransportOption;
  transportOverrides: TransportOverride[];
  dailyTimeLimit: number; // hours
  dailyStartTime: string; // e.g. "09:30"
  dailyEndTime: string;   // e.g. "21:30"
  preferences: TripPreferences;
  exploreStartPoint?: boolean;
  preferredOvernights?: { dayNumber: number; location: string }[];
  appliedOptimizations?: string[];
}

export interface TripStop {
  type: 'visit' | 'overnight' | 'travel' | 'ACTION';
  location: string;
  coordinates?: { lat: number; lng: number };
  arrivalTime?: string;
  departureTime?: string;
  duration?: string;
  travelTime?: string;
  distance?: string;
  transportMode?: TransportOption;
  cost?: string;
  operationHours?: string;
  fees?: string;
  notes?: string;
  officialSite?: string;
  exploreGoogleMapsLink?: string;
  suggestedSpots?: string;
  gpsCoordinates?: string;
  importantInfo?: string;
  permitDeadline?: string;
  parkingInfo?: string;
  suggestions?: string[];
  warnings?: string[];
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  stops: TripStop[];
}

export interface ReplacementOption {
  location: string;
  description: string; // Briefly describe differences
}

export interface OptimizationOption {
  id: string;
  type: 'remove' | 'replace' | 'add' | 'adjust';
  location: string;
  replacement?: string;
  alternatives?: ReplacementOption[];
  parameter?: 'dailyTimeLimit' | 'dailyStartTime' | 'dailyEndTime' | 'startTime' | 'endTime';
  newValue?: any;
  reason: string;
}

export interface FeasibilityAssessment {
  feasible: boolean;
  score: number; // 0 to 100
  unreachablePlaces?: string[]; // places requested but not included because of distance or flight constraints
  reasons?: string[]; // explanations of constraints/inconsistencies
  bottlenecks?: string[]; // list of issues (e.g. "Day 2 travel exceeds limit by 1h 20m")
}

export interface TripPlan {
  tripName?: string;
  itinerary: ItineraryDay[];
  totalCost?: string;
  totalDistance?: string;
  summary: string;
  preparationInfo?: string;
  optimizationSuggestions?: string;
  optimizations?: OptimizationOption[];
  mapsLinks: { title: string; uri: string }[];
  routeSequence?: string[];
  feasibility?: FeasibilityAssessment;
}
