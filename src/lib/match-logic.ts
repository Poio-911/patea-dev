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
        // Phase 1: Atomically check if match is full and mark it as "generating teams"
        // This prevents race conditions when two players join simultaneously
        const matchData = await db.runTransaction(async (transaction) => {
            const matchSnap = await transaction.get(matchRef);
            if (!matchSnap.exists) return null;

            const match = matchSnap.data() as Match;

            // Already processed
            if (match.teamsGenerated) return null;

            const currentPlayers = match.players || [];
            if (currentPlayers.length < match.matchSize) return null;

            // Claim the lock: mark teamsGenerated BEFORE generating teams
            // This prevents a second concurrent call from also generating teams
            transaction.update(matchRef, { teamsGenerated: true });

            return match;
        });

        // If transaction returned null, nothing to do
        if (!matchData) return { success: true, message: 'Not ready or already processed' };

        logger.info(`[match-logic] Match ${matchId} is FULL. Generating teams...`);

        const currentPlayers = matchData.players || [];

        // Phase 2: Generate teams (outside transaction since AI call can be slow)
        const aiInput = {
            players: currentPlayers.map(p => ({
                uid: p.uid,
                displayName: p.displayName,
                ovr: p.ovr || 50,
                position: p.position || 'MED'
            })),
            teamCount: 2
        };

        const result = await generateBalancedTeams(aiInput);

        if ('error' in result) {
            // Rollback the teamsGenerated flag so it can be retried
            await matchRef.update({ teamsGenerated: false });
            throw new Error(`AI Team Generation Failed: ${result.error}`);
        }

        // Enrich teams with photoUrls
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

        // Phase 3: Write final teams
        await matchRef.update({
            status: 'upcoming',
            teams: [
                result.teams?.[0] || { name: 'Equipo A', players: [], averageOVR: 0 },
                result.teams?.[1] || { name: 'Equipo B', players: [], averageOVR: 0 }
            ],
            updatedAt: FieldValue.serverTimestamp()
        });

        logger.info(`[match-logic] Match ${matchId} successfully completed and teams generated.`);
        return { success: true };

    } catch (error: any) {
        logger.error(`[match-logic] Error in triggerMatchFullSequence for ${matchId}:`, error);
        return { success: false, error: error.message };
    }
}
