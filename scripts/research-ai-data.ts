import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!getApps().length) initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

async function listCollections() {
    const collections = await db.listCollections();
    console.log('Collections:', collections.map(c => c.id).join(', '));

    // Check for specific AI related collections
    const aiCollections = collections.filter(c => c.id.toLowerCase().includes('ai') || c.id.toLowerCase().includes('log'));
    for (const coll of aiCollections) {
        const snap = await coll.limit(5).get();
        console.log(`\nSample from ${coll.id}:`);
        snap.docs.forEach(doc => console.log(doc.id, doc.data()));
    }
}

listCollections().catch(console.error);
