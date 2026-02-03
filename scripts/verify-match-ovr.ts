import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

async function verifyMatchOvrUpdates(matchId: string) {
    const db = getFirestore();

    console.log('\n🔍 VERIFICATION: OVR Updates for Match');
    console.log('═'.repeat(60));
    console.log(`Match ID: ${matchId}\n`);

    // Get match
    const matchDoc = await db.doc(`matches/${matchId}`).get();
    if (!matchDoc.exists) {
        console.log('❌ Match not found');
        return;
    }

    const match = matchDoc.data();
    const playerUids = match?.playerUids || [];

    console.log(`📋 Match: ${match?.title}`);
    console.log(`   Status: ${match?.status}`);
    console.log(`   Players: ${playerUids.length}\n`);

    if (match?.status !== 'evaluated') {
        console.log(`⚠️  Match status is "${match?.status}", expected "evaluated"`);
        console.log('   Make sure to finalize evaluations first.\n');
    }

    console.log('👥 Checking OVR updates for each player:\n');

    let allPass = true;
    const results = [];

    for (const playerId of playerUids) {
        const playerDoc = await db.doc(`players/${playerId}`).get();
        if (!playerDoc.exists) {
            console.log(`   ⚠️  Player ${playerId} not found`);
            continue;
        }

        const player = playerDoc.data();
        const playerName = player?.name || 'Unknown';

        // Check OVR history for this match
        const ovrHistory = await db.collection(`players/${playerId}/ovrHistory`)
            .where('matchId', '==', matchId)
            .get();

        const hasOvrHistory = !ovrHistory.empty;
        let ovrChange = 0;
        let oldOvr = 0;
        let newOvr = 0;

        if (hasOvrHistory) {
            const historyData = ovrHistory.docs[0].data();
            ovrChange = historyData.change || 0;
            oldOvr = historyData.oldOVR || 0;
            newOvr = historyData.newOVR || 0;
        }

        // Check evaluations received
        const evaluations = await db.collection('evaluations')
            .where('playerId', '==', playerId)
            .where('matchId', '==', matchId)
            .get();

        const receivedEvals = evaluations.size;

        // Check matchesPlayed increment
        const matchesPlayed = player?.stats?.matchesPlayed || 0;

        const status = hasOvrHistory ? '✅' : '❌';
        const changeStr = ovrChange > 0 ? `+${ovrChange}` : ovrChange < 0 ? `${ovrChange}` : '±0';

        console.log(`   ${status} ${playerName}`);
        console.log(`      OVR: ${oldOvr} → ${newOvr} (${changeStr})`);
        console.log(`      Evaluations received: ${receivedEvals}`);
        console.log(`      Total matches played: ${matchesPlayed}`);

        if (!hasOvrHistory) {
            allPass = false;
            console.log(`      ❌ MISSING OVR HISTORY ENTRY`);
        }

        results.push({
            name: playerName,
            hasHistory: hasOvrHistory,
            ovrChange,
            evaluations: receivedEvals,
            matchesPlayed
        });

        console.log('');
    }

    console.log('═'.repeat(60));
    console.log('\n📊 SUMMARY:\n');

    const withHistory = results.filter(r => r.hasHistory).length;
    const withoutHistory = results.filter(r => !r.hasHistory).length;
    const withEvaluations = results.filter(r => r.evaluations > 0).length;
    const withoutEvaluations = results.filter(r => r.evaluations === 0).length;

    console.log(`   Players with OVR history: ${withHistory}/${playerUids.length}`);
    console.log(`   Players without OVR history: ${withoutHistory}/${playerUids.length}`);
    console.log(`   Players with evaluations: ${withEvaluations}/${playerUids.length}`);
    console.log(`   Players without evaluations: ${withoutEvaluations}/${playerUids.length}`);

    console.log('\n');

    if (allPass) {
        console.log('🎉 SUCCESS! All players have OVR history entries.');
        console.log('   The fix is working correctly!');
    } else {
        console.log('⚠️  FAILURE: Some players are missing OVR history.');
        console.log('   The bug may still be present.');
    }

    console.log('═'.repeat(60));
}

const matchId = process.argv[2] || 'WBm27E7Whk42gvZJWqcJ';
verifyMatchOvrUpdates(matchId).finally(() => process.exit(0));
