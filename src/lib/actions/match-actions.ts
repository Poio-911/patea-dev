'use server';

import { getAdminDb } from '../../firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { handleServerActionError, createError, ErrorCodes } from '../errors';
import { requireAuth } from '../auth/get-server-session';
import { hasPermission } from '../group-permissions';
import type { Match, Player, Notification, EvaluationAssignment } from '../types';
import { generateTeamsAction } from './server-actions';
import { notifyEvaluationAvailableAction, notifyMatchUpdatedAction, notifyTeamsShuffledAction } from './notification-actions';

async function canEditMatch(match: Match, userId: string) {
    if (match.ownerUid === userId) {
        return true;
    }

    if (!match.groupId) {
        return false;
    }

    const groupSnap = await getAdminDb().collection('groups').doc(match.groupId).get();
    if (!groupSnap.exists) {
        return false;
    }

    const group = groupSnap.data() as any;
    if (group.ownerUid === userId) {
        return true;
    }

    const role = group.memberRoles?.find((member: any) => member.userId === userId)?.role
        || (group.members?.includes(userId) ? 'member' : null);
    return role ? hasPermission(role, 'matches.edit') : false;
}

const isRealUser = (player: Player) => player.id === player.ownerUid;

function generateEvaluationAssignments(match: Match, allPlayers: Player[]): Omit<EvaluationAssignment, 'id'>[] {
    const assignments: Omit<EvaluationAssignment, 'id'>[] = [];
    const matchPlayers = allPlayers.filter((player) => match.playerUids.includes(player.id));
    const realPlayerUids = matchPlayers.filter(isRealUser).map((player) => player.id);
    const incomingCounts: Record<string, number> = {};

    matchPlayers.forEach((player) => {
        incomingCounts[player.id] = 0;
    });

    const shuffledEvaluators = [...realPlayerUids];
    for (let index = shuffledEvaluators.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffledEvaluators[index], shuffledEvaluators[swapIndex]] = [shuffledEvaluators[swapIndex], shuffledEvaluators[index]];
    }

    shuffledEvaluators.forEach((evaluatorId) => {
        const evaluatorTeam = match.teams?.find((team) => team.players.some((player) => player.uid === evaluatorId));
        const candidates = matchPlayers
            .filter((player) => player.id !== evaluatorId)
            .sort((left, right) => {
                const countDiff = incomingCounts[left.id] - incomingCounts[right.id];
                if (countDiff !== 0) {
                    return countDiff;
                }

                const leftIsTeammate = evaluatorTeam?.players.some((teamPlayer) => teamPlayer.uid === left.id);
                const rightIsTeammate = evaluatorTeam?.players.some((teamPlayer) => teamPlayer.uid === right.id);

                if (leftIsTeammate && !rightIsTeammate) {
                    return -1;
                }
                if (!leftIsTeammate && rightIsTeammate) {
                    return 1;
                }
                return 0;
            });

        const selectedPeers = candidates.slice(0, 2);

        if (selectedPeers.length === 0) {
            assignments.push({
                matchId: match.id,
                evaluatorId,
                subjectId: evaluatorId,
                status: 'pending',
            });
            return;
        }

        selectedPeers.forEach((subject) => {
            incomingCounts[subject.id] += 1;
            assignments.push({
                matchId: match.id,
                evaluatorId,
                subjectId: subject.id,
                status: 'pending',
            });
        });
    });

    return assignments;
}

/**
 * Adds a user to a match.
 * Validates that the match exists, is not full, and the user is not already joined.
 * Sends a notification to the match owner if the joiner is not the owner.
 */
