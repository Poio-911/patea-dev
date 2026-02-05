import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

const db = getFirestore();

async function wipeHistory() {
    console.log('🧹 Wiping "evaluations" collection (History/Feedback)...');

    // Use recursive delete for safety, though it's likely flat
    await db.recursiveDelete(db.collection('evaluations'));

    console.log('✅ History wiped. No more zombies.');
}

wipeHistory().catch(console.error);
