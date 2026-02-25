'use server';

import { getAdminDb } from '@/firebase/admin-init';
import type { PlayerPosition } from '@/lib/types';

export type PlayerMatchStat = {
    uid: string;
    displayName: string;
    photoURL: string;
    position: PlayerPosition;
    goals: number;
    assists: number;
    mvpVotes: number;
};

export type MatchResultStats = {
    selfReportedStats: PlayerMatchStat[];
    mvpPlayer: PlayerMatchStat | null;
    totalTeam1Goals: number;
    totalTeam2Goals: number;
    hasFinalScore: boolean;
    finalScore?: { team1: number; team2: number };
};

/**
 * Aggregates selfEvaluations sub-collection to produce match result stats:
 * - Goals & assists per player (self-reported)
 * - MVP: player with most votes in this specific match
 */
export async function getMatchResultStatsAction(matchId: string): Promise<{
    success: boolean;
    stats?: MatchResultStats;
    error?: string;
}> {
    try {
        const db = getAdminDb();

        // 1. Fetch selfEvaluations
        const selfEvalsSnap = await db.collection(`matches/${matchId}/selfEvaluations`).get();
        const selfEvals = selfEvalsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        // 2. Fetch match doc for player list + finalScore + teams
        const matchSnap = await db.collection('matches').doc(matchId).get();
        if (!matchSnap.exists) {
            return { success: false, error: 'Partido no encontrado' };
        }
        const matchData = matchSnap.data() as any;
        const matchPlayers: { uid: string; displayName: string; photoURL: string; position: PlayerPosition; teamId?: string }[] =
            matchData.players || [];

        // 3. Build a map of uid -> stat
        const statsMap = new Map<string, PlayerMatchStat>();
        for (const mp of matchPlayers) {
            statsMap.set(mp.uid, {
                uid: mp.uid,
                displayName: mp.displayName,
                photoURL: mp.photoURL || '',
                position: mp.position,
                goals: 0,
                assists: 0,
                mvpVotes: 0,
            });
        }

        // 4. Accumulate goals/assists per player from selfEvals
        const mvpVoteCount = new Map<string, number>();
        for (const ev of selfEvals) {
            const existing = statsMap.get(ev.playerId);
            if (existing) {
                existing.goals += ev.goals || 0;
                existing.assists += ev.assists || 0;
            }
            // Count MVP votes
            if (ev.mvpVote) {
                mvpVoteCount.set(ev.mvpVote, (mvpVoteCount.get(ev.mvpVote) || 0) + 1);
            }
        }

        // 5. Apply mvpVotes count to stat objects
        for (const [uid, count] of mvpVoteCount.entries()) {
            const existing = statsMap.get(uid);
            if (existing) {
                existing.mvpVotes = count;
            }
        }

        // 6. Find MVP (most votes, min 1)
        let mvpPlayer: PlayerMatchStat | null = null;
        let maxVotes = 0;
        for (const stat of statsMap.values()) {
            if (stat.mvpVotes > maxVotes) {
                maxVotes = stat.mvpVotes;
                mvpPlayer = stat;
            }
        }

        const selfReportedStats = Array.from(statsMap.values())
            .filter(s => s.goals > 0 || s.assists > 0 || s.mvpVotes > 0)
            .sort((a, b) => b.goals - a.goals || b.assists - a.assists);

        // 7. Compute team totals if teams exist
        let totalTeam1Goals = 0;
        let totalTeam2Goals = 0;
        const teams: { id: string; playerUids: string[]; name?: string }[] = matchData.teams || [];
        if (teams.length >= 2) {
            const team1Uids = new Set(teams[0]?.playerUids || []);
            const team2Uids = new Set(teams[1]?.playerUids || []);
            for (const stat of statsMap.values()) {
                if (team1Uids.has(stat.uid)) totalTeam1Goals += stat.goals;
                if (team2Uids.has(stat.uid)) totalTeam2Goals += stat.goals;
            }
        }

        const finalScore = matchData.finalScore;

        return {
            success: true,
            stats: {
                selfReportedStats,
                mvpPlayer,
                totalTeam1Goals,
                totalTeam2Goals,
                hasFinalScore: !!finalScore,
                finalScore,
            },
        };
    } catch (error: any) {
        console.error('Error fetching match result stats:', error);
        return { success: false, error: error.message || 'Error al obtener estadísticas' };
    }
}
