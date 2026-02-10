'use server';

import { getAdminDb } from '../../firebase/admin-init';
import { AvailablePlayer, Match } from '../types';
import * as geohash from 'ngeohash';
import { isSameDay, parseISO } from 'date-fns';

export type SearchPlayersParams = {
    lat: number;
    lng: number;
    radiusInKm: number; // e.g. 5, 10, 20
    position?: string; // 'all' | 'DEL' | 'MED' | 'DEF' | 'POR'
    minOvr?: number;
    maxOvr?: number;
    excludeIds?: string[];
    limit?: number;
};

export type SearchPlayersResult = {
    players: (AvailablePlayer & { distance: number })[];
    nextPageToken?: string; // For future pagination
};

export type SearchMatchesParams = {
    lat: number;
    lng: number;
    radiusInKm: number;
    date?: string; // 'YYYY-MM-DD'
    matchSize?: number;
    limit?: number;
};

export type SearchMatchesResult = {
    matches: (Match & { distance: number })[];
};

export async function searchPlayersAction(params: SearchPlayersParams): Promise<{ success: boolean; data?: SearchPlayersResult; error?: string }> {
    try {
        const { lat, lng, radiusInKm = 10, position = 'all', minOvr = 0, maxOvr = 99, excludeIds = [], limit = 50 } = params;

        // 1. Calculate Geohash bounds
        // We roughly estimate 1 degree lat ~= 111km. 
        // This is a naive implementation; for production 'geofire-common' is better but let's stick to simpler bounding box or just client-side filtering after coarse server filtering if user base is small.
        // BUT the goal here is scalability.

        // Strategy:
        // A. Use geohash for "coarse" filtering.
        // B. Refine by exact distance.

        // For now, let's fetch strictly by basic criteria and client-side distance if we can't do complex geohash queries easily without a library.
        // WAIT, I promised Geohashing.

        // Simple Geohash approach:
        // 1. Compute geohash of center.
        // 2. Find neighbors.
        // 3. Query all users in those geohash prefixes?
        // Firestore allows range queries on strings.
        // range = [hash, hash + '~']

        // Resolution depends on radius.
        // precision 4 ~= 39km x 19km
        // precision 5 ~= 4.9km x 4.9km
        // precision 6 ~= 1.2km x 0.6km

        const { hashesToQuery } = getGeohashRange(lat, lng, radiusInKm);

        // We need to query Firestore for each hash prefix.
        // Firestore `in` query supports up to 10/30 items.
        // But we can't do `startAt` / `endAt` for multiple ranges easily in one query.
        // We might need parallel queries.
        // OR just one query if we define a "geohash" field with high precision and do range inequality?
        // Accepted solution usually involves asking for the specific bounded box of geohashes.

        // Let's implement the "Proximity Hash" approach:
        // Store ONE geohash at high precision (e.g. 10 chars) in the doc (Done).
        // Query: find docs where geohash starts with X, Y, or Z.
        // Since we can't do "starts with X OR Y", we verify:
        // Actually, we can use `where('location.geohash', '>=', range.start)` and `<=`.
        // But for multiple neighbors we need multiple queries.

        const db = getAdminDb();
        const playersRef = db.collection('availablePlayers');

        // Let's settle on fetching from the "main" geohash area and maybe neighbors if needed.
        // For simplicity V1: Fetch from the calculated hashes (9 queries max).

        const promises = hashesToQuery.map(hash => {
            const end = hash + '~';
            let q = playersRef
                .where('location.geohash', '>=', hash)
                .where('location.geohash', '<=', end);

            if (position !== 'all') {
                q = q.where('position', '==', position);
            }

            // Note: Firestore requires composite index for Range(geohash) + Equality(position).
            // I should document this requirement.

            return q.get();
        });

        const snapshots = await Promise.all(promises);
        const distinctPlayers = new Map<string, AvailablePlayer & { distance: number }>();

        snapshots.forEach(snap => {
            snap.forEach(doc => {
                const data = doc.data() as AvailablePlayer;
                if (excludeIds.includes(data.uid)) return;

                // OVR Filter (Manual because we used Inequality on Geohash already)
                if (data.ovr < minOvr || data.ovr > maxOvr) return;

                // Exact Distance Check
                const dist = getDistanceFromLatLonInKm(lat, lng, data.location.lat, data.location.lng);
                if (dist <= radiusInKm) {
                    distinctPlayers.set(data.uid, { ...data, distance: dist });
                }
            });
        });

        const sortedPlayers = Array.from(distinctPlayers.values()).sort((a, b) => a.distance - b.distance);

        return {
            success: true,
            data: {
                players: sortedPlayers.slice(0, limit)
            }
        };

    } catch (error: any) {
        console.error('Error searching players:', error);
        return { success: false, error: 'Error interno al buscar jugadores.' };
    }
}

export async function searchMatchesAction(params: SearchMatchesParams): Promise<{ success: boolean; data?: SearchMatchesResult; error?: string }> {
    try {
        const { lat, lng, radiusInKm = 10, date, matchSize, limit = 50 } = params;

        const { hashesToQuery } = getGeohashRange(lat, lng, radiusInKm);

        const db = getAdminDb();
        const matchesRef = db.collection('matches');

        // Query public upcoming matches
        const promises = hashesToQuery.map(hash => {
            const end = hash + '~';
            return matchesRef
                .where('isPublic', '==', true)
                .where('status', '==', 'upcoming')
                .where('location.geohash', '>=', hash)
                .where('location.geohash', '<=', end)
                .get();
        });

        const snapshots = await Promise.all(promises);
        const distinctMatches = new Map<string, Match & { distance: number }>();

        snapshots.forEach(snap => {
            snap.forEach(doc => {
                const data = { id: doc.id, ...doc.data() } as Match;

                // Date Filter
                if (date && !isSameDay(new Date(data.date), parseISO(date))) return;

                // Match Size Filter
                if (matchSize && data.matchSize !== matchSize) return;

                // Exact Distance Check
                const dist = getDistanceFromLatLonInKm(lat, lng, data.location.lat, data.location.lng);
                if (dist <= radiusInKm) {
                    distinctMatches.set(data.id, { ...data, distance: dist });
                }
            });
        });

        const sortedMatches = Array.from(distinctMatches.values()).sort((a, b) => a.distance - b.distance);

        return {
            success: true,
            data: {
                matches: sortedMatches.slice(0, limit)
            }
        };

    } catch (error: any) {
        console.error('Error searching matches:', error);
        return { success: false, error: 'Error interno al buscar partidos.' };
    }
}

function getGeohashRange(lat: number, lng: number, radiusInKm: number) {
    let precision = 4;
    if (radiusInKm <= 5) precision = 6;
    else if (radiusInKm <= 20) precision = 5;
    else precision = 4;

    const centerHash = geohash.encode(lat, lng, precision);
    const neighbors = geohash.neighbors(centerHash);
    const hashesToQuery = [centerHash, ...neighbors];

    return { hashesToQuery, precision };
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}
