import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

async function testMapping(matchId: string) {
    const db = getFirestore();

    const matchDoc = await db.doc(`matches/${matchId}`).get();
    if (!matchDoc.exists) {
        console.log('❌ Match not found');
        return;
    }

    const match = matchDoc.data();

    console.log('\n🔍 TESTING UID MAPPING');
    console.log('═'.repeat(60));

    // Get real player data
    const playerDocs = await Promise.all(
        match!.playerUids.map((uid: string) => db.doc(`players/${uid}`).get())
    );

    const realPlayers = playerDocs
        .filter(doc => doc.exists)
        .map(doc => ({ id: doc.id, ...doc.data() }));

    console.log('\n📋 Real Players (from playerUids):');
    realPlayers.forEach((p: any) => {
        console.log(`  ${p.id.substring(0, 8)}... - ${p.name} (${p.position})`);
    });

    console.log('\n📋 Team Players (from match.teams):');
    match!.teams.forEach((team: any) => {
        console.log(`\n  Team: ${team.name}`);
        team.players.forEach((p: any) => {
            console.log(`    ${p.uid} - ${p.displayName} (${p.position})`);

            // Try to find match
            const matchByName = realPlayers.find((rp: any) =>
                rp.name === p.displayName && rp.position === p.position
            );

            if (matchByName) {
                console.log(`      ✅ Match found: ${matchByName.id.substring(0, 8)}...`);
            } else {
                console.log(`      ❌ NO MATCH - trying fuzzy match...`);

                // Try case-insensitive
                const fuzzyMatch = realPlayers.find((rp: any) =>
                    rp.name.toLowerCase() === p.displayName.toLowerCase() &&
                    rp.position === p.position
                );

                if (fuzzyMatch) {
                    console.log(`      ⚠️  Fuzzy match: ${fuzzyMatch.id.substring(0, 8)}... (case difference)`);
                } else {
                    console.log(`      ❌ No fuzzy match either`);
                    console.log(`         Looking for: "${p.displayName}" (${p.position})`);
                    console.log(`         Available: ${realPlayers.map((rp: any) => `"${rp.name}"`).join(', ')}`);
                }
            }
        });
    });

    console.log('\n═'.repeat(60));
}

const matchId = process.argv[2] || 'WBm27E7Whk42gvZJWqcJ';
testMapping(matchId).finally(() => process.exit(0));
