import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

const db = getFirestore();

async function inspectAssignments(matchId: string) {
    console.log(`\n🔍 Inspecting Assignments for Match: ${matchId}`);

    // 1. Get Match Info
    const matchDoc = await db.doc(`matches/${matchId}`).get();
    if (!matchDoc.exists) {
        console.log('❌ Match not found');
        return;
    }
    const match = matchDoc.data();
    console.log(`Title: ${match?.title}`);
    console.log(`Total Players: ${match?.playerUids?.length || 0}`);

    // 2. Get All Assignments
    const snapshot = await db.collection(`matches/${matchId}/assignments`).get();
    console.log(`Total Assignment Docs: ${snapshot.size}`);

    const assignments = snapshot.docs.map(d => d.data());

    // 3. Analyze Distribution
    const evaluatorCounts: Record<string, number> = {}; // How many people did X evaluate?
    const subjectCounts: Record<string, number> = {};    // How many people evaluated Y?

    assignments.forEach((a: any) => {
        // Count outgoing (Evaluator)
        evaluatorCounts[a.evaluatorId] = (evaluatorCounts[a.evaluatorId] || 0) + 1;

        // Count incoming (Subject)
        subjectCounts[a.subjectId] = (subjectCounts[a.subjectId] || 0) + 1;
    });

    // 4. Report
    console.log('\n📊 INCOMING EVALUATIONS (Subject Counts):');
    const allPlayerIds = match?.playerUids || [];

    // Sort by count asc
    const sortedSubjects = allPlayerIds.map((uid: string) => ({
        uid,
        count: subjectCounts[uid] || 0
    })).sort((a: any, b: any) => a.count - b.count);

    sortedSubjects.forEach((p: any) => {
        console.log(`   Player ${p.uid.substring(0, 10)}... : ${p.count} incoming evaluations`);
    });

    console.log('\n📊 OUTGOING EVALUATIONS (Evaluator Counts):');
    const sortedEvaluators = allPlayerIds.map((uid: string) => ({
        uid,
        count: evaluatorCounts[uid] || 0
    })).sort((a: any, b: any) => a.count - b.count);

    sortedEvaluators.forEach((p: any) => {
        console.log(`   Player ${p.uid.substring(0, 10)}... : ${p.count} outgoing evaluations`);
    });

    // Specific check for Alvaro M (SEfHvCyLMPFGd5gn7EKq)
    console.log('\n🕵️ Specific Check for SEfHvCyLMPFGd5gn7EKq (Alvaro M.):');
    console.log(`   Incoming Assignments: ${subjectCounts['SEfHvCyLMPFGd5gn7EKq'] || 0}`);
    console.log(`   Outgoing Assignments: ${evaluatorCounts['SEfHvCyLMPFGd5gn7EKq'] || 0}`);

    // Who is supposed to evaluate Alvaro?
    const evaluatorsForAlvaro = assignments.filter((a: any) => a.subjectId === 'SEfHvCyLMPFGd5gn7EKq');
    console.log(`   Evaluators assigned to Alvaro:`);

    for (const a of evaluatorsForAlvaro) {
        // Need to fetch player to check ownerUid
        const pDoc = await db.doc(`players/${a.evaluatorId}`).get();
        const p = pDoc.data();
        const isReal = p?.id === p?.ownerUid;
        console.log(`     - Evaluator ID: ${a.evaluatorId} (${p?.name}) | Real User? ${isReal} | Owner: ${p?.ownerUid}`);
    }

    // Check actual submissions
    console.log('\n   Checking Submissions containing Alvaro as subject...');
    // Submissions -> submission.evaluations -> array of { subjectId: ... }
    const submissionsSnap = await db.collection('evaluationSubmissions')
        .where('matchId', '==', matchId)
        .get();

    let foundCount = 0;
    submissionsSnap.docs.forEach(doc => {
        const data = doc.data();
        const evals = data.submission?.evaluations || [];
        const found = evals.find((e: any) => e.subjectId === 'SEfHvCyLMPFGd5gn7EKq');
        if (found) {
            console.log(`     ✅ Found in submission from ${data.evaluatorId} (${found.evaluationType})`);
            foundCount++;
        }
    });
    console.log(`   Total Submissions Received: ${foundCount}`);
    // Check for ID in playerUids
    const alvaroId = 'SEfHvCyLMPFGd5gn7EKq';
    console.log(`\n   Checking if Alvaro (${alvaroId}) is in match.playerUids:`);
    if (match?.playerUids?.includes(alvaroId)) {
        console.log('     ✅ YES, found in playerUids');
    } else {
        console.log('     ❌ NO, NOT found in playerUids (This explains why he wasn\'t evaluated!)');
    }

    // Inspect Fiorenzo's submission
    const fiorenzoId = 'N7GKXwOa4vVeap4emu23x8jn8wF2';
    console.log(`\n   Inspecting Fiorenzo's submission (${fiorenzoId})...`);
    const fSub = await db.collection('evaluationSubmissions')
        .where('matchId', '==', matchId)
        .where('evaluatorId', '==', fiorenzoId)
        .get();

    if (fSub.empty) {
        console.log('     ❌ No submission found for Fiorenzo');
    } else {
        const data = fSub.docs[0].data();
        console.log(`     ✅ Submission found. Evaluated Subjects:`);
        data.submission?.evaluations?.forEach((e: any) => {
            console.log(`        - ${e.displayName} (${e.subjectId})`);
        });
    }

}

const matchId = process.argv[2] || 'qfpCyX5uXP7o8I3x4ULc';
inspectAssignments(matchId).catch(console.error);
