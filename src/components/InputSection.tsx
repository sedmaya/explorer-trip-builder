import React, { useState } from 'react';
import { Plus, Trash2, MapPin, Calendar, Clock, Navigation, Plane, Car, Bike, Footprints, HelpCircle, Asterisk, Sparkles, Moon } from 'lucide-react';
import { TripInputs, TransportOption, TransportOverride, FlightSegment } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';

const ValidationError = ({ message }: { message: string }) => {
  if (!message) return null;
  return (
    <div className="group relative inline-block ml-1 align-middle">
      <Asterisk className="w-3 h-3 text-red-500 cursor-help" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center normal-case">
        {message}
      </div>
    </div>
  );
};

interface Props {
  onSubmit: (inputs: TripInputs) => void;
  isLoading: boolean;
}

export default function InputSection({ onSubmit, isLoading }: Props) {
  const [inputs, setInputs] = useState<TripInputs>({
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    startPoint: '',
    endPoint: '',
    tripType: 'one-way',
    involvesAir: false,
    flights: [],
    placesToVisit: [{ id: Math.random().toString(36).substr(2, 9), location: '', date: '' }],
    defaultTransport: 'car',
    transportOverrides: [],
    dailyTimeLimit: 4,
    dailyStartTime: '09:30',
    dailyEndTime: '21:30',
    preferences: {
      experienceType: 'mixed',
      hikingDifficulty: 'moderate',
      infrastructureImportance: 'medium',
      pace: 'moderate',
    },
    exploreStartPoint: false,
  });

  const handleAddPlace = () => {
    setInputs({ 
      ...inputs, 
      placesToVisit: [
        ...inputs.placesToVisit, 
        { id: Math.random().toString(36).substr(2, 9), location: '', date: '' }
      ] 
    });
  };

  const handleRemovePlace = (index: number) => {
    const newPlaces = [...inputs.placesToVisit];
    newPlaces.splice(index, 1);
    setInputs({ ...inputs, placesToVisit: newPlaces });
  };

  const handlePlaceChange = (index: number, value: string) => {
    // Check if multiple places are pasted (comma separated)
    if (value.includes(',')) {
      const pastedPlaces = value.split(',').map(p => p.trim()).filter(p => p).map(p => ({
        id: Math.random().toString(36).substr(2, 9),
        location: p,
        date: ''
      }));
      const newPlaces = [...inputs.placesToVisit];
      newPlaces.splice(index, 1, ...pastedPlaces);
      setInputs({ ...inputs, placesToVisit: newPlaces });
    } else {
      const newPlaces = [...inputs.placesToVisit];
      newPlaces[index] = { ...newPlaces[index], location: value };
      setInputs({ ...inputs, placesToVisit: newPlaces });
    }
  };

  const handlePlaceDateChange = (index: number, date: string) => {
    const newPlaces = [...inputs.placesToVisit];
    newPlaces[index] = { ...newPlaces[index], date };
    setInputs({ ...inputs, placesToVisit: newPlaces });
  };

  const handleAddFlight = () => {
    const newFlight: FlightSegment = {
      id: Math.random().toString(36).substr(2, 9),
      departureAirport: '',
      arrivalAirport: '',
      departureTime: inputs.startDate ? `${inputs.startDate}T12:00` : '',
      arrivalTime: inputs.startDate ? `${inputs.startDate}T14:00` : '',
      isLayover: false,
    };
    setInputs({ ...inputs, flights: [...inputs.flights, newFlight] });
  };

  const handleRemoveFlight = (id: string) => {
    setInputs({ ...inputs, flights: inputs.flights.filter(f => f.id !== id) });
  };

  const handleFlightChange = (id: string, field: keyof FlightSegment, value: any) => {
    setInputs({
      ...inputs,
      flights: inputs.flights.map(f => f.id === id ? { ...f, [field]: value } : f),
    });
  };

  const handleAddOverride = () => {
    const newOverride: TransportOverride = {
      id: Math.random().toString(36).substr(2, 9),
      from: '',
      to: '',
      mode: 'car',
    };
    setInputs({ ...inputs, transportOverrides: [...inputs.transportOverrides, newOverride] });
  };

  const handleRemoveOverride = (id: string) => {
    setInputs({
      ...inputs,
      transportOverrides: inputs.transportOverrides.filter(o => o.id !== id),
    });
  };

  const handleOverrideChange = (id: string, field: keyof TransportOverride, value: any) => {
    setInputs({
      ...inputs,
      transportOverrides: inputs.transportOverrides.map(o => o.id === id ? { ...o, [field]: value } : o),
    });
  };

  const getErrors = () => {
    const errors: string[] = [];
    
    // Trip Dates
    if (!inputs.startDate) errors.push("Start date is required.");
    if (!inputs.endDate) errors.push("End date is required.");
    if (inputs.startDate && inputs.endDate && inputs.startDate > inputs.endDate) {
      errors.push("End date cannot be before start date.");
    }
    
    if (inputs.startDate === inputs.endDate && inputs.startTime && inputs.endTime && inputs.startTime > inputs.endTime) {
      errors.push("End time cannot be before start time on the same day.");
    }

    // Route
    if (!inputs.startPoint.trim()) errors.push("Starting location is required.");
    if (inputs.tripType === 'one-way' && !inputs.endPoint.trim()) {
      errors.push("End location is required for one-way trips.");
    }

    // Flights
    if (inputs.involvesAir) {
      if (inputs.flights.length === 0) {
        errors.push("You indicated the trip involves air travel, but no flights are listed.");
      }
      inputs.flights.forEach((flight, index) => {
        const num = index + 1;
        if (!flight.departureAirport.trim()) errors.push(`Flight #${num}: Departure airport is required.`);
        if (!flight.arrivalAirport.trim()) errors.push(`Flight #${num}: Arrival airport is required.`);
        if (flight.departureTime && flight.arrivalTime && flight.departureTime > flight.arrivalTime) {
          errors.push(`Flight #${num}: Arrival time is before departure time.`);
        }
        // Check if flight is within trip dates
        if (flight.departureTime && inputs.startDate && flight.departureTime.split('T')[0] < inputs.startDate) {
          errors.push(`Flight #${num}: Departure is before the trip start date.`);
        }
        if (flight.arrivalTime && inputs.endDate && flight.arrivalTime.split('T')[0] > inputs.endDate) {
          errors.push(`Flight #${num}: Arrival is after the trip end date.`);
        }
      });

      // Flight overlaps
      for (let i = 0; i < inputs.flights.length - 1; i++) {
        const current = inputs.flights[i];
        const next = inputs.flights[i+1];
        if (current.arrivalTime && next.departureTime && current.arrivalTime > next.departureTime) {
          errors.push(`Flight #${i+2} departs before Flight #${i+1} arrives.`);
        }
      }
    }

    // Places to Visit
    const validPlaces = inputs.placesToVisit.filter(p => p.location.trim());
    if (inputs.placesToVisit.length > 0 && validPlaces.length === 0 && inputs.placesToVisit.some(p => p.location !== '')) {
       errors.push("Please provide names for the places you want to visit, or remove the empty rows.");
    }
    
    inputs.placesToVisit.forEach((place, index) => {
      if (place.date) {
        if (inputs.startDate && place.date < inputs.startDate) {
          errors.push(`Place #${index + 1} (${place.location || 'Unnamed'}): Date is before trip start.`);
        }
        if (inputs.endDate && place.date > inputs.endDate) {
          errors.push(`Place #${index + 1} (${place.location || 'Unnamed'}): Date is after trip end.`);
        }
      }
    });

    // Limits
    if (inputs.dailyStartTime && inputs.dailyEndTime && inputs.dailyStartTime >= inputs.dailyEndTime) {
      errors.push("Daily end time must be after daily start time.");
    }

    // Overrides
    inputs.transportOverrides.forEach((override, index) => {
      const num = index + 1;
      if (!override.from || !override.to) {
        errors.push(`Transport Override #${num}: Both 'From' and 'To' locations must be selected.`);
      }
      if (override.from && override.to && override.from === override.to) {
        errors.push(`Transport Override #${num}: 'From' and 'To' locations cannot be the same.`);
      }
    });

    return errors;
  };

  const errors = getErrors();

  const handleFillTestData = () => {
    setInputs({
      startDate: '2026-06-05',
      startTime: '19:15',
      endDate: '2026-06-07',
      endTime: '20:00',
      startPoint: '07670',
      endPoint: '',
      tripType: 'round-trip',
      involvesAir: false,
      flights: [],
      placesToVisit: [
        { id: 'm1', location: 'Maryland State House', date: '' },
        { id: 'm2', location: 'U. S. Naval academy', date: '' },
        { id: 'm3', location: 'Cape Henlopen State Park', date: '' },
        { id: 'm4', location: '18th-century colonial streets', date: '' },
        { id: 'm5', location: 'William Paca House & Garden', date: '' },
        { id: 'm6', location: 'New Castle Historic District', date: '' }
      ],
      defaultTransport: 'car',
      transportOverrides: [],
      dailyTimeLimit: 5,
      dailyStartTime: '09:00',
      dailyEndTime: '21:30',
      preferences: {
        experienceType: 'sightseeing',
        hikingDifficulty: 'easy',
        infrastructureImportance: 'medium',
        pace: 'moderate',
      },
      exploreStartPoint: false,
      preferredOvernights: [
        { dayNumber: 1, location: 'Econo Lodge Inn & Suites Rehoboth Beach' },
        { dayNumber: 2, location: 'SpringHill Suites by Marriott Annapolis' }
      ]
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (errors.length > 0) return;
    onSubmit(inputs);
  };

  const transportIcons = {
    air: <Plane className="w-4 h-4" />,
    car: <Car className="w-4 h-4" />,
    bike: <Bike className="w-4 h-4" />,
    hike: <Footprints className="w-4 h-4" />,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleFillTestData}
          className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2"
        >
          <Sparkles className="w-3 h-3" /> Fill Test Data
        </button>
      </div>
      {/* Trip Preferences Questionnaire */}
      <div className="card p-6 space-y-6 bg-indigo-50/30 border-indigo-100">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Trip Preferences
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
              Experience Type
              <HelpCircle className="w-3 h-3 text-slate-400 cursor-help" />
            </label>
            <select
              className="input-field capitalize"
              value={inputs.preferences.experienceType}
              onChange={e => setInputs({
                ...inputs,
                preferences: { ...inputs.preferences, experienceType: e.target.value as any }
              })}
            >
              <option value="sightseeing">Sightseeing</option>
              <option value="hiking">Hiking Focused</option>
              <option value="mixed">Mixed Experience</option>
              <option value="quick-overlooks">Quick Overlooks</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
              Hiking Difficulty
              <HelpCircle className="w-3 h-3 text-slate-400 cursor-help" />
            </label>
            <select
              className="input-field capitalize"
              value={inputs.preferences.hikingDifficulty}
              onChange={e => setInputs({
                ...inputs,
                preferences: { ...inputs.preferences, hikingDifficulty: e.target.value as any }
              })}
            >
              <option value="none">No Hiking</option>
              <option value="easy">Easy (Flat, Short)</option>
              <option value="moderate">Moderate (Some Incline)</option>
              <option value="strenuous">Strenuous (Steep, Long)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
              Infrastructure Importance
              <HelpCircle className="w-3 h-3 text-slate-400 cursor-help" />
            </label>
            <select
              className="input-field capitalize"
              value={inputs.preferences.infrastructureImportance}
              onChange={e => setInputs({
                ...inputs,
                preferences: { ...inputs.preferences, infrastructureImportance: e.target.value as any }
              })}
            >
              <option value="low">Low (Remote/Wilderness)</option>
              <option value="medium">Medium (Standard)</option>
              <option value="high">High (Easy Access/Dining)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
              Trip Pace
              <HelpCircle className="w-3 h-3 text-slate-400 cursor-help" />
            </label>
            <select
              className="input-field capitalize"
              value={inputs.preferences.pace}
              onChange={e => setInputs({
                ...inputs,
                preferences: { ...inputs.preferences, pace: e.target.value as any }
              })}
            >
              <option value="relaxed">Relaxed (Slow & Easy)</option>
              <option value="moderate">Moderate (Balanced)</option>
              <option value="fast">Fast (See Everything)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dates & Times */}
      <div className="card p-6 space-y-4 bg-blue-50/30 border-blue-100">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-600 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Trip Dates
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              Start Date <ValidationError message={!inputs.startDate ? "Start date is required" : ""} />
            </label>
            <input
              type="date"
              required
              className="input-field px-2"
              value={inputs.startDate}
              onChange={e => {
                const newDate = e.target.value;
                setInputs(prev => ({
                  ...prev,
                  startDate: newDate,
                  endDate: prev.endDate || newDate,
                  flights: prev.flights.map(f => ({
                    ...f,
                    departureTime: f.departureTime || `${newDate}T12:00`,
                    arrivalTime: f.arrivalTime || `${newDate}T14:00`
                  }))
                }));
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Start Time (Optional)</label>
            <input
              type="time"
              className="input-field px-2"
              value={inputs.startTime}
              onChange={e => setInputs({ ...inputs, startTime: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              End Date 
              <ValidationError message={
                !inputs.endDate ? "End date is required" : 
                (inputs.startDate && inputs.endDate && inputs.startDate > inputs.endDate ? "End date cannot be before start date" : "")
              } />
            </label>
            <input
              type="date"
              required
              className="input-field px-2"
              value={inputs.endDate}
              onChange={e => setInputs({ ...inputs, endDate: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              End Time (Optional)
              <ValidationError message={
                inputs.startDate === inputs.endDate && inputs.startTime && inputs.endTime && inputs.startTime > inputs.endTime ? 
                "End time cannot be before start time on the same day" : ""
              } />
            </label>
            <input
              type="time"
              className="input-field px-2"
              value={inputs.endTime}
              onChange={e => setInputs({ ...inputs, endTime: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Core Locations */}
      <div className="card p-6 space-y-4 bg-purple-50/30 border-purple-100">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-600 flex items-center gap-2">
          <MapPin className="w-4 h-4" /> Route
        </h3>
        <div className="space-y-4">
          <div className="flex gap-4 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              className={clsx(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                inputs.tripType === 'one-way' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
              onClick={() => setInputs({ ...inputs, tripType: 'one-way' })}
            >
              One Way
            </button>
            <button
              type="button"
              className={clsx(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                inputs.tripType === 'round-trip' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
              onClick={() => setInputs({ ...inputs, tripType: 'round-trip' })}
            >
              Round Trip
            </button>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              Start Point <ValidationError message={!inputs.startPoint.trim() ? "Starting location is required" : ""} />
            </label>
            <input
              type="text"
              required
              placeholder="City, Landmark, or Address"
              className="input-field"
              value={inputs.startPoint}
              onChange={e => setInputs({ ...inputs, startPoint: e.target.value })}
            />
            <div className="flex items-center gap-2 pt-1.5 pl-0.5">
              <input
                type="checkbox"
                id="exploreStartPoint"
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                checked={inputs.exploreStartPoint || false}
                onChange={e => setInputs({ ...inputs, exploreStartPoint: e.target.checked })}
              />
              <label htmlFor="exploreStartPoint" className="text-xs font-medium text-slate-600 flex items-center gap-1.5 cursor-pointer select-none">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Explore Start Point (dedicate time and suggest sights there)
              </label>
            </div>
          </div>
          {inputs.tripType === 'one-way' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                End Point <ValidationError message={!inputs.endPoint.trim() ? "End location is required for one-way trips" : ""} />
              </label>
              <input
                type="text"
                required
                placeholder="Final Destination"
                className="input-field"
                value={inputs.endPoint}
                onChange={e => setInputs({ ...inputs, endPoint: e.target.value })}
              />
            </div>
          )}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="involvesAir"
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={inputs.involvesAir}
              onChange={e => setInputs({ ...inputs, involvesAir: e.target.checked })}
            />
            <label htmlFor="involvesAir" className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Plane className="w-4 h-4" /> Involves Air Travel
            </label>
          </div>
        </div>
      </div>

      {/* Flight Details */}
      <AnimatePresence>
        {inputs.involvesAir && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="card p-6 space-y-4 border-emerald-100 bg-emerald-50/30">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-600 flex items-center gap-2">
                  <Plane className="w-4 h-4" /> Flight Details
                </h3>
                <button
                  type="button"
                  onClick={handleAddFlight}
                  className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-all flex items-center gap-2"
                >
                  <Plus className="w-3 h-3" /> Add Flight Segment
                </button>
              </div>
              
              <div className="space-y-4">
                {inputs.flights.length === 0 && (
                  <p className="text-xs text-emerald-600/60 italic">Add your flight details to account for airport times and time zones.</p>
                )}
                {inputs.flights.map((flight, index) => (
                  <div key={flight.id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-white rounded-xl border border-emerald-100 shadow-sm relative">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Departure Airport <ValidationError message={!flight.departureAirport.trim() ? "Required" : ""} />
                      </label>
                      <input
                        type="text"
                        placeholder="JFK, LHR..."
                        className="input-field py-1.5 text-xs"
                        value={flight.departureAirport}
                        onChange={e => handleFlightChange(flight.id, 'departureAirport', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Arrival Airport <ValidationError message={!flight.arrivalAirport.trim() ? "Required" : ""} />
                      </label>
                      <input
                        type="text"
                        placeholder="LAX, CDG..."
                        className="input-field py-1.5 text-xs"
                        value={flight.arrivalAirport}
                        onChange={e => handleFlightChange(flight.id, 'arrivalAirport', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Departure Time
                        <ValidationError message={
                          flight.departureTime && inputs.startDate && flight.departureTime.split('T')[0] < inputs.startDate ? "Before trip start" : ""
                        } />
                      </label>
                      <input
                        type="datetime-local"
                        className="input-field py-1.5 text-xs px-1"
                        value={flight.departureTime}
                        onChange={e => handleFlightChange(flight.id, 'departureTime', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Arrival Time
                        <ValidationError message={
                          (flight.departureTime && flight.arrivalTime && flight.departureTime > flight.arrivalTime ? "Before departure" : "") ||
                          (flight.arrivalTime && inputs.endDate && flight.arrivalTime.split('T')[0] > inputs.endDate ? "After trip end" : "")
                        } />
                      </label>
                      <input
                        type="datetime-local"
                        className="input-field py-1.5 text-xs px-1"
                        value={flight.arrivalTime}
                        onChange={e => handleFlightChange(flight.id, 'arrivalTime', e.target.value)}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 flex items-center gap-2 h-9 px-3 bg-slate-50 rounded-lg border border-slate-100 group/layover relative">
                        <input
                          type="checkbox"
                          id={`layover-${flight.id}`}
                          className="w-3 h-3 rounded border-slate-300 text-emerald-600"
                          checked={flight.isLayover}
                          onChange={e => handleFlightChange(flight.id, 'isLayover', e.target.checked)}
                        />
                        <label htmlFor={`layover-${flight.id}`} className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 cursor-pointer">
                          Layover
                          <HelpCircle className="w-2.5 h-2.5 text-slate-400" />
                        </label>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover/layover:opacity-100 transition-opacity pointer-events-none z-50">
                          Mark this segment as a layover. Layovers are treated as transit points rather than overnight stays.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFlight(flight.id)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Places to Visit */}
      <div className="card p-6 space-y-4 bg-amber-50/30 border-amber-100">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-600 flex items-center gap-2">
              <Navigation className="w-4 h-4" /> Places to Visit
            </h3>
            <div className="group relative">
              <HelpCircle className="w-3.5 h-3.5 text-amber-400 cursor-help" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Enter/paste location names manually one by one using "Add place", or list all the places at once separated by commas.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddPlace}
            className="btn-secondary py-1.5 flex items-center gap-2 text-xs border-amber-200 text-amber-700 hover:bg-amber-100"
          >
            <Plus className="w-3 h-3" /> Add Place
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <AnimatePresence mode="popLayout">
            {inputs.placesToVisit.map((place, index) => (
              <motion.div
                key={place.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col sm:flex-row gap-2 relative group"
              >
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder={`Location ${index + 1}`}
                    className="input-field pr-10"
                    value={place.location}
                    onChange={e => handlePlaceChange(index, e.target.value)}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <ValidationError message={!place.location.trim() && inputs.placesToVisit.length > 1 ? "Required" : ""} />
                  </div>
                </div>
                <div className="sm:w-48 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <input
                    type="date"
                    className="input-field pl-9 text-xs"
                    value={place.date}
                    onChange={e => handlePlaceDateChange(index, e.target.value)}
                    min={inputs.startDate}
                    max={inputs.endDate}
                  />
                </div>
                {inputs.placesToVisit.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemovePlace(index)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Preferences & Overrides Parent Card */}
      <div className="card p-6 bg-slate-50/50 border-slate-200 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-6 space-y-4 md:col-span-1 bg-white border-slate-100">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Limits
            </h3>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600">Daily Travel Limit (Hours)</label>
                <div className="group relative">
                  <HelpCircle className="w-3 h-3 text-slate-400 cursor-help" />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    Maximum hours spent driving/traveling per day.
                  </div>
                </div>
              </div>
              <input
                type="number"
                min="1"
                max="24"
                className="input-field"
                value={inputs.dailyTimeLimit}
                onChange={e => setInputs({ ...inputs, dailyTimeLimit: parseInt(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-600">Start Day At</label>
                  <div className="group relative">
                    <HelpCircle className="w-3 h-3 text-slate-400 cursor-help" />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      Time to begin activities each morning.
                    </div>
                  </div>
                </div>
                <input
                  type="time"
                  className="input-field px-2"
                  value={inputs.dailyStartTime}
                  onChange={e => setInputs({ ...inputs, dailyStartTime: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-600">
                    End Day At
                    <ValidationError message={inputs.dailyStartTime && inputs.dailyEndTime && inputs.dailyStartTime >= inputs.dailyEndTime ? "Must be after start time" : ""} />
                  </label>
                  <div className="group relative">
                    <HelpCircle className="w-3 h-3 text-slate-400 cursor-help" />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      Time to finish activities each evening.
                    </div>
                  </div>
                </div>
                <input
                  type="time"
                  className="input-field px-2"
                  value={inputs.dailyEndTime}
                  onChange={e => setInputs({ ...inputs, dailyEndTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600">Default Transport</label>
                <div className="group relative">
                  <HelpCircle className="w-3 h-3 text-slate-400 cursor-help" />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    Preferred mode of transportation for the entire trip.
                  </div>
                </div>
              </div>
              <select
                className="input-field capitalize"
                value={inputs.defaultTransport}
                onChange={e => setInputs({ ...inputs, defaultTransport: e.target.value as TransportOption })}
              >
                <option value="car">Car</option>
                <option value="air">Air</option>
                <option value="bike">Bike</option>
                <option value="hike">Hike</option>
              </select>
            </div>
          </div>
  
          {/* Transport Overrides */}
          <div className="card p-6 space-y-4 md:col-span-2 bg-white border-slate-100">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Navigation className="w-4 h-4" /> Specific Route Portions
                </h3>
                <div className="group relative">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    Define specific transportation modes for certain segments of your journey.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddOverride}
                className="btn-secondary py-1.5 flex items-center gap-2 text-xs"
              >
                <Plus className="w-3 h-3" /> Add Override
              </button>
            </div>
            
            <div className="space-y-3">
              {inputs.transportOverrides.length === 0 && (
                <p className="text-xs text-slate-400 italic">No specific route overrides set.</p>
              )}
              {inputs.transportOverrides.map((override) => (
                <div key={override.id} className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex-1 min-w-[120px]">
                    <select
                      className="input-field py-1.5 text-xs"
                      value={override.from}
                      onChange={e => handleOverrideChange(override.id, 'from', e.target.value)}
                    >
                      <option value="">From...</option>
                      <option value={inputs.startPoint}>{inputs.startPoint || 'Start Point'}</option>
                      {inputs.placesToVisit.filter(p => p.location).map(p => (
                        <option key={p.id} value={p.location}>{p.location}</option>
                      ))}
                      {inputs.endPoint && <option value={inputs.endPoint}>{inputs.endPoint}</option>}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <select
                      className="input-field py-1.5 text-xs"
                      value={override.to}
                      onChange={e => handleOverrideChange(override.id, 'to', e.target.value)}
                    >
                      <option value="">To...</option>
                      <option value={inputs.startPoint}>{inputs.startPoint || 'Start Point'}</option>
                      {inputs.placesToVisit.filter(p => p.location).map(p => (
                        <option key={p.id} value={p.location}>{p.location}</option>
                      ))}
                      {inputs.endPoint && <option value={inputs.endPoint}>{inputs.endPoint}</option>}
                    </select>
                  </div>
                  <div className="w-24">
                    <select
                      className="input-field py-1.5 text-xs capitalize"
                      value={override.mode}
                      onChange={e => handleOverrideChange(override.id, 'mode', e.target.value)}
                    >
                      <option value="car">Car</option>
                      <option value="air">Air</option>
                      <option value="bike">Bike</option>
                      <option value="hike">Hike</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveOverride(override.id)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preferred Overnights */}
        <div className="card p-6 space-y-4 bg-white border-slate-100">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Moon className="w-4 h-4" /> Preferred Overnights (Lodging)
              </h3>
              <div className="group relative">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  Force the AI to plan your stay at a specific town or hotel for a particular night.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInputs({
                ...inputs,
                preferredOvernights: [...(inputs.preferredOvernights || []), { dayNumber: (inputs.preferredOvernights?.length || 0) + 1, location: '' }]
              })}
              className="btn-secondary py-1.5 flex items-center gap-2 text-xs"
            >
              <Plus className="w-3 h-3" /> Add Overnight
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(!inputs.preferredOvernights || inputs.preferredOvernights.length === 0) && (
              <p className="text-xs text-slate-400 italic">No specific lodging preferences set. The AI will optimize stays based on the route.</p>
            )}
            {inputs.preferredOvernights?.map((overnight, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-16">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Night</label>
                  <input
                    type="number"
                    min="1"
                    className="input-field py-1.5 text-xs"
                    value={overnight.dayNumber}
                    onChange={e => {
                      const newOvernights = [...(inputs.preferredOvernights || [])];
                      newOvernights[index].dayNumber = parseInt(e.target.value);
                      setInputs({ ...inputs, preferredOvernights: newOvernights });
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Location / Hotel</label>
                  <input
                    type="text"
                    placeholder="City or Hotel Name"
                    className="input-field py-1.5 text-xs"
                    value={overnight.location}
                    onChange={e => {
                      const newOvernights = [...(inputs.preferredOvernights || [])];
                      newOvernights[index].location = e.target.value;
                      setInputs({ ...inputs, preferredOvernights: newOvernights });
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newOvernights = inputs.preferredOvernights?.filter((_, i) => i !== index);
                    setInputs({ ...inputs, preferredOvernights: newOvernights });
                  }}
                  className="p-2 mt-4 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 pt-4">
        <AnimatePresence>
          {errors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full max-w-md overflow-hidden"
            >
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase tracking-wider">
                  <Asterisk className="w-3.5 h-3.5" />
                  Please fix the following:
                </div>
                <ul className="space-y-1">
                  {errors.map((err, i) => (
                    <li key={i} className="text-[11px] text-red-500 flex items-start gap-2">
                      <span className="mt-1 w-1 h-1 bg-red-400 rounded-full flex-shrink-0" />
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={isLoading || errors.length > 0}
          className="btn-primary w-full max-w-md flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Optimizing Your Route...
            </>
          ) : (
            <>
              <Navigation className="w-5 h-5" />
              Build My Trip
            </>
          )}
        </button>
      </div>
    </form>
  );
}