export async function joinMatchAction(matchId: string, userId: string, userDisplayName: string) {
    try {
        const db = getAdminDb();
        const matchRef = db.collection('matches').doc(matchId);

        // Run as a transaction to ensure atomic read-and-update (prevents overfilling)
        await db.runTransaction(async (transaction) => {
            const matchDoc = await transaction.get(matchRef);
            if (!matchDoc.exists) {
                throw createError(ErrorCodes.DATA_NOT_FOUND, { matchId });
            }

            const match = matchDoc.data() as Match;

            if (match.playerUids && match.playerUids.includes(userId)) {
                // User already in match, technically a success or no-op
                return;
            }

            // Also check invitations subcollection — a confirmed/pending invite means
            // the user is already committed to this match (prevents double-join via Partidos Abiertos)
            const invitationRef = db.collection(`matches/${matchId}/invitations`).doc(userId);
            const invitationSnap = await transaction.get(invitationRef);
            if (invitationSnap.exists && invitationSnap.data()?.status !== 'declined') {
                // Already invited or confirmed — idempotent exit to avoid duplicate entry
                return;
            }

            if ((match.players?.length || 0) >= match.matchSize) {
                throw new Error("El partido está lleno.");
            }

            // Fetch player profile to ensure we have the latest data
            const playerRef = db.collection('players').doc(userId);
            const playerDoc = await transaction.get(playerRef);

            if (!playerDoc.exists) {
                throw new Error("No se encontró tu perfil de jugador.");
            }

            const playerProfile = playerDoc.data() as Player;

            const playerPayload = {
                uid: userId,
                displayName: playerProfile.name,
                ovr: playerProfile.ovr,
                position: playerProfile.position,
                photoURL: playerProfile.photoURL || (playerProfile as any).photoUrl || ''
            };

            // Update match
            transaction.update(matchRef, {
                players: FieldValue.arrayUnion(playerPayload),
                playerUids: FieldValue.arrayUnion(userId)
            });

            // Send notification to owner if applicable
            if (match.ownerUid !== userId) {
                const notificationRef = db.collection(`users/${match.ownerUid}/notifications`).doc();
                const notification: Omit<Notification, 'id'> = {
                    type: 'new_joiner',
                    title: '¡Nuevo Jugador!',
                    message: `${userDisplayName} se ha apuntado a tu partido "${match.title}".`,
                    link: `/matches/${matchId}`, // Fixed link to point to specific match
                    isRead: false,
                    createdAt: new Date().toISOString(),
                    metadata: { fromUserId: userId, matchId: matchId },
                };
                transaction.set(notificationRef, notification);
            }
        });

        // Trigger full sequence checks (outside transaction)
        try {
            const { triggerMatchFullSequence } = await import('../match-logic');
            await triggerMatchFullSequence(matchId);
        } catch (e) {
            console.error('[joinMatchAction] Error triggering completion sequence:', e);
        }

        // Revalidate the match page to reflect changes immediately in RSC
        revalidatePath(`/matches/${matchId}`);
        revalidatePath('/dashboard');
        revalidatePath('/explore');

        return { success: true };
    } catch (error: any) {
        return handleServerActionError(error, { matchId, userId, action: 'joinMatch' });
    }
}

/**
 * Removes a user from a match.
 */
export async function leaveMatchAction(matchId: string, userId: string) {
    try {
        // Verify the caller is the user being removed
        const callerId = await requireAuth();
        if (callerId !== userId) {
            return { success: false, error: 'No tienes permiso para realizar esta acción.' };
        }

        const db = getAdminDb();
        const matchRef = db.collection('matches').doc(matchId);

        await db.runTransaction(async (transaction) => {
            const matchDoc = await transaction.get(matchRef);
            if (!matchDoc.exists) {
                throw createError(ErrorCodes.DATA_NOT_FOUND, { matchId });
            }

            const match = matchDoc.data() as Match;

            if (!match.playerUids || !match.playerUids.includes(userId)) {
                // User not in match, idempotent
                return;
            }

            // Always use filter approach to avoid arrayRemove exact-match pitfall
            const newPlayers = match.players.filter(p => p.uid !== userId);
            const newPlayerUids = match.playerUids.filter(uid => uid !== userId);

            transaction.update(matchRef, {
                players: newPlayers,
                playerUids: newPlayerUids
            });
        });

        revalidatePath(`/matches/${matchId}`);
        revalidatePath('/dashboard');
        revalidatePath('/explore');

        return { success: true };
    } catch (error: any) {
        return handleServerActionError(error, { matchId, userId, action: 'leaveMatch' });
    }
}

/**
 * Sends a join request for a manual/public match.
 * Instead of directly joining, creates a pending request the organizer must accept.
 */
