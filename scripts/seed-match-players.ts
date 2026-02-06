import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

interface Player {
    id: string;
    name: string;
    position: string;
    ovr: number;
    photoURL?: string;
    groupId: string;
}

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

async function seedMatchPlayers(matchId: string) {
    const db = getFirestore();
    console.log(`\n⚽ Seeding players for Match ID: ${matchId}`);

    // 1. Get Match
    const matchRef = db.doc(`matches/${matchId}`);
    const matchDoc = await matchRef.get();

    if (!matchDoc.exists) {
        console.error('❌ Match not found!');
        return;
    }

    const matchData = matchDoc.data()!;
    const groupId = matchData.groupId;

    if (!groupId) {
        console.error('❌ Match has no groupId associated!');
        return;
    }

    console.log(`   Group ID: ${groupId}`);

    // 2. Get Players from Group
    const playersSnap = await db.collection('players')
        .where('groupId', '==', groupId)
        .get();

    const allPlayers: Player[] = playersSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().displayName || 'Unknown',
        position: doc.data().position || 'MED',
        ovr: doc.data().ovr || 50,
        photoURL: doc.data().photoURL || '',
        groupId: doc.data().groupId
    }));

    if (allPlayers.length < 10) {
        console.warn(`⚠️ Only found ${allPlayers.length} players in the group. Adding all of them.`);
    }

    // 3. Select 10 random players
    const selectedPlayers = shuffle(allPlayers).slice(0, 10);

    console.log(`   Selected ${selectedPlayers.length} players:`);
    selectedPlayers.forEach(p => console.log(`   - ${p.name} (${p.position})`));

    // 4. Update Match
    const simplifiedPlayers = selectedPlayers.map(p => ({
        uid: p.id,
        displayName: p.name,
        photoURL: p.photoURL || '',
        position: p.position,
        ovr: p.ovr
    }));

    const playerUids = selectedPlayers.map(p => p.id);

    // If it's "by_teams" or we want to pre-distribute for "collaborative" 5v5
    // Let's create two balanced teams just in case the UI expects 'teams' structure or user wants it.
    // Simple even/odd distribution for now.
    const team1Players = simplifiedPlayers.slice(0, 5);
    const team2Players = simplifiedPlayers.slice(5, 10);

    const team1 = {
        name: "Equipo 1",
        players: team1Players,
        totalOVR: team1Players.reduce((sum, p) => sum + p.ovr, 0),
        averageOVR: Math.round(team1Players.reduce((sum, p) => sum + p.ovr, 0) / 5)
    };

    const team2 = {
        name: "Equipo 2",
        players: team2Players,
        totalOVR: team2Players.reduce((sum, p) => sum + p.ovr, 0),
        averageOVR: Math.round(team2Players.reduce((sum, p) => sum + p.ovr, 0) / 5)
    };

    await matchRef.update({
        players: simplifiedPlayers,
        playerUids: playerUids,
        // Optional: Update teams if this was a team-based match or to facilitate manual mode
        // For a generic "anota 10 jugadores", filling the players list is the primary requirement.
        // We often set 'teams' even in manual/collaborative matches so the UI has something to show if switched.
        teams: [team1, team2],
        updatedAt: new Date().toISOString()
    });

    console.log('\n✅ Match updated successfully!');
    console.log('   Players have been added to the list.');
}

const matchId = process.argv[2];
if (!matchId) {
    console.error('Please provide a match ID');
    process.exit(1);
}

seedMatchPlayers(matchId).catch(console.error);
