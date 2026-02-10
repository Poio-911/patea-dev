'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { useTheme } from 'next-themes';
import type { AvailablePlayer, Match, PlayerPosition } from '@/lib/types';
import { pateaMapStyle, POSITION_COLORS, ACCENT_COLOR } from '../maps/map-styles';

const DEFAULT_CENTER = { lat: -34.9011, lng: -56.1645 }; // Montevideo
const DEFAULT_ZOOM = 12;

// ── SVG marker builder (Players) ─────────────────────────
function buildPlayerMarkerSvg(
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

// ── SVG marker builder (Matches) ─────────────────────────
function buildMatchMarkerSvg(
    isActive: boolean
): string {
    const color = ACCENT_COLOR;
    const size = isActive ? 44 : 34;
    const r = size / 2;
    const glowFilter = isActive
        ? `<filter id="glowMatch"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${color}" flood-opacity="0.8"/></filter>`
        : '';
    const filterAttr = isActive ? ' filter="url(#glowMatch)"' : '';
    const tail = size * 0.35;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + tail}" viewBox="0 0 ${size} ${size + tail}">
    <defs>${glowFilter}</defs>
    <path d="M${r},${size + tail} L${r - 6},${size - 2} A${r},${r} 0 1,1 ${r + 6},${size - 2} Z" fill="${color}"${filterAttr}/>
    <circle cx="${r}" cy="${r}" r="${r - 2}" fill="#0f172a" stroke="${color}" stroke-width="2.5"${filterAttr}/>
    <path d="M${r - 5},${r} L${r + 5},${r} M${r},${r - 5} L${r},${r + 5}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="${r}" cy="${r}" r="2" fill="${color}"/>
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
type ExplorationEntity =
    | { type: 'player'; data: AvailablePlayer }
    | { type: 'match'; data: Match };

type ExplorationMapProps = {
    entities: ExplorationEntity[];
    userLocation: { lat: number; lng: number } | null;
    activeEntityId: string | null;
    onEntitySelect: (id: string | null) => void;
    searchRadius: number;
    type: 'players' | 'matches';
};

export function ExplorationMap({
    entities,
    userLocation,
    activeEntityId,
    onEntitySelect,
    searchRadius,
    type
}: ExplorationMapProps) {
    const map = useMap();
    const { theme } = useTheme();
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

    // ── Entity markers ──
    useEffect(() => {
        if (!map) return;

        const currentIds = new Set(entities.map((e) => e.data.id || (e.data as any).uid));
        const existingMarkers = markersRef.current;

        // Remove old markers
        existingMarkers.forEach((marker, id) => {
            if (!currentIds.has(id)) {
                marker.setMap(null);
                existingMarkers.delete(id);
            }
        });

        // Create or update markers
        entities.forEach((entity) => {
            const id = entity.data.id || (entity.data as any).uid;
            const pos = entity.data.location;
            if (!pos?.lat || !pos?.lng) return;

            const isActive = activeEntityId === id;
            const existing = existingMarkers.get(id);

            const svg = entity.type === 'player'
                ? buildPlayerMarkerSvg((entity.data as AvailablePlayer).position, isActive)
                : buildMatchMarkerSvg(isActive);

            const markerIcon = {
                url: svgToDataUri(svg),
                scaledSize: new google.maps.Size(
                    isActive ? 44 : 34,
                    isActive ? 59 : 46
                ),
                anchor: new google.maps.Point(
                    isActive ? 22 : 17,
                    isActive ? 59 : 46
                ),
            };

            if (existing) {
                existing.setPosition(pos);
                existing.setIcon(markerIcon);
                existing.setZIndex(isActive ? 50 : 1);
            } else {
                const marker = new google.maps.Marker({
                    position: pos,
                    map,
                    icon: markerIcon,
                    zIndex: isActive ? 50 : 1,
                    optimized: false,
                    title: entity.type === 'player' ? (entity.data as any).displayName : (entity.data as Match).title,
                });

                marker.addListener('click', () => {
                    onEntitySelect(id);
                });

                existingMarkers.set(id, marker);
            }
        });
    }, [map, entities, activeEntityId, onEntitySelect]);

    // Clean up
    useEffect(() => {
        return () => {
            markersRef.current.forEach((m) => m.setMap(null));
            markersRef.current.clear();
        };
    }, []);

    // Pan to active entity
    useEffect(() => {
        if (!map || !activeEntityId) return;
        const entity = entities.find((e) => (e.data.id || (e.data as any).uid) === activeEntityId);
        if (entity?.data?.location) {
            map.panTo(entity.data.location);
        }
    }, [map, activeEntityId, entities]);

    const handleMapClick = useCallback(() => {
        onEntitySelect(null);
    }, [onEntitySelect]);

    const isDark = theme === 'dark' || theme === 'game' || theme === 'nike';

    return (
        <GoogleMap
            defaultCenter={userLocation || DEFAULT_CENTER}
            defaultZoom={DEFAULT_ZOOM}
            gestureHandling="greedy"
            disableDefaultUI
            zoomControl
            styles={isDark ? pateaMapStyle : []}
            onClick={handleMapClick}
            className="w-full h-full"
        />
    );
}
