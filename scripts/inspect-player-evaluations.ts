import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

async function inspectPlayerEvaluations(matchId: string, playerIds: string[]) {
    const db = getFirestore();

    console.log(`\n🔍 INSPECTING EVALUATIONS FOR MATCH: ${matchId}`);
    console.log('═'.repeat(60));

    // If no player IDs provided, fetch all from match
    let targetPlayerIds = playerIds;
    if (targetPlayerIds.length === 0) {
        const matchDoc = await db.doc(`matches/${matchId}`).get();
        if (!matchDoc.exists) {
            console.log('Match not found');
            return;
        }
        const matchData = matchDoc.data();
        targetPlayerIds = matchData?.playerUids || [];
        console.log(`ℹ️  No player IDs provided. Inspecting all ${targetPlayerIds.length} players in match.`);
    }

    const evalsSnap = await db.collection('evaluations')
        .where('matchId', '==', matchId)
        .get();
    const evals = evalsSnap.docs.map(doc => doc.data());

    for (const playerId of targetPlayerIds) {
        const playerDoc = await db.doc(`players/${playerId}`).get();
        const playerName = playerDoc.exists ? (playerDoc.data() as any).name : playerId;

        const playerEvals = evals.filter(e => e.playerId === playerId);
        const ratings = playerEvals.map(e => e.rating).filter(r => r !== undefined);
        const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

        console.log(`👤 Player: ${playerName} (${playerId})`);
        console.log(`   - Evaluations count: ${playerEvals.length}`);

        const allTags: any[] = [];
        playerEvals.forEach((e: any) => {
            if (e.performanceTags) {
                allTags.push(...e.performanceTags);
            }
        });

        console.log(`   - Ratings: ${ratings.join(', ') || 'None'}`);
        console.log(`   - Average Rating: ${avgRating !== null ? avgRating.toFixed(2) : 'N/A'}`);

        if (allTags.length > 0) {
            console.log(`   - Tags: ${allTags.map(t => t.name).join(', ')}`);
            const totalTagEffect = allTags.reduce((sum, tag) => sum + (tag.effects?.reduce((s: number, e: any) => s + e.change, 0) || 0), 0);
            console.log(`   - Total Tag Effect: ${totalTagEffect.toFixed(2)}`);
            console.log(`   - Tag OVR Adjustment (Math.round(effect / 6)): ${Math.round(totalTagEffect / 6)}`);
        }

        if (avgRating !== null) {
            const baseline = 5;
            const delta = avgRating - baseline;
            const rawChange = delta * 0.6;
            const roundedChange = Math.round(rawChange);
            console.log(`   - Baseline: ${baseline}`);
            console.log(`   - Rating Delta: ${delta.toFixed(2)}`);
            console.log(`   - Raw OVR Change (delta * 0.6): ${rawChange.toFixed(2)}`);
            console.log(`   - Final Rounded Change: ${roundedChange}`);
        }
        console.log('');
    }
}

const matchId = process.argv[2];
const playerIds = process.argv.slice(3);

if (!matchId) {
    console.error('Usage: npx tsx scripts/inspect-player-evaluations.ts <matchId> [playerId1] [playerId2] ...');
    process.exit(1);
}

inspectPlayerEvaluations(matchId, playerIds).catch(console.error).finally(() => process.exit(0));
