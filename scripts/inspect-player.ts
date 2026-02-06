import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

async function inspectPlayer(uid: string) {
    const db = getFirestore();
    console.log(`\n🔍 Inspecting Player: ${uid}`);

    // Check specific doc
    const docRef = db.doc(`players/${uid}`);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
        console.log('📄 Document found:');
        console.log(JSON.stringify(docSnap.data(), null, 2));
    } else {
        console.log('❌ Document NOT found at players/' + uid);
    }

    // Search for players where ownerUid is this UID
    console.log(`\n🔎 Searching for players owned by ${uid}...`);
    const querySnap = await db.collection('players').where('ownerUid', '==', uid).get();

    if (querySnap.empty) {
        console.log('   No players found owned by this UID.');
    } else {
        querySnap.forEach(d => {
            console.log(`   - ID: ${d.id}`);
            console.log(`     Name: ${d.data().name}`);
            console.log(`     Owner: ${d.data().ownerUid}`);
            console.log(`     Real?: ${d.id === d.data().ownerUid}`);
            console.log('---');
        });
    }
}

const targetUid = process.argv[2] || 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2';
inspectPlayer(targetUid).catch(console.error);
