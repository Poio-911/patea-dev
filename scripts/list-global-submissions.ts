import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
    }
}

async function listSubmissions() {
    const db = getFirestore();
    console.log('📋 Listing recent evaluationSubmissions...');

    const snap = await db.collection('evaluationSubmissions')
        .orderBy('submittedAt', 'desc')
        .limit(10)
        .get();

    console.log(`Found ${snap.size} submissions globally:`);
    snap.forEach(doc => {
        const data = doc.data();
        console.log(`- MatchId: ${data.matchId}, Evaluator: ${data.evaluatorId}, Date: ${data.submittedAt}`);
    });

    console.log('\n📋 Listing recent processedSubmissions (globally if possible)...');
    // Usually processedSubmissions are in matches/{id}/processedSubmissions
    // But maybe there is a root collection? 
    // Let's try to find matches that HAVE evaluations.
    const matchesSnap = await db.collection('matches').get();
    console.log(`Checking ${matchesSnap.size} matches for processed data...`);
    for (const matchDoc of matchesSnap.docs) {
        const pSnap = await db.collection(`matches/${matchDoc.id}/processedSubmissions`).get();
        if (pSnap.size > 0) {
            console.log(`- Match ${matchDoc.id} has ${pSnap.size} processed submissions`);
        }
    }
}

listSubmissions().catch(console.error);
