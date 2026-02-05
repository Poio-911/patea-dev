import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

const db = getFirestore();

async function deleteCollectionRecursively(collectionId: string) {
    const ref = db.collection(collectionId);
    // recursiveDelete is available in newer firebase-admin versions
    // It deletes the documents AND their subcollections.
    console.log(`Deleting collection (recursive): ${collectionId}...`);
    try {
        await db.recursiveDelete(ref);
        console.log(`✅ Deleted ${collectionId}`);
    } catch (error) {
        console.warn(`⚠️ Error or empty collection ${collectionId}:`, error);
    }
}

// Main Reset Function
async function resetGameData() {
    console.log('🚨 STARTING COMPLETE GAME DATA WIPE...');
    console.log('   Preserving ONLY: Users, Players, Groups');
    console.log('   Deleting everything else recursively.');

    // 1. Delete Collections Recursively
    const collectionsToDelete = [
        'matches',
        'leagues',
        'cups',
        'evaluations', // Added: History/Finalized evaluations
        'evaluationSubmissions',
        'activityFeed',
        'notifications',
        'matchNextId',
        'invitations',
        'chats',
        'teams', // Assumed ephemeral or non-group teams
        'achievements',
        'social_likes',
        'socialLikes', // Just in case of naming variation
        'match_votes',
        'location_votes',
        'venue_reviews'
    ];

    for (const col of collectionsToDelete) {
        await deleteCollectionRecursively(col);
    }

    console.log('✅ All ephemeral collections and subcollections wiped.');

    // 2. Reset Players Limits & Stats
    console.log('🔄 Resetting Players to OVR 50...');
    const playersSnap = await db.collection('players').get();

    const batchArray: FirebaseFirestore.WriteBatch[] = [];
    let batch = db.batch();
    let count = 0;
    let batchCount = 0;

    playersSnap.docs.forEach((doc) => {
        const player = doc.data();

        const resetAttributes = {
            pac: 50, sho: 50, pas: 50, dri: 50, def: 50, phy: 50
        };

        const updateData = {
            ovr: 50,
            ...resetAttributes,
            stats: {
                goals: 0,
                assists: 0,
                matchesPlayed: 0,
                mvpCount: 0,
                averageRating: 5.0,
                cleanSheets: 0
            },
            ovrHistory: [],
            evolution: []
        };

        batch.update(doc.ref, updateData);
        count++;
        batchCount++;

        if (batchCount >= 400) {
            batchArray.push(batch);
            batch = db.batch();
            batchCount = 0;
        }
    });

    batchArray.push(batch);

    for (const b of batchArray) {
        await b.commit();
    }

    console.log(`✅ Reset ${count} players to Baseline (50 OVR).`);
    console.log('🚀 SYSTEM WIPE COMPLETE.');
}

resetGameData().catch(console.error);
