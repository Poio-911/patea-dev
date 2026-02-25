'use server';

import { getAdminDb } from '@/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger';
import { generateBalancedTeams } from '@/ai/flows/generate-balanced-teams';
import type { Match, Player } from '@/lib/types';

/**
 * Checks if a match is full and automates team generation and status transition.
 * Should be called whenever a player's confirmation status changes to 'confirmed'.
 */
export async function triggerMatchFullSequence(matchId: string) {
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);

    try {
        // 1. Get latest match data
        const matchSnap = await matchRef.get();
        if (!matchSnap.exists) return { success: false, error: 'Match not found' };

        const match = matchSnap.data() as Match;
        const maxPlayers = match.matchSize;

        // 2. Safety check: avoid double execution
        if (match.status === 'upcoming' && match.teamsGenerated) {
            return { success: true, message: 'Teams already generated' };
        }

        // 3. Confirm we have enough players
        const currentPlayers = match.players || [];
        if (currentPlayers.length < maxPlayers) {
            logger.info(`[match-logic] Match ${matchId} not full yet (${currentPlayers.length}/${maxPlayers})`);
            return { success: true, message: 'Not full yet' };
        }

        logger.info(`[match-logic] Match ${matchId} is FULL. Triggering auto-completion...`);

        // 4. Prepare input for AI Balancing
        const aiInput = {
            players: currentPlayers.map(p => ({
                uid: p.uid,
                displayName: p.displayName,
                ovr: p.ovr || 50,
                position: p.position || 'MED'
            })),
            teamCount: 2
        };

        // 5. Generate Teams via AI
        const result = await generateBalancedTeams(aiInput);

        if ('error' in result) {
            throw new Error(`AI Team Generation Failed: ${result.error}`);
        }

        // 6. Enrich teams with photoUrls (optional but recommended for consistency)
        const playerIds = currentPlayers.map(p => p.uid);
        const photoMap: Record<string, string> = {};
        const playerDocs = await db.getAll(...playerIds.map(id => db.collection('players').doc(id)));
        playerDocs.forEach(doc => {
            if (doc.exists) photoMap[doc.id] = doc.data()?.photoUrl || doc.data()?.photoURL || '';
        });

        result.teams?.forEach(team => {
            team.players.forEach(p => {
                if (p.uid) (p as any).photoURL = photoMap[p.uid] || '';
            });
        });

        // 7. Final Update: status -> upcoming, teams -> results
        await matchRef.update({
            status: 'upcoming',
            teams: [
                result.teams?.[0] || { name: 'Equipo A', players: [], averageOVR: 0 },
                result.teams?.[1] || { name: 'Equipo B', players: [], averageOVR: 0 }
            ],
            teamsGenerated: true,
            updatedAt: FieldValue.serverTimestamp()
        });

        logger.info(`[match-logic] Match ${matchId} successfully completed and teams generated.`);
        return { success: true };

    } catch (error: any) {
        logger.error(`[match-logic] Error in triggerMatchFullSequence for ${matchId}:`, error);
        return { success: false, error: error.message };
    }
}
