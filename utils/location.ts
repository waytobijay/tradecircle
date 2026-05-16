/**
 * utils/location.ts
 * Geolocation, reverse-geocoding and distance helpers.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationResult {
  city: string;
  country: string;
  coordinates: Coordinates;
}

/**
 * Wrap the browser Geolocation API in a Promise.
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 60_000,
    });
  });
}

interface NominatimResponse {
  address: {
    city?: string;
    town?: string;
    village?: string;
    country?: string;
  };
}

/**
 * Convert latitude/longitude to a human-readable city and country
 * using the Nominatim (OpenStreetMap) reverse-geocoding API.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<LocationResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;

  const response = await fetch(url, {
    headers: {
      // Nominatim policy requires a valid User-Agent
      'User-Agent': 'TradeCircle/1.0 (tradecircle.com.au)',
    },
  });

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed with status ${response.status}`);
  }

  const data = (await response.json()) as NominatimResponse;

  const city =
    data.address.city ??
    data.address.town ??
    data.address.village ??
    'Unknown city';

  const country = data.address.country ?? 'Unknown country';

  return {
    city,
    country,
    coordinates: { lat, lng },
  };
}

const EARTH_RADIUS_KM = 6371;

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate the great-circle distance between two coordinates (Haversine formula).
 * Returns the distance in kilometres.
 */
export function calculateDistance(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Convenience: get the device's current position and reverse-geocode it.
 */
export async function getUserLocation(): Promise<LocationResult> {
  const position = await getCurrentPosition();
  const { latitude, longitude } = position.coords;
  return reverseGeocode(latitude, longitude);
}
