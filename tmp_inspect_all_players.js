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
    const data = matchSnap.data();
    console.log('--- PLAYERS IN MATCH ---');
    const playersSnap = await db.collection('players').where('__name__', 'in', data.playerUids).get();
    playersSnap.docs.forEach(d => {
        const p = d.data();
        const match = d.id === p.ownerUid ? 'MATCH' : 'MISMATCH';
        console.log(`[${match}] ID: ${d.id}, Owner: ${p.ownerUid}, Name: ${p.name}`);
    });
}
run().catch(console.error);
