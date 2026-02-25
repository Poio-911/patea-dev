import { getAdminDb } from '../src/firebase/admin-init';

async function debugMatchEvaluations(matchId: string) {
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);

    console.log(`--- DEBUG MATCH ${matchId} ---`);
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) {
        console.log('Match not found');
        return;
    }
    const match = matchSnap.data() as any;
    const playersInMatch = match.players || [];
    console.log(`Total players in match document: ${playersInMatch.length}`);

    // Check each player
    for (const p of playersInMatch) {
        const playerSnap = await db.collection('players').doc(p.uid).get();
        if (!playerSnap.exists) {
            console.log(`Player ${p.uid} (${p.displayName}) NOT FOUND in players collection`);
            continue;
        }
        const pData = playerSnap.data() as any;
        const isRealUser = p.uid === pData.ownerUid;
        console.log(`- Player ${p.uid}: ${p.displayName}, Group: ${pData.groupId}, RealUser: ${isRealUser}`);
    }

    // Check assignments in subcollection
    const assignmentsSnap = await matchRef.collection('assignments').get();
    console.log(`Assignments in match/assignments: ${assignmentsSnap.size}`);
    assignmentsSnap.docs.forEach(doc => {
        console.log(`  Assignment ${doc.id}: status=${doc.data().status}, evaluator=${doc.data().evaluatorId}`);
    });

    // Check root assignments just in case
    const rootAssignmentsSnap = await db.collection('evaluationAssignments').where('matchId', '==', matchId).get();
    console.log(`Root evaluationAssignments: ${rootAssignmentsSnap.size}`);
}

debugMatchEvaluations('sAul42BOyTjYph06xFds');
