import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!getApps().length) initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

export function advanceWinner(
    bracket: any[],
    completedMatchId: string,
    winnerId: string,
    winnerName: string,
    winnerJersey: any,
    finalScore?: { team1: number; team2: number }
): any[] {
    const updatedBracket = [...bracket];

    // Find the completed match
    const completedMatchIndex = updatedBracket.findIndex((m: any) => m.id === completedMatchId);
    if (completedMatchIndex === -1) {
        throw new Error(`Match ${completedMatchId} not found in bracket`);
    }

    const completedMatch = updatedBracket[completedMatchIndex];

    // Mark winner and score in completed match
    updatedBracket[completedMatchIndex] = {
        ...completedMatch,
        winnerId,
        finalScore,
    };

    // If final, no advancement needed
    if (completedMatch.round === 'final') {
        return updatedBracket;
    }
    return updatedBracket;
}

async function testAdvance() {
    const cupId = 'LTZECrLjILPRNg8YlQw5';
    const matchId = 'v8dwptMZ8xEJcgFNg5n5';

    // Simulate what updateMatchFinalScoreAction did
    const matchRef = db.collection('matches').doc(matchId);
    const updatedMatchSnap = await matchRef.get();
    const updatedMatch: any = { id: updatedMatchSnap.id, ...updatedMatchSnap.data() };

    const team1Id = updatedMatch.participantTeamIds?.[0] || updatedMatch.teams?.[0]?.id;
    const team2Id = updatedMatch.participantTeamIds?.[1] || updatedMatch.teams?.[1]?.id;

    // finalScore is {team1: 2, team2: 1}
    const team1Score = 2;
    const team2Score = 1;
    const winnerId = team1Score > team2Score ? team1Id : team2Id;

    const cupRef = db.collection('cups').doc(cupId);

    const [matchSnap, winnerTeamSnap] = await Promise.all([
        matchRef.get(),
        db.collection('teams').doc(winnerId).get()
    ]);

    const winnerTeam = winnerTeamSnap.data() as any;
    const cupSnap = await cupRef.get();
    const cup = cupSnap.data() as any;
    const bracketMatch = cup.bracket.find((bm: any) => bm.matchId === matchId);

    try {
        let updatedBracket = advanceWinner(
            cup.bracket,
            bracketMatch.id,
            winnerId,
            winnerTeam.name,
            winnerTeam.jersey,
            updatedMatch.finalScore || undefined
        );
        console.log('Advance winner ran successfully. Final length:', updatedBracket.length);
        console.log('Modified match 7:', JSON.stringify(updatedBracket.find(m => m.id === 'match-7'), null, 2));
    } catch (e: any) {
        console.log('Error inside advanceWinner:', e.message);
    }
}

testAdvance().catch(console.error);
