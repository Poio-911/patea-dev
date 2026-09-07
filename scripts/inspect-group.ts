import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

const db = getFirestore();

async function run() {
    const groupSnap = await db.collection('groups').doc('Lo7Mz3sUg2PyRZDuCLbd').get();
    console.log('Group Data:', groupSnap.data()?.name, 'Invite code:', groupSnap.data()?.inviteCode);

    const playersSnap = await db.collection('players').where('groupId', '==', 'Lo7Mz3sUg2PyRZDuCLbd').get();
    console.log(`\nFound ${playersSnap.size} players in group:`);
    playersSnap.docs.forEach(d => {
        const p = d.data();
        console.log(`- ${d.id}: ${p.name} | Pos: ${p.position} | OVR: ${p.ovr}`);
    });
}

run().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
