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
    const assignmentsSnap = await db.collection('matches').doc(matchId).collection('assignments').get();
    const assignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const playersIds = [...new Set([...assignments.map(a => a.evaluatorId), ...assignments.map(a => a.subjectId)])];

    // Fetch players in batches of 30
    const playersNames = {};
    for (let i = 0; i < playersIds.length; i += 30) {
        const chunk = playersIds.slice(i, i + 30);
        const snap = await db.collection('players').where('__name__', 'in', chunk).get();
        snap.docs.forEach(d => {
            const data = d.data();
            playersNames[d.id] = {
                name: data.name,
                group: data.groupId,
                owner: data.ownerUid
            };
        });
    }

    console.log('--- DETAILED ASSIGNMENTS ---');
    const groupedByEvaluator = {};
    assignments.forEach(a => {
        if (!groupedByEvaluator[a.evaluatorId]) groupedByEvaluator[a.evaluatorId] = [];
        groupedByEvaluator[a.evaluatorId].push(a);
    });

    for (const [evalId, evals] of Object.entries(groupedByEvaluator)) {
        const p = playersNames[evalId] || { name: evalId };
        console.log(`Evaluator: ${p.name} (Owner: ${p.owner}, Group: ${p.group})`);
        evals.forEach(e => {
            const s = playersNames[e.subjectId] || { name: e.subjectId };
            console.log(`  -> Subject: ${s.name} [Status: ${e.status}]`);
        });
    }
}
run().catch(console.error);
