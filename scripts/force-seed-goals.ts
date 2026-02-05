import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

async function forceSeedGoals(matchId: string) {
    const db = getFirestore();
    console.log(`\n🚀 FORCING GOALS FOR MATCH: ${matchId}`);

    // 1. Get processed submissions
    const procRef = db.collection(`matches/${matchId}/processedSubmissions`);
    const snap = await procRef.get();

    if (snap.empty) {
        console.log('❌ No processed submissions found. Seed them first.');
        return;
    }

    console.log(`   Updating ${snap.size} submissions...`);

    // Use the dummy IDs from the match teams
    const p1 = '1'; // Alvaro M.
    const p2 = '6'; // Player in other team

    const batch = db.batch();

    // We update the FIRST submission to have evaluatorId='1' and goals=2
    // and the SECOND submission to have evaluatorId='6' and goals=1
    let i = 0;
    snap.forEach(doc => {
        const updateData: any = {};
        if (i === 0) {
            updateData.evaluatorId = p1;
            updateData['submission.evaluatorGoals'] = 2;
        } else if (i === 1) {
            updateData.evaluatorId = p2;
            updateData['submission.evaluatorGoals'] = 1;
        } else {
            updateData['submission.evaluatorGoals'] = 0;
        }

        batch.update(doc.ref, updateData);
        i++;
    });

    await batch.commit();
    console.log(`   ✅ Updated submissions with dummy goals: ${p1}(2), ${p2}(1).`);
    console.log(`   Expected Score: 2 - 1`);
}

const matchId = process.argv[2] || 'In3uDPSg0YGuBrVAPRfv';
forceSeedGoals(matchId).catch(console.error);
