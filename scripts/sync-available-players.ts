import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getAdminDb } from '../src/firebase/admin-init';

async function sync() {
  const db = getAdminDb();
  const snap = await db.collection('availablePlayers').get();
  console.log(`Checking ${snap.size} available players...`);

  for (const doc of snap.docs) {
    const data = doc.data();
    const pSnap = await db.collection('players').doc(doc.id).get();
    const uSnap = await db.collection('users').doc(doc.id).get();

    const pData = pSnap.exists ? pSnap.data() : null;
    const uData = uSnap.exists ? uSnap.data() : null;

    const currentPhoto = pData?.photoURL || pData?.photoUrl || uData?.photoURL || '';
    const currentName = pData?.name || uData?.displayName || data.displayName || '';
    const currentOvr = pData?.ovr ?? data.ovr ?? 50;
    const currentPos = pData?.position || data.position || 'MED';

    console.log(`Player [${doc.id}]: ${data.displayName} -> ${currentName}`);
    console.log(`  Old photo: ${data.photoURL || data.photoUrl}`);
    console.log(`  New photo: ${currentPhoto}`);
    console.log(`  Old OVR: ${data.ovr}, New OVR: ${currentOvr}`);
    console.log(`  Old Pos: ${data.position}, New Pos: ${currentPos}`);

    await doc.ref.set(
      {
        displayName: currentName,
        photoURL: currentPhoto,
        photoUrl: currentPhoto,
        ovr: currentOvr,
        position: currentPos,
      },
      { merge: true }
    );
  }
  console.log('Sync complete!');
}

sync().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
