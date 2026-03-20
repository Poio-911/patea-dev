
'use server';
/**
 * @fileOverview This file contains all the server-side actions that use the Firebase Admin SDK.
 * It is marked with 'use server' to ensure it only runs on the server.
 */

import { getAdminDb, getAdminStorage } from '../../firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
// AI flow types (type-only imports don't execute code)
import type { GenerateBalancedTeamsInput } from '../../ai/flows/generate-balanced-teams';
import type { SuggestPlayerImprovementsInput } from '../../ai/flows/suggest-player-improvements';
import type { GetMatchDayForecastInput } from '../../ai/flows/get-match-day-forecast';
import type { FindBestFitPlayerInput } from '../../ai/flows/find-best-fit-player';
import type { CoachConversationInput } from '../../ai/flows/coach-conversation';
import type { DetectPlayerPatternsInput } from '../../ai/flows/detect-player-patterns';
import type { AnalyzePlayerProgressionInput } from '../../ai/flows/analyze-player-progression';
import { type GenerateMatchChronicleOutput, type GenerateMatchChronicleInput, MatchLocation } from '../../lib/types';
// Note: AI flow functions are imported dynamically within each action to avoid
// loading Genkit during build when API key is not available
import { Player, Evaluation, OvrHistory, EvaluationAssignment, PerformanceTag, SelfEvaluation, Invitation, Notification, GroupTeam, GroupTeamMember, TeamAvailabilityPost, Match, GenerateDuoImageInput, League, LeagueFormat, CompetitionStatus, Cup, CupFormat, CupSeedingType, BracketMatch, CompetitionApplication, CompetitionFormat, HealthConnection, PlayerPerformance, GoogleFitAuthUrl, GoogleFitSession, SocialActivity, Follow, NotificationType, PlayerPosition, PreferredFoot } from '../types';
import { logger } from '../logger';
import { handleServerActionError, createError, ErrorCodes, formatErrorResponse, isErrorResponse, type ErrorResponse } from '../errors';
import { addDays, format } from 'date-fns';
import { generateBracket, advanceWinner, isTournamentComplete, getChampion, getRunnerUp, getNextRound, getCurrentRound } from '../../lib/utils/cup-bracket';
import { publishMatchPlayedActivity, publishOvrChangeActivity } from './social-actions';
import { notifyMatchUpdatedAction } from './notification-actions';
import { CREDITS } from '../constants';
import { getServerSession } from '@/lib/auth/get-server-session';

// --- Server Actions ---

// --- Player Progression Logic (Migrated from evaluate/page) ---
const OVR_PROGRESSION = {
    BASELINE_RATING: 5,
    MAX_STEP: 1.5,
    MIN_OVR: 40,
    MAX_OVR: 99,
    MIN_ATTRIBUTE: 20,
    MAX_ATTRIBUTE: 99
};

const calculateOvrChange = (currentOvr: number, avgRating: number): number => {
    if (avgRating === OVR_PROGRESSION.BASELINE_RATING) return 0;
    const ratingDelta = avgRating - OVR_PROGRESSION.BASELINE_RATING; // -5 to +5 range
    let scale = 0.30; // Default (Normal)
    if (currentOvr < 50) scale = 0.50;      // Very Fast (Rookie)
    else if (currentOvr < 60) scale = 0.40; // Fast
    else if (currentOvr < 70) scale = 0.30; // Standard
    else if (currentOvr < 80) scale = 0.20; // Harder
    else if (currentOvr < 90) scale = 0.10; // Elite Grind
    else scale = 0.05;                      // Legend (Very slow)
    let rawDelta = ratingDelta * scale;
    return Math.max(-OVR_PROGRESSION.MAX_STEP, Math.min(OVR_PROGRESSION.MAX_STEP, rawDelta));
};

const POSITION_WEIGHTS: Record<string, Record<keyof Player, number>> = {
    'DEL': { pac: 0.25, sho: 0.35, pas: 0.15, dri: 0.15, def: 0.05, phy: 0.05 },
    'MED': { pac: 0.15, sho: 0.15, pas: 0.30, dri: 0.20, def: 0.10, phy: 0.10 },
    'DEF': { pac: 0.15, sho: 0.05, pas: 0.15, dri: 0.05, def: 0.40, phy: 0.20 },
    'POR': { pac: 0.10, sho: 0.05, pas: 0.10, dri: 0.05, def: 0.50, phy: 0.20 },
};
const DEFAULT_WEIGHTS = { pac: 0.166, sho: 0.166, pas: 0.166, dri: 0.166, def: 0.166, phy: 0.166 };

const calculateAttributeChangesFromPoints = (currentAttrs: Player, ovrChange: number, position: string) => {
    if (ovrChange === 0) return currentAttrs;
    const newAttributes = { ...currentAttrs };
    const attributes: Array<keyof Player> = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
    const weights = POSITION_WEIGHTS[position as keyof typeof POSITION_WEIGHTS] || DEFAULT_WEIGHTS;
    const totalPointsToAdd = ovrChange * 6;
    let accumulatedError = 0;

    attributes.forEach((attr) => {
        const currentVal = newAttributes[attr] as number;
        const targetShare = totalPointsToAdd * weights[attr as keyof typeof weights];
        let multiplier = 1.0;
        if (currentVal >= 92) multiplier = 0.1;
        else if (currentVal >= 85) multiplier = 0.2;
        else if (currentVal >= 75) multiplier = 0.4;
        else if (currentVal >= 60) multiplier = 0.7;

        const effectiveShare = targetShare > 0 ? targetShare * multiplier : targetShare;
        const pointWithDecimal = effectiveShare + accumulatedError;
        // Use Math.ceil for positive gains to favor the player, Math.floor for losses
        const pointRounded = effectiveShare > 0 ? Math.ceil(pointWithDecimal) : Math.floor(pointWithDecimal);
        accumulatedError = pointWithDecimal - pointRounded;

        newAttributes[attr] = Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, currentVal + pointRounded));
    });
    return newAttributes;
};

const calculateAttributeChanges = (currentAttrs: Player, tags: PerformanceTag[] = []) => {
    const newAttributes = { ...currentAttrs };
    if (tags && tags.length > 0) {
        tags.forEach(tag => {
            if (!tag.effects) return;
            tag.effects.forEach(effect => {
                const key = effect.attribute as keyof Player;
                if (typeof newAttributes[key] === 'number') {
                    const currentVal = newAttributes[key] as number;
                    let multiplier = 1.0;
                    if (currentVal >= 92) multiplier = 0.1;
                    else if (currentVal >= 85) multiplier = 0.2;
                    else if (currentVal >= 75) multiplier = 0.4;
                    else if (currentVal >= 60) multiplier = 0.7;

                    let rawChange = effect.change * multiplier;
                    // Enforce integer change (favoring the player)
                    let integerChange = rawChange > 0 ? Math.ceil(rawChange) : Math.floor(rawChange);

                    let newVal = currentVal + integerChange;
                    newAttributes[key] = Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, newVal));
                }
            });
        });
    }
    // Cap net delta per attribute to ±5
    const NET_CAP = 5;
    const attrs = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const;
    for (const attr of attrs) {
        const initialVal = (currentAttrs as any)[attr] as number;
        const finalVal = (newAttributes as any)[attr] as number;
        const delta = finalVal - initialVal;
        if (Math.abs(delta) > NET_CAP) {
            (newAttributes as any)[attr] = initialVal + (delta > 0 ? NET_CAP : -NET_CAP);
        }
    }
    return newAttributes;
};

const calculateAttributeChangesFromAI = (currentAttrs: Player, aiChanges: { attribute: string; change: number }[] = []) => {
    const newAttributes = { ...currentAttrs };
    if (aiChanges && aiChanges.length > 0) {
        aiChanges.forEach(change => {
            const key = change.attribute as keyof Player;
            if (typeof newAttributes[key] === 'number') {
                const currentVal = newAttributes[key] as number;
                let multiplier = 1.0;
                if (currentVal >= 92) multiplier = 0.1;
                else if (currentVal >= 85) multiplier = 0.2;
                else if (currentVal >= 75) multiplier = 0.4;
                else if (currentVal >= 60) multiplier = 0.7;

                let rawChange = change.change * multiplier;
                // Enforce integer change (favoring the player)
                let integerChange = rawChange > 0 ? Math.ceil(rawChange) : Math.floor(rawChange);

                const newVal = currentVal + integerChange;
                newAttributes[key] = Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, newVal));
            }
        });
    }
    return newAttributes;
};

export async function generateTeamsAction(players: Array<Pick<Player, 'id' | 'name' | 'ovr' | 'position'>>) {
    if (!players || players.length < 2) {
        return { error: 'Se necesitan al menos 2 jugadores para generar equipos.' };
    }

    // Validar y loguear datos de entrada para diagnóstico
    const invalidPlayers = players.filter(p => !p.id || !p.name || p.ovr === undefined || !p.position);
    if (invalidPlayers.length > 0) {
        logger.error('Jugadores con datos incompletos:', invalidPlayers.map(p => ({
            id: p.id,
            name: p.name,
            ovr: p.ovr,
            position: p.position,
        })));
        return { error: `Hay ${invalidPlayers.length} jugador(es) con datos incompletos. Verifica que todos tengan nombre, posición y OVR.` };
    }

    logger.info('generateTeamsAction - Entrada:', {
        playerCount: players.length,
        players: players.map(p => ({ id: p.id, name: p.name, ovr: p.ovr, position: p.position })),
    });

    const input: GenerateBalancedTeamsInput = {
        players: players.map(p => ({
            uid: p.id,
            displayName: p.name,
            ovr: p.ovr,
            position: p.position,
        })),
        teamCount: 2,
    };

    try {
        const { generateBalancedTeams } = await import('../../ai/flows/generate-balanced-teams');
        const result = await generateBalancedTeams(input);
        if ('error' in result) {
            throw new Error(String(result.error) || 'La IA no pudo generar los equipos.');
        }
        if (!result || !result.teams) {
            throw new Error('La respuesta de la IA no contiene equipos.');
        }

        // Fetch photo URLs for all players
        const playerIds = players.map(p => p.id).filter(Boolean);
        const photoMap = new Map<string, string>();
        if (playerIds.length > 0) {
            const playerRefs = playerIds.map(id => getAdminDb().collection('players').doc(id));
            const playerDocs = await getAdminDb().getAll(...playerRefs);
            playerDocs.forEach(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    photoMap.set(doc.id, data?.photoUrl || data?.photoURL || '');
                }
            });
        }

        result.teams.forEach(team => {
            team.players.forEach(player => {
                const originalPlayer = players.find(p => p.name === player.displayName && p.position === player.position)
                    || players.find(p => p.name === player.displayName);
                if (originalPlayer) {
                    player.uid = originalPlayer.id;
                    (player as any).photoURL = photoMap.get(originalPlayer.id) || '';
                }
            });
        });

        logger.info('generateTeamsAction - Éxito:', {
            teams: result.teams.map(t => ({ name: t.name, playerCount: t.players.length, avgOvr: t.averageOVR })),
        });

        return result;
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error('Error generating teams', error);
        console.error('[generateTeamsAction] Full error:', errorMessage);
        if (errorStack) console.error('[generateTeamsAction] Stack:', errorStack);
        return { error: `La IA no pudo generar los equipos: ${errorMessage}` };
    }
}

export async function getPlayerEvaluationsAction(playerId: string, groupId: string): Promise<Partial<Evaluation>[]> {
    // 1. Fetch recent evaluations for the player (Limit 50 to avoid reading thousands)
    const evalsSnapshot = await getAdminDb()
        .collection('evaluations')
        .where('playerId', '==', playerId)
        .orderBy('evaluatedAt', 'desc')
        .limit(50)
        .get();

    if (evalsSnapshot.empty) {
        return [];
    }

    const evaluations = evalsSnapshot.docs.map(doc => doc.data() as Evaluation);
    const matchIds = [...new Set(evaluations.map(e => e.matchId).filter(Boolean))];

    if (matchIds.length === 0) {
        return [];
    }

    // 2. Fetch only the relevant matches to check groupId
    // Firestore 'in' limit is 30 (or 10 depending on usage), getAll is better for IDs.
    const matchRefs = matchIds.map(id => getAdminDb().collection('matches').doc(id));
    const matchSnapshots = await getAdminDb().getAll(...matchRefs);

    const validMatchIds = new Set<string>();
    matchSnapshots.forEach(snap => {
        if (snap.exists) {
            const matchData = snap.data() as Match;
            if (matchData.groupId === groupId) {
                validMatchIds.add(snap.id);
            }
        }
    });

    // 3. Filter evaluations that belong to the group
    return evaluations.filter(e => validMatchIds.has(e.matchId));
}


export async function getPlayerImprovementSuggestionsAction(playerId: string, groupId: string) {
    try {
        const playerDocRef = getAdminDb().doc(`players/${playerId}`);
        const playerDocSnap = await playerDocRef.get();

        if (!playerDocSnap.exists) {
            return { error: 'No se pudo encontrar al jugador.' };
        }
        const player = playerDocSnap.data() as Player;

        const evaluations = await getPlayerEvaluationsAction(playerId, groupId);

        const input: SuggestPlayerImprovementsInput = {
            playerId: playerId,
            playerStats: player.stats,
            evaluations: evaluations.map(e => ({
                rating: e.rating || 0,
                performanceTags: e.performanceTags?.map((t: any) => t.name) || [],
                evaluatedBy: e.evaluatorId || '',
                evaluatedAt: e.evaluatedAt || '',
                matchId: e.matchId || ''
            })),
        };

        const { suggestPlayerImprovements } = await import('../../ai/flows/suggest-player-improvements');
        const result = await suggestPlayerImprovements(input);
        return result;

    } catch (error) {
        logger.error('Error getting player improvement suggestions', error, { playerId });
        return { error: 'No se pudieron obtener las sugerencias de la IA.' };
    }
}

export async function getWeatherForecastAction(input: GetMatchDayForecastInput) {
    try {
        const { getMatchDayForecast } = await import('../../ai/flows/get-match-day-forecast');
        const result = await getMatchDayForecast(input);
        return result;
    } catch (error) {
        logger.error('Error getting weather forecast', error, { location: input.location });
        return { error: 'No se pudo obtener el pronóstico del tiempo.' };
    }
}

export async function findBestFitPlayerAction(input: Omit<FindBestFitPlayerInput, 'spotsToFill'>) {
    try {
        const { findBestFitPlayer } = await import('../../ai/flows/find-best-fit-player');
        const result = await findBestFitPlayer(input);
        if (isErrorResponse(result)) {
            throw new Error(String(result.error));
        }
        return result;
    } catch (error: any) {
        logger.error('Error finding best fit player', error);
        if (error instanceof SyntaxError || error.message.includes('Unexpected token')) {
            return { error: 'La IA devolvió una respuesta inesperada. Por favor, inténtalo de nuevo.' };
        }
        return { error: error.message || 'La IA no pudo procesar la solicitud en este momento.' };
    }
}

export async function coachConversationAction(
    playerId: string,
    groupId: string,
    userMessage: string,
    conversationHistory?: CoachConversationInput['conversationHistory']
) {
    try {
        const playerDocRef = getAdminDb().doc(`players/${playerId}`);
        const playerDocSnap = await playerDocRef.get();

        if (!playerDocSnap.exists) {
            return { error: 'No se pudo encontrar al jugador.' };
        }

        const player = playerDocSnap.data() as Player;
        const evaluations = await getPlayerEvaluationsAction(playerId, groupId) as Evaluation[];

        const recentTags = evaluations
            .flatMap(e => e.performanceTags?.map(t => t?.name).filter(Boolean) || [])
            .slice(0, 10);

        const positiveTags = evaluations
            .flatMap(e => e.performanceTags
                ?.filter(t => t?.effects?.some(ef => ef.change > 0))
                .map(t => t?.name)
                .filter(Boolean) || []
            );

        const negativeTags = evaluations
            .flatMap(e => e.performanceTags
                ?.filter(t => t?.effects?.some(ef => ef.change < 0))
                .map(t => t?.name)
                .filter(Boolean) || []
            );

        const input: CoachConversationInput = {
            userMessage,
            conversationHistory: conversationHistory || [],
            playerContext: {
                playerId: playerId,
                playerName: player.name,
                position: player.position,
                ovr: player.ovr,
                stats: {
                    matchesPlayed: player.stats.matchesPlayed || 0,
                    goals: player.stats.goals || 0,
                    assists: player.stats.assists || 0,
                    averageRating: player.stats.averageRating || 0,
                },
                recentTags: recentTags.length > 0 ? recentTags : undefined,
                strengths: positiveTags.length > 0 ? positiveTags : undefined,
                weaknesses: negativeTags.length > 0 ? negativeTags : undefined,
            },
        };

        const { coachConversation } = await import('../../ai/flows/coach-conversation');
        const result = await coachConversation(input);
        return result;
    } catch (error: any) {
        logger.error('Error in coach conversation', error, { playerId });
        return { error: error.message || 'Error al generar la respuesta del entrenador.' };
    }
}

/**
 * Ensure monthly credit reset for a player.
 * If `lastCreditReset` is missing or older than the first day of the current month,
 * set `cardGenerationCredits` to CREDITS.MONTHLY_FREE and update `lastCreditReset` with a server timestamp.
 */
export async function ensureMonthlyCreditResetAction(playerId: string): Promise<{ success: boolean; updated: boolean; error?: string }> {
    try {
        const db = getAdminDb();
        const playerRef = db.doc(`players/${playerId}`);
        const snap = await playerRef.get();
        if (!snap.exists) {
            return { success: false, updated: false, error: 'Player not found' };
        }
        const data = snap.data() as Player;

        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let lastResetDate: Date | null = null;
        const lastReset: any = (data as any).lastCreditReset;
        if (lastReset) {
            // Handle Firestore Timestamp or string ISO
            if (typeof lastReset?.toDate === 'function') {
                lastResetDate = lastReset.toDate();
            } else if (typeof lastReset === 'string') {
                lastResetDate = new Date(lastReset);
            }
        }

        const needsReset = !lastResetDate || lastResetDate < currentMonthStart;
        if (!needsReset) {
            return { success: true, updated: false };
        }

        await playerRef.update({
            cardGenerationCredits: CREDITS.MONTHLY_FREE,
            lastCreditReset: FieldValue.serverTimestamp(),
        });

        return { success: true, updated: true };
    } catch (error: any) {
        return { success: false, updated: false, error: error?.message || 'Unknown error' };
    }
}

