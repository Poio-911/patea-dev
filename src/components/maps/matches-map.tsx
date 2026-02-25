'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import type { Match, MatchType } from '@/lib/types';
import { pateaMapStyle, ACCENT_COLOR } from './map-styles';
import { formatDistance, getDistance } from '@/lib/geo-utils';

const DEFAULT_CENTER = { lat: -34.9011, lng: -56.1645 }; // Montevideo
const DEFAULT_ZOOM = 12;

// ── Match type → marker color ───────────────────────────
const MATCH_TYPE_COLORS: Record<MatchType, string> = {
  manual: '#c8ff00',        // primary/volt
  collaborative: '#a855f7', // accent purple
  by_teams: '#5b8af5',      // blue
  league: '#f59e0b',        // amber
  cup: '#ef4444',           // red
  league_final: '#f59e0b',  // amber
  intergroup_friendly: '#22c55e', // green
};

function buildMatchMarkerSvg(type: MatchType, isActive: boolean): string {
  const color = MATCH_TYPE_COLORS[type] || ACCENT_COLOR;
  const size = isActive ? 44 : 34;
  const r = size / 2;
  const tail = size * 0.35;
  const glowFilter = isActive
    ? `<filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${color}" flood-opacity="0.7"/></filter>`
    : '';
  const filterAttr = isActive ? ' filter="url(#glow)"' : '';

  // Football icon (circle with pentagon pattern)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + tail}" viewBox="0 0 ${size} ${size + tail}">
    <defs>${glowFilter}</defs>
    <path d="M${r},${size + tail} L${r - 6},${size - 2} A${r},${r} 0 1,1 ${r + 6},${size - 2} Z" fill="${color}"${filterAttr}/>
    <circle cx="${r}" cy="${r}" r="${r - 2}" fill="${color}" stroke="white" stroke-width="2.5"${filterAttr}/>
    <text x="${r}" y="${r + 1}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-weight="700" font-size="${isActive ? 16 : 13}" fill="white">⚽</text>
  </svg>`;
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// ── User location SVG ───────────────────────────────────
const USER_MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="13" fill="${ACCENT_COLOR}" fill-opacity="0.15" stroke="${ACCENT_COLOR}" stroke-width="1.5" stroke-opacity="0.5"/>
  <circle cx="14" cy="14" r="7" fill="${ACCENT_COLOR}" stroke="white" stroke-width="2.5"/>
</svg>`;

// ── Type labels for InfoWindow ──────────────────────────
const typeLabels: Record<string, string> = {
  manual: 'Amistoso',
  collaborative: 'Colaborativo',
  by_teams: 'Por Equipos',
  intergroup_friendly: 'Intergrupos',
  league: 'Liga',
  cup: 'Copa',
  league_final: 'Final',
};

// ── Component ───────────────────────────────────────────
type MatchesMapProps = {
  matches: Match[];
  userLocation: { lat: number; lng: number } | null;
  searchRadius: number | null; // km, null = no circle
  onMatchSelect?: (matchId: string) => void;
};

export function MatchesMap({
  matches,
  userLocation,
  searchRadius,
  onMatchSelect,
}: MatchesMapProps) {
  const map = useMap();
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // ── User location marker ──
  useEffect(() => {
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
      userMarkerRef.current = null;
    }

    if (!userLocation) return;

    userMarkerRef.current = new google.maps.Marker({
      position: userLocation,
      map,
      icon: {
        url: svgToDataUri(USER_MARKER_SVG),
        scaledSize: new google.maps.Size(28, 28),
        anchor: new google.maps.Point(14, 14),
      },
      zIndex: 100,
      clickable: false,
      title: 'Tu ubicación',
    });

    return () => {
      userMarkerRef.current?.setMap(null);
    };
  }, [map, userLocation]);

  // ── Search radius circle ──
  useEffect(() => {
    if (!map) return;

    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }

    if (!userLocation || !searchRadius) return;

    circleRef.current = new google.maps.Circle({
      center: userLocation,
      radius: searchRadius * 1000,
      map,
      fillColor: ACCENT_COLOR,
      fillOpacity: 0.04,
      strokeColor: ACCENT_COLOR,
      strokeOpacity: 0.2,
      strokeWeight: 1.5,
      clickable: false,
    });

    return () => {
      circleRef.current?.setMap(null);
    };
  }, [map, userLocation, searchRadius]);

  // ── Match markers ──
  useEffect(() => {
    if (!map) return;

    const currentIds = new Set(matches.map((m) => m.id));
    const existingMarkers = markersRef.current;

    // Remove markers for matches no longer in the list
    existingMarkers.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.setMap(null);
        existingMarkers.delete(id);
      }
    });

    // Create or update markers for current matches
    matches.forEach((match) => {
      if (!match.location?.lat || !match.location?.lng) return;

      const existing = existingMarkers.get(match.id);

      if (existing) {
        existing.setPosition({ lat: match.location.lat, lng: match.location.lng });
      } else {
        const marker = new google.maps.Marker({
          position: { lat: match.location.lat, lng: match.location.lng },
          map,
          icon: {
            url: svgToDataUri(buildMatchMarkerSvg(match.type, false)),
            scaledSize: new google.maps.Size(34, 46),
            anchor: new google.maps.Point(17, 46),
          },
          zIndex: 1,
          optimized: false,
          title: match.title || match.location.name,
        });

        marker.addListener('click', () => {
          // Close previous info window
          if (infoWindowRef.current) {
            infoWindowRef.current.close();
          }

          const dateObj = new Date(match.date);
          const fecha = dateObj.toLocaleDateString('es-AR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          });
          const hora = (match.time || '').replace(' hs', '').replace('hs', '').trim();
          const spotsLeft = match.matchSize - (match.players?.length || 0);
          const typeLabel = typeLabels[match.type] || match.type;
          const dist = userLocation
            ? formatDistance(getDistance(userLocation, match.location))
            : '';

          const content = `
            <div style="font-family:system-ui,sans-serif;min-width:180px;max-width:240px;padding:4px 0;">
              <div style="font-weight:700;font-size:13px;margin-bottom:4px;color:#fff;">
                ${match.title || match.location.name}
              </div>
              <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
                <span style="background:${MATCH_TYPE_COLORS[match.type] || ACCENT_COLOR}22;color:${MATCH_TYPE_COLORS[match.type] || ACCENT_COLOR};padding:1px 6px;border-radius:99px;font-size:10px;font-weight:600;border:1px solid ${MATCH_TYPE_COLORS[match.type] || ACCENT_COLOR}44;">
                  ${typeLabel}
                </span>
                ${dist ? `<span style="font-size:10px;color:#94a3b8;">📍 ${dist}</span>` : ''}
              </div>
              <div style="font-size:11px;color:#94a3b8;margin-bottom:2px;">
                📅 ${fecha}${hora ? ` · 🕐 ${hora}` : ''}
              </div>
              <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">
                👥 ${match.players?.length || 0}/${match.matchSize} · ${spotsLeft} lugar${spotsLeft !== 1 ? 'es' : ''} libre${spotsLeft !== 1 ? 's' : ''}
              </div>
              <a href="/matches/${match.id}" style="display:inline-block;background:${ACCENT_COLOR};color:#000;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none;">
                Ver partido →
              </a>
            </div>
          `;

          const infoWindow = new google.maps.InfoWindow({ content });
          infoWindow.open(map, marker);
          infoWindowRef.current = infoWindow;

          onMatchSelect?.(match.id);
        });

        existingMarkers.set(match.id, marker);
      }
    });
  }, [map, matches, userLocation, onMatchSelect]);

  // Clean up all markers on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current.clear();
      infoWindowRef.current?.close();
    };
  }, []);

  const handleMapClick = useCallback(() => {
    infoWindowRef.current?.close();
  }, []);

  return (
    <GoogleMap
      defaultCenter={userLocation || DEFAULT_CENTER}
      defaultZoom={DEFAULT_ZOOM}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      styles={pateaMapStyle}
      onClick={handleMapClick}
      className="w-full h-full rounded-lg"
    />
  );
}
