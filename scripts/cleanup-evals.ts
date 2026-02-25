import { getAdminDb } from '../src/firebase/admin-init';

async function cleanupMatch(matchId: string) {
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);

    console.log(`[cleanup] Cleaning up evaluations for match ${matchId}...`);

    // 1. Delete peer evaluations
    const evalsSnap = await db.collection('evaluations').where('matchId', '==', matchId).get();
    const batch = db.batch();
    evalsSnap.docs.forEach(doc => batch.delete(doc.ref));
    console.log(`[cleanup] Deleting ${evalsSnap.size} peer evaluations...`);

    // 2. Delete self evaluations
    const selfEvalsSnap = await matchRef.collection('selfEvaluations').get();
    selfEvalsSnap.docs.forEach(doc => batch.delete(doc.ref));
    console.log(`[cleanup] Deleting ${selfEvalsSnap.size} self evaluations...`);

    // 3. Reset assignments
    const assignmentsSnap = await matchRef.collection('assignments').get();
    assignmentsSnap.docs.forEach(doc => batch.update(doc.ref, {
        status: 'pending',
        evaluationId: null
    }));
    console.log(`[cleanup] Resetting ${assignmentsSnap.size} assignments to pending...`);

    await batch.commit();
    console.log(`[cleanup] Done.`);
}

cleanupMatch('sAul42BOyTjYph06xFds').then(() => process.exit(0));
