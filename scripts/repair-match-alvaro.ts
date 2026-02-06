import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

async function repairMatch(matchId: string) {
    const db = getFirestore();
    const guestId = 'SEfHvCyLMPFGd5gn7EKq'; // El Rubio
    const realId = 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2'; // Alvaro M.

    console.log(`🔧 Repairing Match ${matchId}...`);
    console.log(`   Swapping ${guestId} -> ${realId}`);

    const matchRef = db.doc(`matches/${matchId}`);
    const matchSnap = await matchRef.get();

    if (!matchSnap.exists) { console.error('Match not found'); return; }

    // 1. Fetch Real Player Data
    const realPlayerSnap = await db.doc(`players/${realId}`).get();
    if (!realPlayerSnap.exists) { console.error('Real player not found'); return; }
    const realPlayerData = realPlayerSnap.data()!;

    const simplePlayer = {
        uid: realId,
        id: realId, // Ensure compatibility
        name: realPlayerData.name,
        photoURL: realPlayerData.photoUrl || (realPlayerData as any).photoURL || '',
        position: realPlayerData.position,
        ovr: realPlayerData.ovr
    };

    // 2. Update Match Players & UIDs
    const currentData = matchSnap.data()!;

    // Remove guest, Add real (using Set to avoid duplicates)
    const newUids = new Set(currentData.playerUids || []);
    newUids.delete(guestId);
    newUids.add(realId);

    // Update players array
    let newPlayers = (currentData.players || []).filter((p: any) => (p.uid || p.id) !== guestId);
    // Check if real player is already in array
    if (!newPlayers.some((p: any) => (p.uid || p.id) === realId)) {
        newPlayers.push(simplePlayer);
    }

    // 3. Update Teams
    const teams = currentData.teams || [];
    const newTeams = teams.map((team: any) => {
        const teamPlayers = team.players || [];
        const updatedTeamPlayers = teamPlayers.map((p: any) => {
            if ((p.uid || p.id) === guestId) {
                return simplePlayer; // Swap
            }
            return p;
        });
        return { ...team, players: updatedTeamPlayers };
    });

    await matchRef.update({
        playerUids: Array.from(newUids),
        players: newPlayers,
        teams: newTeams,
        status: 'completed' // Ensure status is completed for assignment generation
    });
    console.log('✅ Match players and teams updated.');

    // 4. Delete existing Assignments
    const assignmentsQuery = await matchRef.collection('assignments').get();
    const batch = db.batch();
    assignmentsQuery.docs.forEach(doc => batch.delete(doc.ref));
    console.log(`   Preparing to delete ${assignmentsQuery.size} old assignments...`);

    // 5. Delete existing Evaluation Submissions
    const submissionsQuery = await db.collection('evaluationSubmissions').where('matchId', '==', matchId).get();
    submissionsQuery.docs.forEach(doc => batch.delete(doc.ref));
    console.log(`   Preparing to delete ${submissionsQuery.size} old submissions...`);

    // 6. Delete processedSubmissions and selfEvaluations if any (cleanup)
    const processedQuery = await matchRef.collection('processedSubmissions').get();
    processedQuery.docs.forEach(doc => batch.delete(doc.ref));

    const evaluationsQuery = await db.collection('evaluations').where('matchId', '==', matchId).get();
    evaluationsQuery.docs.forEach(doc => batch.delete(doc.ref));

    await batch.commit();
    console.log('✅ Old data cleaned up.');
}

repairMatch('hSUtIkUZbY0A1fs2CYTq').catch(console.error);
