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

async function listRecentMatches() {
    const db = getAdminDb();
    const snapshot = await db.collection('matches')
        .orderBy('date', 'desc')
        .limit(5)
        .get();

    console.log('Recent Matches:');
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`- ID: ${doc.id}`);
        console.log(`  Title: ${data.title}`);
        console.log(`  Type: ${data.type}`);
        console.log(`  Status: ${data.status}`);
        console.log(`  Date: ${data.date}`);
    });
}

listRecentMatches().catch(console.error);
