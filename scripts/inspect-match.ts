import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
if (!getApps().length) initializeApp({ credential: cert(sa as any), projectId: sa.project_id });
const db = getFirestore();
async function run() {
    const matchId = 'KQNVhxQco1fFAi9ioug0';
    const matchDoc = await db.collection('matches').doc(matchId).get();
    const match = matchDoc.data()!;
    console.log('=== STATUS:', match.status);
    console.log('=== TEAMS:');
    for (const team of match.teams || []) {
        console.log('  Team:', team.name, '|', team.id);
        for (const p of team.players) {
            console.log('    -', p.uid, '|', p.name || p.displayName, '| pos:', p.position, '| ovr:', p.ovr);
        }
    }
    console.log('\n=== FLAT PLAYERS:');
    for (const p of match.players || []) {
        console.log('  -', p.uid, '|', p.displayName || p.name, '| pos:', p.position, '| ovr:', p.ovr);
    }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
