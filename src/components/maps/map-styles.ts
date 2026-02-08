/**
 * Custom dark map style for Pateá — hides POIs, transit, and businesses.
 * Inspired by the app's dark "game" theme (carbon + volt yellow accents).
 */
export const pateaMapStyle: google.maps.MapTypeStyle[] = [
  // ── Base geometry: Deep Blue/Black ──
  { elementType: 'geometry', stylers: [{ color: '#050b14' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a9ab0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#050b14' }, { weight: 3 }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  // ── Water: Deep Tech Blue ──
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },

  // ── Roads: Subtle lines ──
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'road',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },

  // ── Polygons: Neon Accents (Subtle) ──
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0f221a' }], // Very subtle green tint
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'geometry',
    stylers: [{ color: '#1a1825' }], // Very subtle purple tint
  },

  // ── Hide noise ──
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

/**
 * Hex colors for each position — used by imperative markers.
 * Matches the HSL values from globals.css pos-* tokens.
 */
export const POSITION_COLORS = {
  DEL: '#eb4034', // red
  MED: '#a855f7', // purple
  DEF: '#5b8af5', // blue
  POR: '#f59e0b', // amber
} as const;

/** Primary accent color (volt yellow from game theme) */
export const ACCENT_COLOR = '#c8ff00';
