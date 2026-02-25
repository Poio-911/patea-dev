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

async function analyzeAssignmentLogic(matchId: string) {
    const db = getAdminDb();
    const matchDoc = await db.collection('matches').doc(matchId).get();
    if (!matchDoc.exists) return;

    const match = matchDoc.data()!;
    const playerToTeam = new Map();
    const playerNames = new Map();

    if (match.teams) {
        match.teams.forEach((team: any) => {
            team.players.forEach((p: any) => {
                playerToTeam.set(p.uid, team.name);
                playerNames.set(p.uid, p.displayName);
            });
        });
    }

    const assignmentsSnapshot = await db.collection('matches').doc(matchId).collection('assignments').get();

    console.log(`Match: ${match.title} (${match.type})`);
    console.log(`Total assignments: ${assignmentsSnapshot.size}`);

    assignmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const evaluatorName = playerNames.get(data.evaluatorId) || data.evaluatorId;
        const subjectName = playerNames.get(data.subjectId) || data.subjectId;
        const evaluatorTeam = playerToTeam.get(data.evaluatorId);
        const subjectTeam = playerToTeam.get(data.subjectId);

        console.log(`- Evaluator: ${evaluatorName} (${evaluatorTeam}) -> Subject: ${subjectName} (${subjectTeam}) [${data.status}]`);
    });
}

const matchId = process.argv[2] || 'I3OjfKZv3hoRFSP5q0ce';
analyzeAssignmentLogic(matchId).catch(console.error);
