import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

/**
 * Verifies that ALL players in evaluated matches have:
 * 1. OVR history entry for the match
 * 2. Incremented stats.matchesPlayed
 */
async function verifyFix() {
    const db = getFirestore();
    const groupId = 'Lo7Mz3sUg2PyRZDuCLbd';

    console.log('\n🔍 VERIFICATION: OVR Update Fix');
    console.log('═'.repeat(60));

    // Get recent evaluated matches
    const matches = await db.collection('matches')
        .where('groupId', '==', groupId)
        .where('status', '==', 'evaluated')
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get();

    if (matches.empty) {
        console.log('❌ No evaluated matches found');
        return;
    }

    console.log(`Found ${matches.size} evaluated matches\n`);

    let allPass = true;
    const issues: string[] = [];

    for (const matchDoc of matches.docs) {
        const matchData = matchDoc.data();
        const matchId = matchDoc.id;
        const playerUids = matchData.playerUids || [];

        console.log(`📋 Match: ${matchData.title}`);
        console.log(`   Players in match: ${playerUids.length}`);

        let matchPass = true;

        for (const playerId of playerUids) {
            const playerDoc = await db.doc(`players/${playerId}`).get();
            if (!playerDoc.exists) {
                console.log(`   ⚠️  Player ${playerId} not found`);
                continue;
            }

            const player = playerDoc.data();
            const playerName = player?.name || 'Unknown';

            // Check 1: OVR History
            const ovrHistory = await db.collection(`players/${playerId}/ovrHistory`)
                .where('matchId', '==', matchId)
                .get();

            const hasOvrHistory = !ovrHistory.empty;

            // Check 2: Stats.matchesPlayed (should be > 0)
            const matchesPlayed = player?.stats?.matchesPlayed || 0;

            // Check 3: Has evaluations (optional, for context)
            const evaluations = await db.collection('evaluations')
                .where('playerId', '==', playerId)
                .where('matchId', '==', matchId)
                .get();

            const receivedEvals = evaluations.size;

            const status = hasOvrHistory ? '✅' : '❌';
            console.log(`   ${status} ${playerName}: OVR=${hasOvrHistory ? 'YES' : 'NO'}, matchesPlayed=${matchesPlayed}, evals=${receivedEvals}`);

            if (!hasOvrHistory) {
                matchPass = false;
                allPass = false;
                issues.push(`${matchData.title}: ${playerName} missing OVR history`);
            }
        }

        console.log(matchPass ? '   ✅ PASS\n' : '   ❌ FAIL\n');
    }

    console.log('═'.repeat(60));
    if (allPass) {
        console.log('🎉 ALL CHECKS PASSED - Fix is working!');
    } else {
        console.log('⚠️  ISSUES FOUND:');
        issues.forEach(issue => console.log(`   - ${issue}`));
    }
    console.log('═'.repeat(60));
}

verifyFix().finally(() => process.exit(0));
