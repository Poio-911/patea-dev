import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!getApps().length) initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const uid = 'qrVOXyawztZBtTg7i6md6Opbt5H2'; // briseida@test.com
const u = await db.collection('users').doc(uid).get();
const d = u.data() || {};
console.log('activeGroupId:', d.activeGroupId ?? '(ninguno)');
console.log('campo groups  :', JSON.stringify(d.groups ?? null));

const gs = await db.collection('groups').where('members', 'array-contains', uid).get();
console.log(`grupos donde es miembro: ${gs.size}`);
for (const g of gs.docs) {
  const players = await db.collection('players').where('groupId', '==', g.id).get();
  const matches = await db.collection('matches').where('groupId', '==', g.id).get();
  console.log(`  ${g.id}  "${g.data().name}"  jugadores=${players.size} partidos=${matches.size}`);
}
const orphanP = await db.collection('players').get();
const noGroup = orphanP.docs.filter(p => !p.data().groupId).length;
console.log(`total jugadores en la base: ${orphanP.size} (sin groupId: ${noGroup})`);
