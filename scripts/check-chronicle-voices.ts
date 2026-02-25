
import { getAdminDb } from '../src/firebase/admin-init';

async function checkChronicle(matchId: string) {
    const db = getAdminDb();
    const matchSnap = await db.collection('matches').doc(matchId).get();

    if (!matchSnap.exists) {
        console.error('Match not found');
        return;
    }

    const matchData = matchSnap.data();
    const chronicle = matchData?.chronicle;

    if (!chronicle) {
        console.log('No chronicle found for this match.');
        return;
    }

    console.log(`Headline: ${chronicle.headline}`);
    console.log(`Number of voices: ${chronicle.playerVoices?.length || 0}`);

    if (chronicle.playerVoices) {
        chronicle.playerVoices.forEach((v: any, i: number) => {
            console.log(`${i + 1}. ${v.playerName}: ${v.quote.substring(0, 30)}...`);
        });
    }
}

checkChronicle('qV658LXdVOgmtt4HKkEe');
