
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

async function inspectInterGroupMatch() {
    console.log('Searching for match "Mezcla Gruesa vs 19 de Abril"...');
    const matchesSnap = await db.collection('matches')
        .where('title', '==', 'Mezcla Gruesa vs 19 de Abril')
        .get();

    if (matchesSnap.empty) {
        console.log('Match not found.');
        return;
    }

    const matchDoc = matchesSnap.docs[0];
    const match = matchDoc.data();

    console.log(`Match ID: ${matchDoc.id}`);
    console.log(`Type: ${match.type}`); // Expecting 'intergroup_friendly'
    console.log(`Title: ${match.title}`);

    console.log('\n--- Teams ---');
    if (match.teams && Array.isArray(match.teams)) {
        console.log(`Teams count: ${match.teams.length}`);
        match.teams.forEach((team: any, index: number) => {
            console.log(`Team ${index + 1}: ${team.name}`);
            console.log(`  Jersey:`, team.jersey);
            console.log(`  Players count: ${team.players?.length || 0}`);
            if (team.players?.length > 0) {
                console.log(`  First player: ${team.players[0].displayName} (${team.players[0].uid})`);
            }
        });
    } else {
        console.log('No teams array found or invalid.');
    }

    console.log('\n--- Match Players (Flat List) ---');
    if (match.players && Array.isArray(match.players)) {
        console.log(`Players array count: ${match.players.length}`);
    } else {
        console.log('No match.players array found.');
    }
}

inspectInterGroupMatch().catch(console.error);
