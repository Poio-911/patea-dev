import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
if (getApps().length === 0) initializeApp({ credential: cert(sa), projectId: sa.project_id });

const db = getFirestore();

async function clean() {
    const snap = await db.collection('evaluationSubmissions').where('matchId', '==', 'KQNVhxQco1fFAi9ioug0').get();
    let count = 0;
    for (const doc of snap.docs) {
        await doc.ref.delete();
        count++;
    }
    console.log(`Borradas ${count} submissions viejas.`);
}

clean().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
