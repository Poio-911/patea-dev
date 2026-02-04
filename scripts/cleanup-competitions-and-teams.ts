
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account (mirrored from other scripts)
const serviceAccountPath = path.join(__dirname, '../mil-disculpis-firebase-adminsdk-fbsvc-5d1f71eeb1.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('ERROR: service-account.json not found at', serviceAccountPath);
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount),
    });
}

const db = getFirestore();

async function deleteCollection(collectionPath: string, batchSize: number = 500) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db: FirebaseFirestore.Firestore, query: FirebaseFirestore.Query, resolve: (value?: unknown) => void) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        // When there are no documents left, we are done
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse on the next process tick, to avoid
    // exploding the stack.
    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

async function cleanup() {
    console.log('🗑️  Starting cleanup...');

    try {
        // 1. Delete Leagues
        console.log('Deleting all leagues...');
        await deleteCollection('leagues');

        // 2. Delete Cups
        console.log('Deleting all cups...');
        await deleteCollection('cups');

        // 3. Delete Teams (created in groups)
        console.log('Deleting all teams...');
        await deleteCollection('teams');

        // 4. Delete Competition Applications
        console.log('Deleting all competition applications...');
        await deleteCollection('competitionApplications');

        // 5. Delete Matches related to competitions (Type 'league', 'cup', 'league_final')
        // We can't easily filter by "type IN [...]" for deleteCollection because it processes in batches.
        // Instead we will query and delete batch by batch.
        console.log('Deleting competition matches...');
        const matchTypes = ['league', 'cup', 'league_final'];

        for (const type of matchTypes) {
            console.log(`  Deleting matches of type: ${type}`);
            // Can't use deleteCollection helper efficiently here because of the where clause 
            // combined with the recursive need.
            // We will do a loop.
            while (true) {
                const snapshot = await db.collection('matches')
                    .where('type', '==', type)
                    .limit(500)
                    .get();

                if (snapshot.empty) break;

                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                console.log(`    Deleted ${snapshot.size} ${type} matches.`);
            }
        }

        console.log('✅ Cleanup complete! All leagues, cups, teams, and competition matches have been deleted.');
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

cleanup();
