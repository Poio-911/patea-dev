'use server';

import { findBestFitPlayer } from '@/ai/flows/find-best-fit-player';
import type { AvailablePlayer, Match } from '@/lib/types';

export async function findBestFitPlayerAction({
    match,
    availablePlayers
}: {
    match: Match;
    availablePlayers: AvailablePlayer[];
}) {
    try {
        // Simplify data for AI context
        const matchData = {
            id: match.id,
            title: match.title,
            matchSize: match.matchSize,
            players: match.players?.map(p => ({
                uid: p.uid,
                displayName: p.displayName,
                ovr: p.ovr,
                position: p.position
            })) || []
        };

        const playersData = availablePlayers.map(p => ({
            uid: p.uid,
            displayName: p.displayName,
            ovr: p.ovr,
            position: p.position
        }));

        const result = await findBestFitPlayer({
            match: matchData,
            availablePlayers: playersData
        });

        return { success: true, recommendations: result.recommendations };
    } catch (error: any) {
        console.error('Error in findBestFitPlayerAction:', error);
        return { success: false, error: error.message || 'Error al obtener recomendaciones de la IA' };
    }
}
