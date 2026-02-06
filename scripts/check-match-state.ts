import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

async function checkMatch(matchId: string) {
    const db = getFirestore();
    const matchDoc = await db.doc(`matches/${matchId}`).get();
    const data = matchDoc.data();

    if (!data) { console.log('Match not found'); return; }

    console.log(`Match Status: ${data.status}`);
    console.log(`Player UIDs (${data.playerUids.length}):`, data.playerUids);
    console.log(`Players Array (${data.players.length}):`);
    data.players.forEach((p: any) => console.log(` - ${p.name} (${p.id})`));
}

checkMatch('hSUtIkUZbY0A1fs2CYTq');
