import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

async function inspectMatch(matchId: string) {
    const db = getFirestore();
    const matchSnap = await db.doc(`matches/${matchId}`).get();

    if (!matchSnap.exists) {
        console.log('Match not found.');
        return;
    }

    const data = matchSnap.data();
    console.log(`MATCH TEAMS (Match ${matchId}):\n`, JSON.stringify(data?.teams, null, 2));

    const procSnap = await db.collection(`matches/${matchId}/processedSubmissions`).get();
    console.log(`Number of processed submissions: ${procSnap.size}`);

    const evaluators = procSnap.docs.map(doc => doc.data().evaluatorId);
    console.log(`Evaluator IDs in submissions: ${JSON.stringify(evaluators)}`);
}

const matchId = process.argv[2] || 'In3uDPSg0YGuBrVAPRfv';
inspectMatch(matchId).catch(console.error);
