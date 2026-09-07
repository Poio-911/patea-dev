import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getAdminDb } from '../src/firebase/admin-init';

async function test() {
  const db = getAdminDb();
  const doc = await db.collection('matches').doc('tXQWshCxEZkTY89hq16z').get();
  console.log(JSON.stringify(doc.data(), null, 2));
}
test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
