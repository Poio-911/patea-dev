
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

const db = getFirestore();

async function deleteCollection(collectionPath: string, batchSize: number = 500) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db: FirebaseFirestore.Firestore, query: FirebaseFirestore.Query, resolve: Function) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

async function resetSystem() {
    console.log('🚨 STARTING SYSTEM RESET (Preserving Players & Groups) 🚨');

    // Collections to WIPE
    const collections = [
        'matches',
        'leagues',
        'cups',
        'notifications',
        'achievements', // Assuming this collection exists
        'evaluationSubmissions',
        'evaluations', // Global evaluations if any
        // Add any other collection to wipe here
    ];

    for (const col of collections) {
        console.log(`Deleting collection: ${col}...`);
        await deleteCollection(col);
    }

    // Check if we need to clean up subcollections of kept data (e.g., players OVR history?)
    // User said "borrar todo lo demas", implying OVR history might be linked to matches.
    // If we delete matches, OVR history is orphaned.
    // Let's wipe player subcollections 'ovrHistory' too?
    // User said "solo dejar lo de siempre jugadores y grupos". 
    // It's safer to wipe match-related player data to ensure consistency.

    console.log('Cleaning up Player subcollections (ovrHistory)...');
    const players = await db.collection('players').get();
    let playerBatch = db.batch();
    let operationCount = 0;

    for (const p of players.docs) {
        await deleteCollection(`players/${p.id}/ovrHistory`);

        // Reset OVR and Stats
        const playerRef = db.collection('players').doc(p.id);
        playerBatch.update(playerRef, {
            ovr: 50,
            stats: {
                matchesPlayed: 0,
                goals: 0,
                assists: 0,
                averageRating: 0,
                wins: 0,
                losses: 0,
                draws: 0
            }
        });
        operationCount++;

        // Batches have a limit of 500 operations
        if (operationCount >= 400) {
            await playerBatch.commit();
            operationCount = 0;
            // re-instantiate batch? No, commit empties it? 
            // Firestore Node SDK batch commit ends the batch. We need a new one.
            // But actually, let's just do it simple: single updates or new batch object per chunk.
            // Since we are inside a loop, let's just restart the batch process properly if needed.
            // For simplicity in this script, let's just run update per doc if batch complex.
            // OR just commit and create new batch.
            playerBatch = db.batch(); // Re-initialize batch for the next chunk
        }
    }

    // Commit remaining
    if (operationCount > 0) {
        await playerBatch.commit();
    }

    console.log('✅ SYSTEM RESET COMPLETED. Matches deleted. Players reset to OVR 50.');
}

resetSystem().catch(console.error);
