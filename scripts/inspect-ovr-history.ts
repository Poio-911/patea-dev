import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

async function inspectOvrHistory(matchId: string, playerId: string) {
    const db = getFirestore();

    console.log(`\n🔍 INSPECTING OVR HISTORY FOR PLAYER: ${playerId} IN MATCH: ${matchId}`);
    console.log('═'.repeat(60));

    const historySnap = await db.collection(`players/${playerId}/ovrHistory`)
        .where('matchId', '==', matchId)
        .get();

    if (historySnap.empty) {
        console.log('❌ No history entry found for this match.');
        return;
    }

    historySnap.forEach(doc => {
        console.log('History Entry:');
        console.log(JSON.stringify(doc.data(), null, 2));
    });

    const playerDoc = await db.doc(`players/${playerId}`).get();
    console.log('\nCurrent Player Stats:');
    console.log(JSON.stringify(playerDoc.data()?.stats, null, 2));
}

const matchId = process.argv[2];
const playerId = process.argv[3];

if (!matchId || !playerId) {
    console.log('Usage: npx tsx scripts/inspect-ovr-history.ts <matchId> <playerId>');
    process.exit(1);
}

inspectOvrHistory(matchId, playerId).finally(() => process.exit(0));
