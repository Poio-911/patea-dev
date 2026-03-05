import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

// Import all utilities verbatim
import {
    advanceWinner,
    isTournamentComplete,
    getChampion,
    getRunnerUp,
    getCurrentRound,
    getNextRound
} from '../src/lib/utils/cup-bracket';

config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!getApps().length) initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

async function debugTransaction() {
    const cupId = 'LTZECrLjILPRNg8YlQw5';
    const matchId = 'v8dwptMZ8xEJcgFNg5n5';
    const winnerId = 'Bke4AjETAM63KK2iU2p0';

    const cupRef = db.collection('cups').doc(cupId);
    const matchRef = db.collection('matches').doc(matchId);

    const [matchSnap, winnerTeamSnap] = await Promise.all([
        matchRef.get(),
        db.collection('teams').doc(winnerId).get()
    ]);

    const match = { id: matchSnap.id, ...matchSnap.data() } as any;
    const winnerTeam = { id: winnerTeamSnap.id, ...winnerTeamSnap.data() } as any;

    try {
        const result = await db.runTransaction(async (transaction) => {
            const cupSnap = await transaction.get(cupRef);
            if (!cupSnap.exists) throw new Error('Copa no encontrada.');

            const cup = { id: cupSnap.id, ...cupSnap.data() } as any;
            if (!cup.bracket) throw new Error('Bracket no generado.');

            const bracketMatch = cup.bracket.find((bm: any) => bm.matchId === matchId);
            if (!bracketMatch) {
                const alreadyDone = cup.bracket.some((bm: any) => bm.matchId === matchId && bm.winnerId);
                if (alreadyDone) return { success: true, reason: 'already_done' };
                return { success: false, error: 'Partido no encontrado en el bracket.' };
            }

            console.log('AdvanceWinner before call with:', {
                brId: bracketMatch.id, winnerId, name: winnerTeam.name, finalScore: match.finalScore || undefined
            });

            let updatedBracket = advanceWinner(
                cup.bracket,
                bracketMatch.id,
                winnerId,
                winnerTeam.name,
                winnerTeam.jersey,
                match.finalScore || undefined
            );

            console.log('AdvanceWinner returned fine');

            const isComplete = isTournamentComplete(updatedBracket);
            console.log('isComplete is:', isComplete);

            const updateData: any = { bracket: updatedBracket };

            if (isComplete) {
                console.log('Getting champion and runnerup');
                const champion = getChampion(updatedBracket);
                const runnerUp = getRunnerUp(updatedBracket);

                console.log('Champion:', champion);
                console.log('RunnerUp:', runnerUp);

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
                console.log('Getting current round');
                const currentActiveRound = getCurrentRound(updatedBracket);
                if (currentActiveRound && currentActiveRound !== cup.currentRound) {
                    updateData.currentRound = currentActiveRound;
                }
                const nextRound = getNextRound(bracketMatch.round);
                console.log('Next round:', nextRound);
            }

            // We do NOT call transaction.update so we don't mess up DB
            // transaction.update(cupRef, updateData);
            console.log('Transaction would update data:', Object.keys(updateData));

            return { success: true, updatedBracketLength: updatedBracket.length };
        });

        console.log('Transaction result:', result);
    } catch (e: any) {
        console.error('Transaction threw error!', e.message, e.stack);
    }
}

debugTransaction().catch(console.error);
