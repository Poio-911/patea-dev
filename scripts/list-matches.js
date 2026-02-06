
const { getFirestore } = require('firebase-admin/firestore');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { join } = require('path');
require('dotenv').config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

const db = getFirestore();

async function listMatches() {
    console.log('🔍 Listing all matches in Firestore...');
    const snapshot = await db.collection('matches').get();

    if (snapshot.empty) {
        console.log('❌ No matches found in DB.');
        return;
    }

    console.log(`✅ Found ${snapshot.size} matches.`);
    snapshot.docs.forEach(d => {
        const m = d.data();
        console.log(`- [${d.id}] ${m.title} | Status: ${m.status} | Date: ${m.date} | Owner: ${m.ownerUid}`);
    });
}

listMatches().catch(console.error);
