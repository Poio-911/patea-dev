'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import type { AvailablePlayer, PlayerPosition } from '@/lib/types';
import { pateaMapStyle, POSITION_COLORS, ACCENT_COLOR } from './map-styles';

const DEFAULT_CENTER = { lat: -34.9011, lng: -56.1645 }; // Montevideo
const DEFAULT_ZOOM = 12;

// ── SVG marker builder ─────────────────────────────────
function buildMarkerSvg(
  position: PlayerPosition,
  isActive: boolean
): string {
  const color = POSITION_COLORS[position];
  const size = isActive ? 44 : 34;
  const r = size / 2;
  const textSize = isActive ? 11 : 9;
  const glowFilter = isActive
    ? `<filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${color}" flood-opacity="0.7"/></filter>`
    : '';
  const filterAttr = isActive ? ' filter="url(#glow)"' : '';
  const tail = size * 0.35;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + tail}" viewBox="0 0 ${size} ${size + tail}">
    <defs>${glowFilter}</defs>
    <path d="M${r},${size + tail} L${r - 6},${size - 2} A${r},${r} 0 1,1 ${r + 6},${size - 2} Z" fill="${color}"${filterAttr}/>
    <circle cx="${r}" cy="${r}" r="${r - 2}" fill="${color}" stroke="white" stroke-width="2.5"${filterAttr}/>
    <text x="${r}" y="${r + 1}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-weight="700" font-size="${textSize}" fill="white">${position}</text>
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

// ── Component ───────────────────────────────────────────
type PlayersMapProps = {
  players: AvailablePlayer[];
  userLocation: { lat: number; lng: number } | null;
  activePlayerId: string | null;
  onPlayerSelect: (uid: string | null) => void;
  searchRadius: number;
};

export function PlayersMap({
  players,
  userLocation,
  activePlayerId,
  onPlayerSelect,
  searchRadius,
}: PlayersMapProps) {
  const map = useMap();
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);

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

    if (!userLocation) return;

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

  // ── Player markers ──
  useEffect(() => {
    if (!map) return;

    const currentUids = new Set(players.map((p) => p.uid));
    const existingMarkers = markersRef.current;

    // Remove markers for players no longer in the list
    existingMarkers.forEach((marker, uid) => {
      if (!currentUids.has(uid)) {
        marker.setMap(null);
        existingMarkers.delete(uid);
      }
    });

    // Create or update markers for current players
    players.forEach((player) => {
      if (!player.location) return;

      const isActive = activePlayerId === player.uid;
      const existing = existingMarkers.get(player.uid);

      if (existing) {
        // Update existing marker
        existing.setPosition(player.location);
        existing.setIcon({
          url: svgToDataUri(buildMarkerSvg(player.position, isActive)),
          scaledSize: new google.maps.Size(
            isActive ? 44 : 34,
            isActive ? 59 : 46
          ),
          anchor: new google.maps.Point(
            isActive ? 22 : 17,
            isActive ? 59 : 46
          ),
        });
        existing.setZIndex(isActive ? 50 : 1);
      } else {
        // Create new marker
        const marker = new google.maps.Marker({
          position: player.location,
          map,
          icon: {
            url: svgToDataUri(buildMarkerSvg(player.position, isActive)),
            scaledSize: new google.maps.Size(
              isActive ? 44 : 34,
              isActive ? 59 : 46
            ),
            anchor: new google.maps.Point(
              isActive ? 22 : 17,
              isActive ? 59 : 46
            ),
          },
          zIndex: isActive ? 50 : 1,
          optimized: false,
          title: player.displayName,
        });

        marker.addListener('click', () => {
          onPlayerSelect(player.uid);
        });

        existingMarkers.set(player.uid, marker);
      }
    });
  }, [map, players, activePlayerId, onPlayerSelect]);

  // Clean up all markers on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current.clear();
    };
  }, []);

  // Pan to active player
  useEffect(() => {
    if (!map || !activePlayerId) return;
    const player = players.find((p) => p.uid === activePlayerId);
    if (player?.location) {
      map.panTo(player.location);
    }
  }, [map, activePlayerId, players]);

  const handleMapClick = useCallback(() => {
    onPlayerSelect(null);
  }, [onPlayerSelect]);

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
