
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

const matchId = process.argv[2];
if (!matchId) {
    console.error('Please provide a match ID');
    process.exit(1);
}

async function inspect() {
    const db = getFirestore();
    console.log(`\n🔍 Inspecting AI Evaluations for match: ${matchId}\n`);

    const snapshot = await db.collection('evaluations')
        .where('matchId', '==', matchId)
        .get();

    let found = false;
    for (const doc of snapshot.docs) {
        const data = doc.data();
        // Check if it has text description or AI attributes (indicative of text/AI evaluation)
        if (data.textDescription || data.aiAttributeChanges) {
            found = true;
            const evaluator = await db.doc(`players/${data.evaluatorId}`).get();
            const subject = await db.doc(`players/${data.playerId}`).get();

            console.log(`📝 Evaluation: ${evaluator.data()?.name} -> ${subject.data()?.name}`);
            console.log(`   Description: "${data.textDescription}"`);
            if (data.aiSummary) console.log(`   AI Summary: "${data.aiSummary}"`);

            if (data.aiAttributeChanges && data.aiAttributeChanges.length > 0) {
                console.log('   AI Attribute Changes:');
                data.aiAttributeChanges.forEach((change: any) => {
                    const sign = change.change > 0 ? '+' : '';
                    console.log(`     • ${change.attribute.toUpperCase()}: ${sign}${change.change}`);
                });
            }
            console.log('──────────────────────────────────────────────────');
        }
    }

    if (!found) {
        console.log('No text/AI evaluations found for this match.');
    }
}

inspect().catch(console.error);
