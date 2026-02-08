
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

async function debug() {
    const db = getFirestore();
    const snapshot = await db.collection('players').where('name', '==', 'Cosme').get();

    if (snapshot.empty) {
        console.log('Cosme not found');
        // Try listing first 5 players to see structure
        const all = await db.collection('players').limit(5).get();
        all.forEach(d => console.log(d.id, d.data().name, d.data().stats));
        return;
    }

    snapshot.forEach(doc => {
        console.log(`\nID: ${doc.id}`);
        console.log('Data:', JSON.stringify(doc.data(), null, 2));
    });
}

debug().catch(console.error);
