const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const files = fs.readdirSync('d:/Pateá');
const saFile = files.find(f => f.startsWith('mil-disculpis-firebase-adminsdk') && f.endsWith('.json'));
const serviceAccount = require(path.join('d:/Pateá', saFile));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Helper to determine if a player is a "real user"
const isRealUser = (player) => player.id === player.ownerUid;

function generateEvaluationAssignments(match, allPlayers) {
    const assignments = [];
    const matchPlayers = allPlayers.filter(p => match.playerUids.includes(p.id));

    // Only real users can be evaluators
    const realPlayerUids = matchPlayers.filter(isRealUser).map(p => p.id);

    // Track incoming evaluation counts to ensure balance
    const incomingCounts = {};
    matchPlayers.forEach(p => incomingCounts[p.id] = 0);

    // Fisher-Yates shuffle for unbiased randomization
    const shuffledEvaluators = [...realPlayerUids];
    for (let i = shuffledEvaluators.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledEvaluators[i], shuffledEvaluators[j]] = [shuffledEvaluators[j], shuffledEvaluators[i]];
    }

    shuffledEvaluators.forEach(evaluatorId => {
        const myTeam = match.teams?.find(t => t.players.some(p => p.uid === evaluatorId));
        let candidates = matchPlayers.filter(p => p.id !== evaluatorId);

        candidates.sort((a, b) => {
            const countDiff = incomingCounts[a.id] - incomingCounts[b.id];
            if (countDiff !== 0) return countDiff;
            const aIsTeammate = myTeam?.players.some(tp => tp.uid === a.id);
            const bIsTeammate = myTeam?.players.some(tp => tp.uid === b.id);
            if (aIsTeammate && !bIsTeammate) return -1;
            if (!aIsTeammate && bIsTeammate) return 1;
            return 0;
        });

        const MAX_PEERS = 2;
        const selectedPeers = candidates.slice(0, MAX_PEERS);

        if (selectedPeers.length === 0) {
            assignments.push({
                matchId: match.id,
                evaluatorId: evaluatorId,
                subjectId: evaluatorId,
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

    return assignments;
}

async function run() {
    const matchId = 'sSTA1Tgv9pj18TJhUkWO';
    const matchRef = db.collection('matches').doc(matchId);
    const matchSnap = await matchRef.get();
    const matchData = { id: matchSnap.id, ...matchSnap.data() };

    console.log('Regenerating assignments for match:', matchId);

    // 1. Delete ALL current assignments
    const assignmentsCol = matchRef.collection('assignments');
    const oldAssignments = await assignmentsCol.get();
    const batch = db.batch();
    oldAssignments.docs.forEach(doc => batch.delete(doc.ref));
    console.log(`Deleting ${oldAssignments.size} old assignments...`);

    // 2. Fetch all players involved
    const playersIds = matchData.playerUids;
    const playersSnap = await db.collection('players').where('__name__', 'in', playersIds).get();
    const allPlayers = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 3. Generate new assignments
    const newAssignments = generateEvaluationAssignments(matchData, allPlayers);
    console.log(`Generated ${newAssignments.length} new assignments.`);

    // 4. Save new assignments
    newAssignments.forEach(a => {
        const ref = assignmentsCol.doc();
        batch.set(ref, a);
    });

    await batch.commit();
    console.log('Success! Assignments regenerated.');
}
run().catch(console.error);
