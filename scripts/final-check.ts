import { getAdminDb } from '../src/firebase/admin-init';

async function finalCheck(matchId: string) {
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);

    console.log(`--- FINAL CHECK MATCH ${matchId} ---`);
    const matchSnap = await matchRef.get();
    const playersInMatch = matchSnap.data()?.players || [];
    console.log(`Players in match: ${playersInMatch.length}`);

    const assignmentsSnap = await matchRef.collection('assignments').get();
    const evaluators = Array.from(new Set(assignmentsSnap.docs.map(d => d.data().evaluatorId)));

    console.log(`Evaluators with assignments: ${evaluators.length}`);
    for (const p of playersInMatch) {
        const hasAssignment = evaluators.includes(p.uid);
        console.log(`- Player ${p.uid} (${p.displayName}): ${hasAssignment ? 'HAS' : 'NO'} assignments`);
    }
}

finalCheck('sAul42BOyTjYph06xFds');
