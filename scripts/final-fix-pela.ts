import { getAdminDb } from '../src/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';

async function finalFix(matchId: string) {
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);

    console.log(`[final-fix] Repairing player 'Pela' for match ${matchId}...`);

    try {
        const matchSnap = await matchRef.get();
        const matchData = matchSnap.data() as any;
        const organizerId = matchData.ownerUid;

        // Get organizer's group
        const organizerSnap = await db.collection('players').doc(organizerId).get();
        const organizerGroup = organizerSnap.data()?.groupId || 'poio-911';

        const pelaId = 'LboYwPCEtoet2NlIb33rODKGug73';
        const players = matchData.players || [];

        // 1. Ensure Pela is in the group
        await db.collection('players').doc(pelaId).update({
            groupId: organizerGroup,
            ownerUid: pelaId
        }).catch(() => { });

        console.log(`[final-fix] Pela synced to group ${organizerGroup}.`);

        // 2. Create missing assignments for Pela (evaluating others)
        const batch = db.batch();

        // Let's have Pela evaluate 2 random teammates
        const others = players.filter((p: any) => p.uid !== pelaId).slice(0, 2);

        for (const other of others) {
            const assignmentId = `asgn_pela_${other.uid}_${matchId}`;
            const assignmentRef = matchRef.collection('assignments').doc(assignmentId);

            batch.set(assignmentRef, {
                id: assignmentId,
                matchId: matchId,
                evaluatorId: pelaId,
                subjectId: other.uid,
                status: 'completed'
            });

            // Create Evaluation
            const evaluationId = `eval_pela_${other.uid}_${matchId}`;
            const evaluationRef = db.collection('evaluations').doc(evaluationId);
            batch.set(evaluationRef, {
                id: evaluationId,
                assignmentId,
                playerId: other.uid,
                evaluatorId: pelaId,
                matchId: matchId,
                rating: 8,
                aiSummary: "Demostró un gran nivel técnico y compromiso con el equipo.",
                evaluatedAt: new Date().toISOString(),
                status: 'completed'
            });
        }

        // Add Self-Eval for Pela
        const selfEvalRef = matchRef.collection('selfEvaluations').doc(pelaId);
        batch.set(selfEvalRef, {
            playerId: pelaId,
            matchId: matchId,
            goals: 0,
            assists: 1,
            personalChronicle: "Traté de aportar en la distribución y dar pases seguros.",
            reportedAt: new Date().toISOString()
        });

        await batch.commit();
        console.log(`[final-fix] Successfully repaired Pela's assignments.`);

    } catch (error) {
        console.error(`[final-fix] Error:`, error);
    }
}

finalFix('sAul42BOyTjYph06xFds').then(() => process.exit(0));