export async function requestJoinMatchAction(matchId: string) {
    try {
        const userId = await requireAuth();
        const db = getAdminDb();
        const matchRef = db.collection('matches').doc(matchId);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return { success: false, error: 'Partido no encontrado.' };
        }
        const match = matchDoc.data() as Match;

        if (match.playerUids?.includes(userId)) {
            return { success: false, error: 'Ya estás en este partido.' };
        }
        if (match.pendingPlayerUids?.includes(userId)) {
            return { success: true, alreadyPending: true };
        }
        if ((match.players?.length || 0) >= match.matchSize) {
            return { success: false, error: 'El partido está lleno.' };
        }

        const playerDoc = await db.collection('players').doc(userId).get();
        if (!playerDoc.exists) {
            return { success: false, error: 'No se encontró tu perfil de jugador.' };
        }
        const player = playerDoc.data() as Player;

        const batch = db.batch();

        // Pending request doc with full profile for organizer to review
        const requestRef = db.collection(`matches/${matchId}/joinRequests`).doc(userId);
        batch.set(requestRef, {
            uid: userId,
            displayName: player.name,
            photoURL: player.photoURL || (player as any).photoUrl || '',
            ovr: player.ovr,
            position: player.position,
            requestedAt: new Date().toISOString(),
        });

        // Mark uid as pending on the match doc
        batch.update(matchRef, {
            pendingPlayerUids: FieldValue.arrayUnion(userId),
        });

        // Notify organizer
        const notificationRef = db.collection(`users/${match.ownerUid}/notifications`).doc();
        const notification: Omit<Notification, 'id'> = {
            type: 'join_request' as any,
            title: '📋 Nueva solicitud',
            message: `${player.name} quiere unirse a "${match.title}". Revisa su perfil y acepta o rechaza.`,
            link: `/matches/${matchId}`,
            isRead: false,
            createdAt: new Date().toISOString(),
            metadata: { fromUserId: userId, matchId },
        };
        batch.set(notificationRef, notification);

        await batch.commit();
        revalidatePath(`/matches/${matchId}`);
        return { success: true };
    } catch (error: any) {
        return handleServerActionError(error, { matchId, action: 'requestJoin' });
    }
}

/**
 * Organizer accepts or rejects a pending join request.
 */
export async function respondJoinRequestAction(
    matchId: string,
    requesterId: string,
    accepted: boolean,
) {
    try {
        const userId = await requireAuth();
        const db = getAdminDb();
        const matchRef = db.collection('matches').doc(matchId);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) return { success: false, error: 'Partido no encontrado.' };
        const match = matchDoc.data() as Match;
        if (match.ownerUid !== userId) return { success: false, error: 'Sin permiso.' };

        const requestRef = db.collection(`matches/${matchId}/joinRequests`).doc(requesterId);
        const requestDoc = await requestRef.get();
        if (!requestDoc.exists) return { success: false, error: 'Solicitud no encontrada.' };
        const request = requestDoc.data()!;

        if (accepted && (match.players?.length || 0) >= match.matchSize) {
            return { success: false, error: 'El partido ya está lleno.' };
        }

        const batch = db.batch();

        if (accepted) {
            const playerPayload = {
                uid: requesterId,
                displayName: request.displayName,
                ovr: request.ovr,
                position: request.position,
                photoURL: request.photoURL || '',
            };
            batch.update(matchRef, {
                players: FieldValue.arrayUnion(playerPayload),
                playerUids: FieldValue.arrayUnion(requesterId),
                pendingPlayerUids: FieldValue.arrayRemove(requesterId),
            });
        } else {
            batch.update(matchRef, {
                pendingPlayerUids: FieldValue.arrayRemove(requesterId),
            });
        }

        batch.delete(requestRef);

        // Notify the requester
        const notifRef = db.collection(`users/${requesterId}/notifications`).doc();
        batch.set(notifRef, {
            type: accepted ? 'join_accepted' : 'join_rejected',
            title: accepted ? '¡Solicitud aceptada! 🎉' : 'Solicitud rechazada',
            message: accepted
                ? `Fuiste aceptado en "${match.title}". ¡Ya estás en la lista!`
                : `Tu solicitud para "${match.title}" fue rechazada.`,
            link: `/matches/${matchId}`,
            isRead: false,
            createdAt: new Date().toISOString(),
            metadata: { matchId },
        });

        await batch.commit();
        revalidatePath(`/matches/${matchId}`);
        return { success: true };
    } catch (error: any) {
        return handleServerActionError(error, { matchId, requesterId, action: 'respondJoinRequest' });
    }
}

export async function updateMatchTeamsAction(matchId: string, teams: Match['teams']) {
    try {
        const userId = await requireAuth();
        const db = getAdminDb();
        const matchRef = db.collection('matches').doc(matchId);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return { success: false, error: 'Partido no encontrado.' };
        }

        const match = { id: matchDoc.id, ...matchDoc.data() } as Match;
        const allowed = await canEditMatch(match, userId);
        if (!allowed) {
            return { success: false, error: 'No tienes permiso para editar este partido.' };
        }

        await matchRef.update({ teams: teams || [] });
        revalidatePath(`/matches/${matchId}`);
        return { success: true };
    } catch (error: any) {
        return handleServerActionError(error, { matchId, action: 'updateMatchTeams' });
    }
}

