/**
 * Haversine distance between two lat/lng points in kilometers.
 */
export function getDistance(
  pos1: { lat: number; lng: number } | null,
  pos2: { lat: number; lng: number }
): number {
  if (!pos1) return Infinity;
  const R = 6371; // Radius of the Earth in km
  const dLat = ((pos2.lat - pos1.lat) * Math.PI) / 180;
  const dLng = ((pos2.lng - pos1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((pos1.lat * Math.PI) / 180) *
      Math.cos((pos2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format a distance in km to a human-readable string.
 * Under 1 km → "500 m", otherwise → "2.3 km"
 */
export function formatDistance(km: number): string {
  if (!isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
