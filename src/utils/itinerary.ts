import { format, parseISO } from 'date-fns';

export const formatLatLngToDMS = (lat: number, lng: number): string => {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return '';
  
  const toDMS = (num: number, isLat: boolean) => {
    const absNum = Math.abs(num);
    const d = Math.floor(absNum);
    const m = Math.floor((absNum - d) * 60);
    const s = ((absNum - d - m / 60) * 3600).toFixed(1);
    const direction = isLat 
      ? (num >= 0 ? 'N' : 'S') 
      : (num >= 0 ? 'E' : 'W');
    return `${d}°${m}'${s}"${direction}`;
  };
  
  return `${toDMS(lat, true)} ${toDMS(lng, false)}`;
};

export const formatGPSToDMSString = (gpsStr: string | undefined, fallbackCoords?: { lat: number; lng: number }): string => {
  if (!gpsStr) {
    if (fallbackCoords && typeof fallbackCoords.lat === 'number' && typeof fallbackCoords.lng === 'number') {
      return formatLatLngToDMS(fallbackCoords.lat, fallbackCoords.lng);
    }
    return '';
  }
  
  const parts = gpsStr.split(/[\s,]+/);
  if (parts.length >= 2) {
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return formatLatLngToDMS(lat, lng);
    }
  }
  
  return gpsStr;
};

export const formatDayOfWeek = (dateStr: string) => {
  try {
    return format(parseISO(dateStr), 'EEE');
  } catch (e) {
    return '';
  }
};

export const formatDateOnly = (dateStr: string) => {
  try {
    return format(parseISO(dateStr), 'MMM-dd');
  } catch (e) {
    return dateStr;
  }
};

export const formatTime = (timeStr: string) => {
  if (!timeStr) return '';
  
  const decimalHourMatch = timeStr.match(/(\d+\.?\d*)\s*(h|hour)/i);
  if (decimalHourMatch && !timeStr.includes('m')) {
    const hours = parseFloat(decimalHourMatch[1]);
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`.trim();
  }

  const hMatch = timeStr.match(/(\d+)\s*h/i);
  const mMatch = timeStr.match(/(\d+)\s*m/i);
  
  let h = hMatch ? parseInt(hMatch[1]) : 0;
  let m = mMatch ? parseInt(mMatch[1]) : 0;

  if (!hMatch && !mMatch) {
    const colonMatch = timeStr.match(/(\d+):(\d+)/);
    if (colonMatch) {
      h = parseInt(colonMatch[1]);
      m = parseInt(colonMatch[2]);
    } else {
      const mins = parseFloat(timeStr);
      if (!isNaN(mins)) {
        if (mins < 24 && timeStr.includes('.')) {
          h = Math.floor(mins);
          m = Math.round((mins - h) * 60);
        } else {
          h = Math.floor(mins / 60);
          m = Math.round(mins % 60);
        }
      } else {
        return timeStr.replace(/mins?/g, 'm').trim();
      }
    }
  }

  if (m >= 60) {
    h += Math.floor(m / 60);
    m = m % 60;
  }

  if (h === 0 && m === 0) return '';
  return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`.trim();
};

export const parseDurationToMins = (durationStr: string): number => {
  if (!durationStr) return 0;
  const cleanStr = durationStr.toLowerCase().trim();
  
  const floatHMatch = cleanStr.match(/([\d.]+)\s*(h|hr|hour|s)/);
  if (floatHMatch) {
    const hVal = parseFloat(floatHMatch[1]);
    if (!isNaN(hVal)) {
      return Math.round(hVal * 60);
    }
  }
  
  const hMatch = cleanStr.match(/(\d+)\s*(h|hr|hour)/);
  const h = hMatch ? parseInt(hMatch[1], 10) : 0;
  const mMatch = cleanStr.match(/(\d+)\s*(m|min|minute|s)/);
  const m = mMatch ? parseInt(mMatch[1], 10) : (cleanStr.includes('h') ? 0 : parseInt(cleanStr, 10) || 0);
  
  return (h * 60) + m;
};

export const formatArrival = (timeStr: string) => {
  if (!timeStr || timeStr === "N/A") return timeStr || '';
  try {
    // Check for 24h format (e.g., 19:15 or 19:15:00)
    const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      let h = parseInt(match[1]);
      const m = match[2];
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      return `${h}:${m} ${ampm}`;
    }
    // If it already has am/pm, ensure it has a space and is uppercase
    const ampmMatch = timeStr.match(/(\d{1,2}:\d{2})\s*(am|pm)/i);
    if (ampmMatch) {
      return `${ampmMatch[1]} ${ampmMatch[2].toUpperCase()}`;
    }
  } catch (e) {
    return timeStr;
  }
  return timeStr;
};

export const formatDeparture = (timeStr: string) => formatArrival(timeStr);

export const formatTimeRange = (rangeStr: string) => {
  if (!rangeStr || rangeStr === "N/A") return rangeStr || '';
  // Split by common delimiters like "-", "to", "until"
  const parts = rangeStr.split(/\s*-\s*|\s+to\s+|\s+until\s+/i);
  if (parts.length === 2) {
    return `${formatArrival(parts[0].trim())} - ${formatArrival(parts[1].trim())}`;
  }
  return rangeStr;
};

export const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.replace(/[^0-9:]/g, '').split(':');
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours * 60 + minutes;
};

export const formatMinsToHoursAndMins = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`.trim() || '0m';
};

export const isTomorrow = (dateStr: string) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const visitDate = parseISO(dateStr);
    visitDate.setHours(0, 0, 0, 0);
    const diffTime = visitDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1;
  } catch (e) {
    return false;
  }
};
