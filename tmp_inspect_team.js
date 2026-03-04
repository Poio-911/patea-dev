const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const rootDir = 'd:/Pateá';
const files = fs.readdirSync(rootDir);
const saFile = files.find(f => f.startsWith('mil-disculpis-firebase-adminsdk') && f.endsWith('.json'));

if (!saFile) {
    console.error('Service account file not found');
    process.exit(1);
}

const serviceAccount = require(path.join(rootDir, saFile));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function checkTeam() {
    const snapshot = await db.collection('teams').limit(1).get();
    if (snapshot.empty) {
        console.log('No teams found');
        return;
    }
    console.log(JSON.stringify(snapshot.docs[0].data(), null, 2));
}

checkTeam().catch(console.error);
