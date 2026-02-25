
import { getAdminDb } from '../src/firebase/admin-init';
import { generateMatchChronicleAction } from '../src/lib/actions/server-actions';

async function regenerate(matchId: string) {
    console.log(`Regenerating chronicle for match ${matchId}...`);
    const result = await generateMatchChronicleAction(matchId);

    if (result.error) {
        console.error(`Error: ${result.error}`);
        return;
    }

    const chronicle = result.data;
    if (!chronicle) {
        console.error('No data returned.');
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

regenerate('qV658LXdVOgmtt4HKkEe');
