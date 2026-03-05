import { advanceCupWinnerAction } from '../src/lib/actions/server-actions';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!getApps().length) initializeApp({ credential: cert(sa), projectId: sa.project_id });

async function runIt() {
    console.log('Running advanceCupWinnerAction...');
    try {
        const result = await advanceCupWinnerAction('LTZECrLjILPRNg8YlQw5', 'v8dwptMZ8xEJcgFNg5n5', 'Bke4AjETAM63KK2iU2p0');
        console.log('Result:', result);
    } catch (e) {
        console.error('Crash!', e);
    }
}
runIt();