export async function updateMatchStreamAction(matchId: string, stream: { provider: string; id: string | null; url: string | null; active: boolean; }) {
    try {
        const userId = await requireAuth();
        const db = getAdminDb();
        const matchRef = db.collection('matches').doc(matchId);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return { success: false, error: 'Partido no encontrado.' };
        }

        const match = { id: matchDoc.id, ...matchDoc.data() } as Match;
        const allowed = await canEditMatch(match, userId);
        if (!allowed) {
            return { success: false, error: 'No tienes permiso para editar este partido.' };
        }

        await matchRef.update({ stream });
        revalidatePath(`/matches/${matchId}`);
        return { success: true };
    } catch (error: any) {
        return handleServerActionError(error, { matchId, action: 'updateMatchStream' });
    }
}

export async function finishMatchAction(matchId: string) {
    try {
        const userId = await requireAuth();
        const db = getAdminDb();
        const matchRef = db.collection('matches').doc(matchId);
        const matchSnap = await matchRef.get();

        if (!matchSnap.exists) {
            return { success: false, error: 'Partido no encontrado.' };
        }

        const match = { id: matchSnap.id, ...matchSnap.data() } as Match;
        if (!(await canEditMatch(match, userId))) {
            return { success: false, error: 'No tienes permiso para finalizar este partido.' };
        }

        const playerRefs = (match.playerUids || []).map((playerId) => db.collection('players').doc(playerId));
        const playerDocs = playerRefs.length > 0 ? await db.getAll(...playerRefs) : [];
        const allPlayers = playerDocs.filter((doc) => doc.exists).map((doc) => ({ id: doc.id, ...doc.data() } as Player));

        let finalTeams = match.teams;
        const matchUpdateData: Record<string, unknown> = { status: 'completed' };

        if ((!finalTeams || finalTeams.length === 0) && (match.playerUids?.length || 0) >= match.matchSize) {
            const playersToBalance = allPlayers
                .filter((player) => match.playerUids.includes(player.id))
                .map((player) => ({ id: player.id, name: player.name, ovr: player.ovr, position: player.position }));
            const teamGenerationResult = await generateTeamsAction(playersToBalance);
            if ('error' in teamGenerationResult || !teamGenerationResult.teams) {
                throw new Error(('error' in teamGenerationResult ? teamGenerationResult.error : undefined) || 'La IA no pudo generar los equipos.');
            }
            finalTeams = teamGenerationResult.teams as Match['teams'];
            matchUpdateData.teams = finalTeams;
        }

        const matchForAssignments = finalTeams ? { ...match, teams: finalTeams } : match;
        const assignments = generateEvaluationAssignments(matchForAssignments, allPlayers);
        const realPlayerUids = allPlayers.filter((player) => match.playerUids.includes(player.id) && isRealUser(player)).map((player) => player.id);
        const batch = db.batch();

        batch.update(matchRef, matchUpdateData);

        assignments.forEach((assignment) => {
            const assignmentRef = db.collection(`matches/${match.id}/assignments`).doc();
            batch.set(assignmentRef, assignment);
        });

        const uniqueEvaluatorIds = [...new Set(assignments.map((assignment) => assignment.evaluatorId))];
        uniqueEvaluatorIds.forEach((evaluatorId) => {
            const notificationRef = db.collection(`users/${evaluatorId}/notifications`).doc();
            batch.set(notificationRef, {
                type: 'evaluation_pending',
                title: '¡Evaluación pendiente!',
                message: `Es hora de evaluar a tus compañeros del partido "${match.title}".`,
                link: `/evaluations/${match.id}`,
                isRead: false,
                createdAt: new Date().toISOString(),
                metadata: { fromUserId: userId },
            });
        });

        await batch.commit();

        if (realPlayerUids.length > 0) {
            notifyEvaluationAvailableAction({
                playerIds: realPlayerUids,
                matchTitle: match.title,
            }).catch((error) => console.error('Failed to send evaluation notification', error));
        }

        revalidatePath(`/matches/${matchId}`);
        revalidatePath('/matches');
        return { success: true, assignmentsCount: assignments.length };
    } catch (error: any) {
        return handleServerActionError(error, { matchId, action: 'finishMatch' });
    }
}