export async function detectPlayerPatternsAction(playerId: string, groupId: string) {
    try {
        const playerDocRef = getAdminDb().doc(`players/${playerId}`);
        const playerDocSnap = await playerDocRef.get();

        if (!playerDocSnap.exists) {
            return { error: 'No se pudo encontrar al jugador.' };
        }
        const player = playerDocSnap.data() as Player;

        const evaluations = await getPlayerEvaluationsAction(playerId, groupId) as Evaluation[];

        const ovrHistorySnapshot = await getAdminDb()
            .collection(`players/${playerId}/ovrHistory`)
            .orderBy('date', 'desc')
            .limit(20)
            .get();
        const ovrHistory = ovrHistorySnapshot.docs.map(doc => doc.data() as OvrHistory);

        const recentMatchIds = [...new Set(evaluations.slice(0, 15).map(e => e.matchId))];

        const selfEvalsByMatchId = new Map<string, SelfEvaluation>();
        if (recentMatchIds.length > 0) {
            const selfEvalsPromises = recentMatchIds.map(matchId =>
                getAdminDb().collection(`matches/${matchId}/selfEvaluations`).where('playerId', '==', playerId).get()
            );
            const selfEvalsSnapshots = await Promise.all(selfEvalsPromises);

            selfEvalsSnapshots.forEach(snapshot => {
                snapshot.forEach(doc => {
                    const selfEval = doc.data() as SelfEvaluation;
                    selfEvalsByMatchId.set(selfEval.matchId, selfEval);
                });
            });
        }

        const recentEvaluations = evaluations.slice(0, 15).map(e => {
            const selfEval = selfEvalsByMatchId.get(e.matchId);

            const validTags = (e.performanceTags || [])
                .filter((tag): tag is PerformanceTag => tag && typeof tag === 'object' && !!tag.name && !!tag.impact)
                .map(tag => ({
                    name: tag.name,
                    impact: tag.impact,
                }));

            return {
                matchDate: e.evaluatedAt || new Date().toISOString(),
                rating: e.rating,
                performanceTags: validTags,
                goals: selfEval?.goals || 0,
            };
        });

        const input: DetectPlayerPatternsInput = {
            playerId,
            playerName: player.name,
            position: player.position,
            currentOVR: player.ovr,
            stats: {
                matchesPlayed: player.stats.matchesPlayed || 0,
                goals: player.stats.goals || 0,
                assists: player.stats.assists || 0,
                averageRating: player.stats.averageRating || 0,
            },
            recentEvaluations,
            ovrHistory: ovrHistory.length > 0 ? ovrHistory : undefined,
        };

        const { detectPlayerPatterns } = await import('../../ai/flows/detect-player-patterns');
        const result = await detectPlayerPatterns(input);
        return result;
    } catch (error: any) {
        logger.error('Error detecting player patterns', error, { playerId });
        return { error: error.message || 'No se pudo analizar el rendimiento del jugador.' };
    }
}

export async function analyzePlayerProgressionAction(playerId: string, groupId: string) {
    try {
        const db = getAdminDb();
        const playerDocRef = db.doc(`players/${playerId}`);
        const playerDocSnap = await playerDocRef.get();
        if (!playerDocSnap.exists) {
            return { error: 'No se pudo encontrar al jugador.' };
        }
        const player = playerDocSnap.data() as Player;

        // Fallback for name to avoid Zod validation errors in AI flow
        const playerName = player.name || player.displayName || 'Jugador';

        const evaluations = await getPlayerEvaluationsAction(playerId, groupId) as Evaluation[];

        // Group peer evaluations by matchId
        const evalsByMatch = new Map<string, Evaluation[]>();
        evaluations.forEach(e => {
            if (e.matchId) {
                const existing = evalsByMatch.get(e.matchId) || [];
                evalsByMatch.set(e.matchId, [...existing, e]);
            }
        });

        // Get match IDs to fetch selfEvaluations
        const matchIds = Array.from(evalsByMatch.keys()).slice(0, 10);

        // Fetch self-evaluations to get goals, assists and chronicles
        const selfEvalsPromises = matchIds.map(mId =>
            db.collection(`matches/${mId}/selfEvaluations`)
                .where('playerId', '==', playerId)
                .get()
        );
        const selfEvalsSnaps = await Promise.all(selfEvalsPromises);
        const selfEvalsMap = new Map<string, any>();
        selfEvalsSnaps.forEach((snap, i) => {
            if (!snap.empty) {
                selfEvalsMap.set(matchIds[i], snap.docs[0].data());
            }
        });

        const ovrHistorySnapshot = await db.collection(`players/${playerId}/ovrHistory`).orderBy('date', 'desc').limit(10).get();
        const ovrHistory = ovrHistorySnapshot.docs.map(doc => doc.data() as OvrHistory).reverse();

        // Build consolidated evaluations for AI
        const recentEvaluationsForAI = matchIds.map(mId => {
            const peerEvals = evalsByMatch.get(mId) || [];
            const selfEval = selfEvalsMap.get(mId);

            // Average rating from peers
            let avgRating: number | undefined = undefined;
            if (peerEvals.length > 0) {
                const total = peerEvals.reduce((acc, curr) => acc + (curr.rating || 0), 0);
                avgRating = total / peerEvals.length;
                if (isNaN(avgRating)) avgRating = undefined;
            }

            // Flatten performance tags
            const tags = new Set<string>();
            peerEvals.forEach(e => {
                e.performanceTags?.forEach(t => {
                    if (typeof t === 'string') tags.add(t);
                    else if (t && typeof t === 'object' && 'name' in t && typeof t.name === 'string') tags.add(t.name);
                });
            });

            // Combine peer text feedback
            const peerFeedback = peerEvals
                .map(e => e.textEvaluation)
                .filter(val => typeof val === 'string' && val.trim().length > 0)
                .join(' | ');

            return {
                matchDate: peerEvals[0]?.evaluatedAt || selfEval?.reportedAt || new Date().toISOString(),
                rating: avgRating,
                performanceTags: Array.from(tags),
                goals: typeof selfEval?.goals === 'number' ? selfEval.goals : 0,
                assists: typeof selfEval?.assists === 'number' ? selfEval.assists : 0,
                personalChronicle: (typeof selfEval?.personalChronicle === 'string' && selfEval.personalChronicle.trim().length > 0)
                    ? selfEval.personalChronicle
                    : undefined,
                peerFeedbackSummary: peerFeedback.length > 0 ? peerFeedback : undefined,
            };
        });

        const input: AnalyzePlayerProgressionInput = {
            playerName,
            ovrHistory: (ovrHistory || []).map(h => ({
                date: (h && typeof h.date === 'string') ? h.date : new Date().toISOString(),
                newOVR: (h && typeof h.newOVR === 'number') ? h.newOVR : 0,
                change: (h && typeof h.change === 'number') ? h.change : 0
            })),
            recentEvaluations: recentEvaluationsForAI,
        };

        const { analyzePlayerProgression } = await import('../../ai/flows/analyze-player-progression');
        try {
            return await analyzePlayerProgression(input);
        } catch (aiError) {
            logger.error('AI Flow execution failed', aiError, { input });
            throw aiError;
        }
    } catch (error: any) {
        logger.error('Error in analyzePlayerProgressionAction', error, { playerId });
        return { error: 'No se pudo generar el análisis de progresión.' };
    }
}

export async function generateMatchChronicleAction(matchId: string): Promise<{ data?: GenerateMatchChronicleOutput; error?: string }> {
    logger.info('[generateMatchChronicleAction] Starting chronicle generation', { matchId });
    try {
        const matchRef = getAdminDb().doc(`matches/${matchId}`);
        const matchSnap = await matchRef.get();
        if (!matchSnap.exists) {
            logger.error('[generateMatchChronicleAction] Match not found', { matchId });
            throw createError(ErrorCodes.DATA_NOT_FOUND, { matchId });
        }

        const match = { id: matchSnap.id, ...matchSnap.data() } as Match;

        if (match.status !== 'evaluated' || !match.teams || match.teams.length < 2) {
            throw createError(ErrorCodes.VAL_INVALID_FORMAT, { status: match.status, matchId });
        }

        const evalsQuery = getAdminDb().collection('evaluations').where('matchId', '==', matchId);
        const selfEvalsQuery = getAdminDb().collection(`matches/${matchId}/selfEvaluations`);
        const [evalsSnap, selfEvalsSnap] = await Promise.all([evalsQuery.get(), selfEvalsQuery.get()]);

        const evaluations = evalsSnap.docs.map(d => d.data() as Evaluation);
        const selfEvaluations = selfEvalsSnap.docs.map(d => d.data() as SelfEvaluation);

        const goalsByPlayer = selfEvaluations.reduce((acc, ev) => {
            acc[ev.playerId] = (acc[ev.playerId] || 0) + ev.goals;
            return acc;
        }, {} as Record<string, number>);
        const assistsByPlayer = selfEvaluations.reduce((acc, ev) => {
            if (typeof ev.assists === 'number') {
                acc[ev.playerId] = (acc[ev.playerId] || 0) + ev.assists;
            }
            return acc;
        }, {} as Record<string, number>);

        // Prefer canonical match.finalScore if present; fallback reconstructing from selfEvaluations
        let team1Score: number;
        let team2Score: number;
        if (match.finalScore && typeof match.finalScore.team1 === 'number' && typeof match.finalScore.team2 === 'number') {
            team1Score = match.finalScore.team1;
            team2Score = match.finalScore.team2;
        } else {
            let t1 = 0; let t2 = 0;
            // First try from selfEvaluations
            const hasSelfEvalData = Object.keys(goalsByPlayer).length > 0;

            if (hasSelfEvalData) {
                match.teams[0].players.forEach(p => t1 += goalsByPlayer[p.uid] || 0);
                match.teams[1].players.forEach(p => t2 += goalsByPlayer[p.uid] || 0);
            } else {
                // Fallback: Use aggregated evaluations (votes)
                // Assuming 'mvp.rating' logic accesses 'evaluations', we can also extract aggregated goals if available
                // But evaluations are usually 'votes for others'.
                // If the system aggregates stats into a 'matchStats' object, use that.
                // If not, we rely on 'selfEvaluations' being present.
                // However, seeing 0-0 implies selfEvaluations are missing.

                // Try to infer from 'evaluationSubmissions' via 'evaluations' logic? 
                // Actually, let's use the raw evaluations if they have goal data?
                // Typically 'Evaluation' object has 'rating' and 'performanceTags'.
                // It does NOT strictly have 'goals' unless it's a specific type.

                // CHECK IF evaluations have stats?
                // The TYPE 'Evaluation' doesn't seem to have 'goals' property in the map (line 417).
                // Let's check the type definition again.
                // If seed script created submissions with 'evaluatorGoals', those land in 'processedSubmissions' or 'selfEvaluations'.

                // CRITICAL FIX: The seed script creates 'evaluationSubmissions'.
                // The process script (check-submissions.ts) supposedly processes them.
                // If it creates 'evaluations', those are VOTES.
                // Does it create 'selfEvaluations'?
                // If 'check-submissions.ts' logic (which I read) doesn't show creating 'selfEvaluations', then THAT is the missing link.
                // I will add logic here to READ 'evaluationSubmissions' directly if needed? No, that's expensive.

                // Let's assume the user provided valid seed data which populates 'selfEvaluations'.
                // If not, I will default to random scores for now to satisfy the "Chronicle generation" request if real data is 0.

                // But user asked to SUM goals.
                // I will update this block to default to match.finalScore if available, else 0-0.
            }

            // Temporary fix for the user request:
            // READ 'evaluationSubmissions' to get the goals if selfEvaluations are empty.
            if (t1 === 0 && t2 === 0) {
                // Try processedSubmissions (the most likely place for archived data)
                const processedSnap = await getAdminDb().collection(`matches/${matchId}/processedSubmissions`).get();
                if (processedSnap.size > 0) {
                    processedSnap.forEach(doc => {
                        const data = doc.data();
                        if (data.submission?.evaluatorGoals) {
                            goalsByPlayer[data.evaluatorId] = data.submission.evaluatorGoals;
                        }
                    });
                } else {
                    // Try pending evaluationSubmissions
                    const submissionsSnap = await getAdminDb().collection('evaluationSubmissions')
                        .where('matchId', '==', matchId).get();
                    submissionsSnap.forEach(doc => {
                        const data = doc.data();
                        if (data.submission?.evaluatorGoals) {
                            goalsByPlayer[data.evaluatorId] = data.submission.evaluatorGoals;
                        }
                    });
                }

                match.teams[0].players.forEach(p => t1 += goalsByPlayer[p.uid] || 0);
                match.teams[1].players.forEach(p => t2 += goalsByPlayer[p.uid] || 0);
            }

            team1Score = t1; team2Score = t2;
        }

        const playersMap = new Map(match.players.map(p => [p.uid, p.displayName]));

        const keyEvents = evaluations
            .filter(e => Array.isArray(e.performanceTags) && e.performanceTags.length > 0)
            .sort(() => 0.5 - Math.random())
            .slice(0, 5)
            .map(e => {
                const firstTag = e.performanceTags![0];
                const safeDescription = firstTag?.description || firstTag?.name || 'Acción destacada';
                return {
                    minute: Math.floor(Math.random() * 85) + 5,
                    type: 'KeyPlay' as const,
                    playerName: playersMap.get(e.playerId) || 'Un jugador',
                    description: safeDescription,
                };
            });

        const enrichedEvents: GenerateMatchChronicleInput['keyEvents'] = [...keyEvents];
        const usedMinutes = new Set(enrichedEvents.map(e => e.minute));

        function randomMinute() {
            let m = Math.floor(Math.random() * 85) + 5;
            let attempts = 0;
            while (usedMinutes.has(m) && attempts < 10) {
                m = Math.floor(Math.random() * 85) + 5;
                attempts++;
            }
            usedMinutes.add(m);
            return m;
        }

        if (enrichedEvents.length < 3) {
            const goalEntries = Object.entries(goalsByPlayer)
                .filter(([, g]) => g > 0)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);
            for (const [playerId, goals] of goalEntries) {
                if (enrichedEvents.length >= 5) break;
                const displayName = playersMap.get(playerId) || 'Jugador';
                const description = goals > 1
                    ? `Marcó un doblete decisivo para su equipo.`
                    : `Definió con categoría para abrir el marcador.`;
                enrichedEvents.push({
                    minute: randomMinute(),
                    type: 'Goal' as const,
                    playerName: displayName,
                    description,
                });
            }
        }

        if (enrichedEvents.length < 5) {
            const assistEntries = Object.entries(assistsByPlayer)
                .filter(([, a]) => a > 0)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);
            for (const [playerId, assists] of assistEntries) {
                if (enrichedEvents.length >= 5) break;
                const displayName = playersMap.get(playerId) || 'Jugador';
                const description = assists > 1
                    ? `Repartió ${assists} asistencias clave que inclinaron el partido.`
                    : `Asistencia precisa que cambió el marcador.`;
                enrichedEvents.push({
                    minute: randomMinute(),
                    type: 'Assist' as const,
                    playerName: displayName,
                    description,
                });
            }
        }

        if (enrichedEvents.length < 3) {
            const ratedEvals = evaluations
                .filter(e => typeof e.rating === 'number' && e.rating && e.rating >= 7)
                .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                .slice(0, 3);
            for (const ev of ratedEvals) {
                if (enrichedEvents.length >= 5) break;
                enrichedEvents.push({
                    minute: randomMinute(),
                    type: 'KeyPlay' as const,
                    playerName: playersMap.get(ev.playerId) || 'Jugador',
                    description: `Actuación destacada con calificación ${ev.rating}.`,
                });
            }
        }

        if (enrichedEvents.length === 0) {
            enrichedEvents.push({
                minute: randomMinute(),
                type: 'KeyPlay',
                playerName: 'El partido',
                description: 'Partido parejo sin acciones destacadas registradas.',
            });
        }

        const mvp = evaluations.reduce((best, current) => {
            if (!current.rating) return best;
            return (current.rating > best.rating) ? { playerId: current.playerId, rating: current.rating } : best;
        }, { playerId: '', rating: 0 });

        // ✅ NEW: Collect player personal chronicles
        const playerChronicles = selfEvaluations
            .filter(se => se.personalChronicle && se.personalChronicle.trim().length > 0)
            .map(se => ({
                playerName: playersMap.get(se.playerId) || 'Jugador',
                chronicle: se.personalChronicle!,
                position: match.players.find(p => p.uid === se.playerId)?.position || 'MED'
            }));

        // ✅ NEW: Collect top performance tags (max 10, mix of positive and negative)
        const allTaggedEvals = evaluations
            .flatMap(e => (e.performanceTags || []).map(tag => ({
                playerId: e.playerId,
                tag
            })))
            .filter(item => item.tag.impact === 'positive' || item.tag.impact === 'negative');

        const topPerformanceTags = allTaggedEvals
            .slice(0, 10)
            .map(item => ({
                playerName: playersMap.get(item.playerId) || 'Jugador',
                tagName: item.tag.name,
                tagDescription: item.tag.description,
                impact: item.tag.impact as 'positive' | 'negative'
            }));

        const input: GenerateMatchChronicleInput = {
            matchTitle: match.title,
            matchLocation: match.location?.name,
            team1Name: match.teams[0].name,
            team1Score,
            team2Name: match.teams[1].name,
            team2Score,
            keyEvents: enrichedEvents,
            mvp: {
                name: playersMap.get(mvp.playerId) || 'El Equipo',
                reason: 'por su rendimiento excepcional y una calificación de ' + mvp.rating
            },
            playerChronicles: playerChronicles.length > 0 ? playerChronicles : undefined,
            topPerformanceTags: topPerformanceTags.length > 0 ? topPerformanceTags : undefined,
        };

        const { generateMatchChronicleFlow } = await import('../../ai/flows/generate-match-chronicle');
        const result = await generateMatchChronicleFlow(input);

        if (!result) {
            throw createError(ErrorCodes.AI_GENERATION_FAILED, { matchId });
        }

        // ✅ NEW: Save chronicle to match document
        await matchRef.update({
            chronicle: result,
            chronicleGeneratedAt: new Date().toISOString()
        });

        logger.info('[generateMatchChronicleAction] Chronicle saved to match', { matchId });

        return { data: result };

    } catch (error) {
        logger.error('[generateMatchChronicleAction] Error occurred', error, { matchId, action: 'generateMatchChronicle' });
        const formattedError = handleServerActionError(error, { matchId, action: 'generateMatchChronicle' });
        return { error: formattedError.error };
    }
}

// ============================================================================
// ACTION: Update player contribution (goals/assists) for a match
// ============================================================================
export async function updateMatchPlayerContributionAction(
    matchId: string,
    playerId: string,
    goalsDelta: number = 0,
    assistsDelta: number = 0,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const matchRef = getAdminDb().collection('matches').doc(matchId);
        const matchSnap = await matchRef.get();
        if (!matchSnap.exists) return { success: false, error: 'Partido no encontrado.' };
        const match = { id: matchSnap.id, ...matchSnap.data() } as Match;
        if (match.ownerUid !== userId) return { success: false, error: 'No autorizado.' };

        const selfEvalRef = getAdminDb().collection(`matches/${matchId}/selfEvaluations`).where('playerId', '==', playerId);
        const existingSnap = await selfEvalRef.get();
        let docRefToUpdate;
        if (existingSnap.empty) {
            docRefToUpdate = getAdminDb().collection(`matches/${matchId}/selfEvaluations`).doc();
            await docRefToUpdate.set({
                playerId,
                matchId,
                goals: Math.max(0, goalsDelta),
                assists: Math.max(0, assistsDelta),
                reportedAt: new Date().toISOString(),
            });
        } else {
            docRefToUpdate = existingSnap.docs[0].ref;
            const data = existingSnap.docs[0].data();
            await docRefToUpdate.update({
                goals: Math.max(0, (data.goals || 0) + goalsDelta),
                assists: Math.max(0, (data.assists || 0) + assistsDelta),
            });
        }

        // --- NEW: Update aggregated Player Stats ---
        const playerRef = getAdminDb().collection('players').doc(playerId);
        await playerRef.update({
            'stats.goals': FieldValue.increment(goalsDelta),
            'stats.assists': FieldValue.increment(assistsDelta),
            // matchesPlayed is updated separately when match is completed/finalized
        });

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error, { action: 'updateMatchPlayerContribution' });
        return { success: false, error: err.error };
    }
}


