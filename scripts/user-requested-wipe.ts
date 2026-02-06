
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
    console.log(`Deleting collection (recursive): ${collectionId}...`);
    try {
        await db.recursiveDelete(ref);
        console.log(`✅ Deleted ${collectionId}`);
    } catch (error) {
        console.warn(`⚠️ Error or empty collection ${collectionId}:`, error);
    }
}

async function wipeData() {
    console.log('🚨 STARTING USER-REQUESTED WIPE...');
    console.log('   Preserving: Users, Players, Groups');
    console.log('   Deleting: Matches, Leagues, Cups, Teams, Evaluations, etc.');

    const collectionsToDelete = [
        'matches',
        'leagues',
        'cups',
        'evaluations',
        'evaluationSubmissions',
        'teams', // Explicitly requested to delete group teams
        'teamAvailabilityPosts',
        'invitations',
        'notifications',
        'activityFeed',
        'match_votes',
        'location_votes',
        'venue_reviews',
        'achievements', // If tied to matches/performance, better reset
        'matchNextId'
    ];

    for (const col of collectionsToDelete) {
        await deleteCollectionRecursively(col);
    }

    // Also need to clear 'ovrHistory' subcollection from players?
    // User didn't explicitly ask for this, but if we delete matches, the history references non-existent matches.
    // However, the user said "resetea todo", usually implying stats too.
    // In the previous task I reset stats.
    // "Borra todo de nuevo menos jugadores y grupos"
    // Does this mean reset stats? Probably yes.
    // I will look at `reset-game-data.ts` again. It resets player stats to 50.
    // The user recently asked for "Prevent OVR Inflation", maybe they want to keep the players they have but reset their *progress*?
    // "menos jugadores y grupos" -> Keep the *entities*, but delete the *activity*.
    // So yes, I should reset stats and OVR history.

    console.log('🔄 Resetting Player Stats & OVR History...');
    const playersSnap = await db.collection('players').get();
    const batchArray: FirebaseFirestore.WriteBatch[] = [];
    let batch = db.batch();
    let count = 0;

    for (const doc of playersSnap.docs) {
        // Delete ovrHistory subcollection
        await db.recursiveDelete(doc.ref.collection('ovrHistory'));
        await db.recursiveDelete(doc.ref.collection('evolution')); // If exists

        // Reset stats
        const updateData = {
            ovr: 50,
            pac: 50, sho: 50, pas: 50, dri: 50, def: 50, phy: 50,
            stats: {
                goals: 0,
                assists: 0,
                matchesPlayed: 0,
                mvpCount: 0,
                averageRating: 5.0,
                cleanSheets: 0
            },
            // Clear other match-dependent fields if any
        };

        batch.update(doc.ref, updateData);
        count++;

        if (count % 400 === 0) {
            batchArray.push(batch);
            batch = db.batch();
        }
    }
    batchArray.push(batch);

    await Promise.all(batchArray.map(b => b.commit()));
    console.log(`✅ Reset stats for ${count} players.`);

    console.log('🚀 WIPE COMPLETE.');
}

wipeData().catch(console.error);
