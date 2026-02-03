import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

async function verify() {
    const db = getFirestore();

    const matches = await db.collection('matches')
        .where('groupId', '==', 'Lo7Mz3sUg2PyRZDuCLbd')
        .where('status', '==', 'evaluated')
        .limit(5)
        .get();

    console.log(`\n🔍 Verificando ${matches.size} partidos...\n`);

    let allPass = true;

    for (const matchDoc of matches.docs) {
        const matchData = matchDoc.data();
        const playersInMatch = matchData.playerUids?.length || 0;

        const evals = await db.collection('evaluations')
            .where('matchId', '==', matchDoc.id)
            .get();

        const playerIds = new Set<string>();
        evals.forEach(e => playerIds.add(e.data().playerId));

        const pass = playerIds.size === playersInMatch;
        const status = pass ? '✅ PASS' : '❌ FAIL';

        console.log(`${status} Match ${matchDoc.id.substring(0, 8)}...`);
        console.log(`   Players in match: ${playersInMatch}`);
        console.log(`   Players evaluated: ${playerIds.size}`);
        console.log(`   Total evaluations: ${evals.size}\n`);

        if (!pass) allPass = false;
    }

    console.log('═'.repeat(50));
    console.log(allPass ? '🎉 ALL MATCHES PASS - Fix verified!' : '⚠️  Some matches still failing');
    console.log('═'.repeat(50));
}

verify().finally(() => process.exit(0));
