const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Try to find any service account JSON
const files = fs.readdirSync('d:/Pateá');
const saFile = files.find(f => f.startsWith('mil-disculpis-firebase-adminsdk') && f.endsWith('.json'));

if (!saFile) {
    console.error('No service account file found');
    process.exit(1);
}

const serviceAccount = require(path.join('d:/Pateá', saFile));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const matchId = 'sSTA1Tgv9pj18TJhUkWO';
    const assignmentsSnap = await db.collection('matches').doc(matchId).collection('assignments').get();
    const assignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (assignments.length === 0) {
        console.log('No assignments found for match ' + matchId);
        return;
    }

    const playersIds = [...new Set([...assignments.map(a => a.evaluatorId), ...assignments.map(a => a.subjectId)])];
    const playersSnap = await db.collection('players').where('__name__', 'in', playersIds).get();
    const playersNames = {};
    playersSnap.docs.forEach(d => {
        const data = d.data();
        playersNames[d.id] = data.name + ' (Group: ' + data.groupId + ', Owner: ' + data.ownerUid + ')';
    });

    console.log('--- ASSIGNMENTS FOR MATCH ' + matchId + ' ---');
    assignments.forEach(a => {
        console.log('Evaluator: ' + (playersNames[a.evaluatorId] || a.evaluatorId) + ' -> Subject: ' + (playersNames[a.subjectId] || a.subjectId) + ' [Status: ' + a.status + ']');
    });
}
run().catch(console.error);
