const { config } = require('dotenv');
const { join } = require('path');

// Load env before other imports
config({ path: join(process.cwd(), '.env.local') });
if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'mil-disculpis.appspot.com';
}

// Now we can require the action
const { advanceCupWinnerAction } = require('../src/lib/actions/server-actions');

async function fixCup() {
    const cupId = 'LTZECrLjILPRNg8YlQw5';
    const finalMatchId = 'v8dwptMZ8xEJcgFNg5n5';
    const winnerId = 'Bke4AjETAM63KK2iU2p0'; // Mezcla Gruesa

    console.log(`Fixing Cup ${cupId}...`);
    try {
        const result = await advanceCupWinnerAction(cupId, finalMatchId, winnerId);
        console.log('Result:', result);
        if (result.success) {
            console.log('✅ Cup fixed successfully.');
        } else {
            console.error('❌ Failed to fix cup:', result.error);
        }
    } catch (e) {
        console.error('Crashed while fixing cup:', e);
    }
}

fixCup().then(() => process.exit(0));
