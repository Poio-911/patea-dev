import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

async function listMatches() {
    const db = getFirestore();
    console.log('Fetching matches...');

    // Fetch completed matches first
    const completedSnapshot = await db.collection('matches')
        .where('status', '==', 'completed')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

    console.log(`\nFound ${completedSnapshot.size} completed matches:`);
    completedSnapshot.forEach(doc => {
        const d = doc.data();
        console.log(`- [${doc.id}] ${d.title} (${d.date}) - Status: ${d.status}`);
    });

    // Also fetch evaluated ones?
    const evaluatedSnapshot = await db.collection('matches')
        .where('status', '==', 'evaluated')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

    console.log(`\nFound ${evaluatedSnapshot.size} evaluated matches (Skip these):`);
    evaluatedSnapshot.forEach(doc => {
        const d = doc.data();
        console.log(`- [${doc.id}] ${d.title} (${d.date}) - Status: ${d.status}`);
    });
}

listMatches().catch(console.error);
