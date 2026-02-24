'use server';

import { getServerSession } from '@/lib/auth-helpers';
import type { AvailablePlayer, DayOfWeek, TimeOfDay } from '@/lib/types';
import ngeohash from 'ngeohash';
import { getAdminDb } from '@/firebase/admin-init';

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

// Function to calculate exact bounding box of a distance
function getBoundingBox(lat: number, lon: number, radiusInKm: number) {
    const R = 6371;
    const maxLat = lat + (radiusInKm / R) * (180 / Math.PI);
    const minLat = lat - (radiusInKm / R) * (180 / Math.PI);
    const maxLon = lon + (radiusInKm / R) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
    const minLon = lon - (radiusInKm / R) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
    return { minLat, minLon, maxLat, maxLon };
}

/**
 * Busca jugadores disponibles cercanos utilizando geohash en memoria (versión optimizada con bounding box)
 */
export async function getAvailableLocalPlayersAction({
    lat,
    lng,
    radiusInKm = 10,
    dayOfWeek,
    timeOfDay
}: {
    lat: number;
    lng: number;
    radiusInKm?: number;
    dayOfWeek?: DayOfWeek;
    timeOfDay?: TimeOfDay;
}): Promise<{ success: boolean; players?: (AvailablePlayer & { matchScore?: number })[]; error?: string }> {
    try {
        const session = await getServerSession();
        if (!session?.user?.uid) {
            return { success: false, error: 'No autenticado' };
        }

        // Calcula el bounding box
        const { minLat, minLon, maxLat, maxLon } = getBoundingBox(lat, lng, radiusInKm);

        // Obtenemos los hashes a nivel 5 de precisión (aproximadamente cajas de ~5x5 km)
        const geohashesToQuery = ngeohash.bboxes(minLat, minLon, maxLat, maxLon, 5);

        // Obtenemos todos los jugadores en memoria ya que la colección principal no debería ser gigantesca inicialmente.
        // Si la plataforma escala, debe usarse un enfoque como geofire-common
        const snapshot = await db.collection('availablePlayers').get();

        let players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as AvailablePlayer));

        // Filtrar por distancia circular real (ya que la BB es cuadrada) y excluir al usuario actual
        players = players.filter(p => {
            if (p.uid === session.user.uid) return false;
            if (!p.location) return false;

            const dist = calculateDistanceInKm(lat, lng, p.location.lat, p.location.lng);
            return dist <= radiusInKm;
        });

        // Ordenar por disponibilidad si se proporciona el día y la hora
        // En vez de filtrar estrictamente, puntuamos y ordenamos para no vaciar el mercado
        let scoredPlayers = players.map(p => {
            let score = 1; // Neutral

            if (dayOfWeek || timeOfDay) {
                if (p.availability) {
                    let matchDay = true;
                    let matchTime = true;

                    if (dayOfWeek && p.availability[dayOfWeek] !== undefined) {
                        const timesForDay = p.availability[dayOfWeek] || [];
                        if (timeOfDay) {
                            matchTime = timesForDay.includes(timeOfDay);
                        }
                    } else if (dayOfWeek) {
                        matchDay = false;
                    }

                    if (matchDay && matchTime) score = 2; // Perfect match
                    else if (!matchDay && !matchTime) score = 0; // Conflicto total
                    else score = 1; // Match parcial
                }
            }

            return {
                ...p,
                matchScore: score
            };
        });

        // Ordenar de mayor a menor score
        scoredPlayers.sort((a, b) => b.matchScore - a.matchScore);

        return { success: true, players: scoredPlayers };
    } catch (error: any) {
        console.error('Error fetching available local players:', error);
        return { success: false, error: error.message || 'Error al buscar jugadores' };
    }
}
