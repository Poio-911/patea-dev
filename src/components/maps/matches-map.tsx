'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import type { Match, MatchType } from '@/lib/types';
import { pateaMapStyle, ACCENT_COLOR } from './map-styles';
import { formatDistance, getDistance } from '@/lib/geo-utils';
import Link from 'next/link';

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

// ── Teardrop pin with SVG football icon ─────────────────
function buildMatchMarkerSvg(type: MatchType, isActive: boolean): string {
  const color = MATCH_TYPE_COLORS[type] || ACCENT_COLOR;

  const w = isActive ? 34 : 26;
  const h = isActive ? 50 : 38;
  const cx = w / 2;
  const cy = isActive ? 16 : 12;
  const rBall = isActive ? 8 : 6;
  const rPent = rBall * 0.65;
  const strokeW = isActive ? 2 : 1.5;
  const lineW = isActive ? 1.5 : 1.2;

  const glowFilter = isActive
    ? `<filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${color}" flood-opacity="0.7"/></filter>`
    : '';
  const filterAttr = isActive ? ' filter="url(#glow)"' : '';

  const path = isActive
    ? `M17,49 C7,38 3,28 3,16 A14,14 0 0,1 31,16 C31,28 27,38 17,49 Z`
    : `M13,37 C5,28 2,20 2,12 A11,11 0 0,1 24,12 C24,20 21,28 13,37 Z`;

  const pentPoints: string[] = [];
  const radialLines: string[] = [];
  for (let k = 0; k < 5; k++) {
    const angle = -Math.PI / 2 + (2 * Math.PI / 5) * k;
    const vx = cx + rPent * Math.cos(angle);
    const vy = cy + rPent * Math.sin(angle);
    pentPoints.push(`${vx.toFixed(1)},${vy.toFixed(1)}`);
    const ex = cx + rBall * Math.cos(angle);
    const ey = cy + rBall * Math.sin(angle);
    radialLines.push(
      `<line x1="${vx.toFixed(1)}" y1="${vy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${color}" stroke-width="${lineW}"/>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>${glowFilter}</defs>
  <path d="${path}" fill="${color}" stroke="rgba(0,0,0,0.35)" stroke-width="${strokeW}"${filterAttr}/>
  <circle cx="${cx}" cy="${cy}" r="${rBall}" fill="rgba(0,0,0,0.55)"/>
  <polygon points="${pentPoints.join(' ')}" fill="none" stroke="${color}" stroke-width="${lineW}" stroke-linejoin="round"/>
  ${radialLines.join('\n  ')}
</svg>`;
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// ── User location SVG — clean white beacon ───────────────
const USER_MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="12" fill="white" fill-opacity="0.15" stroke="white" stroke-width="1.2" stroke-opacity="0.45"/>
  <circle cx="14" cy="14" r="6" fill="white" stroke="#050b14" stroke-width="2.5"/>
</svg>`;

// ── Type labels ──────────────────────────────────────────
const typeLabels: Record<string, string> = {
  manual: 'Amistoso',
  collaborative: 'Colaborativo',
  by_teams: 'Por Equipos',
  intergroup_friendly: 'Intergrupos',
  league: 'Liga',
  cup: 'Copa',
  league_final: 'Final',
};

// ── Custom popup card ────────────────────────────────────
function MapPopup({
  match,
  userLocation,
  onClose,
}: {
  match: Match;
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
}) {
  const dateObj = new Date(match.date);
  const fecha = dateObj.toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
  const hora = (match.time || '').replace(' hs', '').replace('hs', '').trim();
  const spotsLeft = match.matchSize - (match.players?.length || 0);
  const isFull = spotsLeft <= 0;
  const typeLabel = typeLabels[match.type] || match.type;
  const typeColor = MATCH_TYPE_COLORS[match.type] || ACCENT_COLOR;
  const dist = userLocation
    ? formatDistance(getDistance(userLocation, match.location))
    : '';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 12,
        right: 12,
        zIndex: 10,
        background: '#0d1b2a',
        borderRadius: 18,
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
        padding: '14px 16px 14px 16px',
        fontFamily: 'system-ui, sans-serif',
        pointerEvents: 'auto',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 99,
          color: 'rgba(255,255,255,0.6)',
          cursor: 'pointer',
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>

      {/* Title */}
      <div style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0', lineHeight: 1.3, paddingRight: 30, marginBottom: 8 }}>
        {match.title || match.location?.name || 'Partido'}
      </div>

      {/* Type badge + distance */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 7 }}>
        <span style={{
          background: `${typeColor}20`,
          color: typeColor,
          padding: '2px 9px',
          borderRadius: 99,
          fontSize: 10,
          fontWeight: 700,
          border: `1px solid ${typeColor}40`,
          letterSpacing: '0.02em',
        }}>
          {typeLabel}
        </span>
        {dist && (
          <span style={{ fontSize: 10, color: '#64748b' }}>📍 {dist}</span>
        )}
      </div>

      {/* Date / time */}
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>
        📅 {fecha}{hora ? <span>&nbsp;· 🕐 {hora}</span> : null}
      </div>

      {/* Players */}
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
        👥 {match.players?.length || 0}/{match.matchSize}
        &nbsp;·&nbsp;
        <span style={{ color: isFull ? '#ef4444' : '#4ade80' }}>
          {isFull ? 'Lleno' : `${spotsLeft} lugar${spotsLeft !== 1 ? 'es' : ''} libre${spotsLeft !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* CTA */}
      <Link
        href={`/matches/${match.id}`}
        style={{
          display: 'inline-block',
          background: ACCENT_COLOR,
          color: '#000',
          padding: '6px 16px',
          borderRadius: 9,
          fontSize: 12,
          fontWeight: 700,
          textDecoration: 'none',
          letterSpacing: '0.01em',
        }}
      >
        Ver partido →
      </Link>
    </div>
  );
}

// ── Component ───────────────────────────────────────────
type MatchesMapProps = {
  matches: Match[];
  userLocation: { lat: number; lng: number } | null;
  searchRadius: number | null;
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
  const activeMarkerRef = useRef<{ marker: google.maps.Marker; type: MatchType } | null>(null);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

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

    existingMarkers.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.setMap(null);
        existingMarkers.delete(id);
      }
    });

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
            scaledSize: new google.maps.Size(26, 38),
            anchor: new google.maps.Point(13, 38),
          },
          zIndex: 1,
          optimized: false,
          title: match.title || match.location.name,
        });

        marker.addListener('click', () => {
          // Restore the previous active marker
          if (activeMarkerRef.current && activeMarkerRef.current.marker !== marker) {
            activeMarkerRef.current.marker.setIcon({
              url: svgToDataUri(buildMatchMarkerSvg(activeMarkerRef.current.type, false)),
              scaledSize: new google.maps.Size(26, 38),
              anchor: new google.maps.Point(13, 38),
            });
            activeMarkerRef.current.marker.setZIndex(1);
          }

          // Activate this marker (glow + larger)
          marker.setIcon({
            url: svgToDataUri(buildMatchMarkerSvg(match.type, true)),
            scaledSize: new google.maps.Size(34, 50),
            anchor: new google.maps.Point(17, 50),
          });
          marker.setZIndex(10);
          activeMarkerRef.current = { marker, type: match.type };

          setSelectedMatch(match);
          onMatchSelect?.(match.id);
        });

        existingMarkers.set(match.id, marker);
      }
    });
  }, [map, matches, onMatchSelect]);

  // Clean up on unmount
  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      markers.forEach((m) => m.setMap(null));
      markers.clear();
    };
  }, []);

  const handleMapClick = useCallback(() => {
    setSelectedMatch(null);
    if (activeMarkerRef.current) {
      activeMarkerRef.current.marker.setIcon({
        url: svgToDataUri(buildMatchMarkerSvg(activeMarkerRef.current.type, false)),
        scaledSize: new google.maps.Size(26, 38),
        anchor: new google.maps.Point(13, 38),
      });
      activeMarkerRef.current.marker.setZIndex(1);
      activeMarkerRef.current = null;
    }
  }, []);

  return (
    <div className="relative w-full h-full">
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
      {selectedMatch && (
        <MapPopup
          match={selectedMatch}
          userLocation={userLocation}
          onClose={() => {
            setSelectedMatch(null);
            if (activeMarkerRef.current) {
              activeMarkerRef.current.marker.setIcon({
                url: svgToDataUri(buildMatchMarkerSvg(activeMarkerRef.current.type, false)),
                scaledSize: new google.maps.Size(26, 38),
                anchor: new google.maps.Point(13, 38),
              });
              activeMarkerRef.current.marker.setZIndex(1);
              activeMarkerRef.current = null;
            }
          }}
        />
      )}
    </div>
  );
}
