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

async function listCollections() {
    const db = getAdminDb();
    const collections = await db.listCollections();
    console.log('Collections:');
    collections.forEach(c => console.log(`- ${c.id}`));
}

listCollections().catch(console.error);
