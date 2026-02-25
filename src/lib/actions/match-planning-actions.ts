'use server';

import { getAdminDb } from '@/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import type { Match, MatchDateProposal } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

const db = getAdminDb();

export async function addMatchDateProposalAction(
    matchId: string,
    proposedBy: string,
    date: string,
    time: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const matchRef = db.collection('matches').doc(matchId);

        // We can use a transaction to ensure safe updates to the array
        await db.runTransaction(async (transaction) => {
            const matchSnap = await transaction.get(matchRef);
            if (!matchSnap.exists) {
                throw new Error('Partido no encontrado');
            }

            const matchData = matchSnap.data() as Match;
            if (matchData.status !== 'planning') {
                throw new Error('El partido no está en estado de planificación.');
            }

            const newProposal: MatchDateProposal = {
                id: uuidv4(),
                matchId,
                proposedBy,
                date,
                time,
                votes: [],
                createdAt: new Date().toISOString()
            };

            const dateProposals = matchData.dateProposals || [];

            // Auto-vote for the creator
            newProposal.votes.push(proposedBy);

            dateProposals.push(newProposal);

            transaction.update(matchRef, { dateProposals });
        });

        revalidatePath(`/matches/${matchId}`);
        return { success: true };
    } catch (error: any) {
        logger.error('Error adding match date proposal', error, { matchId });
        return { success: false, error: error.message };
    }
}

export async function voteMatchDateAction(
    matchId: string,
    proposalId: string,
    userId: string,
    voteAction: 'add' | 'remove'
): Promise<{ success: boolean; error?: string }> {
    try {
        const matchRef = db.collection('matches').doc(matchId);

        await db.runTransaction(async (transaction) => {
            const matchSnap = await transaction.get(matchRef);
            if (!matchSnap.exists) {
                throw new Error('Partido no encontrado');
            }

            const matchData = matchSnap.data() as Match;

            if (!matchData.dateProposals) {
                throw new Error('No hay propuestas de fecha para este partido.');
            }

            const proposalIndex = matchData.dateProposals.findIndex(p => p.id === proposalId);
            if (proposalIndex === -1) {
                throw new Error('Propuesta no encontrada.');
            }

            const proposal = matchData.dateProposals[proposalIndex];
            const votesSet = new Set(proposal.votes || []);

            if (voteAction === 'add') {
                votesSet.add(userId);
            } else {
                votesSet.delete(userId);
            }

            proposal.votes = Array.from(votesSet);
            matchData.dateProposals[proposalIndex] = proposal;

            transaction.update(matchRef, { dateProposals: matchData.dateProposals });
        });

        revalidatePath(`/matches/${matchId}`);
        return { success: true };
    } catch (error: any) {
        logger.error('Error voting for date proposal', error, { matchId, proposalId, userId });
        return { success: false, error: error.message };
    }
}

export async function confirmMatchDateAction(
    matchId: string,
    proposalId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const matchRef = db.collection('matches').doc(matchId);

        await db.runTransaction(async (transaction) => {
            const matchSnap = await transaction.get(matchRef);
            if (!matchSnap.exists) {
                throw new Error('Partido no encontrado');
            }

            const matchData = matchSnap.data() as Match;

            if (!matchData.dateProposals) {
                throw new Error('No hay propuestas de fecha para este partido.');
            }

            const winningProposal = matchData.dateProposals.find(p => p.id === proposalId);
            if (!winningProposal) {
                throw new Error('Propuesta no encontrada.');
            }

            // Update the match to upcoming and set the final date and time
            transaction.update(matchRef, {
                status: 'upcoming',
                date: winningProposal.date,
                time: winningProposal.time,
                isVotingOpen: false
            });
        });

        revalidatePath(`/matches/${matchId}`);
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error: any) {
        logger.error('Error confirming match date', error, { matchId, proposalId });
        return { success: false, error: error.message };
    }
}
