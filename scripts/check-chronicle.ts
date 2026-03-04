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
const MATCH_ID = 'KQNVhxQco1fFAi9ioug0';

async function check() {
    const doc = await db.doc(`matches/${MATCH_ID}`).get();
    const data = doc.data();
    console.log(JSON.stringify(data?.chronicle, null, 2));
}

check().catch(console.error).finally(() => process.exit(0));
