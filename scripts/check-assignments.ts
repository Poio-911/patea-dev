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

async function checkAssignments(matchId: string) {
    const db = getAdminDb();
    const snapshot = await db.collection('evaluationAssignments')
        .where('matchId', '==', matchId)
        .get();

    console.log(`Assignments for match ${matchId}: ${snapshot.size}`);
    snapshot.docs.forEach(doc => {
        console.log(`Document ID: ${doc.id}`);
        console.log(JSON.stringify(doc.data(), null, 2));
    });
}

const matchId = process.argv[2] || 'I3OjfKZv3hoRFSP5q0ce';
checkAssignments(matchId).catch(console.error);
