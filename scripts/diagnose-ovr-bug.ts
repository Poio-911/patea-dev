import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

async function diagnose() {
    const db = getFirestore();
    const groupId = 'Lo7Mz3sUg2PyRZDuCLbd';

    // Get a recent evaluated match
    const matches = await db.collection('matches')
        .where('groupId', '==', groupId)
        .where('status', '==', 'evaluated')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

    if (matches.empty) {
        console.log('❌ No evaluated matches found');
        return;
    }

    const matchDoc = matches.docs[0];
    const matchData = matchDoc.data();
    const matchId = matchDoc.id;

    console.log('\n🔍 DIAGNOSTIC REPORT');
    console.log('═'.repeat(60));
    console.log(`Match: ${matchData.title}`);
    console.log(`Match ID: ${matchId}`);
    console.log(`Players in match (playerUids): ${matchData.playerUids?.length || 0}`);
    console.log('');

    // Get all players in match
    const playerUids = matchData.playerUids || [];
    console.log('👥 Players in Match:');
    for (const uid of playerUids) {
        const playerDoc = await db.doc(`players/${uid}`).get();
        if (playerDoc.exists) {
            const player = playerDoc.data();
            console.log(`  - ${player?.name} (${uid.substring(0, 8)}...)`);
        }
    }
    console.log('');

    // Get assignments
    const assignments = await db.collection(`matches/${matchId}/assignments`).get();
    console.log(`📋 Assignments Created: ${assignments.size}`);

    const assignmentsByEvaluator = new Map<string, number>();
    const assignmentsBySubject = new Map<string, number>();

    assignments.forEach(a => {
        const data = a.data();
        assignmentsByEvaluator.set(data.evaluatorId, (assignmentsByEvaluator.get(data.evaluatorId) || 0) + 1);
        assignmentsBySubject.set(data.subjectId, (assignmentsBySubject.get(data.subjectId) || 0) + 1);
    });

    console.log('  By Evaluator:');
    for (const [uid, count] of assignmentsByEvaluator) {
        const playerDoc = await db.doc(`players/${uid}`).get();
        const name = playerDoc.exists ? playerDoc.data()?.name : 'Unknown';
        console.log(`    ${name}: ${count} assignments`);
    }

    console.log('  By Subject (who gets evaluated):');
    for (const [uid, count] of assignmentsBySubject) {
        const playerDoc = await db.doc(`players/${uid}`).get();
        const name = playerDoc.exists ? playerDoc.data()?.name : 'Unknown';
        console.log(`    ${name}: evaluated ${count} times`);
    }
    console.log('');

    // Get evaluations
    const completedAssignmentIds = assignments.docs
        .filter(a => a.data().status === 'completed')
        .map(a => a.id);

    console.log(`✅ Completed Assignments: ${completedAssignmentIds.length}`);

    if (completedAssignmentIds.length > 0) {
        const evaluations = await db.collection('evaluations')
            .where('assignmentId', 'in', completedAssignmentIds.slice(0, 10))
            .get();

        console.log(`📊 Evaluations in DB: ${evaluations.size}`);

        // Group by playerId (who was evaluated)
        const evalsByPlayer = new Map<string, number>();
        evaluations.forEach(e => {
            const playerId = e.data().playerId;
            evalsByPlayer.set(playerId, (evalsByPlayer.get(playerId) || 0) + 1);
        });

        console.log('  Evaluations received per player:');
        for (const [uid, count] of evalsByPlayer) {
            const playerDoc = await db.doc(`players/${uid}`).get();
            const name = playerDoc.exists ? playerDoc.data()?.name : 'Unknown';
            console.log(`    ${name}: ${count} evaluations`);
        }
    }
    console.log('');

    // Check OVR history for each player
    console.log('📈 OVR History Check:');
    for (const uid of playerUids) {
        const playerDoc = await db.doc(`players/${uid}`).get();
        if (!playerDoc.exists) continue;

        const player = playerDoc.data();
        const ovrHistory = await db.collection(`players/${uid}/ovrHistory`)
            .where('matchId', '==', matchId)
            .get();

        const hasHistory = !ovrHistory.empty;
        const status = hasHistory ? '✅' : '❌';
        console.log(`  ${status} ${player?.name}: ${hasHistory ? 'Has OVR update' : 'NO OVR update'}`);
    }
    console.log('');

    // Check stats.matchesPlayed increment
    console.log('🎮 Stats.matchesPlayed Check:');
    for (const uid of playerUids) {
        const playerDoc = await db.doc(`players/${uid}`).get();
        if (!playerDoc.exists) continue;

        const player = playerDoc.data();
        const matchesPlayed = player?.stats?.matchesPlayed || 0;

        // Check if this player appears in any evaluations
        const playerEvals = await db.collection('evaluations')
            .where('playerId', '==', uid)
            .where('matchId', '==', matchId)
            .get();

        const receivedEvals = playerEvals.size > 0;
        const status = receivedEvals ? '✅' : '❌';
        console.log(`  ${status} ${player?.name}: matchesPlayed=${matchesPlayed}, receivedEvals=${receivedEvals}`);
    }
    console.log('');

    // THE BUG: Show who would be in playerIdsToUpdate
    console.log('🐛 BUG ANALYSIS:');
    console.log('  Current code: playerIdsToUpdate = Object.keys(peerEvalsByPlayer)');
    console.log('  This ONLY includes players who received peer evaluations!');
    console.log('');

    if (completedAssignmentIds.length > 0) {
        const evaluations = await db.collection('evaluations')
            .where('assignmentId', 'in', completedAssignmentIds.slice(0, 10))
            .get();

        const peerEvalsByPlayer = new Map<string, number>();
        evaluations.forEach(e => {
            const playerId = e.data().playerId;
            peerEvalsByPlayer.set(playerId, (peerEvalsByPlayer.get(playerId) || 0) + 1);
        });

        console.log('  Players in peerEvalsByPlayer (WILL get OVR update):');
        for (const uid of peerEvalsByPlayer.keys()) {
            const playerDoc = await db.doc(`players/${uid}`).get();
            const name = playerDoc.exists ? playerDoc.data()?.name : 'Unknown';
            console.log(`    ✅ ${name}`);
        }

        console.log('');
        console.log('  Players NOT in peerEvalsByPlayer (WON\'T get OVR update):');
        for (const uid of playerUids) {
            if (!peerEvalsByPlayer.has(uid)) {
                const playerDoc = await db.doc(`players/${uid}`).get();
                const name = playerDoc.exists ? playerDoc.data()?.name : 'Unknown';
                console.log(`    ❌ ${name} - MISSING OVR UPDATE!`);
            }
        }
    }

    console.log('');
    console.log('═'.repeat(60));
    console.log('💡 ROOT CAUSE:');
    console.log('  Line 319 in evaluate/page.tsx:');
    console.log('    playerIdsToUpdate = Object.keys(peerEvalsByPlayer)');
    console.log('');
    console.log('  This excludes players who:');
    console.log('    - Only have self-evaluations');
    console.log('    - Are manual players (not real users)');
    console.log('    - Had no completed peer assignments');
    console.log('');
    console.log('  FIX: Should use match.playerUids instead!');
    console.log('═'.repeat(60));
}

diagnose().finally(() => process.exit(0));
