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

const matchId = 'XId03UW7ClMdDCt6MTbl';

async function checkEvaluations() {
    const db = getFirestore();
    const evalsSnap = await db.collection(`matches/${matchId}/evaluations`).get();
    console.log(`✅ Evaluations found: ${evalsSnap.size}`);

    if (evalsSnap.size > 0) {
        let totalGoals = 0;
        evalsSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.stats?.goals) {
                totalGoals += data.stats.goals;
                console.log(`   - Player ${data.playerId}: ${data.stats.goals} goals`);
            }
        });
        console.log(`   Total Goals in Evaluations: ${totalGoals}`);
    } else {
        console.log('❌ No evaluations found. Submissions might be pending processing.');

        const subsSnap = await db.collection('evaluationSubmissions')
            .where('matchId', '==', matchId)
            .get();
        console.log(`   Pending Submissions: ${subsSnap.size}`);
    }
}

checkEvaluations().catch(console.error);
