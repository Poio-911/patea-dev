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

async function updateCompetitionOwner() {
    console.log('🔧 Updating competition owner to cosme@test.com\n');

    try {
        // Find cosme@test.com user
        const usersSnap = await db.collection('users')
            .where('email', '==', 'cosme@test.com')
            .limit(1)
            .get();

        if (usersSnap.empty) {
            console.error('❌ User cosme@test.com not found!');
            return;
        }

        const cosmeUser = { id: usersSnap.docs[0].id, ...usersSnap.docs[0].data() } as any;
        console.log(`✅ Found user: ${cosmeUser.email} (${cosmeUser.id})`);

        // Update all cups
        const cupsSnap = await db.collection('cups').get();
        console.log(`\n📋 Updating ${cupsSnap.size} cups...`);

        for (const doc of cupsSnap.docs) {
            await doc.ref.update({ ownerUid: cosmeUser.id });
            console.log(`   ✅ Updated cup: ${doc.id}`);
        }

        // Update all leagues
        const leaguesSnap = await db.collection('leagues').get();
        console.log(`\n📋 Updating ${leaguesSnap.size} leagues...`);

        for (const doc of leaguesSnap.docs) {
            await doc.ref.update({ ownerUid: cosmeUser.id });
            console.log(`   ✅ Updated league: ${doc.id}`);
        }

        // Update all matches
        const matchesSnap = await db.collection('matches').get();
        console.log(`\n📋 Updating ${matchesSnap.size} matches...`);

        for (const doc of matchesSnap.docs) {
            await doc.ref.update({ ownerUid: cosmeUser.id });
            console.log(`   ✅ Updated match: ${doc.id}`);
        }

        console.log('\n✅ All competitions and matches updated successfully!');

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

updateCompetitionOwner()
    .then(() => {
        console.log('\nScript completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
