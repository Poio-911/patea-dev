'use server';

import { getAdminDb } from '../../firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { handleServerActionError, createError, ErrorCodes } from '../errors';
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
                photoUrl: playerProfile.photoUrl || ''
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
        const db = getAdminDb();
        const matchRef = db.collection('matches').doc(matchId);

        await db.runTransaction(async (transaction) => {
            const matchDoc = await transaction.get(matchRef);
            if (!matchDoc.exists) {
                throw createError(ErrorCodes.DATA_NOT_FOUND, { matchId });
            }

            const match = matchDoc.data() as Match;

            if (!match.playerUids || !match.playerUids.includes(userId)) {
                // User not in match, strictly speaking an error but idempotent
                return;
            }

            const playerToRemove = match.players.find(p => p.uid === userId);

            // Note: arrayRemove works by exact object equality for objects.
            // If the object in DB differs slightly (e.g. updated OVR), arrayRemove might fail.
            // However, since we reconstructed it exactly as it is in the array (we'd need to find it first), it should work?
            // Actually, we don't have the exact object reference from the DB in a client context usually, 
            // but here inside transaction we read 'match.players'.
            // So 'playerToRemove' IS the exact object reference if we used the array from the doc.
            // But Firestore 'arrayRemove' needs the *exact value*.

            if (playerToRemove) {
                transaction.update(matchRef, {
                    players: FieldValue.arrayRemove(playerToRemove),
                    playerUids: FieldValue.arrayRemove(userId)
                });
            } else {
                // Fallback: If for some reason we can't find the exact object to remove (data desync),
                // we might need to read -> filter -> Update whole array.
                // It is safer to filter and set the new array to avoid "zombie" players.
                const newPlayers = match.players.filter(p => p.uid !== userId);
                const newPlayerUids = match.playerUids.filter(uid => uid !== userId);

                transaction.update(matchRef, {
                    players: newPlayers,
                    playerUids: newPlayerUids
                });
            }
        });

        revalidatePath(`/matches/${matchId}`);
        revalidatePath('/dashboard');
        revalidatePath('/explore');

        return { success: true };
    } catch (error: any) {
        return handleServerActionError(error, { matchId, userId, action: 'leaveMatch' });
    }
}
