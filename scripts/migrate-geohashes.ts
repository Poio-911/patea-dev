
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as geohash from 'ngeohash';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

// Initialize Firebase Admin
if (getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
    initializeApp({
        credential: cert(serviceAccount),
    });
}

const db = getFirestore();

async function migrateGeohashes() {
    console.log('Starting geohash migration...');

    const snapshot = await db.collection('availablePlayers').get();
    console.log(`Found ${snapshot.size} players to check.`);

    let updatedCount = 0;
    let batch = db.batch();
    let batchSize = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();

        // Check if location exists and geohash is missing or needs update
        if (data.location && data.location.lat && data.location.lng) {
            if (!data.location.geohash) {
                const hash = geohash.encode(data.location.lat, data.location.lng);

                const updateData = {
                    'location.geohash': hash
                };

                batch.update(doc.ref, updateData);
                batchSize++;
                updatedCount++;

                if (batchSize >= 500) {
                    await batch.commit();
                    console.log(`Committed batch of ${batchSize} updates.`);
                    batch = db.batch();
                    batchSize = 0;
                }
            }
        }
    }

    if (batchSize > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${batchSize} updates.`);
    }

    console.log(`Migration complete. Updated ${updatedCount} players.`);
}

migrateGeohashes().catch(console.error);
