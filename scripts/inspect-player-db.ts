
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

async function inspectPlayer(playerNamePart: string) {
    const db = getFirestore();
    console.log(`\n🔍 INSPECTING PLAYER matching "${playerNamePart}"...`);

    // Find player by name
    const snap = await db.collection('players').get();
    const playerDoc = snap.docs.find(d =>
        (d.data().name || '').toLowerCase().includes(playerNamePart.toLowerCase())
    );

    if (!playerDoc) {
        console.log('❌ Player not found');
        return;
    }

    const data = playerDoc.data();
    console.log(`✅ Found: ${data.name} (ID: ${playerDoc.id})`);
    console.log('═'.repeat(40));
    console.log(`OVR: ${data.ovr}`);
    console.log(`Stats Object:`);
    console.log(JSON.stringify(data.stats, null, 2));
    console.log('═'.repeat(40));

    if (data.ovr && data.stats?.goals && data.ovr === data.stats.goals) {
        console.warn('⚠️  WARNING: OVR equals Goals! Data might be corrupted.');
    } else {
        console.log('OK: OVR and Goals are different.');
    }
}

const name = process.argv[2] || 'anaclara';
inspectPlayer(name).catch(console.error);
