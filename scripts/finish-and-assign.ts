import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

async function finishMatch(matchId: string) {
    const db = getFirestore();
    console.log(`\n🏁 Finishing Match ID: ${matchId}`);

    const matchRef = db.doc(`matches/${matchId}`);
    const matchDoc = await matchRef.get();

    if (!matchDoc.exists) {
        console.error('❌ Match not found');
        return;
    }

    // Set random score
    const score1 = Math.floor(Math.random() * 5) + 1;
    const score2 = Math.floor(Math.random() * 5);

    await matchRef.update({
        status: 'completed',
        finalScore: { team1: score1, team2: score2 },
        endedAt: new Date().toISOString()
    });

    // Also generate balanced assignments if they don't exist? 
    // Usually the backend triggers this on finish, but since we are simulating manually...
    // The seed-evaluations script relies on assignments existing in subcollection 'assignments'.
    // If the backend trigger doesn't run (because we are bypassing it or local env), we might need to seed assignments too.
    // Let's assume for now we need to generate assignments manually if they don't exist.

    console.log(`✅ Match set to COMPLETED (Score: ${score1}-${score2})`);

    // Generate assignments logic (simplified 2-regular graph or just all-vs-all for testing)
    const players = matchDoc.data()?.playerUids || [];
    console.log(`👥 Generating assignments for ${players.length} players...`);

    const assignmentsBatch = db.batch();
    const assignmentsRef = matchRef.collection('assignments');

    // Delete existing to be safe
    const existing = await assignmentsRef.get();
    existing.docs.forEach(d => assignmentsBatch.delete(d.ref));

    if (players.length > 0) {
        // Create assignments: Each player evaluates 2 specific teammates (Round Robin / Circle)
        // This ensures every player GIVES 2 evaluations and RECEIVES 2 evaluations.
        console.log('Using Deterministic Circular Assignment (2-peers strictly balanced)');

        // Shuffle the array ONCE to randomize "who sits next to whom", but keep the topology consistent
        const shuffledPlayers = [...players].sort(() => 0.5 - Math.random());
        const count = shuffledPlayers.length;

        for (let i = 0; i < count; i++) {
            const evaluatorId = shuffledPlayers[i];

            // Pick next 2 players in the circle (wrapping around)
            const subject1Id = shuffledPlayers[(i + 1) % count];
            const subject2Id = shuffledPlayers[(i + 2) % count];

            const selectedSubjects = [subject1Id, subject2Id];

            for (const subjectId of selectedSubjects) {
                if (evaluatorId === subjectId) continue;

                const ref = assignmentsRef.doc();
                assignmentsBatch.set(ref, {
                    matchId,
                    evaluatorId,
                    subjectId,
                    status: 'pending',
                    assignedAt: new Date().toISOString()
                });
                console.log(`   -> ${evaluatorId} will evaluate ${subjectId}`);
            }
        }
    }

    await assignmentsBatch.commit();
    console.log(`✅ Generated assignments (2 per player)`);
}

const matchId = process.argv[2];
if (!matchId) {
    console.error('Please provide a match ID');
    process.exit(1);
}

finishMatch(matchId).catch(console.error);
