import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
if (!getApps().length) initializeApp({ credential: cert(sa as any), projectId: sa.project_id });
const db = getFirestore();

const snap = await db.collection('players').limit(1).get();
if (!snap.empty) {
    const data = snap.docs[0].data();
    console.log('=== PLAYER FIELDS ===');
    console.log(JSON.stringify({
        stats: data.stats,
        attributes: data.attributes,
        ovr: data.ovr,
    }, null, 2));
}
process.exit(0);
