import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

async function inspectMatch(matchId: string) {
    const db = getFirestore();

    const matchDoc = await db.doc(`matches/${matchId}`).get();
    if (!matchDoc.exists) {
        console.log('❌ Match not found');
        return;
    }

    const match = matchDoc.data();

    console.log('\n🔍 MATCH STRUCTURE INSPECTION');
    console.log('═'.repeat(60));
    console.log(`Match ID: ${matchId}\n`);

    console.log('📋 Match.teams structure:');
    console.log(JSON.stringify(match?.teams, null, 2));

    console.log('\n📋 Match.playerUids:');
    console.log(JSON.stringify(match?.playerUids, null, 2));

    console.log('\n📋 Sample team player structure:');
    if (match?.teams && match.teams.length > 0 && match.teams[0].players && match.teams[0].players.length > 0) {
        console.log('First player in first team:');
        console.log(JSON.stringify(match.teams[0].players[0], null, 2));
    }

    console.log('\n═'.repeat(60));
}

const matchId = process.argv[2] || 'WBm27E7Whk42gvZJWqcJ';
inspectMatch(matchId).finally(() => process.exit(0));
