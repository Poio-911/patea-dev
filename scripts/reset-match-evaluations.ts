
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

async function resetMatchEvaluations(matchId: string) {
    const db = getFirestore();
    console.log(`\n🔄 RESETTING EVALUATIONS for match: ${matchId}`);

    // 1. Revert stats updates
    console.log('📉 Reverting player stats...');
    const selfEvalsSnap = await db.collection(`matches/${matchId}/selfEvaluations`).get();

    const batchArray: FirebaseFirestore.WriteBatch[] = [];
    let currentBatch = db.batch();
    let ops = 0;

    const flush = () => {
        if (ops > 0) {
            batchArray.push(currentBatch);
            currentBatch = db.batch();
            ops = 0;
        }
    };

    for (const doc of selfEvalsSnap.docs) {
        const data = doc.data();
        // Decrement stats if they were added
        if (data.goals > 0 || data.assists > 0) {
            const playerRef = db.doc(`players/${data.playerId}`);
            currentBatch.update(playerRef, {
                'stats.goals': FieldValue.increment(-data.goals),
                'stats.assists': FieldValue.increment(-data.assists)
            });
            ops++;
            if (ops >= 400) flush();
        }

        // Delete self evaluation
        currentBatch.delete(doc.ref);
        ops++;
        if (ops >= 400) flush();
    }

    // 2. Delete peer evaluations
    console.log('🗑️ Deleting peer evaluations...');
    const evalsSnap = await db.collection('evaluations').where('matchId', '==', matchId).get();
    for (const doc of evalsSnap.docs) {
        currentBatch.delete(doc.ref);
        ops++;
        if (ops >= 400) flush();
    }

    // 3. Reset assignments
    console.log('🔙 Resetting assignments...');
    const assignmentsSnap = await db.collection(`matches/${matchId}/assignments`).get();
    for (const doc of assignmentsSnap.docs) {
        currentBatch.update(doc.ref, {
            status: 'pending',
            evaluationId: FieldValue.delete()
        });
        ops++;
        if (ops >= 400) flush();
    }

    // 4. Update match status if needed? 
    // Usually status stays 'completed' or 'evaluated'. If we want to allow re-eval, it should probably be 'completed'.
    // complete-evaluations.ts checks for 'completed'.
    const matchRef = db.doc(`matches/${matchId}`);
    currentBatch.update(matchRef, { status: 'completed' }); // Ensure it is ready for complete-evaluations
    ops++;
    if (ops >= 400) flush();

    flush();

    console.log(`💾 Committing ${batchArray.length} batches...`);
    for (const b of batchArray) {
        await b.commit();
    }

    console.log('✅ Match reset complete. Ready to re-run evaluations.');
}

const matchId = process.argv[2];
if (!matchId) {
    console.error('Usage: npx tsx scripts/reset-match-evaluations.ts <matchId>');
    process.exit(1);
}

resetMatchEvaluations(matchId).catch(console.error);
