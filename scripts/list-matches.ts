
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
        console.log(`- [${d.id}] ${m.title} | Status: ${m.status} | Group: ${m.groupId} | Owner: ${m.ownerUid}`);
    });
}

listMatches().catch(console.error);
