import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
if (!getApps().length) initializeApp({ credential: cert(sa as any), projectId: sa.project_id });
const db = getFirestore();

async function run() {
    const GROUP_ID = 'Lo7Mz3sUg2PyRZDuCLbd';
    const matches = await db.collection('matches').where('groupId', '==', GROUP_ID).get();

    if (matches.empty) {
        console.log('No hay partidos para borrar.');
        return;
    }

    const batch = db.batch();
    matches.docs.forEach(doc => {
        batch.delete(doc.ref);
        console.log(`Borrando partido: ${doc.id}`);
    });

    await batch.commit();
    console.log(`✅ ${matches.size} partidos eliminados.`);
}

run().then(() => process.exit(0)).catch(console.error);
