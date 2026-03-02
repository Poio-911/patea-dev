'use server';

import { getAdminDb } from '../../firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { handleServerActionError, createError, ErrorCodes } from '../errors';
import { requireAuth } from '../auth/get-server-session';
import type { Match, Player, Notification } from '../types';

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
