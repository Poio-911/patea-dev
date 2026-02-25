import { getAdminDb } from '../src/firebase/admin-init';

async function checkMatch(matchId: string) {
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);
    const matchSnap = await matchRef.get();

    if (!matchSnap.exists) {
        console.error('Match not found');
        return;
    }

    const players = matchSnap.data()?.players || [];
    console.log(`Match ${matchId} has ${players.length} players:`);
    players.forEach((p: any) => console.log(`- ${p.uid}: ${p.displayName}`));
}

checkMatch('SXONApSnP1il2G3zGnJa');
