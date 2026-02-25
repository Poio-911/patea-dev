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

async function dumpMatch(matchId: string) {
    const db = getAdminDb();
    const matchDoc = await db.collection('matches').doc(matchId).get();
    if (!matchDoc.exists) {
        console.error('Match not found');
        return;
    }
    console.log(JSON.stringify(matchDoc.data(), null, 2));
}

const matchId = process.argv[2] || 'I3OjfKZv3hoRFSP5q0ce';
dumpMatch(matchId).catch(console.error);
