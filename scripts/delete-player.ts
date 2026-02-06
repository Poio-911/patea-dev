import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

async function deleteDuplicatePlayer(playerId: string) {
    const db = getFirestore();
    console.log(`\n🗑️ Deleting Duplicate Player: ${playerId}`);

    const docRef = db.doc(`players/${playerId}`);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
        console.log('❌ Player not found.');
        return;
    }

    const data = docSnap.data();
    console.log(`   Name: ${data?.name}`);
    console.log(`   Owner: ${data?.ownerUid}`);
    console.log(`   Is Real?: ${data?.id === data?.ownerUid}`);

    if (data?.id === data?.ownerUid) {
        console.error('⚠️ SAFETY CHECK TRIGGERED: Attempting to delete a REAL user profile. Aborting.');
        return;
    }

    await docRef.delete();
    console.log('✅ Player deleted successfully.');
}

const targetId = process.argv[2] || 'SEfHvCyLMPFGd5gn7EKq';
deleteDuplicatePlayer(targetId).catch(console.error);
