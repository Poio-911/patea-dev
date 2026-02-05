import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

const db = getFirestore();

async function cleanSubmissions(matchId: string) {
    console.log(`🧹 Cleaning evaluation submissions for match: ${matchId}`);

    const submissionsSnap = await db.collection('evaluationSubmissions')
        .where('matchId', '==', matchId)
        .get();

    if (submissionsSnap.empty) {
        console.log('✅ No submissions found to delete.');
        return;
    }

    const batch = db.batch();
    submissionsSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`✅ Deleted ${submissionsSnap.size} submissions.`);
}

const matchId = process.argv[2] || 'qfpCyX5uXP7o8I3x4ULc';
cleanSubmissions(matchId).catch(console.error);