export async function deleteMatchAction(matchId: string) {
    try {
        const userId = await requireAuth();
        const db = getAdminDb();
        const matchRef = db.collection('matches').doc(matchId);
        const matchSnap = await matchRef.get();

        if (!matchSnap.exists) {
            return { success: false, error: 'Partido no encontrado.' };
        }

        const match = { id: matchSnap.id, ...matchSnap.data() } as Match;
        if (match.ownerUid !== userId) {
            return { success: false, error: 'Solo el organizador puede eliminar este partido.' };
        }

        if (match.playerUids?.length) {
            notifyMatchUpdatedAction({
                playerIds: match.playerUids,
                matchTitle: match.title,
                updateType: 'cancelled',
                updateDetails: 'El partido fue cancelado por el organizador',
            }).catch((error) => console.error('Failed to send cancellation notification', error));
        }

        await matchRef.delete();
        revalidatePath('/matches');
        return { success: true };
    } catch (error: any) {
        return handleServerActionError(error, { matchId, action: 'deleteMatch' });
    }
}

export async function shuffleMatchTeamsAction(matchId: string) {
    try {
        const userId = await requireAuth();
        const db = getAdminDb();
        const matchRef = db.collection('matches').doc(matchId);
        const matchSnap = await matchRef.get();

        if (!matchSnap.exists) {
            return { success: false, error: 'Partido no encontrado.' };
        }

        const match = { id: matchSnap.id, ...matchSnap.data() } as Match;
        if (!(await canEditMatch(match, userId))) {
            return { success: false, error: 'No tienes permiso para reordenar los equipos.' };
        }

        const playerRefs = (match.playerUids || []).map((playerId) => db.collection('players').doc(playerId));
        const playerDocs = playerRefs.length > 0 ? await db.getAll(...playerRefs) : [];
        const playersToBalance = playerDocs
            .filter((doc) => doc.exists)
            .map((doc) => ({ ...(doc.data() as Player), id: doc.id }))
            .filter((player) => match.playerUids.includes(player.id))
            .map((player) => ({ id: player.id, name: player.name, ovr: player.ovr, position: player.position }));

        const teamGenerationResult = await generateTeamsAction(playersToBalance);
        if ('error' in teamGenerationResult || !teamGenerationResult.teams) {
            throw new Error(('error' in teamGenerationResult ? teamGenerationResult.error : undefined) || 'La IA no pudo generar los equipos.');
        }

        await matchRef.update({ teams: teamGenerationResult.teams });

        if (match.playerUids?.length) {
            notifyTeamsShuffledAction({
                playerIds: match.playerUids,
                matchTitle: match.title,
            }).catch((error) => console.error('Failed to send team shuffle notification', error));
        }

        revalidatePath(`/matches/${matchId}`);
        return { success: true, teams: teamGenerationResult.teams };
    } catch (error: any) {
        return handleServerActionError(error, { matchId, action: 'shuffleMatchTeams' });
    }
}

export async function finalizePendingMatchesAction(matchIds: string[]) {
    try {
        const userId = await requireAuth();
        const uniqueMatchIds = [...new Set(matchIds.filter(Boolean))];

        if (uniqueMatchIds.length === 0) {
            return { success: true, finalizedCount: 0 };
        }

        const db = getAdminDb();
        const matchRefs = uniqueMatchIds.map((matchId) => db.collection('matches').doc(matchId));
        const matchDocs = await db.getAll(...matchRefs);
        const batch = db.batch();
        const finalizedAt = new Date().toISOString();
        const competitionTypes = new Set(['league', 'cup', 'league_final']);
        let finalizedCount = 0;

        for (const matchDoc of matchDocs) {
            if (!matchDoc.exists) {
                continue;
            }

            const match = { id: matchDoc.id, ...matchDoc.data() } as Match;

            if (match.ownerUid !== userId) {
                continue;
            }

            if (match.status !== 'upcoming' || competitionTypes.has(match.type)) {
                continue;
            }

            batch.update(matchDoc.ref, { status: 'completed', finalizedAt });
            finalizedCount += 1;
        }

        if (finalizedCount > 0) {
            await batch.commit();
            revalidatePath('/matches');
            revalidatePath('/dashboard');
        }

        return { success: true, finalizedCount };
    } catch (error: any) {
        return handleServerActionError(error, { action: 'finalizePendingMatches', matchIds });
    }
}
