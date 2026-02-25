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

async function analyzeMatch(matchId: string) {
    console.log(`Analyzing match: ${matchId}`);

    const db = getAdminDb();
    const matchDoc = await db.collection('matches').doc(matchId).get();
    if (!matchDoc.exists) {
        console.error('Match not found');
        return;
    }

    const match = matchDoc.data()!;
    console.log(`Title: ${match.title}`);
    console.log(`Type: ${match.type}`);
    console.log(`Status: ${match.status}`);

    const evaluationsSnapshot = await db.collection('evaluations')
        .where('matchId', '==', matchId)
        .get();

    console.log(`Total evaluations found: ${evaluationsSnapshot.size}`);

    const playersMap = new Map();
    if (match.players) {
        match.players.forEach((p: any) => playersMap.set(p.uid, p.displayName));
    }

    evaluationsSnapshot.docs.forEach((doc, idx) => {
        const evalData = doc.data();
        const playerName = playersMap.get(evalData.playerId) || evalData.playerId;
        const evaluatorName = playersMap.get(evalData.evaluatorId) || evalData.evaluatorId;

        console.log(`\nEvaluation ${idx + 1}:`);
        console.log(`- Evaluator: ${evaluatorName}`);
        console.log(`- Player: ${playerName}`);
        console.log(`- Score: ${evalData.score}`);
        console.log(`- Points: ${evalData.points}`);
        console.log(`- Tags: ${evalData.tags?.join(', ') || 'None'}`);
        if (evalData.comment) {
            console.log(`- Comment: ${evalData.comment}`);
        }
    });
}

const matchId = process.argv[2] || 'I3OjfKZv3hoRFSP5q0ce';
analyzeMatch(matchId).catch(console.error);
