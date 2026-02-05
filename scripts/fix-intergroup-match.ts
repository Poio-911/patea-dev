
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (getApps().length === 0) {
    initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')),
    });
}

const db = getFirestore();

async function fixInterGroupMatch() {
    const matchId = 'GPq83rcY7Bruse6NJTNs'; // ID from inspection
    console.log(`Fetching match ${matchId}...`);

    const matchRef = db.collection('matches').doc(matchId);
    const matchSnap = await matchRef.get();

    if (!matchSnap.exists) {
        console.error('Match not found!');
        return;
    }

    const matchData = matchSnap.data() as any;
    console.log(`Found match: ${matchData.title}`);

    const teamIds = matchData.participantTeamIds;
    if (!teamIds || teamIds.length !== 2) {
        console.error('Match explicitly requires 2 participantTeamIds.', teamIds);
        return;
    }

    console.log(`Fetching teams: ${teamIds.join(', ')}`);
    const teamsRefs = teamIds.map((id: string) => db.doc(`teams/${id}`));
    const teamsSnaps = await db.getAll(...teamsRefs);

    const teamDocs = teamsSnaps.map(snap => ({ id: snap.id, ...snap.data() } as any));
    const missingTeams = teamDocs.filter(t => !t.name); // primitive check
    if (missingTeams.length > 0) {
        console.error('Some teams were not found.');
        return;
    }

    // Collect all unique player IDs from both teams
    const allPlayerIds = new Set<string>();
    teamDocs.forEach(team => {
        const members = team.members || [];
        members.forEach((m: any) => allPlayerIds.add(m.playerId));
    });

    console.log(`Total unique players to fetch: ${allPlayerIds.size}`);

    // Fetch players in chunks
    const playerIds = Array.from(allPlayerIds);
    const playersMap = new Map<string, any>();
    const chunkSize = 10;

    for (let i = 0; i < playerIds.length; i += chunkSize) {
        const chunk = playerIds.slice(i, i + chunkSize);
        const chunkSnaps = await db.collection('players').where('__name__', 'in', chunk).get();
        chunkSnaps.forEach(doc => {
            playersMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
    }

    // Construct match.teams
    const finalTeams = teamDocs.map(td => {
        const teamDetails = {
            id: td.id,
            name: td.name,
            jersey: td.jersey,
            players: [] as any[],
            totalOVR: 0,
            averageOVR: 0
        };

        const members = td.members || [];
        teamDetails.players = members.map((m: any) => {
            const profile = playersMap.get(m.playerId);
            return {
                uid: m.playerId,
                displayName: profile?.name || 'Jugador',
                ovr: profile?.ovr || 50,
                position: profile?.position || 'MED',
                photoURL: profile?.photoURL || (profile as any)?.photoUrl || '',
            };
        });

        const totalOVR = teamDetails.players.reduce((sum, p) => sum + p.ovr, 0);
        teamDetails.totalOVR = totalOVR;
        teamDetails.averageOVR = teamDetails.players.length ? Math.round(totalOVR / teamDetails.players.length) : 0;

        return teamDetails;
    });

    // Construct flat match.players and match.playerUids
    const finalPlayers = finalTeams.flatMap(t => t.players);
    const finalPlayerUids = finalPlayers.map(p => p.uid);

    console.log(`Constructed data:`);
    console.log(`- Teams: ${finalTeams.length}`);
    console.log(`- Players: ${finalPlayers.length}`);
    console.log(`- Team 1: ${finalTeams[0].name} (${finalTeams[0].players.length} players)`);
    console.log(`- Team 2: ${finalTeams[1].name} (${finalTeams[1].players.length} players)`);

    // Update match
    await matchRef.update({
        teams: finalTeams,
        players: finalPlayers,
        playerUids: finalPlayerUids,
        matchSize: finalPlayers.length // Update matchSize to reflect actual roster? Or keep 22 cap?
        // Keeping matchSize as is or updating? Usually matchSize is the cap.
        // But for by_teams, matchSize is sum of players.
        // server-actions set matchSize: 22. 
        // I'll update matchSize to be accurate to prevent "0/22" if 22 is arbitrary.
        // Actually creating/route.ts sets matchSize to sum of players for by_teams.
    });

    // Also update matchSize
    await matchRef.update({ matchSize: finalPlayers.length });

    console.log('Match updated successfully!');
}

fixInterGroupMatch().catch(console.error);
