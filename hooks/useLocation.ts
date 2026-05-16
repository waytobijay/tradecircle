/**
 * hooks/useLocation.ts
 * Geolocation hook — requests device location, reverse-geocodes it,
 * and persists the result to localStorage.
 * Spec ref: section 9.4 (Location Discovery)
 *
 * Usage:
 *   const { location, loading, error, requestLocation } = useLocation();
 */

import { useState, useCallback, useEffect } from 'react';
import { getUserLocation, type LocationResult } from '@/utils/location';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const STORAGE_KEY = 'tc-location';

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useLocation() {
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // ── On mount: restore from localStorage ───

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as LocationResult;
        setLocation(parsed);
      }
    } catch {
      // Malformed or missing — ignore; user can request fresh location
    }
  }, []);

  // ── requestLocation ────────────────────────

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getUserLocation();
      setLocation(result);

      // Persist to localStorage for subsequent page loads
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      }
    } catch {
      setError('Could not get your location. Please enter it manually.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { location, loading, error, requestLocation };
}
