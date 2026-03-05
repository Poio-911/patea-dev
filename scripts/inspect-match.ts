import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!getApps().length) initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

async function inspectMatch() {
    const matchId = 'v8dwptMZ8xEJcgFNg5n5';
    const matchSnap = await db.collection('matches').doc(matchId).get();
    const data = matchSnap.data();

    console.log(JSON.stringify({
        type: data?.type,
        leagueInfo: data?.leagueInfo,
        participantTeamIds: data?.participantTeamIds,
        winnerId: data?.winnerId
    }, null, 2));
}

inspectMatch().catch(console.error);
