import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

async function checkMatch(matchId: string) {
    const db = getFirestore();

    const matchDoc = await db.doc(`matches/${matchId}`).get();
    if (!matchDoc.exists) {
        console.log('❌ Match not found');
        return;
    }

    const match = { id: matchDoc.id, ...matchDoc.data() } as any;

    console.log('\n📋 MATCH INFO');
    console.log('═'.repeat(60));
    console.log(`ID: ${matchId}`);
    console.log(`Title: ${match.title}`);
    console.log(`Status: ${match.status}`);
    console.log(`Players: ${match.playerUids?.length || 0}`);
    console.log(`Teams: ${match.teams?.length || 0}`);
    console.log('');

    if (match.status === 'upcoming') {
        console.log('⚠️  Match is UPCOMING');
        console.log('   To seed evaluations, the match needs to be COMPLETED first.');
        console.log('');
        console.log('   Options:');
        console.log('   1. Finalize the match from the UI (click "Finalizar Partido")');
        console.log('   2. Or use a different match that is already completed');
        console.log('');
    } else if (match.status === 'completed') {
        const assignmentsSnap = await db.collection(`matches/${matchId}/assignments`).get();
        console.log(`✅ Match is COMPLETED`);
        console.log(`   Assignments: ${assignmentsSnap.size}`);
        console.log('');
        console.log('   Ready to seed evaluations!');
        console.log(`   Run: npx tsx scripts/seed-evaluations.ts ${matchId}`);
        console.log('');
    } else if (match.status === 'evaluated') {
        console.log('⚠️  Match is already EVALUATED');
        console.log('   Evaluations have already been finalized.');
        console.log('');
    }

    console.log('═'.repeat(60));
}

const matchId = process.argv[2] || 'WBm27E7Whk42gvZJWqcJ';
checkMatch(matchId).finally(() => process.exit(0));
