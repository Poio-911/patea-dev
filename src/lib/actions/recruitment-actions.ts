'use server';

import { getServerSession } from '@/lib/auth/get-server-session';
import type { AvailablePlayer, DayOfWeek, TimeOfDay } from '@/lib/types';
import { getAdminDb } from '@/firebase/admin-init';
import { Timestamp, GeoPoint } from 'firebase-admin/firestore';

// Recursively converts Firestore-specific types (Timestamp, GeoPoint) to plain JS values
// so Next.js can serialize the result from server action to client
function serializeFirestore(value: unknown): unknown {
    if (value instanceof Timestamp) {
        return value.toDate().toISOString();
    }
    if (value instanceof GeoPoint) {
        return { lat: value.latitude, lng: value.longitude };
    }
    if (Array.isArray(value)) {
        return value.map(serializeFirestore);
    }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serializeFirestore(v)])
        );
    }
    return value;
}

const db = getAdminDb();

// Helper to calculate distance between two coordinates in kilometers using Haversine formula
function calculateDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

/**
 * Returns the set of UIDs that belong to any group the current user is part of.
 * These players can already be invited from within the match itself, so they
 * should not appear in the Mercado de Fichajes.
 */
async function getGroupMateUids(currentUserId: string): Promise<Set<string>> {
    // Find all player docs owned by the current user → get their groupIds
    const myPlayersSnap = await db.collection('players')
        .where('ownerUid', '==', currentUserId)
        .get();

    const groupIds = [...new Set(
        myPlayersSnap.docs
            .map(d => d.data().groupId as string | null)
            .filter((id): id is string => !!id)
    )];

    if (groupIds.length === 0) return new Set();

    // For each group, find all players in that group and collect their ownerUids
    const uidSet = new Set<string>();
    for (const groupId of groupIds) {
        const groupPlayersSnap = await db.collection('players')
            .where('groupId', '==', groupId)
            .get();
        groupPlayersSnap.docs.forEach(d => {
            const ownerUid = d.data().ownerUid as string | undefined;
            if (ownerUid) uidSet.add(ownerUid);
        });
    }

    return uidSet;
}

/**
 * Busca jugadores disponibles cercanos dentro de un radio dado,
 * excluyendo compañeros de grupo del usuario y jugadores ya en el partido.
 */
export async function getAvailableLocalPlayersAction({
    lat,
    lng,
    radiusInKm = 10,
    dayOfWeek,
    timeOfDay,
    matchPlayerUids = [],
}: {
    lat: number;
    lng: number;
    radiusInKm?: number;
    dayOfWeek?: DayOfWeek;
    timeOfDay?: TimeOfDay;
    matchPlayerUids?: string[];
}): Promise<{ success: boolean; players?: (AvailablePlayer & { matchScore?: number; isCurrentUser?: boolean; distanceKm?: number })[]; error?: string }> {
    try {
        const session = await getServerSession();
        if (!session?.user?.uid) {
            return { success: false, error: 'No autenticado' };
        }

        const currentUserId = session.user.uid;

        // Guard against invalid coordinates
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
            console.error('[recruitment] Coordenadas inválidas recibidas:', { lat, lng });
            return { success: false, error: 'El partido no tiene coordenadas de ubicación válidas.' };
        }

        // Build exclusion set: group mates + players already in the match
        const groupMateUids = await getGroupMateUids(currentUserId);
        const excludedUids = new Set([...groupMateUids, ...matchPlayerUids]);

        console.log(`[recruitment] UIDs excluidos (grupo + partido): ${excludedUids.size}`);

        // Fetch all available players
        const snapshot = await db.collection('availablePlayers').get();

        let players = snapshot.docs.map(doc =>
            serializeFirestore({ id: doc.id, ...doc.data() }) as unknown as AvailablePlayer
        );

        console.log(`[recruitment] Total de jugadores en availablePlayers: ${players.length}`);
        console.log(`[recruitment] Buscando a ${radiusInKm}km de (${lat}, ${lng})`);

        // Filtrar por distancia circular real
        players = players.filter(p => {
            if (!p.location?.lat || !p.location?.lng) {
                console.log(`[recruitment] Jugador ${p.uid} (${p.displayName}) sin coordenadas de ubicación - excluido`);
                return false;
            }

            const dist = calculateDistanceInKm(lat, lng, p.location.lat, p.location.lng);
            console.log(`[recruitment] Jugador ${p.uid} (${p.displayName}): ${dist.toFixed(1)}km`);
            return dist <= radiusInKm;
        });

        // Excluir compañeros de grupo y jugadores ya en el partido
        players = players.filter(p => !excludedUids.has(p.uid));

        console.log(`[recruitment] Jugadores tras excluir grupo/partido: ${players.length}`);

        // Calcular score de compatibilidad por disponibilidad (sin filtrar, solo rankear)
        let scoredPlayers = players.map(p => {
            let score = 1;
            if (dayOfWeek || timeOfDay) {
                if (p.availability && Object.keys(p.availability).length > 0) {
                    let matchDay = true;
                    let matchTime = true;
                    if (dayOfWeek && p.availability[dayOfWeek] !== undefined) {
                        const timesForDay = p.availability[dayOfWeek] || [];
                        if (timeOfDay) matchTime = timesForDay.includes(timeOfDay);
                    } else if (dayOfWeek) {
                        matchDay = false;
                    }
                    if (matchDay && matchTime) score = 2;
                    else if (!matchDay && !matchTime) score = 0;
                    else score = 1;
                }
                // availability vacío = disponible siempre → score neutro (1)
            }
            const distKm = (p.location?.lat != null && p.location?.lng != null)
                ? parseFloat(calculateDistanceInKm(lat, lng, p.location.lat, p.location.lng).toFixed(1))
                : undefined;
            return { ...p, matchScore: score, isCurrentUser: p.uid === currentUserId, distanceKm: distKm };
        });
        scoredPlayers.sort((a, b) => b.matchScore - a.matchScore);

        return { success: true, players: scoredPlayers };
    } catch (error: any) {
        console.error('Error fetching available local players:', error);
        return { success: false, error: error.message || 'Error al buscar jugadores' };
    }
}
