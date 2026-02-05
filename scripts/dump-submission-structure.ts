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

async function dumpFirstSubmission() {
    const snap = await db.collection('evaluationSubmissions').limit(1).get();
    if (snap.empty) {
        console.log('Collection is empty.');
    } else {
        const data = snap.docs[0].data();
        console.log('First Doc Top-Level Keys:', Object.keys(data));
        console.log('Match ID:', data.matchId);

        if (data.submission) {
            console.log('✅ Nested "submission" field found.');
            console.log('Keys inside submission:', Object.keys(data.submission));
            console.log('Submission Subject ID:', data.submission.subjectId);
            console.log('Submission Snapshot:', data.submission.subjectSnapshot ? 'Present' : 'Missing');
        } else {
            console.log('❌ Nested Check: No "submission" field.');
            console.log('Subject ID (Root):', data.subjectId);
        }
    }
}

dumpFirstSubmission().catch(console.error);
