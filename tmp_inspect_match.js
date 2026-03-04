const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const files = fs.readdirSync('d:/Pateá');
const saFile = files.find(f => f.startsWith('mil-disculpis-firebase-adminsdk') && f.endsWith('.json'));
const serviceAccount = require(path.join('d:/Pateá', saFile));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const matchId = 'sSTA1Tgv9pj18TJhUkWO';
    const matchSnap = await db.collection('matches').doc(matchId).get();
    if (!matchSnap.exists) {
        console.error('Match not found');
        return;
    }
    const data = matchSnap.data();
    console.log('--- MATCH DATA ---');
    console.log('Title:', data.title);
    console.log('Status:', data.status);
    console.log('ParticipantGroupIds:', data.participantGroupIds);
    console.log('PlayerUids (count):', data.playerUids?.length || 0);

    const assignmentsSnap = await db.collection('matches').doc(matchId).collection('assignments').get();
    console.log('Assignments (count):', assignmentsSnap.size);

    if (data.playerUids && data.playerUids.length > 0) {
        const playersSnap = await db.collection('players').where('__name__', 'in', data.playerUids).get();
        console.log('--- PLAYERS IN MATCH ---');
        playersSnap.docs.forEach(d => {
            console.log(`ID: ${d.id}, Name: ${d.data().name}, Group: ${d.data().groupId}, Owner: ${d.data().ownerUid}`);
        });
    } else {
        console.log('No playerUids found in match document');
    }
}
run().catch(console.error);
