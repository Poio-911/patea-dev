import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

/**
 * Fix UIDs in match.teams by mapping displayName+position to real player UIDs
 */
async function fixMatchTeamUIDs(matchId: string) {
    const db = getFirestore();

    console.log('\n🔧 FIXING MATCH TEAM UIDs');
    console.log('═'.repeat(60));
    console.log(`Match ID: ${matchId}\n`);

    const matchRef = db.doc(`matches/${matchId}`);
    const matchDoc = await matchRef.get();

    if (!matchDoc.exists) {
        console.log('❌ Match not found');
        return;
    }

    const match = matchDoc.data();

    // Get real player data
    const playerDocs = await Promise.all(
        match!.playerUids.map((uid: string) => db.doc(`players/${uid}`).get())
    );

    const realPlayers = playerDocs
        .filter(doc => doc.exists)
        .map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`📋 Found ${realPlayers.length} real players\n`);

    // Build photo map from real players
    const photoMap = new Map<string, string>();
    realPlayers.forEach((rp: any) => {
        photoMap.set(rp.id, rp.photoUrl || rp.photoURL || '');
    });

    // Fix UIDs and photos in teams
    let fixedCount = 0;
    const updatedTeams = match!.teams.map((team: any) => {
        const updatedPlayers = team.players.map((p: any) => {
            const realPlayer = realPlayers.find((rp: any) =>
                rp.name === p.displayName && rp.position === p.position
            ) || realPlayers.find((rp: any) => rp.name === p.displayName);

            if (realPlayer) {
                const photo = photoMap.get(realPlayer.id) || '';
                const needsUidFix = p.uid !== realPlayer.id;
                const needsPhotoFix = !p.photoURL && photo;

                if (needsUidFix || needsPhotoFix) {
                    if (needsUidFix) console.log(`  ✅ Fixed UID: ${p.displayName} (${p.uid} → ${realPlayer.id.substring(0, 8)}...)`);
                    if (needsPhotoFix) console.log(`  📷 Added photo: ${p.displayName}`);
                    fixedCount++;
                    return { ...p, uid: realPlayer.id, photoURL: photo };
                }
            }

            return p;
        });

        return { ...team, players: updatedPlayers };
    });

    if (fixedCount === 0) {
        console.log('✅ All UIDs and photos are already correct!\n');
        return;
    }

    console.log(`\n📝 Fixed ${fixedCount} player entries`);
    console.log('💾 Updating match document...\n');

    await matchRef.update({ teams: updatedTeams });

    console.log('✅ Match updated successfully!');
    console.log('═'.repeat(60));
}

const matchId = process.argv[2] || 'WBm27E7Whk42gvZJWqcJ';
fixMatchTeamUIDs(matchId).finally(() => process.exit(0));
