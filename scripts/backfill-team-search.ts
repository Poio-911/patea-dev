/**
 * Backfill de `nameLower` y `searchTokens` en `teams`.
 *
 * El buscador de rivales (`searchTeams`) consulta por `searchTokens`. Los
 * equipos creados después de este cambio ya los tienen (los escribe
 * `createTeam` / `updateTeam` y, para cualquier otro origen, el trigger
 * `onTeamWrite`), pero los que existían antes no aparecen en la búsqueda hasta
 * que se les rellena una vez.
 *
 * No hace falta si el trigger `onTeamWrite` ya está desplegado y se toca cada
 * equipo, pero esto lo hace de una sola vez y avisa cuántos faltaban.
 *
 * Uso:
 *   npx tsx scripts/backfill-team-search.ts           # muestra qué haría
 *   npx tsx scripts/backfill-team-search.ts --apply   # escribe
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';
import {
  buildTeamSearchTokens,
  normalizeSearchText,
} from '../functions/src/lib/team-search';

config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
if (!getApps().length) initializeApp({ credential: cert(sa), projectId: sa.project_id });
const adminDb = getFirestore();

const APPLY = process.argv.includes('--apply');

async function main() {
  const snap = await adminDb.collection('teams').get();
  console.log(`Equipos: ${snap.size}`);

  let alreadyOk = 0;
  let withoutName = 0;
  const writes: { id: string; nameLower: string; searchTokens: string[] }[] = [];

  for (const doc of snap.docs) {
    const name = doc.data().name;
    if (typeof name !== 'string' || !name.trim()) {
      withoutName++;
      continue;
    }
    const nameLower = normalizeSearchText(name);
    const searchTokens = buildTeamSearchTokens(name);
    const data = doc.data();
    const current: unknown = data.searchTokens;
    const upToDate =
      data.nameLower === nameLower &&
      Array.isArray(current) &&
      current.length === searchTokens.length &&
      searchTokens.every((t) => current.includes(t));
    if (upToDate) {
      alreadyOk++;
      continue;
    }
    writes.push({ id: doc.id, nameLower, searchTokens });
  }

  console.log(`  ya indexados: ${alreadyOk}`);
  console.log(`  sin nombre (se ignoran): ${withoutName}`);
  console.log(`  a rellenar: ${writes.length}`);

  if (!APPLY) {
    console.log('\nModo simulación. Volvé a correr con --apply para escribir.');
    return;
  }

  for (let i = 0; i < writes.length; i += 400) {
    const batch = adminDb.batch();
    for (const w of writes.slice(i, i + 400)) {
      batch.update(adminDb.collection('teams').doc(w.id), {
        nameLower: w.nameLower,
        searchTokens: w.searchTokens,
      });
    }
    await batch.commit();
    console.log(`  escritos ${Math.min(i + 400, writes.length)} / ${writes.length}`);
  }
  console.log('Listo.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
