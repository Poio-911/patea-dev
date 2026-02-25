import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

import { getAdminDb } from '../src/firebase/admin-init';

async function analyzeEvaluations(matchId: string) {
    const db = getAdminDb();
    const matchDoc = await db.collection('matches').doc(matchId).get();
    if (!matchDoc.exists) {
        console.log('Match not found');
        return;
    }

    const match = matchDoc.data()!;
    const players = match.players || [];
    const playerMap = new Map();
    players.forEach((p: any) => playerMap.set(p.uid, p.displayName));

    console.log(`Match: ${match.title}`);
    console.log(`Total players in match document: ${players.length}`);

    const assignmentsSnap = await db.collection('matches').doc(matchId).collection('assignments').get();
    console.log(`Total assignments found: ${assignmentsSnap.size}`);

    const evaluatorMap = new Map();
    assignmentsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (!evaluatorMap.has(data.evaluatorId)) {
            evaluatorMap.set(data.evaluatorId, []);
        }
        evaluatorMap.get(data.evaluatorId).push(data.subjectId);
    });

    console.log(`\nUnique Evaluators in Assignments (${evaluatorMap.size}):`);
    for (const [evalId, subjects] of evaluatorMap.entries()) {
        const evalName = playerMap.get(evalId) || evalId;
        const subjectNames = subjects.map((sid: string) => playerMap.get(sid) || sid);
        console.log(`- ${evalName} (${evalId}) evaluating: ${subjectNames.join(', ')}`);
    }

    console.log('\nPlayers in Match:');
    players.forEach((p: any) => {
        const hasAssignments = evaluatorMap.has(p.uid);
        console.log(`- ${p.displayName} (${p.uid}) [Evaluator: ${hasAssignments ? 'YES' : 'NO'}]`);
    });
}

const matchId = process.argv[2] || 'I3OjfKZv3hoRFSP5q0ce';
analyzeEvaluations(matchId).catch(console.error);
