import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!getApps().length) initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

async function checkCup(cupId: string) {
    const cupDoc = await db.collection('cups').doc(cupId).get();
    if (!cupDoc.exists) {
        console.log(JSON.stringify({ error: 'Cup not found' }));
        return;
    }
    const cupData = cupDoc.data()!;

    const matchesSnapshot = await db.collection('matches').where('leagueInfo.leagueId', '==', cupId).get();
    const matches = matchesSnapshot.docs.map(doc => ({
        id: doc.id,
        status: doc.data().status,
        round: doc.data().leagueInfo?.round,
        finalScore: doc.data().finalScore,
    }));

    const result = {
        cupStatus: cupData.status,
        bracket: cupData.bracket,
        matches: matches
    };

    console.log(JSON.stringify(result, null, 2));
}

checkCup('LTZECrLjILPRNg8YlQw5').catch(e => console.error(JSON.stringify({ error: e.message })));