export async function generateDuoImageAction(input: GenerateDuoImageInput) {
    try {
        const { convertStorageUrlToBase64 } = await import('./image-generation');

        const player1Result = await convertStorageUrlToBase64(input.player1PhotoURL);
        if (player1Result.error || !player1Result.dataUri) {
            throw new Error(player1Result.error || 'No se pudo procesar la foto del primer jugador.');
        }

        let player2DataUri = player1Result.dataUri;

        if (input.player2PhotoURL && input.player2PhotoURL !== input.player1PhotoURL) {
            const player2Result = await convertStorageUrlToBase64(input.player2PhotoURL);
            if (player2Result.error || !player2Result.dataUri) {
                throw new Error(player2Result.error || 'No se pudo procesar la foto del segundo jugador.');
            }
            player2DataUri = player2Result.dataUri;
        }

        const { generateDuoImage } = await import('../../ai/flows/generate-duo-image');
        const imageUrl = await generateDuoImage(
            player1Result.dataUri,
            player2DataUri,
            input.player1Name,
            input.player2Name || input.player1Name,
            input.prompt
        );

        return { success: true, imageUrl };
    } catch (error) {
        return handleServerActionError(error);
    }
}


// --- TEAM AVAILABILITY POSTS ACTIONS ---

export async function createTeamAvailabilityPostAction(
    teamId: string,
    userId: string,
    postData: {
        date: string;
        time: string;
        location: MatchLocation;
        description?: string;
    }
) {
    try {
        const teamSnap = await getAdminDb().doc(`teams/${teamId}`).get();
        if (!teamSnap.exists) {
            throw createError(ErrorCodes.DATA_NOT_FOUND, { teamId });
        }

        const team = { id: teamSnap.id, ...teamSnap.data() } as GroupTeam;

        if (team.createdBy !== userId) {
            throw createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS, { userId, teamId });
        }

        const postRef = getAdminDb().collection('teamAvailabilityPosts').doc();
        const newPost: any = {
            teamId: team.id,
            teamName: team.name,
            jersey: team.jersey,
            date: postData.date,
            time: postData.time,
            location: postData.location,
            createdBy: userId,
            createdAt: new Date().toISOString(),
        };

        if (postData.description) {
            newPost.description = postData.description;
        }

        await postRef.set(newPost);

        return { success: true, postId: postRef.id };
    } catch (error: any) {
        return handleServerActionError(error);
    }
}

export async function getAvailableTeamPostsAction(userId: string): Promise<{ success: boolean; posts: TeamAvailabilityPost[] } | ErrorResponse> {
    try {
        const today = new Date().toISOString().split('T')[0];

        const postsSnapshot = await getAdminDb()
            .collection('teamAvailabilityPosts')
            .where('createdBy', '!=', userId)
            .where('date', '>=', today)
            .orderBy('date', 'asc')
            .orderBy('createdBy')
            .get();

        const posts = postsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as TeamAvailabilityPost))
            .filter(post => {
                const isActive = !post.status || post.status === 'active';
                const postDateTime = new Date(`${post.date}T${post.time}`);
                const isValidTime = postDateTime > new Date();
                return isActive && isValidTime;
            });

        return { success: true, posts };
    } catch (error: any) {
        return handleServerActionError(error, { userId });
    }
}

export async function getUserTeamPostsAction(userId: string) {
    try {
        const postsSnapshot = await getAdminDb()
            .collection('teamAvailabilityPosts')
            .where('createdBy', '==', userId)
            .orderBy('date', 'asc')
            .get();

        const posts = postsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as TeamAvailabilityPost));

        return { success: true, posts };
    } catch (error: any) {
        return handleServerActionError(error);
    }
}

export async function challengeTeamPostAction(
    postId: string,
    challengingTeamId: string,
    challengerUserId: string
) {
    try {
        const batch = getAdminDb().batch();

        const [postSnap, challengingTeamSnap] = await Promise.all([
            getAdminDb().doc(`teamAvailabilityPosts/${postId}`).get(),
            getAdminDb().doc(`teams/${challengingTeamId}`).get(),
        ]);

        if (!postSnap.exists || !challengingTeamSnap.exists) {
            throw createError(ErrorCodes.DATA_NOT_FOUND, { postId, challengingTeamId });
        }

        const post = { id: postSnap.id, ...postSnap.data() } as TeamAvailabilityPost;
        const challengingTeam = { id: challengingTeamSnap.id, ...challengingTeamSnap.data() } as GroupTeam;

        const challengedTeamSnap = await getAdminDb().doc(`teams/${post.teamId}`).get();
        if (!challengedTeamSnap.exists) throw new Error("El equipo desafiado no existe.");
        const challengedTeam = { id: challengedTeamSnap.id, ...challengedTeamSnap.data() } as GroupTeam;

        const invitationRef = getAdminDb().collection(`teams/${post.teamId}/invitations`).doc();
        const newInvitation: Omit<Invitation, 'id'> = {
            type: 'team_challenge',
            fromTeamId: challengingTeam.id,
            fromTeamName: challengingTeam.name,
            fromTeamJersey: challengingTeam.jersey,
            toTeamId: challengedTeam.id,
            toTeamName: challengedTeam.name,
            toTeamJersey: challengedTeam.jersey,
            postId: post.id,
            status: 'pending',
            createdBy: challengerUserId,
            createdAt: new Date().toISOString(),
        };
        batch.set(invitationRef, newInvitation);

        const notificationRef = getAdminDb().collection(`users/${challengedTeam.createdBy}/notifications`).doc();
        const notification: Omit<Notification, 'id'> = {
            type: 'match_invite',
            title: '¡Desafío Recibido!',
            message: `El equipo "${challengingTeam.name}" quiere aceptar tu postulación.`,
            link: '/competitions/challenges',
            isRead: false,
            createdAt: new Date().toISOString(),
        };
        batch.set(notificationRef, notification);

        await batch.commit();

        return { success: true };
    } catch (error: any) {
        return handleServerActionError(error);
    }
}


export async function acceptTeamChallengeAction(invitationId: string, teamId: string, userId: string): Promise<{ success: boolean; matchId: string } | ErrorResponse> {
    try {
        const result = await getAdminDb().runTransaction(async (transaction) => {
            const invitationRef = getAdminDb().doc(`teams/${teamId}/invitations/${invitationId}`);
            const invitationSnap = await transaction.get(invitationRef);

            if (!invitationSnap.exists || invitationSnap.data()?.status !== 'pending') {
                throw createError(ErrorCodes.DATA_NOT_FOUND, { reason: "Invitation not found or already processed." });
            }

            const invitation = invitationSnap.data() as Invitation;

            const team1Ref = getAdminDb().doc(`teams/${invitation.toTeamId}`);
            const team2Ref = getAdminDb().doc(`teams/${invitation.fromTeamId}`);
            const [team1Snap, team2Snap] = await Promise.all([transaction.get(team1Ref), transaction.get(team2Ref)]);

            if (!team1Snap.exists || !team2Snap.exists) {
                throw createError(ErrorCodes.DATA_NOT_FOUND, { reason: "One of the teams does not exist." });
            }

            const team1Data = { id: team1Snap.id, ...team1Snap.data() } as GroupTeam;
            const team2Data = { id: team2Snap.id, ...team2Snap.data() } as GroupTeam;

            if (team1Data.createdBy !== userId) {
                throw createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS);
            }

            // --- FETCH PLAYERS & POPULATE TEAMS (Fix for Inter-Group Matches) ---
            const allPlayerIds = new Set<string>();
            (team1Data.members || []).forEach((m: any) => allPlayerIds.add(m.playerId));
            (team2Data.members || []).forEach((m: any) => allPlayerIds.add(m.playerId));

            const playersArr = Array.from(allPlayerIds);
            const playersMap = new Map<string, any>();

            // Limit to 30 for "in" query safe limit (chunking needed if larger)
            const chunkSize = 10;
            for (let i = 0; i < playersArr.length; i += chunkSize) {
                const chunk = playersArr.slice(i, i + chunkSize);
                if (chunk.length > 0) {
                    const pSnaps = await getAdminDb().collection('players').where('__name__', 'in', chunk).get();
                    pSnaps.forEach(doc => playersMap.set(doc.id, { id: doc.id, ...doc.data() }));
                }
            }

            const buildTeam = (td: GroupTeam) => {
                const teamPlayers = (td.members || []).map((m: any) => {
                    const p = playersMap.get(m.playerId);
                    const photo = p?.photoURL || p?.photoUrl || '';
                    return {
                        uid: m.playerId,
                        displayName: p?.name || 'Jugador',
                        ovr: p?.ovr || 50,
                        position: p?.position || 'MED',
                        photoURL: photo
                    };
                });
                const totalOVR = teamPlayers.reduce((sum: number, p: any) => sum + p.ovr, 0);
                const avgOVR = teamPlayers.length ? Math.round(totalOVR / teamPlayers.length) : 0;
                return {
                    name: td.name,
                    jersey: td.jersey,
                    players: teamPlayers,
                    totalOVR,
                    averageOVR: avgOVR
                };
            };

            const finalTeam1 = buildTeam(team1Data);
            const finalTeam2 = buildTeam(team2Data);
            const finalTeams = [finalTeam1, finalTeam2];
            const finalPlayers = finalTeams.flatMap(t => t.players);
            const finalPlayerUids = finalPlayers.map(p => p.uid);

            let matchDate: string = new Date().toISOString().split('T')[0];
            let matchTime: string = '19:00';
            let matchLocation: MatchLocation = { name: 'A confirmar', address: '', lat: 0, lng: 0, placeId: '' };

            if (invitation.postId) {
                const postRef = getAdminDb().doc(`teamAvailabilityPosts/${invitation.postId}`);
                const postSnap = await transaction.get(postRef);
                if (postSnap.exists) {
                    const postData = postSnap.data() as TeamAvailabilityPost;
                    matchDate = postData.date;
                    matchTime = postData.time;
                    matchLocation = postData.location;
                    transaction.update(postRef, { status: 'matched' });
                }
            }

            // Clean matchTime (remove 'hs', etc.) to avoid Invalid Date
            const cleanTime = (matchTime || '').replace(' hs', '').replace('hs', '').trim();
            const startTimestampStr = `${matchDate}T${cleanTime}`;
            let startTimestamp: string | undefined;
            try {
                const dateObj = new Date(startTimestampStr);
                if (!isNaN(dateObj.getTime())) {
                    startTimestamp = dateObj.toISOString();
                }
            } catch (e) {
                console.warn('Failed to parse match date/time:', startTimestampStr);
            }

            const matchRef = getAdminDb().collection('matches').doc();
            const newMatch: Omit<Match, 'id'> = {
                title: `${team1Data.name} vs ${team2Data.name}`,
                date: matchDate,
                time: matchTime,
                location: matchLocation,
                type: 'intergroup_friendly',
                matchSize: finalPlayers.length > 0 ? finalPlayers.length : 22,
                players: finalPlayers,
                playerUids: finalPlayerUids,
                teams: finalTeams,
                status: 'upcoming',
                ownerUid: team1Data.createdBy,
                groupId: team1Data.groupId,
                participantGroupIds: [team1Data.groupId, team2Data.groupId].filter(Boolean) as string[],
                isPublic: false,
                startTimestamp: startTimestamp || new Date().toISOString(),
                participantTeamIds: [team1Data.id!, team2Data.id!],
                captains: [team1Data.createdBy, team2Data.createdBy],
                createdAt: new Date().toISOString(),
            };

            transaction.set(matchRef, newMatch);
            transaction.update(invitationRef, { status: 'accepted' });

            // Enviar notificación al retador (Solo si existe createdBy)
            if (invitation.createdBy) {
                const challengerNotificationRef = getAdminDb().collection(`users/${invitation.createdBy}/notifications`).doc();
                transaction.set(challengerNotificationRef, {
                    type: 'challenge_accepted',
                    title: '¡Desafío Aceptado!',
                    message: `"${team1Data.name}" ha aceptado tu desafío. El partido ha sido creado.`,
                    link: `/matches/${matchRef.id}`,
                    isRead: false,
                    createdAt: new Date().toISOString(),
                    metadata: {
                        matchId: matchRef.id,
                        fromUserId: userId,
                        fromUserName: team1Data.name
                    }
                });
            }

            return { success: true, matchId: matchRef.id };
        });

        return result;

    } catch (error) {
        return handleServerActionError(error, { invitationId, teamId, userId });
    }
}

export async function rejectTeamChallengeAction(invitationId: string, teamId: string, userId: string) {
    try {
        const batch = getAdminDb().batch();

        const invitationSnap = await getAdminDb().doc(`teams/${teamId}/invitations/${invitationId}`).get();
        if (!invitationSnap.exists) {
            throw createError(ErrorCodes.DATA_NOT_FOUND, { invitationId });
        }
        const invitation = invitationSnap.data() as Invitation;

        const challengedTeamSnap = await getAdminDb().doc(`teams/${teamId}`).get();
        if (challengedTeamSnap.exists) {
            if (challengedTeamSnap.data()?.createdBy !== userId) {
                throw createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS);
            }
        } else {
            // If team is missing, we still allow deletion if the invitation belongs to this team path
            // This is a safety measure for "ghost" invitations after resets.
            console.warn(`Attempting to reject invitation ${invitationId} for missing team ${teamId}`);
        }

        batch.update(invitationSnap.ref, { status: 'declined' });

        const challengingTeamSnap = await getAdminDb().doc(`teams/${invitation.fromTeamId}`).get();
        if (challengingTeamSnap.exists) {
            const challengingTeam = challengingTeamSnap.data() as GroupTeam;
            const notificationRef = getAdminDb().collection(`users/${challengingTeam.createdBy}/notifications`).doc();
            batch.set(notificationRef, {
                type: 'match_update',
                title: 'Desafío Rechazado',
                message: `"${invitation.toTeamName || 'Un equipo'}" ha rechazado tu desafío.`,
                link: '/competitions',
                isRead: false,
                createdAt: new Date().toISOString(),
            });
        }
        await batch.commit();
        return { success: true };
    } catch (error) {
        return handleServerActionError(error, { invitationId, teamId, userId });
    }
}

export async function deleteTeamAvailabilityPostAction(postId: string, userId: string) {
    try {
        const postRef = getAdminDb().doc(`teamAvailabilityPosts/${postId}`);
        const postSnap = await postRef.get();

        if (!postSnap.exists) {
            throw createError(ErrorCodes.DATA_NOT_FOUND);
        }

        if (postSnap.data()?.createdBy !== userId) {
            throw createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS);
        }

        await postRef.delete();
        return { success: true };
    } catch (error) {
        return handleServerActionError(error);
    }
}

/**
 * Revoke an approved competition application and remove the team from the competition
 */
export async function revokeApplicationAction(
    applicationId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const applicationRef = getAdminDb().collection('competitionApplications').doc(applicationId);
        const applicationDoc = await applicationRef.get();

        if (!applicationDoc.exists) {
            return { success: false, error: 'Aplicación no encontrada' };
        }

        const application = applicationDoc.data() as CompetitionApplication;

        if (application.status !== 'approved') {
            return { success: false, error: 'La aplicación no está aprobada' };
        }

        // 1. Mark application as revoked (preserve historical state)
        await applicationRef.update({ status: 'revoked' });

        // 2. Remove team from competition
        const competitionCollection = application.competitionType === 'cup' ? 'cups' : 'leagues';
        const competitionRef = getAdminDb().collection(competitionCollection).doc(application.competitionId);

        await competitionRef.update({
            teams: FieldValue.arrayRemove(application.teamId)
        });

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Remove a team directly from a cup and update its application status if exists.
 */
export async function removeTeamFromCupAction(
    cupId: string,
    teamId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const cupRef = getAdminDb().collection('cups').doc(cupId);
        const cupDoc = await cupRef.get();

        if (!cupDoc.exists) {
            return { success: false, error: 'Copa no encontrada.' };
        }

        const cup = cupDoc.data() as Cup;

        if (cup.ownerUid !== userId) {
            return { success: false, error: 'No tienes permiso para modificar esta copa.' };
        }

        // Only allow removal if not completed
        if (cup.status === 'completed') {
            return { success: false, error: 'No se puede remover equipos de una copa finalizada.' };
        }

        // 1. Check if it's a ghost team (in subcollection)
        const ghostTeamRef = cupRef.collection('teams').doc(teamId);
        const ghostTeamDoc = await ghostTeamRef.get();

        if (ghostTeamDoc.exists) {
            await ghostTeamRef.delete();
        }

        // 2. Remove team from cup teams array (for real teams)
        await cupRef.update({
            teams: FieldValue.arrayRemove(teamId)
        });

        // 3. Find and update related approved application to 'revoked'
        const applicationsSnapshot = await getAdminDb().collection('competitionApplications')
            .where('competitionId', '==', cupId)
            .where('teamId', '==', teamId)
            .where('status', '==', 'approved')
            .get();

        if (!applicationsSnapshot.empty) {
            const batch = getAdminDb().batch();
            applicationsSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { status: 'revoked' });
            });
            await batch.commit();
        }

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Remove a team from a league. Handles both ghost teams and real teams.
 */
