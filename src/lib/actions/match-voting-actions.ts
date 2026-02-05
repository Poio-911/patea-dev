
'use server';

import { getAdminDb } from '@/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/auth/get-server-session';
import { Match, MatchLocation, LocationProposal } from '@/lib/types';
import { createError, ErrorCodes, handleServerActionError } from '@/lib/errors';
import { revalidatePath } from 'next/cache';

export async function proposeLocationAction(matchId: string, location: MatchLocation) {
    try {
        const userId = await requireAuth();
        const matchRef = getAdminDb().collection('matches').doc(matchId);

        await getAdminDb().runTransaction(async (t) => {
            const matchSnap = await t.get(matchRef);
            if (!matchSnap.exists) throw createError(ErrorCodes.DATA_NOT_FOUND);

            const match = matchSnap.data() as Match;

            // Captains check
            if (match.type === 'intergroup_friendly' && match.captains && !match.captains.includes(userId)) {
                // Allow owner too if not in captains? Usually owner is a captain.
                if (match.ownerUid !== userId) {
                    throw createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS, { message: 'Solo los capitanes pueden proponer cancha.' });
                }
            }

            const newProposal: LocationProposal = {
                id: crypto.randomUUID(),
                location,
                proposedBy: userId,
                votes: [],
                createdAt: new Date().toISOString(),
            };

            t.update(matchRef, {
                locationProposals: FieldValue.arrayUnion(newProposal),
                isVotingOpen: true // Open voting automatically if proposing
            });
        });

        revalidatePath(`/matches/${matchId}`);
        return { success: true };
    } catch (error) {
        return handleServerActionError(error);
    }
}

export async function voteLocationAction(matchId: string, proposalId: string) {
    try {
        const userId = await requireAuth();
        const matchRef = getAdminDb().collection('matches').doc(matchId);

        await getAdminDb().runTransaction(async (t) => {
            const matchSnap = await t.get(matchRef);
            if (!matchSnap.exists) throw createError(ErrorCodes.DATA_NOT_FOUND);
            const match = matchSnap.data() as Match;

            if (!match.isVotingOpen) {
                throw createError(ErrorCodes.VAL_INVALID_FORMAT, { message: 'La votación está cerrada.' });
            }

            if (!match.locationProposals) return;

            const proposals = match.locationProposals;
            const targetIndex = proposals.findIndex(p => p.id === proposalId);
            if (targetIndex === -1) return;

            // Logic: User votes for one proposal. If they voted for others, remove distinct vote?
            // Or allow multiple votes? "Vote for this option". Toggle.
            // Usually "toggle" is best UX.

            const targetProposal = proposals[targetIndex];
            const hasVoted = targetProposal.votes.includes(userId);

            let updatedProposals = [...proposals];

            // Remove vote from ALL proposals first (Single Vote Policy) or allow toggle?
            // Let's enforce Single Vote for simplicity and decision speed.
            updatedProposals = updatedProposals.map(p => ({
                ...p,
                votes: p.votes.filter(uid => uid !== userId)
            }));

            // If they hadn't voted for this one (or even if they did, we just cleared it), add vote back if it wasn't a toggle-off
            // Use Toggle logic:
            if (!hasVoted) {
                updatedProposals[targetIndex].votes.push(userId);
            }

            t.update(matchRef, { locationProposals: updatedProposals });
        });

        revalidatePath(`/matches/${matchId}`);
        return { success: true };
    } catch (error) {
        return handleServerActionError(error);
    }
}

export async function finalizeLocationAction(matchId: string, proposalId: string) {
    try {
        const userId = await requireAuth();
        const matchRef = getAdminDb().collection('matches').doc(matchId);

        await getAdminDb().runTransaction(async (t) => {
            const matchSnap = await t.get(matchRef);
            if (!matchSnap.exists) throw createError(ErrorCodes.DATA_NOT_FOUND);
            const match = matchSnap.data() as Match;

            if (match.type === 'intergroup_friendly' && match.captains && !match.captains.includes(userId)) {
                if (match.ownerUid !== userId) {
                    throw createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS);
                }
            }

            const proposal = match.locationProposals?.find(p => p.id === proposalId);
            if (!proposal) throw createError(ErrorCodes.DATA_NOT_FOUND);

            t.update(matchRef, {
                location: proposal.location,
                isVotingOpen: false
            });
        });

        revalidatePath(`/matches/${matchId}`);
        return { success: true };
    } catch (error) {
        return handleServerActionError(error);
    }
}
