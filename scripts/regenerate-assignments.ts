import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

const db = getFirestore();

// --- LOGIC COPIED FROM use-match-actions.ts ---
function generateAssignmentsBalanced(match: any, allPlayers: any[]) {
    const assignments: any[] = [];
    const matchPlayers = allPlayers.filter(p => match.playerUids.includes(p.id));

    // Only real users can be evaluators
    // In script context, assume we want all players to act as evaluators if ownerId logic is fuzzy,
    // BUT the hook uses isRealUser. Let's stick to the hook logic to be safe.
    // Wait, the user wants EVERYONE to evaluate.
    // The previous seed script simulated everyone.
    // The HOOK logic restricts to Real Users.
    // If I use the hook logic, bots won't evaluate.
    // User said: "todos los jugadores reales evaluan".
    // If there are bots, they don't evaluate.
    // Resulting graph: N_Real evaluators * 2 edges.
    // Distributed among N_Total subjects.
    // New Algo handles this: it distributes the AVAILABLE edges evenly.

    // For this specific match, let's assume all players should evaluate to satisfy the user's "everyone evaluates" request.
    const realPlayerUids = matchPlayers.map(p => p.id); // FORCE ALL FOR THIS FIX

    // Track incoming evaluation counts to ensure balance
    const incomingCounts: Record<string, number> = {};
    matchPlayers.forEach(p => incomingCounts[p.id] = 0);

    // Shuffle evaluators to avoid deterministic bias in order
    const shuffledEvaluators = [...realPlayerUids].sort(() => 0.5 - Math.random());

    shuffledEvaluators.forEach(evaluatorId => {
        if (!match.teams) return;

        const myTeam = match.teams.find((t: any) => t.players.some((p: any) => p.uid === evaluatorId));

        // 1. Define candidates (ALL players except self)
        let candidates = matchPlayers.filter(p => p.id !== evaluatorId);

        // 2. Sort candidates
        candidates.sort((a, b) => {
            // Primary: Starvation (Load Balancing)
            const countDiff = incomingCounts[a.id] - incomingCounts[b.id];
            if (countDiff !== 0) return countDiff;

            // Secondary: Teammate Priority
            const aIsTeammate = myTeam?.players.some((tp: any) => tp.uid === a.id);
            const bIsTeammate = myTeam?.players.some((tp: any) => tp.uid === b.id);

            if (aIsTeammate && !bIsTeammate) return -1;
            if (!aIsTeammate && bIsTeammate) return 1;

            // Tertiary: Random
            return 0.5 - Math.random();
        });

        // 3. Pick top 2
        const MAX_PEERS = 2;
        const selectedPeers = candidates.slice(0, MAX_PEERS);

        if (selectedPeers.length === 0) {
            assignments.push({
                matchId: match.id,
                evaluatorId: evaluatorId,
                subjectId: evaluatorId, // Self
                status: 'pending',
            });
        } else {
            selectedPeers.forEach(subject => {
                incomingCounts[subject.id]++;
                assignments.push({
                    matchId: match.id,
                    evaluatorId: evaluatorId,
                    subjectId: subject.id,
                    status: 'pending',
                });
            });
        }
    });

    return { assignments, incomingCounts };
}

async function fixAssignments(matchId: string) {
    console.log(`🔧 Fixing Assignments for Match: ${matchId}`);

    // 1. Fetch Match
    const matchDoc = await db.doc(`matches/${matchId}`).get();
    if (!matchDoc.exists) { console.log('❌ Match not found'); return; }
    const match = { id: matchDoc.id, ...matchDoc.data() } as any;

    // 2. Fetch Players
    const playerDocs = await Promise.all(match.playerUids.map((uid: string) => db.doc(`players/${uid}`).get()));
    const players = playerDocs.map(d => ({ id: d.id, ...d.data() }));

    // 3. Generate NEW Balanced Assignments
    console.log('🔄 Generating new balanced assignments...');
    const result = generateAssignmentsBalanced(match, players);
    console.log(`   Generated ${result.assignments.length} assignments.`);
    console.log('   Distribution:', result.incomingCounts);

    // 4. Delete OLD Assignments
    console.log('🗑️ Deleting old assignments...');
    const oldAssigns = await db.collection(`matches/${matchId}/assignments`).get();
    if (!oldAssigns.empty) {
        const batch = db.batch();
        oldAssigns.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`   Deleted ${oldAssigns.size} old assignments.`);
    }

    // 5. Write NEW Assignments
    console.log('💾 Saving new assignments...');
    const batch2 = db.batch();
    for (const assign of result.assignments) {
        const ref = db.collection(`matches/${matchId}/assignments`).doc();
        batch2.set(ref, assign);
    }
    await batch2.commit();
    console.log('✅ Assignments regenerated and saved.');
}

const matchId = process.argv[2] || 'qfpCyX5uXP7o8I3x4ULc';
fixAssignments(matchId).catch(console.error);