export async function removeTeamFromLeagueAction(
    leagueId: string,
    teamId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const leagueRef = getAdminDb().collection('leagues').doc(leagueId);
        const leagueDoc = await leagueRef.get();

        if (!leagueDoc.exists) {
            return { success: false, error: 'Liga no encontrada.' };
        }

        const league = leagueDoc.data() as League;
        if (league.ownerUid !== userId) {
            return { success: false, error: 'No tienes permiso para modificar esta liga.' };
        }

        // Only allow removal if not completed
        if (league.status === 'completed') {
            return { success: false, error: 'No se puede remover equipos de una liga finalizada.' };
        }

        // 1. Check if it's a ghost team (in subcollection)
        const ghostTeamRef = leagueRef.collection('teams').doc(teamId);
        const ghostTeamDoc = await ghostTeamRef.get();

        if (ghostTeamDoc.exists) {
            await ghostTeamRef.delete();
        }

        // 2. Remove team from league teams array (for real teams)
        await leagueRef.update({
            teams: FieldValue.arrayRemove(teamId)
        });

        // 3. Find and update related approved application to 'revoked'
        const applicationsSnapshot = await getAdminDb().collection('competitionApplications')
            .where('competitionId', '==', leagueId)
            .where('teamId', '==', teamId)
            .where('status', '==', 'approved')
            .get();

        if (!applicationsSnapshot.empty) {
            const batch = getAdminDb().batch();
            applicationsSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { status: 'revoked' });
            });
            await batch.commit();
        }

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}
export async function sendTeamChallengeAction(challengingTeamId: string, challengedTeamId: string, challengerUserId: string) {
    try {
        const batch = getAdminDb().batch();

        const [challengingTeamSnap, challengedTeamSnap] = await Promise.all([
            getAdminDb().doc(`teams/${challengingTeamId}`).get(),
            getAdminDb().doc(`teams/${challengedTeamId}`).get(),
        ]);

        if (!challengingTeamSnap.exists || !challengedTeamSnap.exists) {
            throw createError(ErrorCodes.DATA_NOT_FOUND, { challengingTeamId, challengedTeamId });
        }

        const challengingTeam = { id: challengingTeamSnap.id, ...challengingTeamSnap.data() } as GroupTeam;
        const challengedTeam = { id: challengedTeamSnap.id, ...challengedTeamSnap.data() } as GroupTeam;

        const invitationRef = getAdminDb().collection(`teams/${challengedTeam.id}/invitations`).doc();
        const newInvitation: Omit<Invitation, 'id'> = {
            type: 'team_challenge',
            fromTeamId: challengingTeam.id,
            fromTeamName: challengingTeam.name,
            fromTeamJersey: challengingTeam.jersey,
            toTeamId: challengedTeam.id,
            toTeamName: challengedTeam.name,
            toTeamJersey: challengedTeam.jersey,
            status: 'pending',
            createdBy: challengerUserId,
            createdAt: new Date().toISOString(),
        };
        batch.set(invitationRef, newInvitation);

        const notificationRef = getAdminDb().collection(`users/${challengedTeam.createdBy}/notifications`).doc();
        const notification: Omit<Notification, 'id'> = {
            type: 'match_invite',
            title: '¡Nuevo Desafío!',
            message: `El equipo "${challengingTeam.name}" te ha desafiado a un amistoso.`,
            link: '/competitions/challenges',
            isRead: false,
            createdAt: new Date().toISOString(),
        };
        batch.set(notificationRef, notification);

        await batch.commit();

        return { success: true };
    } catch (error: any) {
        return handleServerActionError(error);
    }
}

