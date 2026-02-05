import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';
import { writeFileSync } from 'fs';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

const db = getFirestore();

async function showPlayerEvaluations(matchId: string, playerNameFragment: string) {
    console.log(`🔍 Searching for evaluations for player like "${playerNameFragment}" in match ${matchId}...\n`);

    const submissionsSnap = await db.collection('evaluationSubmissions')
        .where('matchId', '==', matchId)
        .get();

    if (submissionsSnap.empty) {
        console.log('❌ No submissions found.');
        return;
    }

    const submissions = submissionsSnap.docs.map(doc => doc.data());
    const allEvaluations: any[] = [];

    // Flatten nested evaluations
    submissions.forEach(sub => {
        const nestedEvals = sub.submission?.evaluations || [];
        nestedEvals.forEach((ev: any) => {
            allEvaluations.push({
                ...ev,
                evaluatorId: sub.evaluatorId,
                evaluatorName: sub.evaluatorSnapshot?.name || 'Unknown'
            });
        });
    });

    // Filter
    const myEvaluations = allEvaluations.filter(ev =>
        (ev.subjectSnapshot?.name?.toLowerCase().includes(playerNameFragment.toLowerCase())) ||
        (ev.subjectId === playerNameFragment)
    );

    if (myEvaluations.length === 0) {
        console.log(`❌ No evaluations found for subject matching "${playerNameFragment}".`);
        return;
    }

    console.log(`✅ Found ${myEvaluations.length} evaluations. Writing to JSON file...`);

    const outputReport = myEvaluations.map(ev => ({
        from: `${ev.evaluatorName} (ID: ${ev.evaluatorId})`,
        type: ev.evaluationType === 'tags' ? 'ETIQUETAS' : 'PUNTOS',
        tags: ev.performanceTags?.map((t: any) => t.name) || [],
        rating: ev.rating
    }));

    writeFileSync('evals_breakdown.json', JSON.stringify(outputReport, null, 2));
    console.log('✅ Wrote breakdown to evals_breakdown.json');
}

const matchId = process.argv[2] || '5zadAxLiwOQeYZvwNJIP';
const player = process.argv[3] || 'Alvaro';

showPlayerEvaluations(matchId, player).catch(console.error);
