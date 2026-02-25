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

async function listSubcollections(matchId: string) {
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);
    const subcollections = await matchRef.listCollections();
    console.log(`Subcollections for match ${matchId}:`);
    subcollections.forEach(c => console.log(`- ${c.id}`));
}

const matchId = process.argv[2] || 'I3OjfKZv3hoRFSP5q0ce';
listSubcollections(matchId).catch(console.error);
