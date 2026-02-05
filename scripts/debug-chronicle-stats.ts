import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

async function debugChronicleStats(matchId: string) {
    const db = getFirestore();
    console.log(`\n🔍 DEBUGGING STATS FOR MATCH: ${matchId}`);

    // 1. Fetch Match
    const matchRef = db.doc(`matches/${matchId}`);
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) {
        console.log('❌ Match not found');
        return;
    }
    const match = { id: matchSnap.id, ...matchSnap.data() } as any;
    console.log(`   Title: ${match.title}`);
    console.log(`   FinalScore in DB: ${JSON.stringify(match.finalScore)}`);

    // 2. Fetch Self-Evaluations
    const selfEvalsSnap = await db.collection(`matches/${matchId}/selfEvaluations`).get();
    const selfEvaluations = selfEvalsSnap.docs.map(d => d.data());
    console.log(`   SelfEvaluations found: ${selfEvaluations.length}`);

    const subGoalsByPlayer: Record<string, number> = {};

    if (selfEvaluations.length > 0) {
        console.log('   ✅ Using SelfEvaluations for Score');
        selfEvaluations.forEach((ev: any) => {
            subGoalsByPlayer[ev.playerId] = (subGoalsByPlayer[ev.playerId] || 0) + ev.goals;
        });
    } else {
        console.log('   ⚠️ No SelfEvaluations. Checking processedSubmissions...');
        const procSnap = await db.collection(`matches/${matchId}/processedSubmissions`).get();
        console.log(`   Processed submissions found: ${procSnap.size}`);

        if (procSnap.size > 0) {
            procSnap.forEach(doc => {
                const data = doc.data();
                if (data.submission?.evaluatorGoals) {
                    subGoalsByPlayer[data.evaluatorId] = data.submission.evaluatorGoals;
                }
            });
        } else {
            console.log('   ⚠️ No Processed. Checking pending evaluationSubmissions...');
            const submissionsSnap = await db.collection('evaluationSubmissions')
                .where('matchId', '==', matchId).get();
            console.log(`   Pending submissions found: ${submissionsSnap.size}`);

            submissionsSnap.forEach(doc => {
                const data = doc.data();
                if (data.submission?.evaluatorGoals) {
                    subGoalsByPlayer[data.evaluatorId] = data.submission.evaluatorGoals;
                }
            });
        }
    }

    let t1 = 0;
    let t2 = 0;

    if (match.teams && match.teams.length >= 2) {
        match.teams[0].players.forEach((p: any) => {
            const goals = subGoalsByPlayer[p.uid] || 0;
            if (goals > 0) console.log(`      T1: ${p.displayName} -> ${goals} goals`);
            t1 += goals;
        });
        match.teams[1].players.forEach((p: any) => {
            const goals = subGoalsByPlayer[p.uid] || 0;
            if (goals > 0) console.log(`      T2: ${p.displayName} -> ${goals} goals`);
            t2 += goals;
        });
    }

    console.log(`\n📊 CALCULATED SCORE: ${t1} - ${t2}`);
    console.log('════════════════════════════════════════════════════════════');
}

const matchId = process.argv[2] || 'In3uDPSg0YGuBrVAPRfv';
debugChronicleStats(matchId).catch(console.error);
