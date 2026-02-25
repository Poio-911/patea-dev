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

async function listEvals() {
    const db = getAdminDb();
    const snapshot = await db.collection('matchEvaluations').limit(5).get();
    console.log(`Sample evaluations: ${snapshot.size}`);
    snapshot.docs.forEach(doc => {
        console.log(`Document ID: ${doc.id}`);
        console.log(JSON.stringify(doc.data(), null, 2));
    });
}

listEvals().catch(console.error);
