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

async function checkDatabase() {
    console.log('🔍 Checking database state...\n');

    // Check players
    const playersSnap = await db.collection('players').limit(20).get();
    console.log(`📊 Players: ${playersSnap.size}`);
    if (playersSnap.size > 0) {
        const groupIds = new Set();
        playersSnap.docs.forEach(d => {
            const p = d.data();
            groupIds.add(p.groupId);
            console.log(`   - ${p.name} (Group: ${p.groupId})`);
        });
        console.log(`\n   Unique groups: ${groupIds.size}`);
    }

    // Check groups
    const groupsSnap = await db.collection('groups').get();
    console.log(`\n📊 Groups: ${groupsSnap.size}`);
    groupsSnap.docs.forEach(d => {
        const g = d.data();
        console.log(`   - ${g.name} (${d.id})`);
    });

    // Check teams
    const teamsSnap = await db.collection('teams').get();
    console.log(`\n📊 Teams: ${teamsSnap.size}`);

    // Check cups
    const cupsSnap = await db.collection('cups').get();
    console.log(`\n📊 Cups: ${cupsSnap.size}`);

    // Check leagues
    const leaguesSnap = await db.collection('leagues').get();
    console.log(`\n📊 Leagues: ${leaguesSnap.size}`);
}

checkDatabase()
    .then(() => {
        console.log('\n✅ Check complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
