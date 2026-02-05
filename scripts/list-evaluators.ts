import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

async function listEvaluators(matchId: string) {
    const db = getFirestore();
    const procSnap = await db.collection(`matches/${matchId}/processedSubmissions`).get();

    console.log(`Evaluators for match ${matchId}:`);
    procSnap.forEach(doc => {
        const data = doc.data();
        console.log(`- ${data.evaluatorId}`);
    });
}

const matchId = process.argv[2] || 'In3uDPSg0YGuBrVAPRfv';
listEvaluators(matchId).catch(console.error);
