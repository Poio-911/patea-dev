import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

async function checkSubmissions(matchId: string) {
    const db = getFirestore();

    console.log('\n📊 EVALUATION SUBMISSIONS STATUS');
    console.log('═'.repeat(60));
    console.log(`Match ID: ${matchId}\n`);

    // Check submissions
    const submissions = await db.collection('evaluationSubmissions')
        .where('matchId', '==', matchId)
        .get();

    console.log(`📝 Pending Submissions: ${submissions.size}`);
    if (submissions.size > 0) {
        submissions.forEach(doc => {
            const data = doc.data();
            console.log(`   - ${data.submission?.evaluations?.length || 0} evaluations from evaluator`);
        });
    }
    console.log('');

    // Check processed submissions
    const processed = await db.collection(`matches/${matchId}/processedSubmissions`).get();
    console.log(`✅ Processed Submissions: ${processed.size}`);
    console.log('');

    // Check evaluations
    const assignments = await db.collection(`matches/${matchId}/assignments`).get();
    const completedAssignmentIds = assignments.docs
        .filter(a => a.data().status === 'completed')
        .map(a => a.id);

    if (completedAssignmentIds.length > 0) {
        const evaluations = await db.collection('evaluations')
            .where('assignmentId', 'in', completedAssignmentIds.slice(0, 10))
            .get();

        console.log(`📊 Evaluations Created: ${evaluations.size}`);

        const byType = { points: 0, tags: 0, text: 0 };
        evaluations.forEach(e => {
            const data = e.data();
            if (data.rating !== undefined) byType.points++;
            else if (data.performanceTags?.length > 0) byType.tags++;
            else if (data.aiAttributeChanges?.length > 0) byType.text++;
        });

        console.log(`   - Points: ${byType.points}`);
        console.log(`   - Tags: ${byType.tags}`);
        console.log(`   - Text/AI: ${byType.text}`);
    } else {
        console.log(`📊 Evaluations Created: 0`);
    }

    console.log('');
    console.log('═'.repeat(60));

    if (submissions.size > 0) {
        console.log('⏳ Submissions are pending processing (auto-processes every 15s)');
        console.log('   Wait a moment and run this script again to see progress');
    } else if (processed.size > 0) {
        console.log('✅ All submissions have been processed!');
        console.log('   You can now finalize evaluations from the organizer panel');
    } else {
        console.log('⚠️  No submissions found');
        console.log('   Run: npx tsx scripts/seed-evaluations.ts ' + matchId);
    }
    console.log('═'.repeat(60));
}

const matchId = process.argv[2] || 'WBm27E7Whk42gvZJWqcJ';
checkSubmissions(matchId).finally(() => process.exit(0));
