/**
 * Backfill del campo `geohash` en `availablePlayers`.
 *
 * `getAvailableLocalPlayers` ahora consulta por rangos de geohash en vez de
 * escanear la colección entera. Los documentos escritos antes de ese cambio no
 * tienen el campo y quedarían fuera del índice, así que hay que rellenarlos una
 * vez. Los nuevos ya lo escriben solos (functions/src/callable/explore.ts).
 *
 * Uso:
 *   npx tsx scripts/backfill-geohash.ts           # muestra qué haría
 *   npx tsx scripts/backfill-geohash.ts --apply   # escribe
 */

import { geohashForLocation } from 'geofire-common';
import { adminDb } from '../src/firebase/admin-init';

const APPLY = process.argv.includes('--apply');

async function main() {
  const snap = await adminDb.collection('availablePlayers').get();
  console.log(`Documentos en availablePlayers: ${snap.size}`);

  let missing = 0;
  let skippedNoLocation = 0;
  let alreadyOk = 0;
  const writes: { id: string; geohash: string }[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const lat = data.location?.lat;
    const lng = data.location?.lng;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      skippedNoLocation++;
      continue;
    }
    if (typeof data.geohash === 'string' && data.geohash.length > 0) {
      alreadyOk++;
      continue;
    }

    missing++;
    writes.push({ id: doc.id, geohash: geohashForLocation([lat, lng]) });
  }

  console.log(`  ya tienen geohash: ${alreadyOk}`);
  console.log(`  sin ubicación (se ignoran): ${skippedNoLocation}`);
  console.log(`  a rellenar: ${missing}`);

  if (!APPLY) {
    console.log('\nModo simulación. Volvé a correr con --apply para escribir.');
    return;
  }

  // Lotes de 500, el límite de un batch de Firestore.
  for (let i = 0; i < writes.length; i += 500) {
    const batch = adminDb.batch();
    writes.slice(i, i + 500).forEach(({ id, geohash }) => {
      batch.set(adminDb.collection('availablePlayers').doc(id), { geohash }, { merge: true });
    });
    await batch.commit();
    console.log(`  escritos ${Math.min(i + 500, writes.length)}/${writes.length}`);
  }

  console.log('Listo.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
