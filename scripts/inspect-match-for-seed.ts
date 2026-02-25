
import { getAdminDb } from '../src/firebase/admin-init';

async function inspectMatch(matchId: string) {
    const db = getAdminDb();
    const matchSnap = await db.collection('matches').doc(matchId).get();

    if (!matchSnap.exists) {
        console.error('Match not found');
        return;
    }

    const matchData = matchSnap.data();
    const players = matchData?.players || [];
    console.log(`Match: ${matchData?.title || matchId}`);
    console.log(`Date: ${matchData?.date} | Status: ${matchData?.status}`);
    console.log(`Players (${players.length}):`);
    players.forEach((p: any) => console.log(`- ${p.uid}: ${p.displayName} (${p.position})`));

    const assignmentsSnap = await db.collection(`matches/${matchId}/assignments`).get();
    console.log(`\nExisting Assignments: ${assignmentsSnap.size}`);

    const evalsSnap = await db.collection('evaluations').where('matchId', '==', matchId).get();
    console.log(`Existing Evaluations: ${evalsSnap.size}`);
}

inspectMatch('qV658LXdVOgmtt4HKkEe');
