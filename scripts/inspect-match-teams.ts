import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

const matchId = 'H8ovfidUvjeukCYNwvER';

async function inspectMatch() {
    const db = getFirestore();
    const doc = await db.collection('matches').doc(matchId).get();

    if (!doc.exists) {
        console.log('Match not found');
        return;
    }

    const data = doc.data() as any;
    console.log('Match Status:', data.status);
    console.log('Final Score:', data.finalScore);
    console.log('MVP:', data.mvp); // Check if MVP exists on match doc

    if (data.teams) {
        console.log('Teams count:', data.teams.length);
        data.teams.forEach((t: any, i: number) => {
            console.log(`Team ${i} (${t.name}):`);
            if (t.players) {
                console.log(`  Players array length: ${t.players.length}`);
                if (t.players.length > 0) {
                    console.log('  Player 0:', t.players[0]);
                }
            } else {
                console.log('  ❌ Players field is MISSING/UNDEFINED');
            }
        });
    } else {
        console.log('❌ Teams field is MISSING');
    }
}

inspectMatch().catch(console.error);
