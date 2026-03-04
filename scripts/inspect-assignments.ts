import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
if (!getApps().length) initializeApp({ credential: cert(sa as any), projectId: sa.project_id });
const db = getFirestore();
async function run() {
    const matchId = 'KQNVhxQco1fFAi9ioug0';
    const asgSnap = await db.collection(`matches/${matchId}/assignments`).get();
    console.log(`Total assignments: ${asgSnap.size}`);
    asgSnap.docs.forEach(doc => {
        const d = doc.data();
        console.log(doc.id, '| evaluatorId:', d.evaluatorId, '| subjectId:', d.subjectId, '| status:', d.status);
    });
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
