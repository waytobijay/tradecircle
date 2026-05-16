/**
 * services/geo.ts
 * Geolocation utilities for ad targeting and map clustering.
 * Spec ref: section 13.14 (Phase 4 — Location-based ad geo-targeting)
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Mean radius of the Earth in kilometres. */
const EARTH_RADIUS_KM = 6371;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ─── Exported utilities ───────────────────────────────────────────────────────

/**
 * Haversine distance between two lat/lng points in km.
 *
 * Uses the Haversine formula which accounts for the spherical shape of the
 * Earth and gives accurate results for distances up to a few thousand km.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Check if a user location is within a radius of an ad's target location.
 *
 * @param userLat  - User's latitude
 * @param userLng  - User's longitude
 * @param adLat    - Ad's target latitude
 * @param adLng    - Ad's target longitude
 * @param radiusKm - Targeting radius in kilometres
 * @returns true if the user is within the specified radius
 */
export function isWithinRadius(
  userLat: number,
  userLng: number,
  adLat: number,
  adLng: number,
  radiusKm: number,
): boolean {
  return haversineDistance(userLat, userLng, adLat, adLng) <= radiusKm;
}

/**
 * Cluster nearby points to avoid map marker overlap.
 *
 * Uses a simple greedy algorithm: iterates through all points and assigns
 * each un-clustered point as a cluster seed, then groups any remaining
 * un-clustered points that fall within `radiusKm` of that seed into the
 * same cluster.
 *
 * @param points   - Array of objects with `lat` and `lng` properties
 * @param radiusKm - Cluster radius in kilometres
 * @returns Array of clusters; each cluster is an array of the input points
 */
export function clusterPoints<T extends { lat: number; lng: number }>(
  points: T[],
  radiusKm: number,
): T[][] {
  const remaining = [...points];
  const clusters: T[][] = [];

  while (remaining.length > 0) {
    // Take the first remaining point as the seed of a new cluster.
    const seed = remaining.shift()!;
    const cluster: T[] = [seed];

    // Walk backwards so splice indices stay valid.
    for (let i = remaining.length - 1; i >= 0; i--) {
      const candidate = remaining[i];
      if (
        haversineDistance(seed.lat, seed.lng, candidate.lat, candidate.lng) <=
        radiusKm
      ) {
        cluster.push(candidate);
        remaining.splice(i, 1);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}