export async function createLeagueAction(
    name: string,
    format: LeagueFormat,
    teamIds: string[],
    isPublic: boolean,
    groupId: string,
    ownerUid: string,
    scheduleConfig?: {
        startDate: string;
        matchFrequency: 'weekly' | 'biweekly' | 'custom';
        matchDayOfWeek: number;
        matchTime: string;
        defaultLocation?: MatchLocation;
    },
    logoUrl?: string
): Promise<{ success: boolean; leagueId?: string; error?: string }> {
    try {
        const batch = getAdminDb().batch();

        const leagueRef = getAdminDb().collection('leagues').doc();
        const newLeague: Omit<League, 'id'> = {
            name,
            format,
            teams: teamIds,
            isPublic,
            groupId,
            ownerUid,
            status: isPublic ? 'open_for_applications' : 'draft',
            createdAt: new Date().toISOString(),
            ...(logoUrl && { logoUrl }),
            ...(scheduleConfig && {
                startDate: scheduleConfig.startDate,
                matchFrequency: scheduleConfig.matchFrequency,
                matchDayOfWeek: scheduleConfig.matchDayOfWeek,
                matchTime: scheduleConfig.matchTime,
                defaultLocation: scheduleConfig.defaultLocation,
            }),
        };
        batch.set(leagueRef, newLeague);

        // Fixture generation removed from here. 
        // Logic moved to updateLeagueStatusAction when status changes to 'in_progress'.
        // This prevents double fixture generation and ghost matches in draft leagues.

        await batch.commit();

        return { success: true, leagueId: leagueRef.id };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

export async function updateLeagueStatusAction(
    leagueId: string,
    newStatus: CompetitionStatus
): Promise<{ success: boolean; error?: string }> {
    try {
        const leagueRef = getAdminDb().collection('leagues').doc(leagueId);
        const leagueDoc = await leagueRef.get();

        if (!leagueDoc.exists) {
            return { success: false, error: 'Liga no encontrada.' };
        }

        const leagueData = leagueDoc.data() as League;

        if (newStatus === 'in_progress') {
            const ghostTeamsCount = (await getAdminDb().collection('leagues').doc(leagueId).collection('teams').count().get()).data().count;
            const realTeamCount = Array.isArray(leagueData.teams) ? leagueData.teams.length : 0;
            const totalTeams = ghostTeamsCount + realTeamCount;

            if (totalTeams < 2) {
                return { success: false, error: 'Se necesitan al menos 2 equipos para iniciar la liga.' };
            }
        }

        await leagueRef.update({ status: newStatus });

        // Generate fixture if starting the league
        if (newStatus === 'in_progress') {
            await generateLeagueFixtureAction(leagueId);
        }

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Save rounds into leagues/{leagueId}/fixtures with ownership check
 */
export async function saveLeagueFixturesAction(leagueId: string, rounds: Array<any>): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getServerSession();
        const currentUserId = session?.user?.uid;

        if (!currentUserId) return { success: false, error: 'No autenticado.' };

        const leagueRef = getAdminDb().collection('leagues').doc(leagueId);
        const leagueDoc = await leagueRef.get();
        if (!leagueDoc.exists) return { success: false, error: 'Liga no encontrada.' };

        const leagueData = leagueDoc.data() as League;
        if (leagueData.ownerUid !== currentUserId) return { success: false, error: 'No tienes permisos para modificar este fixture.' };

        // Remove existing fixtures
        const fixturesSnap = await leagueRef.collection('fixtures').get();
        if (!fixturesSnap.empty) {
            const delBatch = getAdminDb().batch();
            fixturesSnap.docs.forEach(d => delBatch.delete(d.ref));
            await delBatch.commit();
        }

        // Write new rounds
        if (rounds && rounds.length > 0) {
            const writeBatch = getAdminDb().batch();
            const fixturesCol = leagueRef.collection('fixtures');
            rounds.forEach((r) => {
                const newRef = fixturesCol.doc();
                writeBatch.set(newRef, {
                    roundNumber: r.roundNumber,
                    roundName: r.roundName,
                    matches: r.matches,
                    createdAt: r.createdAt || new Date().toISOString(),
                });
            });
            await writeBatch.commit();
        }

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Referee management actions: add / update / delete
 */
export async function addRefereeAction(competitionType: 'leagues' | 'cups', competitionId: string, data: { name: string; email?: string | null; phone?: string | null; notes?: string | null; photoUrl?: string | null; }): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const session = await getServerSession();
        const uid = session?.user?.uid;
        if (!uid) return { success: false, error: 'No autenticado.' };

        const compRef = getAdminDb().collection(competitionType).doc(competitionId);
        const compSnap = await compRef.get();
        if (!compSnap.exists) return { success: false, error: 'Competición no encontrada.' };

        const compData = compSnap.data() as any;
        if (compData.ownerUid !== uid) return { success: false, error: 'No tienes permisos para añadir árbitros.' };

        const refCol = compRef.collection('referees');
        const newRef = await refCol.add({
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            notes: data.notes || null,
            photoUrl: data.photoUrl || null,
            competitionId,
            createdAt: new Date().toISOString(),
            assignedMatches: [],
        });

        return { success: true, id: newRef.id };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

export async function updateRefereeAction(competitionType: 'leagues' | 'cups', competitionId: string, refereeId: string, updates: { name?: string; email?: string | null; phone?: string | null; notes?: string | null; photoUrl?: string | null; }): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getServerSession();
        const uid = session?.user?.uid;
        if (!uid) return { success: false, error: 'No autenticado.' };

        const compRef = getAdminDb().collection(competitionType).doc(competitionId);
        const compSnap = await compRef.get();
        if (!compSnap.exists) return { success: false, error: 'Competición no encontrada.' };

        const compData = compSnap.data() as any;
        if (compData.ownerUid !== uid) return { success: false, error: 'No tienes permisos para editar árbitros.' };

        const refDoc = compRef.collection('referees').doc(refereeId);
        await refDoc.update({
            ...(updates.name !== undefined ? { name: updates.name } : {}),
            ...(updates.email !== undefined ? { email: updates.email } : {}),
            ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
            ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
            ...(updates.photoUrl !== undefined ? { photoUrl: updates.photoUrl } : {}),
            updatedAt: new Date().toISOString(),
        });

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

export async function deleteRefereeAction(competitionType: 'leagues' | 'cups', competitionId: string, refereeId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getServerSession();
        const uid = session?.user?.uid;
        if (!uid) return { success: false, error: 'No autenticado.' };

        const compRef = getAdminDb().collection(competitionType).doc(competitionId);
        const compSnap = await compRef.get();
        if (!compSnap.exists) return { success: false, error: 'Competición no encontrada.' };

        const compData = compSnap.data() as any;
        if (compData.ownerUid !== uid) return { success: false, error: 'No tienes permisos para eliminar árbitros.' };

        const refDoc = compRef.collection('referees').doc(refereeId);
        await refDoc.delete();

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Assign referee to a match (league fixture or cup bracket)
 */
export async function assignRefereeAction(competitionType: 'leagues' | 'cups', competitionId: string, refereeId: string, matchData: { matchId: string; fixtureDocId?: string; isCup: boolean }): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getServerSession();
        const uid = session?.user?.uid;
        if (!uid) return { success: false, error: 'No autenticado.' };

        const compRef = getAdminDb().collection(competitionType).doc(competitionId);
        const compSnap = await compRef.get();
        if (!compSnap.exists) return { success: false, error: 'Competición no encontrada.' };

        const compData = compSnap.data() as any;
        if (compData.ownerUid !== uid) return { success: false, error: 'No tienes permisos para asignar árbitros.' };

        const refereeSnap = await compRef.collection('referees').doc(refereeId).get();
        if (!refereeSnap.exists) return { success: false, error: 'Árbitro no encontrado.' };
        const refereeData = refereeSnap.data() as any;

        const batch = getAdminDb().batch();

        if (matchData.isCup) {
            // Cup assignment
            const bracketArray = compData.bracket || [];
            const updatedBracket = bracketArray.map((m: any) => {
                if (m.id === matchData.matchId) {
                    return { ...m, refereeId, refereeName: refereeData.name };
                }
                return m;
            });
            batch.update(compRef, { bracket: updatedBracket });

            // Update referee's assignedMatches
            const assignmentKey = `bracket:${matchData.matchId}`;
            const currentAssignments = refereeData.assignedMatches || [];
            if (!currentAssignments.includes(assignmentKey)) {
                batch.update(compRef.collection('referees').doc(refereeId), {
                    assignedMatches: [...currentAssignments, assignmentKey],
                });
            }
        } else {
            // League assignment (fixture)
            if (!matchData.fixtureDocId) return { success: false, error: 'Falta fixtureDocId para ligas.' };
            const fixtureRef = compRef.collection('fixtures').doc(matchData.fixtureDocId);
            const fixtureSnap = await fixtureRef.get();
            if (!fixtureSnap.exists) return { success: false, error: 'Fixture no encontrado.' };

            const fixtureData = fixtureSnap.data() as any;
            const updatedMatches = (fixtureData.matches || []).map((m: any) => {
                if (m.id === matchData.matchId) {
                    return { ...m, refereeId, refereeName: refereeData.name };
                }
                return m;
            });
            batch.update(fixtureRef, { matches: updatedMatches });

            // Update referee's assignedMatches
            const assignmentKey = `${matchData.fixtureDocId}:${matchData.matchId}`;
            const currentAssignments = refereeData.assignedMatches || [];
            if (!currentAssignments.includes(assignmentKey)) {
                batch.update(compRef.collection('referees').doc(refereeId), {
                    assignedMatches: [...currentAssignments, assignmentKey],
                });
            }
        }

        await batch.commit();
        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Save match result (handles both league and cup logic)
 */
export async function saveMatchResultAction(competitionType: 'leagues' | 'cups', competitionId: string, matchData: { matchId: string; fixtureDocId?: string; homeScore: number; awayScore: number; scorers: any[]; cards: any[]; mvp?: any; isWalkover: boolean; penaltyWinnerId?: string | null; streamingUrl?: string; isLive?: boolean; attendance?: number | null; notes?: string; isCup: boolean }): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getServerSession();
        const uid = session?.user?.uid;
        if (!uid) return { success: false, error: 'No autenticado.' };

        const compRef = getAdminDb().collection(competitionType).doc(competitionId);
        const compSnap = await compRef.get();
        if (!compSnap.exists) return { success: false, error: 'Competición no encontrada.' };

        const compData = compSnap.data() as any;
        if (compData.ownerUid !== uid) return { success: false, error: 'No tienes permisos para guardar resultados.' };

        if (matchData.isCup) {
            // CUP LOGIC (Keep existing for now, but could be enhanced later if cups get global stats)
            const updates: any = { bracket: compData.bracket || [] };
            
            // Update match in bracket array
            updates.bracket = (updates.bracket).map((bm: any) => {
                if (bm.id === matchData.matchId) {
                    return {
                        ...bm,
                        homeScore: matchData.homeScore,
                        awayScore: matchData.awayScore,
                        scorers: matchData.scorers,
                        cards: matchData.cards,
                        isWalkover: matchData.isWalkover,
                        status: 'finished',
                        penaltyWinnerId: matchData.penaltyWinnerId || null,
                        streamingUrl: matchData.streamingUrl || null,
                        isLive: matchData.isLive || false,
                        ...(matchData.mvp ? { mvp: matchData.mvp } : {}),
                        ...(matchData.attendance !== null && matchData.attendance !== undefined ? { attendance: matchData.attendance } : {}),
                        ...(matchData.notes ? { notes: matchData.notes } : {}),
                    };
                }
                return bm;
            });

            await compRef.update(updates);
        } else {
            // LEAGUE LOGIC
            if (!matchData.fixtureDocId) return { success: false, error: 'Falta fixtureDocId para ligas.' };
            const fixtureRef = compRef.collection('fixtures').doc(matchData.fixtureDocId);
            const fixtureSnap = await fixtureRef.get();
            if (!fixtureSnap.exists) return { success: false, error: 'Fixture no encontrado.' };

            const fixtureData = fixtureSnap.data() as any;
            const previousMatch = (fixtureData.matches || []).find((m: any) => m.id === matchData.matchId);
            
            // --- PLAYER STATS SYNC (Real Players only) ---
            const db = getAdminDb();
            const playerStatsBatch = db.batch();
            const statsUpdatedPlayers = new Set<string>();

            // Helper to get stats delta
            const getDeltas = (prevScorers: any[] = [], nextScorers: any[] = []) => {
                const deltas = new Map<string, { goals: number; assists: number }>();
                
                prevScorers.forEach(s => {
                    if (s.playerId && !s.playerId.startsWith('gp_')) {
                        const d = deltas.get(s.playerId) || { goals: 0, assists: 0 };
                        d.goals -= 1;
                        deltas.set(s.playerId, d);
                    }
                    if (s.assistantId && !s.assistantId.startsWith('gp_')) {
                        const d = deltas.get(s.assistantId) || { goals: 0, assists: 0 };
                        d.assists -= 1;
                        deltas.set(s.assistantId, d);
                    }
                });

                nextScorers.forEach(s => {
                    if (s.playerId && !s.playerId.startsWith('gp_')) {
                        const d = deltas.get(s.playerId) || { goals: 0, assists: 0 };
                        d.goals += 1;
                        deltas.set(s.playerId, d);
                    }
                    if (s.assistantId && !s.assistantId.startsWith('gp_')) {
                        const d = deltas.get(s.assistantId) || { goals: 0, assists: 0 };
                        d.assists += 1;
                        deltas.set(s.assistantId, d);
                    }
                });

                return deltas;
            };

            const deltas = getDeltas(previousMatch?.scorers, matchData.scorers);
            deltas.forEach((val, pid) => {
                if (val.goals !== 0 || val.assists !== 0) {
                    const pRef = db.collection('players').doc(pid);
                    const updates: any = {};
                    if (val.goals !== 0) updates['stats.goals'] = FieldValue.increment(val.goals);
                    if (val.assists !== 0) updates['stats.assists'] = FieldValue.increment(val.assists);
                    playerStatsBatch.update(pRef, updates);
                    statsUpdatedPlayers.add(pid);
                }
            });


            const updatedMatches = (fixtureData.matches || []).map((m: any) => {
                if (m.id === matchData.matchId) {
                    return {
                        ...m,
                        homeScore: matchData.homeScore,
                        awayScore: matchData.awayScore,
                        scorers: matchData.scorers,
                        cards: matchData.cards,
                        isWalkover: matchData.isWalkover,
                        status: 'finished',
                        ...(matchData.mvp ? { mvp: matchData.mvp } : {}),
                        ...(matchData.attendance !== null && matchData.attendance !== undefined ? { attendance: matchData.attendance } : {}),
                        ...(matchData.notes ? { notes: matchData.notes } : {}),
                    };
                }
                return m;
            });
            
            await fixtureRef.update({ matches: updatedMatches });
            
            // Commit stats updates
            await playerStatsBatch.commit();

            // --- STANDINGS SYNC ---
            await updateLeagueStandingsAction(competitionId);
        }

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Update bracket match settings (date, time, venue, streaming, etc)
 */
export async function updateBracketMatchSettingsAction(cupId: string, matchId: string, settings: { date?: string; time?: string; venue?: string; streamingUrl?: string; isLive?: boolean }): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getServerSession();
        const uid = session?.user?.uid;
        if (!uid) return { success: false, error: 'No autenticado.' };

        const cupRef = getAdminDb().collection('cups').doc(cupId);
        const cupSnap = await cupRef.get();
        if (!cupSnap.exists) return { success: false, error: 'Copa no encontrada.' };

        const cupData = cupSnap.data() as any;
        if (cupData.ownerUid !== uid) return { success: false, error: 'No tienes permisos para editar este torneo.' };

        const updatedBracket = (cupData.bracket || []).map((m: any) => {
            if (m.id === matchId) {
                return { 
                    ...m, 
                    ...(settings.date !== undefined ? { date: settings.date } : {}),
                    ...(settings.time !== undefined ? { time: settings.time } : {}),
                    ...(settings.venue !== undefined ? { venue: settings.venue } : {}),
                    ...(settings.streamingUrl !== undefined ? { streamingUrl: settings.streamingUrl } : {}),
                    ...(settings.isLive !== undefined ? { isLive: settings.isLive } : {}),
                };
            }
            return m;
        });

        await cupRef.update({ bracket: updatedBracket });
        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Update cup status
 */
export async function updateCupStatusAction(cupId: string, newStatus: CompetitionStatus): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getServerSession();
        const uid = session?.user?.uid;
        if (!uid) return { success: false, error: 'No autenticado.' };

        const cupRef = getAdminDb().collection('cups').doc(cupId);
        const cupSnap = await cupRef.get();
        if (!cupSnap.exists) return { success: false, error: 'Copa no encontrada.' };

        const cupData = cupSnap.data() as any;
        if (cupData.ownerUid !== uid) return { success: false, error: 'No tienes permisos para editar esta copa.' };

        await cupRef.update({ status: newStatus });
        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Add/Remove sponsors from competition
 */
export async function manageSponsorAction(competitionType: 'leagues' | 'cups', competitionId: string, action: 'add' | 'remove', sponsor: { id?: string; name: string; logoUrl: string; websiteUrl?: string; order?: number }): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getServerSession();
        const uid = session?.user?.uid;
        if (!uid) return { success: false, error: 'No autenticado.' };

        const compRef = getAdminDb().collection(competitionType).doc(competitionId);
        const compSnap = await compRef.get();
        if (!compSnap.exists) return { success: false, error: 'Competición no encontrada.' };

        const compData = compSnap.data() as any;
        if (compData.ownerUid !== uid) return { success: false, error: 'No tienes permisos para editar sponsors.' };

        const sponsorWithId = {
            ...sponsor,
            id: sponsor.id || Math.random().toString(36).substring(2, 11),
        };

        if (action === 'add') {
            const sponsors = compData.sponsors || [];
            if (!sponsors.find((s: any) => s.id === sponsorWithId.id)) {
                await compRef.update({
                    sponsors: [...sponsors, sponsorWithId],
                });
            }
        } else if (action === 'remove') {
            const sponsors = compData.sponsors || [];
            await compRef.update({
                sponsors: sponsors.filter((s: any) => s.id !== sponsor.id),
            });
        }

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

export async function deleteCompetitionAction(
    competitionId: string,
    competitionType: 'leagues' | 'cups'
): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getServerSession();
        const currentUserId = session?.user?.uid;

        if (!currentUserId) {
            return { success: false, error: 'No autenticado.' };
        }

        const compRef = getAdminDb().collection(competitionType).doc(competitionId);
        const compDoc = await compRef.get();

        if (!compDoc.exists) {
            return { success: false, error: 'Competición no encontrada.' };
        }

        const compData = compDoc.data() as League | Cup;
        if (compData.ownerUid !== currentUserId) {
            return { success: false, error: 'No tienes permisos para eliminar esta competición.' };
        }

        const subcollections = ['teams', 'applications', ...(competitionType === 'leagues' ? ['fixtures'] : [])];

        for (const subcollectionName of subcollections) {
            const snapshot = await compRef.collection(subcollectionName).get();
            if (snapshot.empty) continue;

            const batch = getAdminDb().batch();
            snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
            await batch.commit();
        }

        await compRef.delete();

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Helper to generate fixture data (not exported)
 */
function generateFixtureData(
    teams: GroupTeam[],
    format: LeagueFormat,
    schedule: {
        startDate: string;
        matchFrequency: 'weekly' | 'biweekly' | 'custom';
        matchDayOfWeek: number;
        matchTime: string;
        defaultLocation?: MatchLocation;
    },
    leagueId: string,
    ownerUid: string,
    groupId: string
): Partial<Match>[] {
    const matches: Partial<Match>[] = [];

    const numRounds = teams.length - 1;
    const matchesPerRound = teams.length / 2;
    const isDoubleRoundRobin = format === 'double_round_robin';
    const totalPhases = isDoubleRoundRobin ? 2 : 1; // Ida y vuelta

    // Helper function to calculate match date
    const getMatchDate = (round: number): Date => {
        const startDate = new Date(schedule.startDate);
        const daysToAdd = schedule.matchFrequency === 'weekly' ? round * 7 : round * 14;
        const matchDate = new Date(startDate);
        matchDate.setDate(matchDate.getDate() + daysToAdd);

        // Set time
        const [hours, minutes] = schedule.matchTime.split(':');
        matchDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        return matchDate;
    };

    let globalRound = 0;
    // Clone teams array for rotation
    let phaseTeams = [...teams];

    for (let phase = 0; phase < totalPhases; phase++) {
        // Reset teams rotation for second phase
        if (phase === 1) {
            phaseTeams = [...teams];
        }

        for (let round = 0; round < numRounds; round++) {
            globalRound++;
            const matchDate = getMatchDate(globalRound - 1);

            for (let i = 0; i < matchesPerRound; i++) {
                const team1 = phaseTeams[i];
                const team2 = phaseTeams[phaseTeams.length - 1 - i];

                if (team1.id === 'bye' || team2.id === 'bye') continue;

                // For second phase (vuelta), invert home/away
                const homeTeam = phase === 0 ? team1 : team2;
                const awayTeam = phase === 0 ? team2 : team1;

                const matchData: Partial<Match> = {
                    title: `${homeTeam.name} vs ${awayTeam.name}`,
                    date: matchDate.toISOString(),
                    time: schedule.matchTime || "19:00",
                    location: schedule.defaultLocation || { name: "A definir", address: "", lat: 0, lng: 0, placeId: "" },
                    type: 'league',
                    matchSize: 22,
                    status: 'upcoming',
                    ownerUid,
                    groupId,
                    participantTeamIds: [homeTeam.id, awayTeam.id],
                    teams: [
                        { name: homeTeam.name, players: [], totalOVR: 0, averageOVR: 0, jersey: homeTeam.jersey },
                        { name: awayTeam.name, players: [], totalOVR: 0, averageOVR: 0, jersey: awayTeam.jersey },
                    ],
                    leagueInfo: {
                        leagueId: leagueId,
                        round: globalRound,
                    },
                    createdAt: new Date().toISOString(),
                };
                matches.push(matchData);
            }
            // Rotate teams for next round
            phaseTeams.splice(1, 0, phaseTeams.pop()!);
        }
    }

    return matches;
}

/**
 * Generate league fixture if it doesn't exist
 */
export async function generateLeagueFixtureAction(leagueId: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Check if matches already exist
        const matchesSnapshot = await getAdminDb()
            .collection('matches')
            .where('leagueInfo.leagueId', '==', leagueId)
            .limit(1)
            .get();

        if (!matchesSnapshot.empty) {

            return { success: true };
        }

        const leagueDoc = await getAdminDb().collection('leagues').doc(leagueId).get();
        if (!leagueDoc.exists) return { success: false, error: 'Liga no encontrada' };
        const league = { id: leagueDoc.id, ...leagueDoc.data() } as League;

        // Fetch teams
        const teamsSnapshot = await getAdminDb()
            .collection('teams')
            .where('__name__', 'in', league.teams.slice(0, 30)) // Limit check
            .get();

        const teams = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GroupTeam));

        if (teams.length % 2 !== 0) {
            teams.push({
                id: 'bye',
                name: 'Descansa',
                jersey: { type: 'plain', primaryColor: '#ffffff', secondaryColor: '#000000' },
                groupId: league.groupId,
                members: [],
                createdBy: league.ownerUid,
                createdAt: new Date().toISOString(),
                isChallengeable: false,
            } as GroupTeam);
        }

        const fixture = generateFixtureData(
            teams,
            league.format,
            {
                startDate: league.startDate || new Date().toISOString(),
                matchFrequency: league.matchFrequency || 'weekly',
                matchDayOfWeek: league.matchDayOfWeek || 6,
                matchTime: league.matchTime || '19:00',
                defaultLocation: league.defaultLocation
            },
            league.id,
            league.ownerUid,
            league.groupId
        );

        const batch = getAdminDb().batch();
        fixture.forEach(matchData => {
            const matchRef = getAdminDb().collection('matches').doc();
            batch.set(matchRef, matchData);
        });
        await batch.commit();

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Delete a league and all its associated matches
 */
export async function deleteLeagueAction(
    leagueId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Delete all matches associated with this league
        const matchesSnapshot = await getAdminDb()
            .collection('matches')
            .where('leagueInfo.leagueId', '==', leagueId)
            .get();

        const deleteMatchesPromises = matchesSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deleteMatchesPromises);

        // Get league data to check for logo
        const leagueDoc = await getAdminDb().collection('leagues').doc(leagueId).get();
        const leagueData = leagueDoc.data();

        // Delete logo from storage if it exists
        if (leagueData?.logoUrl) {
            try {
                const bucket = getAdminStorage();
                // Extract file path from URL
                const urlParts = leagueData.logoUrl.split('/o/')[1];
                if (urlParts) {
                    const filePath = decodeURIComponent(urlParts.split('?')[0]);
                    await bucket.file(filePath).delete();
                }
            } catch (storageError) {
                console.error('Error deleting logo from storage:', storageError);
                // Continue with league deletion even if logo deletion fails
            }
        }

        // Delete the league document
        await getAdminDb().collection('leagues').doc(leagueId).delete();

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ===== CUP ACTIONS =====

/**
 * Create a new cup
 */
export async function createCupAction(
    name: string,
    format: CupFormat,
    isPublic: boolean,
    teamIds: string[],
    groupId: string,
    ownerUid: string,
    logoUrl?: string,
    startDate?: string,
    defaultLocation?: MatchLocation
): Promise<{ success: boolean; cupId?: string; error?: string }> {
    try {
        if (teamIds.length < 2 || ![2, 4, 8, 16, 32].includes(teamIds.length)) {
            return {
                success: false,
                error: 'El número de equipos debe ser 2, 4, 8, 16 o 32'
            };
        }

        const cupData: Omit<Cup, 'id'> = {
            name,
            format,
            status: isPublic ? 'open_for_applications' : 'draft',
            ownerUid,
            groupId,
            isPublic,
            teams: teamIds,
            createdAt: new Date().toISOString(),
            ...(logoUrl && { logoUrl }),
            ...(startDate && { startDate }),
            ...(defaultLocation && { defaultLocation }),
        };

        const cupRef = await getAdminDb().collection('cups').add(cupData);

        return { success: true, cupId: cupRef.id };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Start cup and generate bracket
 */
export async function startCupAction(
    cupId: string,
    seedingType: CupSeedingType = 'random'
): Promise<{ success: boolean; error?: string }> {
    try {
        const cupDoc = await getAdminDb().collection('cups').doc(cupId).get();
        if (!cupDoc.exists) {
            return { success: false, error: 'Copa no encontrada' };
        }

        const cup = { id: cupDoc.id, ...cupDoc.data() } as Cup;

        if (cup.status !== 'draft' && cup.status !== 'open_for_applications') {
            return { success: false, error: 'La copa ya fue iniciada' };
        }

        // Validate number of teams
        const validCounts = [2, 4, 8, 16, 32];
        if (!cup.teams || !validCounts.includes(cup.teams.length)) {
            return {
                success: false,
                error: `La copa tiene ${cup.teams?.length || 0} equipos. Debe tener exactamente 2, 4, 8, 16 o 32 equipos para generar el fixture.`
            };
        }

        // Normalize cup.teams to string IDs (handle legacy object format)
        const teamIds: string[] = (cup.teams as any[]).map((t: any) =>
            typeof t === 'string' ? t : t?.id
        ).filter(Boolean);

        // Get teams data
        const teamsSnapshot = await getAdminDb()
            .collection('teams')
            .where('__name__', 'in', teamIds)
            .get();

        const teams = teamsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as GroupTeam[];

        // Calculate team OVR if using OVR-based seeding
        let teamsWithOVR = teams;
        if (seedingType === 'ovr_based') {
            teamsWithOVR = await Promise.all(
                teams.map(async (team) => {
                    const playerIds = team.members.map(m => m.playerId);
                    const allPlayers: Player[] = [];

                    // Fetch in batches of 10 (Firestore limit)
                    for (let i = 0; i < playerIds.length; i += 10) {
                        const batch = playerIds.slice(i, i + 10);
                        const playersSnapshot = await getAdminDb()
                            .collection('players')
                            .where('__name__', 'in', batch)
                            .get();
                        allPlayers.push(
                            ...playersSnapshot.docs.map(doc =>
                                ({ id: doc.id, ...doc.data() } as Player)
                            )
                        );
                    }

                    const totalOVR = allPlayers.reduce((sum, p) => sum + p.ovr, 0);
                    const averageOVR = allPlayers.length > 0 ? totalOVR / allPlayers.length : 0;

                    return { ...team, ovr: averageOVR };
                })
            );
        }

        // Generate bracket
        const bracket = generateBracket(teamsWithOVR, seedingType);

        // Update cup with bracket
        await getAdminDb().collection('cups').doc(cupId).update({
            status: 'in_progress',
            bracket,
            currentRound: bracket[0]?.round || 'final',
            seedingType,
        });

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Delete cup
 */
export async function deleteCupAction(
    cupId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Delete all matches
        const matchesSnapshot = await getAdminDb()
            .collection('matches')
            .where('leagueInfo.leagueId', '==', cupId) // Using same field for cups
            .get();

        const deleteMatchesPromises = matchesSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deleteMatchesPromises);

        // Get cup data for logo
        const cupDoc = await getAdminDb().collection('cups').doc(cupId).get();
        const cupData = cupDoc.data();

        // Delete logo
        if (cupData?.logoUrl) {
            try {
                const bucket = getAdminStorage();
                const urlParts = cupData.logoUrl.split('/o/')[1];
                if (urlParts) {
                    const filePath = decodeURIComponent(urlParts.split('?')[0]);
                    await bucket.file(filePath).delete();
                }
            } catch (storageError) {
                console.error('Error deleting logo:', storageError);
            }
        }

        await getAdminDb().collection('cups').doc(cupId).delete();

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Update match date/time/location
 */
export async function updateMatchDateAction(
    matchId: string,
    date: string,
    time: string,
    location?: MatchLocation,
    playerIds?: string[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const matchRef = getAdminDb().collection('matches').doc(matchId);

        const updateData: any = {
            date,
            time,
        };

        if (location) {
            updateData.location = location;
        }

        await matchRef.update(updateData);

        if (playerIds && playerIds.length > 0) {
            const matchSnap = await matchRef.get();
            const matchTitle = matchSnap.exists ? (matchSnap.data()?.title ?? 'Partido') : 'Partido';
            notifyMatchUpdatedAction({
                playerIds,
                matchTitle,
                updateType: 'date',
                updateDetails: `${date} a las ${time}`,
            }).catch(err => logger.error('Failed to send date update notification', err));
        }

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Update match location and notify players
 */
export async function updateMatchLocationAction(
    matchId: string,
    location: MatchLocation,
    playerIds: string[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const matchRef = getAdminDb().collection('matches').doc(matchId);

        await matchRef.update({ location });

        if (playerIds.length > 0) {
            const matchSnap = await matchRef.get();
            const matchTitle = matchSnap.exists ? (matchSnap.data()?.title ?? 'Partido') : 'Partido';
            notifyMatchUpdatedAction({
                playerIds,
                matchTitle,
                updateType: 'location',
                updateDetails: location.name,
            }).catch(err => logger.error('Failed to send location update notification', err));
        }

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ============================================================================
// COMPETITION APPLICATIONS
// ============================================================================

/**
 * Deep serialize Firestore data to plain objects
 * Converts Timestamps and removes any Firestore metadata
 */
function deepSerialize(obj: any): any {
    return JSON.parse(JSON.stringify(obj, (_key, value) => {
        if (value && typeof value === 'object' && typeof value.toDate === 'function') {
            return value.toDate().toISOString();
        }
        return value;
    }));
}

/**
 * Get all public leagues and cups that are open for applications
 */
export async function getPublicCompetitionsAction(userId?: string): Promise<{
    success: boolean;
    leagues?: League[];
    cups?: Cup[];
    applications?: CompetitionApplication[];
    error?: string;
}> {
    try {
        console.log('[getPublicCompetitionsAction] Starting query...');

        // Fetch all public leagues regardless of status (except completed)
        // Then filter on the client side for better flexibility
        const allLeaguesSnapshot = await getAdminDb()
            .collection('leagues')
            .where('isPublic', '==', true)
            .get();

        console.log('[getPublicCompetitionsAction] All public leagues found:', allLeaguesSnapshot.size);

        // Filter out only completed leagues (show draft, open_for_applications, in_progress)
        // Serialize Firestore data to plain objects (convert Timestamps to strings)
        const leagues = allLeaguesSnapshot.docs
            .map(doc => {
                const data = doc.data();
                const serialized = deepSerialize(data);
                return { id: doc.id, ...serialized } as League;
            })
            .filter(league => league.status !== 'completed');

        console.log('[getPublicCompetitionsAction] After filtering out completed:', leagues.length);

        // Fetch all public cups (except completed)
        const allCupsSnapshot = await getAdminDb()
            .collection('cups')
            .where('isPublic', '==', true)
            .get();

        console.log('[getPublicCompetitionsAction] All public cups found:', allCupsSnapshot.size);

        // Filter out only completed cups
        // Serialize Firestore data to plain objects
        const cups = allCupsSnapshot.docs
            .map(doc => {
                const data = doc.data();
                const serialized = deepSerialize(data);
                return { id: doc.id, ...serialized } as Cup;
            })
            .filter(cup => cup.status !== 'completed');

        console.log('[getPublicCompetitionsAction] After filtering out completed cups:', cups.length);

        // Fetch user applications if userId is provided
        let applications: CompetitionApplication[] = [];
        if (userId) {
            const appsSnapshot = await getAdminDb()
                .collection('competitionApplications')
                .where('submittedBy', '==', userId)
                .get();

            // Serialize applications to plain objects
            applications = appsSnapshot.docs.map(doc => {
                const data = doc.data();
                const serialized = deepSerialize(data);
                return { id: doc.id, ...serialized } as CompetitionApplication;
            });
        }

        // Final serialization to ensure no Firestore metadata leaks
        return JSON.parse(JSON.stringify({
            success: true,
            leagues,
            cups,
            applications
        }));
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Submit an application for a team to join a competition
 */
export async function submitCompetitionApplicationAction(
    competitionId: string,
    competitionType: CompetitionFormat,
    teamId: string,
    userId: string
): Promise<{ success: boolean; applicationId?: string; error?: string }> {
    try {
        // Fetch team data
        const teamDoc = await getAdminDb().collection('teams').doc(teamId).get();
        if (!teamDoc.exists) {
            return { success: false, error: 'Equipo no encontrado.' };
        }

        const team = teamDoc.data() as GroupTeam;

        // Check if user owns the team
        if (team.createdBy !== userId) {
            return { success: false, error: 'No tienes permiso para postular este equipo.' };
        }

        // Check if application already exists
        const existingApplications = await getAdminDb()
            .collection('competitionApplications')
            .where('competitionId', '==', competitionId)
            .where('teamId', '==', teamId)
            .where('status', 'in', ['pending', 'approved'])
            .get();

        if (!existingApplications.empty) {
            return { success: false, error: 'Ya existe una postulación para este equipo en esta competición.' };
        }

        // Create application
        const applicationData: Omit<CompetitionApplication, 'id'> = {
            competitionId,
            competitionType,
            teamId,
            teamName: team.name,
            teamJersey: team.jersey,
            status: 'pending',
            submittedAt: new Date().toISOString(),
            submittedBy: userId,
        };

        const applicationRef = await getAdminDb().collection('competitionApplications').add(applicationData);

        // Notify competition owner
        try {
            const competitionDoc = await getAdminDb().collection(competitionType === 'cup' ? 'cups' : 'leagues').doc(competitionId).get();
            if (competitionDoc.exists) {
                const competition = competitionDoc.data() as League | Cup;
                const notificationType: NotificationType = competitionType === 'cup' ? 'cup_application' : 'league_application';

                await getAdminDb().collection(`users/${competition.ownerUid}/notifications`).add({
                    type: notificationType,
                    title: `Nueva postulación para ${competition.name}`,
                    message: `El equipo ${team.name} quiere unirse.`,
                    link: `/organizer/${competitionType === 'cup' ? 'cup' : 'league'}/${competitionId}?tab=applications`,
                    isRead: false,
                    createdAt: new Date().toISOString(),
                    metadata: {
                        fromUserId: userId,
                        fromUserName: team.name, // Using team name as "from" for context
                    }
                });
            }
        } catch (notifError) {
            console.error('Error sending application notification:', notifError);
            // Don't fail the whole action if notification fails
        }

        return { success: true, applicationId: applicationRef.id };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Get all applications for a specific competition
 */
export async function getCompetitionApplicationsAction(
    competitionId: string,
    competitionType: CompetitionFormat
): Promise<{ success: boolean; applications?: CompetitionApplication[]; error?: string }> {
    try {
        const snapshot = await getAdminDb()
            .collection('competitionApplications')
            .where('competitionId', '==', competitionId)
            .where('competitionType', '==', competitionType)
            .get();

        const applications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as CompetitionApplication));

        // Sort by submittedAt in memory to avoid requiring a composite index
        applications.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

        return { success: true, applications };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Approve a competition application and add team to the competition
 */
export async function approveApplicationAction(
    applicationId: string,
    competitionId: string,
    competitionType: CompetitionFormat
): Promise<{ success: boolean; error?: string }> {
    try {
        const applicationRef = getAdminDb().collection('competitionApplications').doc(applicationId);
        const applicationDoc = await applicationRef.get();

        if (!applicationDoc.exists) {
            return { success: false, error: 'Aplicación no encontrada.' };
        }

        const application = applicationDoc.data() as CompetitionApplication;

        // Update application status
        await applicationRef.update({ status: 'approved' });

        // Add team to competition
        const competitionCollection = competitionType === 'league' ? 'leagues' : 'cups';
        const competitionRef = getAdminDb().collection(competitionCollection).doc(competitionId);

        await competitionRef.update({
            teams: FieldValue.arrayUnion(application.teamId)
        });

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Reject a competition application
 */
export async function rejectApplicationAction(
    applicationId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const applicationRef = getAdminDb().collection('competitionApplications').doc(applicationId);
        const applicationDoc = await applicationRef.get();

        if (!applicationDoc.exists) {
            return { success: false, error: 'Aplicación no encontrada.' };
        }

        await applicationRef.update({ status: 'rejected' });

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ============================================================================
// MATCH FINAL SCORE NORMALIZATION
// ============================================================================
export async function updateMatchFinalScoreAction(
    matchId: string,
    team1Score: number,
    team2Score: number,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const matchRef = getAdminDb().collection('matches').doc(matchId);
        const matchSnap = await matchRef.get();
        if (!matchSnap.exists) {
            return { success: false, error: 'Partido no encontrado.' };
        }
        const match = { id: matchSnap.id, ...matchSnap.data() } as Match;

        if (!match.participantTeamIds || match.participantTeamIds.length !== 2) {
            return { success: false, error: 'Estructura de equipos inválida.' };
        }
        if (!match.teams || match.teams.length !== 2) {
            return { success: false, error: 'Datos de equipos incompletos.' };
        }

        // Basic permission: only owner can set score (extend later for admins)
        if (match.ownerUid !== userId) {
            return { success: false, error: 'No autorizado para actualizar el resultado.' };
        }

        // Ensure scores are numbers
        const normalizedScore1 = typeof team1Score === 'number' ? team1Score : Number(team1Score) || 0;
        const normalizedScore2 = typeof team2Score === 'number' ? team2Score : Number(team2Score) || 0;

        const updateData: Partial<Match> = {
            finalScore: { team1: normalizedScore1, team2: normalizedScore2 },
            teams: [
                { ...match.teams[0], finalScore: normalizedScore1 },
                { ...match.teams[1], finalScore: normalizedScore2 },
            ],
            status: 'completed',
            updatedAt: new Date().toISOString(),
            // Ensure live widgets hide after finalization
            liveStatus: 'finished',
            timerPaused: true,
        };

        // Auto-complete match if not yet finalized
        if (match.status === 'upcoming' || match.status === 'active') {
            updateData.status = 'completed';
            updateData.finalizedAt = new Date().toISOString();
        }

        await matchRef.update(updateData as any);

        // Update League Standings if applicable
        if (match.type === 'league' && match.leagueInfo?.leagueId) {
            try {
                await updateLeagueStandingsAction(match.leagueInfo.leagueId);
            } catch (standingsErr) {
                console.error('[updateMatchFinalScoreAction] League standings update error (non-fatal):', standingsErr);
            }
        }

        // If this is a cup match, auto-advance the winner in the bracket
        try {
            const refreshed = await matchRef.get();
            const updatedMatch = { id: refreshed.id, ...refreshed.data() } as Match;

            const isCup = updatedMatch.type === 'cup';
            const cupId = updatedMatch.leagueInfo?.leagueId;
            const isDraw = team1Score === team2Score;

            // In cups, only advance if there is a winner.
            // If it's a draw, it stays as 'completed' but doesn't advance until a winner is set (e.g. via penalties)
            if (isCup && cupId && !isDraw) {
                const team1Id = updatedMatch.participantTeamIds?.[0] || (updatedMatch as any).teams?.[0]?.id;
                const team2Id = updatedMatch.participantTeamIds?.[1] || (updatedMatch as any).teams?.[1]?.id;
                const winnerId = team1Score > team2Score ? team1Id : team2Id;

                if (winnerId) {
                    await advanceCupWinnerAction(cupId, updatedMatch.id, winnerId);
                }
            }
        } catch (advErr) {
            console.error('[updateMatchFinalScoreAction] Cup advancement error (non-fatal):', advErr);
        }

        // Publish match_played activity for all participants
        try {
            // Use a Set to avoid duplicate notifications for the same user
            const participantUserIds = new Set<string>();

            // Add from playerUids if available
            if (match.playerUids) {
                match.playerUids.forEach(uid => participantUserIds.add(uid));
            }

            // Also check players array just in case
            if (match.players) {
                match.players.forEach(p => {
                    // Assuming player.uid is the user ID for real users
                    // We might need a check if player is a "real user" vs "dummy player"
                    // But usually uid points to a user or a generated ID. 
                    // For now, we assume if it's in players array, it's relevant.
                    // Ideally we should check if player.ownerUid exists and use that.
                    // Let's fetch the players if needed, but match.players has basic info.
                    // The 'uid' in match.players usually refers to the Player document ID.
                    // We need the User ID (ownerUid) to post to their feed.
                    // However, for many apps, Player ID = User ID for the main profile.
                    // Let's rely on what we have. If we need ownerUid, we might need to fetch players.
                    // Optimization: Let's assume for now we use the IDs we have.
                    // Wait, match.playerUids is supposed to be User IDs? 
                    // In types.ts: playerUids: string[]; // Added for simpler queries
                    // It usually stores User UIDs.
                    if (p.uid) participantUserIds.add(p.uid);
                });
            }

            // Publish for each unique user
            const publishPromises = Array.from(participantUserIds).map(userId =>
                publishMatchPlayedActivity(userId, match.id, match.title)
            );

            await Promise.allSettled(publishPromises);
        } catch (activityError) {
            console.error('Error publishing match_played activities:', activityError);
            // Don't fail the action if activity creation fails
        }

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error, { matchId });
        return { success: false, error: err.error };
    }
}

// ============================================================================
// LIVE MATCH ACTIONS: Events logging, player stats, live state
// ============================================================================
import type { MatchEvent, LiveMatchStatus } from '../types';

/**
 * Increment player stats atomically based on event type.
 */
export async function updatePlayerEventStatsAction(
    playerId: string,
    stats: { goals?: number; assists?: number; yellowCards?: number; redCards?: number },
    context?: { goalsInMatch?: number; matchId?: string }
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getAdminDb();
        const playerRef = db.doc(`players/${playerId}`);
        const updates: Record<string, FieldValue> = {};

        if (stats.goals) updates['stats.goals'] = FieldValue.increment(stats.goals);
        if (stats.assists) updates['stats.assists'] = FieldValue.increment(stats.assists);
        if (stats.yellowCards) updates['stats.yellowCards'] = FieldValue.increment(stats.yellowCards);
        if (stats.redCards) updates['stats.redCards'] = FieldValue.increment(stats.redCards);

        await playerRef.update(updates);

        // Check achievements after updating stats (goals-related)
        if (stats.goals) {
            const playerDoc = await playerRef.get();
            if (playerDoc.exists) {
                const player = playerDoc.data() as Player;
                // Import dynamically to avoid circular dependencies
                const { checkAndUnlockAchievementsAction } = await import('./achievement-actions');
                await checkAndUnlockAchievementsAction(playerId, player.ownerUid, context);
            }
        }

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Log a match event to the match document and update aggregates.
 * Uses arrayUnion to append events for compatibility with existing components.
 */
export async function logMatchEventAction(
    matchId: string,
    event: MatchEvent,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getAdminDb();
        const matchRef = db.doc(`matches/${matchId}`);
        const snap = await matchRef.get();
        if (!snap.exists) {
            return { success: false, error: 'Partido no encontrado.' };
        }
        const match = { id: snap.id, ...snap.data() } as Match;

        // Only owner/admin can log events
        if (match.ownerUid !== userId) {
            return { success: false, error: 'No autorizado para registrar eventos.' };
        }

        const updates: Record<string, any> = {
            events: FieldValue.arrayUnion(event as any),
        };

        // Update score if regular goal (own_goal counts for opposite team)
        if (event.type === 'goal') {
            const team1Id = match.participantTeamIds?.[0] || match.teams?.[0]?.id || 'team1';
            const team2Id = match.participantTeamIds?.[1] || match.teams?.[1]?.id || 'team2';

            const isOwnGoal = (event as any).goalType === 'own_goal';
            const forTeam1 = event.teamId === team1Id;
            const targetPath = isOwnGoal
                ? (forTeam1 ? 'finalScore.team2' : 'finalScore.team1')
                : (forTeam1 ? 'finalScore.team1' : 'finalScore.team2');
            updates[targetPath] = FieldValue.increment(1);

            // Player stats: goal + optional assist
            // Count goals by this player in this match for hat-trick achievement
            const existingGoals = (match.events || []).filter(
                (e: any) => e.type === 'goal' && e.playerId === event.playerId
            ).length;
            const goalsInMatch = existingGoals + 1; // Include current goal

            await updatePlayerEventStatsAction(event.playerId, { goals: 1 }, { goalsInMatch, matchId });
            if ((event as any).assistId) {
                await updatePlayerEventStatsAction((event as any).assistId, { assists: 1 });
            }
        }

        if (event.type === 'card') {
            const field = (event as any).cardType === 'yellow' ? 'yellowCards' : 'redCards';
            await updatePlayerEventStatsAction(event.playerId, { [field]: 1 } as any);
        }

        await matchRef.update(updates);
        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Update live match status and current minute; set periodStartTs on half starts.
 */
export async function updateLiveStateAction(
    matchId: string,
    newStatus: LiveMatchStatus,
    currentMinute: number,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getAdminDb();
        const matchRef = db.doc(`matches/${matchId}`);
        const snap = await matchRef.get();
        if (!snap.exists) {
            return { success: false, error: 'Partido no encontrado.' };
        }
        const match = { id: snap.id, ...snap.data() } as Match;

        if (match.ownerUid !== userId) {
            return { success: false, error: 'No autorizado para actualizar estado.' };
        }

        if (newStatus === 'finished') {
            const team1Score = match.finalScore?.team1 ?? 0;
            const team2Score = match.finalScore?.team2 ?? 0;
            return await updateMatchFinalScoreAction(matchId, team1Score, team2Score, userId);
        }

        const updates: Record<string, any> = {
            liveStatus: newStatus,
            currentMinute,
        };

        if (newStatus === 'first_half' || newStatus === 'second_half') {
            updates['periodStartTs'] = FieldValue.serverTimestamp();
            updates['timerPaused'] = false;
            // Ensure dashboards treat match as live/active
            updates['status'] = 'active';
        }
        if (newStatus === 'half_time') {
            updates['timerPaused'] = true;
            updates['status'] = 'active';
        }

        await matchRef.update(updates);
        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ============================================================================
// LEAGUE STANDINGS
// ============================================================================

/**
 * Update league standings table based on all completed matches
 * This should be called after a league match is finalized
 */
export async function updateLeagueStandingsAction(
    leagueId: string
): Promise<{ success: boolean; standings?: any[]; error?: string }> {
    try {
        const db = getAdminDb();
        // Get league data
        const leagueRef = db.collection('leagues').doc(leagueId);
        const leagueDoc = await leagueRef.get();
        if (!leagueDoc.exists) {
            return { success: false, error: 'Liga no encontrada.' };
        }
        const league = { id: leagueDoc.id, ...leagueDoc.data() } as League;

        // 1. COLLECT ALL MATCHES
        const allMatchesMap = new Map<string, Match>();

        // 1a. From root 'matches' collection (evaluated league matches)
        const rootMatchesSnapshot = await db
            .collection('matches')
            .where('leagueInfo.leagueId', '==', leagueId)
            .where('status', 'in', ['completed', 'evaluated', 'finished'])
            .get();
        
        rootMatchesSnapshot.docs.forEach(doc => {
            allMatchesMap.set(doc.id, { id: doc.id, ...doc.data() } as Match);
        });

        // 1b. From 'fixtures' subcollection (organizer-managed matches)
        const fixturesSnapshot = await leagueRef.collection('fixtures').get();
        fixturesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.matches && Array.isArray(data.matches)) {
                data.matches.forEach((m: any) => {
                    if (m.status === 'completed' || m.status === 'evaluated' || m.status === 'finished') {
                        // De-duplicate: Prefer root match if it exists (usually has more info)
                        if (!allMatchesMap.has(m.id)) {
                            allMatchesMap.set(m.id, m as Match);
                        }
                    }
                });
            }
        });

        const allMatches = Array.from(allMatchesMap.values());

        // 2. COLLECT TEAM DATA (Real & Ghost)

        // 2. COLLECT TEAM DATA (Real & Ghost)
        const teamsMap = new Map<string, { name: string; jersey: any }>();

        // 2a. Real Teams (Root collection)
        if (league.teams && league.teams.length > 0) {
            // Firestore 'in' query limited to 30 items. If more, we'd need chunks.
            const chunks = [];
            for (let i = 0; i < league.teams.length; i += 30) {
                chunks.push(league.teams.slice(i, i + 30));
            }

            for (const chunk of chunks) {
                const teamsSnapshot = await db.collection('teams').where('__name__', 'in', chunk).get();
                teamsSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    teamsMap.set(doc.id, { name: data.name, jersey: data.jersey });
                });
            }
        }

        // 2b. Ghost Teams (Subcollection)
        const ghostTeamsSnapshot = await leagueRef.collection('teams').get();
        ghostTeamsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            teamsMap.set(doc.id, { name: data.name, jersey: data.jersey });
        });

        // 3. CALCULATE STANDINGS
        const standingsMap = new Map<string, any>();

        // Initialize all teams present in the map (or in league.teams)
        teamsMap.forEach((data, id) => {
            standingsMap.set(id, {
                teamId: id,
                teamName: data.name,
                teamJersey: data.jersey,
                matchesPlayed: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                goalDifference: 0,
                points: 0,
            });
        });

        // Process each match
        allMatches.forEach(match => {
            const team1Id = match.participantTeamIds?.[0] || (match as any).team1Id || (match as any).homeTeamId;
            const team2Id = match.participantTeamIds?.[1] || (match as any).team2Id || (match as any).awayTeamId;

            if (!team1Id || !team2Id) return;

            // Extract scores with fallbacks
            const team1Score = Number(match.finalScore?.team1 ?? (match as any).homeScore ?? 0);
            const team2Score = Number(match.finalScore?.team2 ?? (match as any).awayScore ?? 0);

            const team1Stats = standingsMap.get(team1Id);
            const team2Stats = standingsMap.get(team2Id);

            if (!team1Stats || !team2Stats) return;

            team1Stats.matchesPlayed++;
            team2Stats.matchesPlayed++;
            team1Stats.goalsFor += team1Score;
            team1Stats.goalsAgainst += team2Score;
            team2Stats.goalsFor += team2Score;
            team2Stats.goalsAgainst += team1Score;

            if (team1Score > team2Score) {
                team1Stats.wins++;
                team1Stats.points += (league.pointsForWin ?? 3);
                team2Stats.losses++;
            } else if (team2Score > team1Score) {
                team2Stats.wins++;
                team2Stats.points += (league.pointsForWin ?? 3);
                team1Stats.losses++;
            } else {
                team1Stats.draws++;
                team2Stats.draws++;
                team1Stats.points += (league.pointsForDraw ?? 1);
                team2Stats.points += (league.pointsForDraw ?? 1);
            }

            team1Stats.goalDifference = team1Stats.goalsFor - team1Stats.goalsAgainst;
            team2Stats.goalDifference = team2Stats.goalsFor - team2Stats.goalsAgainst;
        });

        // 4. SORT AND SAVE
        const standings = Array.from(standingsMap.values()).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
            return a.teamName.localeCompare(b.teamName);
        });

        const standingsWithPosition = standings.map((team, index) => ({
            ...team,
            position: index + 1,
        }));

        await leagueRef.update({ standings: standingsWithPosition });

        return { success: true, standings: standingsWithPosition };

        return { success: true, standings: standingsWithPosition };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ============================================================================
// CUP BRACKET ADVANCEMENT
// ============================================================================

/**
 * Create a match document for a cup bracket match if it doesn't exist
 * or return the existing matchId
 */
export async function createCupMatchAction(
    cupId: string,
    bracketMatchId: string
): Promise<{ success: boolean; matchId?: string; error?: string }> {
    try {
        // Get cup data
        const cupDoc = await getAdminDb().collection('cups').doc(cupId).get();
        if (!cupDoc.exists) {
            return { success: false, error: 'Copa no encontrada.' };
        }
        const cup = { id: cupDoc.id, ...cupDoc.data() } as Cup;

        if (!cup.bracket) {
            return { success: false, error: 'Bracket no generado.' };
        }

        // Find the bracket match
        const bracketMatchIndex = cup.bracket.findIndex(bm => bm.id === bracketMatchId);
        if (bracketMatchIndex === -1) {
            return { success: false, error: 'Partido no encontrado en el bracket.' };
        }
        const bracketMatch = cup.bracket[bracketMatchIndex];

        // If match already exists, return its ID
        if (bracketMatch.matchId) {
            return { success: true, matchId: bracketMatch.matchId };
        }

        // Check if teams are ready
        if (!bracketMatch.team1Id || !bracketMatch.team2Id) {
            return { success: false, error: 'Los equipos para este partido aún no están definidos.' };
        }

        // Fetch full team data from Firestore


        const team1Ref = getAdminDb().collection('teams').doc(bracketMatch.team1Id!);
        const team2Ref = getAdminDb().collection('teams').doc(bracketMatch.team2Id!);

        const [team1Snap, team2Snap] = await Promise.all([team1Ref.get(), team2Ref.get()]);



        if (team1Snap.exists) {
            const team1Data = team1Snap.data();

        }

        if (team2Snap.exists) {
            const team2Data = team2Snap.data();

        }

        const team1 = team1Snap.exists ? { id: team1Snap.id, ...team1Snap.data() } as GroupTeam : null;
        const team2 = team2Snap.exists ? { id: team2Snap.id, ...team2Snap.data() } as GroupTeam : null;

        // Collect all player IDs
        const team1PlayerIds = team1?.members.map(m => m.playerId) || [];
        const team2PlayerIds = team2?.members.map(m => m.playerId) || [];
        const allPlayerIds = [...new Set([...team1PlayerIds, ...team2PlayerIds])]; // Deduplicate just in case

        // Fetch all player documents
        let playersMap = new Map<string, Player>();
        if (allPlayerIds.length > 0) {
            const playerRefs = allPlayerIds.map(id => getAdminDb().collection('players').doc(id));
            const playerDocs = await getAdminDb().getAll(...playerRefs);

            playerDocs.forEach(doc => {
                if (doc.exists) {
                    playersMap.set(doc.id, { id: doc.id, ...doc.data() } as Player);
                }
            });
        }

        // Map members to MatchPlayer format
        const mapToMatchPlayers = (members: GroupTeamMember[] | undefined, teamId: string) => {
            if (!members) return [];
            return members.map(m => {
                const player = playersMap.get(m.playerId);
                if (!player) return null;
                return {
                    uid: player.id,
                    displayName: player.name || 'Jugador',
                    photoURL: (player as any).photoUrl || player.photoURL || '',
                    position: player.position || 'MED',
                    ovr: player.ovr || 50,
                    teamId: teamId
                };
            }).filter((p): p is NonNullable<typeof p> => p !== null);
        };

        const team1Players = mapToMatchPlayers(team1?.members, team1?.id || '');
        const team2Players = mapToMatchPlayers(team2?.members, team2?.id || '');

        const allPlayers = [...team1Players, ...team2Players];

        // Log for debugging


        // Create the match document
        const matchRef = getAdminDb().collection('matches').doc();
        const matchData: Partial<Match> = {
            title: `${bracketMatch.team1Name} vs ${bracketMatch.team2Name}`,
            date: cup.startDate || new Date().toISOString(),
            time: '19:00', // Default time
            location: cup.defaultLocation || { name: 'A definir', address: '', lat: 0, lng: 0, placeId: '' },
            type: 'cup',
            matchSize: 22, // Default size
            status: 'upcoming',
            ownerUid: cup.ownerUid,
            groupId: cup.groupId,
            participantTeamIds: [bracketMatch.team1Id!, bracketMatch.team2Id!],
            players: allPlayers,
            playerUids: allPlayers.map(p => p.uid),
            teams: [
                {
                    id: bracketMatch.team1Id!,
                    name: bracketMatch.team1Name || '',
                    players: team1Players,
                    totalOVR: 0,
                    averageOVR: 0,
                    jersey: bracketMatch.team1Jersey || { type: 'plain', primaryColor: '#000000', secondaryColor: '#ffffff' }
                },
                {
                    id: bracketMatch.team2Id!,
                    name: bracketMatch.team2Name || '',
                    players: team2Players,
                    totalOVR: 0,
                    averageOVR: 0,
                    jersey: bracketMatch.team2Jersey || { type: 'plain', primaryColor: '#000000', secondaryColor: '#ffffff' }
                },
            ],
            leagueInfo: {
                leagueId: cupId, // Using same field for cups
                round: 0, // Not used for cups
            },
            createdAt: new Date().toISOString(),
        };

        await matchRef.set(matchData);

        // Update bracket with matchId
        const updatedBracket = [...cup.bracket];
        updatedBracket[bracketMatchIndex] = {
            ...bracketMatch,
            matchId: matchRef.id
        };

        await getAdminDb().collection('cups').doc(cupId).update({
            bracket: updatedBracket
        });

        return { success: true, matchId: matchRef.id };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}


/**
 * Advance winner in cup bracket and create next match if both teams are ready
 * This should be called after a cup match is finalized
 */
export async function advanceCupWinnerAction(
    cupId: string,
    matchId: string,
    winnerId: string
): Promise<{ success: boolean; error?: string }> {
    try {


        const db = getAdminDb();
        const cupRef = db.collection('cups').doc(cupId);
        const matchRef = db.collection('matches').doc(matchId);

        const [matchSnap, winnerTeamSnap] = await Promise.all([
            matchRef.get(),
            db.collection('teams').doc(winnerId).get()
        ]);

        if (!matchSnap.exists) return { success: false, error: 'Partido no encontrado.' };
        if (!winnerTeamSnap.exists) return { success: false, error: 'Equipo ganador no encontrado.' };

        const match = { id: matchSnap.id, ...matchSnap.data() } as Match;
        const winnerTeam = { id: winnerTeamSnap.id, ...winnerTeamSnap.data() } as GroupTeam;

        return await db.runTransaction(async (transaction) => {
            const cupSnap = await transaction.get(cupRef);
            if (!cupSnap.exists) throw new Error('Copa no encontrada.');

            const cup = { id: cupSnap.id, ...cupSnap.data() } as Cup;
            if (!cup.bracket) throw new Error('Bracket no generado.');

            const bracketMatch = cup.bracket.find(bm => bm.matchId === matchId);
            if (!bracketMatch) {
                const alreadyDone = cup.bracket.some(bm => bm.matchId === matchId && bm.winnerId);
                if (alreadyDone) return { success: true };
                return { success: false, error: 'Partido no encontrado en el bracket.' };
            }

            let updatedBracket = advanceWinner(
                cup.bracket,
                bracketMatch.id,
                winnerId,
                winnerTeam.name,
                winnerTeam.jersey,
                match.finalScore || undefined
            );

            const isComplete = isTournamentComplete(updatedBracket);
            const updateData: any = { bracket: updatedBracket };

            if (isComplete) {
                const champion = getChampion(updatedBracket);
                const runnerUp = getRunnerUp(updatedBracket);
                updateData.status = 'completed';
                updateData.completedAt = new Date().toISOString();
                if (champion) {
                    updateData.championTeamId = champion.teamId;
                    updateData.championTeamName = champion.teamName;
                }
                if (runnerUp) {
                    updateData.runnerUpTeamId = runnerUp.teamId;
                    updateData.runnerUpTeamName = runnerUp.teamName;
                }
            } else {
                const currentActiveRound = getCurrentRound(updatedBracket);
                if (currentActiveRound && currentActiveRound !== cup.currentRound) {
                    updateData.currentRound = currentActiveRound;
                }

                const nextRound = getNextRound(bracketMatch.round);
                if (nextRound) {
                    const nextMatchNumber = bracketMatch.nextMatchNumber;
                    if (nextMatchNumber) {
                        const nextBracketMatch = updatedBracket.find(
                            bm => bm.round === nextRound && bm.matchNumber === nextMatchNumber
                        );

                        // Removed eager creation of next match. 
                        // We rely on createCupMatchAction to create the match with full player details (including photos)
                        // when the user interacts with it or when requested.
                        // preventing creation of matches with empty player lists.
                    }
                }
            }

            transaction.update(cupRef, updateData);
            return { success: true };
        });
    } catch (error) {
        console.error('[advanceCupWinnerAction] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

/**
 * Get player performance data for a specific match
 */
export async function getPlayerPerformanceAction(
    matchId: string,
    playerId: string
): Promise<{ success: boolean; performance?: PlayerPerformance; error?: string }> {
    try {
        const performanceSnapshot = await getAdminDb()
            .collection('matches')
            .doc(matchId)
            .collection('playerPerformance')
            .where('playerId', '==', playerId)
            .limit(1)
            .get();

        if (performanceSnapshot.empty) {
            return { success: true, performance: undefined };
        }

        const performance = {
            id: performanceSnapshot.docs[0].id,
            ...performanceSnapshot.docs[0].data(),
        } as PlayerPerformance;

        return { success: true, performance };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Add manual physical performance data (for users without smartwatch)
 * Includes validation to prevent abuse
 */
export async function addManualPerformanceAction(
    userId: string,
    playerId: string,
    matchId: string,
    manualData: {
        distance?: number;
        duration?: number; // in minutes
    }
): Promise<{ success: boolean; performanceId?: string; error?: string }> {
    try {
        // Validation: Reasonable limits
        if (manualData.distance && (manualData.distance < 0 || manualData.distance > 20)) {
            return {
                success: false,
                error: 'La distancia debe estar entre 0 y 20 km.',
            };
        }

        if (manualData.duration && (manualData.duration < 0 || manualData.duration > 180)) {
            return {
                success: false,
                error: 'La duración debe estar entre 0 y 180 minutos.',
            };
        }

        // Get match data to use as activity time
        const matchDoc = await getAdminDb().collection('matches').doc(matchId).get();
        if (!matchDoc.exists) {
            return { success: false, error: 'Partido no encontrado.' };
        }

        const matchData = matchDoc.data();
        if (!matchData) {
            return { success: false, error: 'Datos del partido no encontrados.' };
        }
        const matchDateTime = new Date(matchData.date);

        // Estimate metrics based on manual input
        // These are rough estimates, not precise like smartwatch data
        const estimatedMetrics: any = {};

        if (manualData.distance) {
            estimatedMetrics.distance = manualData.distance;

            // Rough estimates based on distance
            if (manualData.duration) {
                // Calculate average pace
                const paceMinPerKm = manualData.duration / manualData.distance;

                // Estimate steps (very rough: ~1300 steps per km)
                estimatedMetrics.steps = Math.round(manualData.distance * 1300);

                // Estimate calories (very rough: ~65 kcal per km for average person)
                estimatedMetrics.calories = Math.round(manualData.distance * 65);

                // Estimate heart rate based on pace (very rough)
                if (paceMinPerKm < 5) {
                    // Fast pace
                    estimatedMetrics.avgHeartRate = 160;
                    estimatedMetrics.maxHeartRate = 175;
                } else if (paceMinPerKm < 6) {
                    // Moderate pace
                    estimatedMetrics.avgHeartRate = 145;
                    estimatedMetrics.maxHeartRate = 165;
                } else {
                    // Slower pace
                    estimatedMetrics.avgHeartRate = 130;
                    estimatedMetrics.maxHeartRate = 150;
                }
            }
        }

        // Calculate impact (same function as smartwatch data)
        const { calculateAttributeImpact } = await import('../config/google-fit');
        const impact = calculateAttributeImpact(estimatedMetrics);

        // Create performance record
        const performanceData: Omit<PlayerPerformance, 'id'> = {
            playerId,
            matchId,
            userId,
            distance: estimatedMetrics.distance,
            avgHeartRate: estimatedMetrics.avgHeartRate,
            maxHeartRate: estimatedMetrics.maxHeartRate,
            steps: estimatedMetrics.steps,
            calories: estimatedMetrics.calories,
            duration: manualData.duration,
            source: 'manual',
            activityStartTime: matchDateTime.toISOString(),
            activityEndTime: new Date(
                matchDateTime.getTime() + (manualData.duration || 90) * 60000
            ).toISOString(),
            linkedAt: new Date().toISOString(),
            impactOnAttributes: impact,
            rawData: {
                manualInput: manualData,
                note: 'Estimated metrics based on manual input',
            },
        };

        const performanceRef = await getAdminDb()
            .collection('matches')
            .doc(matchId)
            .collection('playerPerformance')
            .add(performanceData);

        logger.info('Manual performance data added', {
            matchId,
            playerId,
            performanceId: performanceRef.id,
            impact,
        });

        return { success: true, performanceId: performanceRef.id };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ============================================
// SOCIAL FEATURES - Follow System
// ============================================

/**
 * Follow a user
 */
export async function followUserAction(
    followerId: string,
    followingId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (followerId === followingId) {
            return { success: false, error: 'No podés seguirte a vos mismo.' };
        }

        // Check if already following using top-level /follows/ collection
        const existingFollowSnapshot = await getAdminDb()
            .collection('follows')
            .where('followerId', '==', followerId)
            .where('followingId', '==', followingId)
            .limit(1)
            .get();

        if (!existingFollowSnapshot.empty) {
            return { success: false, error: 'Ya estás siguiendo a este usuario.' };
        }

        // Create follow relationship in top-level /follows/ collection
        await getAdminDb().collection('follows').add({
            followerId,
            followingId,
            createdAt: new Date().toISOString(),
        });

        // Create notification for the followed user
        await createNotificationAction(followingId, {
            type: 'new_follower',
            title: 'Nuevo Seguidor',
            message: 'Te está siguiendo',
            fromUserId: followerId,
            link: `/players/${followerId}`,
        });

        // Create social activity
        await createActivityAction({
            type: 'new_follower',
            userId: followerId,
            timestamp: new Date().toISOString(),
        });

        // Check achievements for the user who gained a follower
        try {
            const { checkAndUnlockAchievementsAction } = await import('./achievement-actions');
            await checkAndUnlockAchievementsAction(followingId, followingId);
        } catch (achievementError) {
            logger.warn('Failed to check achievements after follow', { followingId, error: achievementError });
        }

        logger.info('User followed successfully', { followerId, followingId });
        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Unfollow a user
 */
export async function unfollowUserAction(
    followerId: string,
    followingId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Find and delete follow relationship from top-level /follows/ collection
        const followSnapshot = await getAdminDb()
            .collection('follows')
            .where('followerId', '==', followerId)
            .where('followingId', '==', followingId)
            .limit(1)
            .get();

        if (followSnapshot.empty) {
            return { success: false, error: 'No estás siguiendo a este usuario.' };
        }

        // Delete the follow document
        await followSnapshot.docs[0].ref.delete();

        logger.info('User unfollowed successfully', { followerId, followingId });
        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Check if user is following another user
 */
export async function isFollowingAction(
    followerId: string,
    followingId: string
): Promise<{ success: boolean; isFollowing: boolean; error?: string }> {
    try {
        const followingDoc = await getAdminDb()
            .collection('users')
            .doc(followerId)
            .collection('following')
            .doc(followingId)
            .get();

        return { success: true, isFollowing: followingDoc.exists };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, isFollowing: false, error: err.error };
    }
}

/**
 * Get followers of a user
 */
export async function getFollowersAction(
    userId: string
): Promise<{ success: boolean; followers?: string[]; count?: number; error?: string }> {
    try {
        // Query top-level 'follows' collection
        const followersSnapshot = await getAdminDb()
            .collection('follows')
            .where('followingId', '==', userId)
            .get();

        const followers = followersSnapshot.docs.map(d => (d.data() as any).followerId).filter(Boolean);

        return { success: true, followers, count: followers.length };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Get users that a user is following
 */
export async function getFollowingAction(
    userId: string
): Promise<{ success: boolean; following?: string[]; count?: number; error?: string }> {
    try {
        // Query top-level 'follows' collection
        const followingSnapshot = await getAdminDb()
            .collection('follows')
            .where('followerId', '==', userId)
            .get();

        const following = followingSnapshot.docs.map(d => (d.data() as any).followingId).filter(Boolean);

        return { success: true, following, count: following.length };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ============================================
// SOCIAL FEATURES - Activity Feed
// ============================================

/**
 * Create a social activity
 */
export async function createActivityAction(activity: Omit<SocialActivity, 'id'>): Promise<{ success: boolean; error?: string }> {
    try {
        await getAdminDb().collection('socialActivities').add(activity);
        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Get social feed for a user (activities from users they follow)
 */
export async function getFeedActivitiesAction(
    userId: string,
    limit: number = 20
): Promise<{ success: boolean; activities?: SocialActivity[]; error?: string }> {
    try {
        // Get list of users that this user follows
        const followingResult = await getFollowingAction(userId);
        if (!followingResult.success || !followingResult.following) {
            return { success: true, activities: [] };
        }

        const following = followingResult.following;

        // Include own activities too
        const userIds = [userId, ...following];

        // Get activities from followed users (limited)
        const activitiesSnapshot = await getAdminDb()
            .collection('socialActivities')
            .where('userId', 'in', userIds.slice(0, 10)) // Firestore 'in' query limited to 10 items
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();

        const activities: SocialActivity[] = activitiesSnapshot.docs.map((doc) => {
            const data = doc.data();
            // Convert to plain object by JSON round-trip to remove Firestore prototypes
            const plainData = JSON.parse(JSON.stringify(data));

            // Handle timestamp explicitly to ensure it's a valid date string/number for the client
            let timestamp = data.timestamp;
            if (data.timestamp && typeof data.timestamp.toDate === 'function') {
                timestamp = data.timestamp.toDate().toISOString();
            } else if (data.timestamp && data.timestamp._seconds) {
                // Handle case where it might be a raw object with _seconds
                timestamp = new Date(data.timestamp._seconds * 1000).toISOString();
            }

            return {
                id: doc.id,
                ...plainData,
                timestamp, // Override with safe timestamp
            };
        });

        return { success: true, activities };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ============================================
// SOCIAL FEATURES - Notifications
// ============================================

/**
 * Create a notification (internal function)
 */
async function createNotificationAction(
    userId: string,
    notification: {
        type: NotificationType;
        title: string;
        message: string;
        fromUserId?: string;
        matchId?: string;
        achievementId?: string;
        playerId?: string;
        link?: string;
    }
): Promise<void> {
    // Get fromUser details if provided
    let fromUserName: string | undefined;
    let fromUserPhoto: string | undefined;

    if (notification.fromUserId) {
        const userDoc = await getAdminDb().collection('users').doc(notification.fromUserId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            fromUserName = userData?.displayName;
            fromUserPhoto = userData?.photoURL;
        }
    }

    await getAdminDb().collection('users').doc(userId).collection('notifications').add({
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: false,
        createdAt: new Date().toISOString(),
        metadata: {
            fromUserId: notification.fromUserId,
            fromUserName,
            fromUserPhoto,
            matchId: notification.matchId,
            achievementId: notification.achievementId,
            playerId: notification.playerId,
        },
        link: notification.link || '/dashboard',
    });
}

/**
 * Get notifications for a user
 */
export async function getNotificationsAction(
    userId: string,
    limit: number = 20
): Promise<{ success: boolean; notifications?: Notification[]; unreadCount?: number; error?: string }> {
    try {
        const notificationsSnapshot = await getAdminDb()
            .collection('users')
            .doc(userId)
            .collection('notifications')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const notifications = notificationsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Notification[];

        const unreadCount = notifications.filter((n) => !n.isRead).length;

        return { success: true, notifications, unreadCount };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsReadAction(
    userId: string,
    notificationId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await getAdminDb()
            .collection('users')
            .doc(userId)
            .collection('notifications')
            .doc(notificationId)
            .update({
                isRead: true,
            });

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsReadAction(
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const unreadNotifications = await getAdminDb()
            .collection('users')
            .doc(userId)
            .collection('notifications')
            .where('isRead', '==', false)
            .get();

        const batch = getAdminDb().batch();
        unreadNotifications.docs.forEach((doc) => {
            batch.update(doc.ref, { isRead: true });
        });
        await batch.commit();

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Update user preferences (view mode, filters, etc.)
 */
export async function updateUserPreferencesAction(
    userId: string,
    preferences: {
        matchesViewMode?: 'grid' | 'compact';
        matchFilters?: {
            types?: string[];
            statuses?: string[];
            onlyMine?: boolean;
        };
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!userId) {
            return { success: false, error: 'Usuario no especificado' };
        }

        const userRef = getAdminDb().collection('users').doc(userId);

        // Merge preferences with existing ones
        await userRef.set(
            { preferences },
            { merge: true }
        );

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Get user preferences
 */
export async function getUserPreferencesAction(
    userId: string
): Promise<{ success: boolean; preferences?: { matchesViewMode?: 'grid' | 'compact'; matchFilters?: { types?: string[]; statuses?: string[]; onlyMine?: boolean } }; error?: string }> {
    try {
        if (!userId) {
            return { success: false, error: 'Usuario no especificado' };
        }

        const userDoc = await getAdminDb().collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return { success: true, preferences: {} };
        }

        const userData = userDoc.data();
        return { success: true, preferences: userData?.preferences || {} };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// --- SECURE OVR AGGREGATION & MATCH FINALIZATION ---
export async function finalizeMatchEvaluationAction(matchId: string) {
    logger.info('Starting finalizeMatchEvaluationAction', { matchId });

    try {
        const db = getAdminDb();
        const matchRef = db.doc(`matches/${matchId}`);
        const assignmentsQuery = db.collection(`matches/${matchId}/assignments`);

        // Fetch assignments first to ensure we have something to process
        const assignmentsSnapshot = await assignmentsQuery.get();
        const assignments = assignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EvaluationAssignment));
        const completedAssignmentIds = assignments.filter(a => a.status === 'completed').map(a => a.id);

        if (completedAssignmentIds.length === 0) {
            throw new Error("No hay evaluaciones completadas para procesar.");
        }

        let playerIdsToUpdate: string[] = [];
        const playerOvrChanges = new Map<string, { player: Player; oldOvr: number; newOvr: number; change: number }>();
        const uniqueUsers = new Set<string>();

        await db.runTransaction(async (transaction) => {
            const matchDoc = await transaction.get(matchRef);
            if (!matchDoc.exists || matchDoc.data()?.status === 'evaluated') {
                throw new Error("Este partido ya ha sido evaluado o no existe.");
            }
            const match = { id: matchDoc.id, ...matchDoc.data() } as Match;

            const pendingSubmissionsQuery = db.collection('evaluationSubmissions').where('matchId', '==', matchId);
            const pendingSubmissionsSnapshot = await transaction.get(pendingSubmissionsQuery);
            if (!pendingSubmissionsSnapshot.empty) {
                throw new Error(`Aún hay ${pendingSubmissionsSnapshot.size} evaluaciones pendientes de procesar. Espera un momento y reintenta.`);
            }

            const peerEvalsQuery = db.collection('evaluations').where('matchId', '==', matchId);
            const peerEvalsSnapshot = await transaction.get(peerEvalsQuery);
            const matchPeerEvals = peerEvalsSnapshot.docs
                .map(doc => ({ ...doc.data(), id: doc.id } as Evaluation))
                .filter(ev => completedAssignmentIds.includes(ev.assignmentId));

            const selfEvalsQuery = db.collection(`matches/${matchId}/selfEvaluations`);
            const selfEvalsSnapshot = await transaction.get(selfEvalsQuery);
            const matchSelfEvals = selfEvalsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SelfEvaluation));
            const selfEvalsByPlayerId = new Map(matchSelfEvals.map(ev => [ev.playerId, ev]));

            // Count MVP votes from selfEvals
            const mvpVoteCount = new Map<string, number>();
            for (const ev of matchSelfEvals) {
                if (ev.mvpVote) {
                    mvpVoteCount.set(ev.mvpVote, (mvpVoteCount.get(ev.mvpVote) || 0) + 1);
                }
            }

            let matchMvpId: string | null = null;
            let maxMatchVotes = 0;
            for (const [uid, count] of mvpVoteCount.entries()) {
                if (count > maxMatchVotes) {
                    maxMatchVotes = count;
                    matchMvpId = uid;
                }
            }

            const peerEvalsByPlayer = matchPeerEvals.reduce((acc, ev) => {
                acc[ev.playerId] = acc[ev.playerId] || [];
                acc[ev.playerId].push(ev);
                return acc;
            }, {} as Record<string, Evaluation[]>);

            const allCompletedPointEvals = matchPeerEvals.filter(ev => ev.rating !== undefined && ev.rating !== null);
            const matchAvgRating = allCompletedPointEvals.length > 0
                ? allCompletedPointEvals.reduce((sum, ev) => sum + (ev.rating || 0), 0) / allCompletedPointEvals.length
                : 5;

            const pendingAssignments = assignments.filter(a => a.status === 'pending');

            for (const assignment of pendingAssignments) {
                const synthEvalRef = db.collection('evaluations').doc();
                const synthEval: Omit<Evaluation, 'id'> = {
                    assignmentId: assignment.id,
                    playerId: assignment.subjectId,
                    evaluatorId: assignment.evaluatorId,
                    matchId: match.id,
                    rating: Math.round(matchAvgRating * 10) / 10,
                    goals: 0,
                    evaluatedAt: new Date().toISOString(),
                    autoGenerated: true,
                };
                transaction.set(synthEvalRef, synthEval);

                const assignRef = db.doc(`matches/${match.id}/assignments/${assignment.id}`);
                transaction.update(assignRef, { status: 'completed', autoCompleted: true, evaluationId: synthEvalRef.id });

                peerEvalsByPlayer[assignment.subjectId] = peerEvalsByPlayer[assignment.subjectId] || [];
                peerEvalsByPlayer[assignment.subjectId].push({ ...synthEval, id: synthEvalRef.id } as Evaluation);
            }

            let team1CalculatedScore = 0;
            let team2CalculatedScore = 0;

            playerIdsToUpdate = match.playerUids || [];
            if (playerIdsToUpdate.length === 0) return;

            const playerDocsMap = new Map<string, Player>();
            const playerRefs = playerIdsToUpdate.map(id => db.collection('players').doc(id));
            const playerDocsSnaps = await db.getAll(...playerRefs);

            playerDocsSnaps.forEach(doc => {
                if (doc.exists) {
                    playerDocsMap.set(doc.id, { id: doc.id, ...doc.data() } as Player);
                }
            });

            for (const playerId of playerIdsToUpdate) {
                const player = playerDocsMap.get(playerId);
                if (!player) continue;

                uniqueUsers.add(player.ownerUid);
                const playerPeerEvals = peerEvalsByPlayer[playerId] || [];
                const pointBasedEvals = playerPeerEvals.filter(ev => ev.rating !== undefined && ev.rating !== null);
                const tagBasedEvals = playerPeerEvals.filter(ev => ev.performanceTags && ev.performanceTags.length > 0);
                const textBasedEvals = playerPeerEvals.filter(ev => ev.aiAttributeChanges && ev.aiAttributeChanges.length > 0);

                let updatedAttributes = { ...player };
                let ovrChangeFromPoints = 0;

                if (tagBasedEvals.length > 0) {
                    const combinedTags = tagBasedEvals.flatMap(ev => ev.performanceTags || []);
                    updatedAttributes = calculateAttributeChanges(player, combinedTags);
                }

                if (textBasedEvals.length > 0) {
                    const allAiChanges = textBasedEvals.flatMap(ev => ev.aiAttributeChanges || []);
                    updatedAttributes = calculateAttributeChangesFromAI(updatedAttributes, allAiChanges);
                }

                const playerSelfEval = selfEvalsByPlayerId.get(playerId);
                const goalsInMatch = playerSelfEval?.goals || 0;
                const assistsInMatch = playerSelfEval?.assists || 0;
                let avgRating = 5;

                if (pointBasedEvals.length > 0) {
                    const totalRating = pointBasedEvals.reduce((sum, ev) => sum + (ev.rating || 0), 0);
                    avgRating = totalRating / pointBasedEvals.length;
                    ovrChangeFromPoints = calculateOvrChange(player.ovr, avgRating);
                } else {
                    if (goalsInMatch >= 2 || assistsInMatch >= 2 || (goalsInMatch + assistsInMatch >= 3)) avgRating = 8;
                    else if (goalsInMatch === 1 || assistsInMatch === 1) avgRating = 7;
                    else avgRating = 5;
                    ovrChangeFromPoints = calculateOvrChange(player.ovr, avgRating);
                }

                if (ovrChangeFromPoints !== 0) {
                    updatedAttributes = calculateAttributeChangesFromPoints(updatedAttributes, ovrChangeFromPoints, player.position || 'MED');
                }

                let newOvr = Math.round((updatedAttributes.pac + updatedAttributes.sho + updatedAttributes.pas + updatedAttributes.dri + updatedAttributes.def + updatedAttributes.phy) / 6);
                newOvr = Math.max(OVR_PROGRESSION.MIN_OVR, Math.min(OVR_PROGRESSION.MAX_OVR, newOvr));

                const newMatchesPlayed = (player.stats.matchesPlayed || 0) + 1;
                const newTotalGoals = (player.stats.goals || 0) + goalsInMatch;
                const newTotalAssists = (player.stats.assists || 0) + assistsInMatch;

                const isInTeam1 = match.teams?.[0]?.players.some(p => p.uid === playerId);
                const isInTeam2 = match.teams?.[1]?.players.some(p => p.uid === playerId);

                if (isInTeam1) team1CalculatedScore += goalsInMatch;
                else if (isInTeam2) team2CalculatedScore += goalsInMatch;

                const newAvgRating = ((player.stats.averageRating || 0) * (player.stats.matchesPlayed || 0) + avgRating) / newMatchesPlayed;

                transaction.update(db.doc(`players/${playerId}`), {
                    ...updatedAttributes,
                    ovr: newOvr,
                    stats: {
                        matchesPlayed: newMatchesPlayed,
                        goals: newTotalGoals,
                        assists: newTotalAssists,
                        averageRating: newAvgRating,
                        mvpVotes: (player.stats.mvpVotes || 0) + (playerId === matchMvpId ? 1 : 0),
                    },
                });

                // Calculate Certera Attribute Variation
                const attributeDeltas: Partial<Pick<Player, 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy'>> = {
                    pac: updatedAttributes.pac - player.pac,
                    sho: updatedAttributes.sho - player.sho,
                    pas: updatedAttributes.pas - player.pas,
                    dri: updatedAttributes.dri - player.dri,
                    def: updatedAttributes.def - player.def,
                    phy: updatedAttributes.phy - player.phy,
                };

                const historyRef = db.collection(`players/${playerId}/ovrHistory`).doc();
                const historyEntry: Omit<OvrHistory, 'id'> = {
                    date: new Date().toISOString(),
                    oldOVR: player.ovr,
                    newOVR: newOvr,
                    change: newOvr - player.ovr,
                    matchId: match.id,
                    attributeChanges: attributeDeltas,
                };
                transaction.set(historyRef, historyEntry);

                playerOvrChanges.set(playerId, { player, oldOvr: player.ovr, newOvr, change: newOvr - player.ovr });
            }

            transaction.update(matchRef, {
                status: 'evaluated',
                finalScore: { team1: team1CalculatedScore, team2: team2CalculatedScore },
                finalizedAt: new Date().toISOString()
            });
        });

        // Publish social activities asynchronously
        try {
            const publishPromises = [];
            for (const [playerId, { player, oldOvr, newOvr, change }] of playerOvrChanges) {
                if (change !== 0) {
                    const historyEntry = { oldOVR: oldOvr, newOVR: newOvr, change, date: new Date().toISOString(), matchId, id: '' };
                    const safePlayer = { ...player, lastCreditReset: player.lastCreditReset ? new Date().toISOString() : undefined };
                    publishPromises.push(publishOvrChangeActivity(safePlayer as Player, historyEntry));
                }
            }
            await Promise.allSettled(publishPromises);
            logger.info('Social activities published after match finalization', { matchId, ovrChangesProcessed: publishPromises.length });
        } catch (socialError) {
            logger.error('Error publishing social activities post-evaluation', socialError);
        }

        const matchData = (await matchRef.get()).data() as Match | undefined;
        if (matchData) {
            if (matchData.type === 'league' && matchData.leagueInfo?.leagueId) {
                try {
                    await updateLeagueStandingsAction(matchData.leagueInfo.leagueId);
                } catch (error) {
                    logger.error('Error updating league standings', error);
                }
            }
            if (matchData.type === 'cup' && matchData.leagueInfo?.leagueId && matchData.finalScore && matchData.participantTeamIds) {
                try {
                    const team1Score = matchData.finalScore.team1;
                    const team2Score = matchData.finalScore.team2;
                    if (team1Score !== team2Score) {
                        const winnerId = team1Score > team2Score ? matchData.participantTeamIds[0] : matchData.participantTeamIds[1];
                        await advanceCupWinnerAction(matchData.leagueInfo.leagueId, matchId, winnerId);
                    }
                } catch (error) {
                    logger.error('Error advancing cup winner', error);
                }
            }
        }

        // --- STAGE 7: AUTOMATICALLY GENERATE MATCH CHRONICLE AFTER EVALUATION ---
        logger.info('Match finalized successfully. Creating background task for AI Chronicle generation.', { matchId });
        try {
            // We await it here. Server actions can run for up to a minute on Vercel normally, but to be 100% sure the user sees it immediately when navigating to the match page, we await it.
            await generateMatchChronicleAction(matchId);
        } catch (chronicleError) {
            logger.error('Failed to generate match chronicle post-evaluation', chronicleError);
            // We don't fail the entire evaluation if the chronicle fails.
        }

        // --- STAGE 8: GAMIFICATION & ACHIEVEMENTS ---
        logger.info('Checking achievements for all players in the match.', { matchId });
        try {
            const { checkAchievementsAction } = await import('../achievements');
            const achievementPromises = (matchData?.players || []).map(player =>
                checkAchievementsAction(player.uid).catch(err =>
                    logger.error(`Failed to check achievements for player ${player.uid}`, err)
                )
            );
            await Promise.allSettled(achievementPromises);
        } catch (achievementsError) {
            logger.error('Failed to process achievements post-evaluation', achievementsError);
        }

        return { success: true };
    } catch (error: any) {
        logger.error('Error finalizing match evaluation', error, { matchId });
        return { success: false, error: error.message || 'Error finalizing match evaluation' };
    }
}

export async function updateProfileAction(uid: string, data: {
    displayName?: string;
    photoURL?: string;
    photoUrl?: string;
    position?: PlayerPosition;
    preferredFoot?: PreferredFoot;
    phoneNumber?: string;
    bio?: string;
    birthYear?: number;
    nationality?: string;
    cropPosition?: { x: number; y: number };
    cropZoom?: number;
}) {
    try {
        const { getAuth } = await import('firebase-admin/auth');
        const db = getAdminDb();
        const auth = getAuth();
        const normalizedPhotoUrl = data.photoURL ?? data.photoUrl;
        const availablePlayerRef = db.collection('availablePlayers').doc(uid);
        const availablePlayerSnap = normalizedPhotoUrl !== undefined ? await availablePlayerRef.get() : null;

        const batch = db.batch();

        // 1. Update users collection
        const userRef = db.collection('users').doc(uid);
        const userUpdates: any = {};
        if (data.displayName !== undefined) userUpdates.displayName = data.displayName;
        if (normalizedPhotoUrl !== undefined) userUpdates.photoURL = normalizedPhotoUrl;
        if (data.phoneNumber !== undefined) userUpdates.phoneNumber = data.phoneNumber;

        if (Object.keys(userUpdates).length > 0) {
            batch.update(userRef, userUpdates);
        }

        // 2. Update players collection
        const playerRef = db.collection('players').doc(uid);
        const playerUpdates: any = {};
        if (data.displayName !== undefined) playerUpdates.name = data.displayName;
        if (normalizedPhotoUrl !== undefined) {
            playerUpdates.photoUrl = normalizedPhotoUrl;
            playerUpdates.photoURL = normalizedPhotoUrl; // update both to be safe due to legacy code
        }
        if (data.position !== undefined) playerUpdates.position = data.position;
        if (data.preferredFoot !== undefined) playerUpdates.preferredFoot = data.preferredFoot;
        if (data.bio !== undefined) playerUpdates.bio = data.bio;
        if (data.birthYear !== undefined) playerUpdates.birthYear = data.birthYear;
        if (data.nationality !== undefined) playerUpdates.nationality = data.nationality;
        if (data.cropPosition !== undefined) playerUpdates.cropPosition = data.cropPosition;
        if (data.cropZoom !== undefined) playerUpdates.cropZoom = data.cropZoom;

        if (Object.keys(playerUpdates).length > 0) {
            batch.update(playerRef, playerUpdates);
        }

        if (availablePlayerSnap?.exists) {
            const availablePlayerUpdates: any = {};
            if (normalizedPhotoUrl !== undefined) {
                availablePlayerUpdates.photoURL = normalizedPhotoUrl;
                availablePlayerUpdates.photoUrl = normalizedPhotoUrl;
            }
            if (data.cropPosition !== undefined) availablePlayerUpdates.cropPosition = data.cropPosition;
            if (data.cropZoom !== undefined) availablePlayerUpdates.cropZoom = data.cropZoom;

            if (Object.keys(availablePlayerUpdates).length > 0) {
                batch.set(availablePlayerRef, availablePlayerUpdates, { merge: true });
            }
        }

        // 3. Update Auth Profile
        const authUpdates: any = {};
        if (data.displayName !== undefined) authUpdates.displayName = data.displayName;
        if (normalizedPhotoUrl !== undefined) authUpdates.photoURL = normalizedPhotoUrl;

        if (Object.keys(authUpdates).length > 0) {
            await auth.updateUser(uid, authUpdates);
        }

        // 4. Commit Firestore batch
        await batch.commit();

        return { success: true };
    } catch (error: any) {
        logger.error('Failed to update profile:', error);
        return handleServerActionError(error, ErrorCodes.SYS_INTERNAL_ERROR as any);
    }
}
