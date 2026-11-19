/** Dry run by default. --apply fills the per-match ledger and reconciles each
 * series without overwriting favorites/hidden. Safe with the live trigger. */
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { resultForMatch, pairDocId } from '../functions/src/lib/team-rivals';
import { recordTeamMatchResult, reconcileRivalPair } from '../functions/src/lib/team-rivals-store';

export async function runBackfill(db: FirebaseFirestore.Firestore, apply = false) {
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined, matches = 0, skipped = 0, counted = 0;
  const pairs = new Map<string, [string, string]>();
  do {
    let query = db.collection('matches').where('type', '==', 'intergroup_friendly').orderBy(FieldPath.documentId()).limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (const doc of page.docs) {
      const result = resultForMatch(doc.data());
      if (!result) { skipped++; continue; }
      matches++; pairs.set(pairDocId(result.teamIds[0], result.teamIds[1]), result.teamIds as [string, string]);
      if (apply && (await recordTeamMatchResult(db, doc.id)).counted) counted++;
    }
    cursor = page.docs[page.size - 1];
  } while (cursor);
  if (apply) for (const [a, b] of pairs.values()) await reconcileRivalPair(db, a, b);
  console.log(JSON.stringify({mode: apply ? 'apply' : 'dry-run', matches, pairs: pairs.size, skipped, newlyCounted: counted}));
}
if (require.main === module) {
  config({path: '.env.local'});
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!getApps().length) initializeApp({projectId: process.env.GCLOUD_PROJECT ?? 'mil-disculpis', credential: sa ? cert(JSON.parse(sa)) : applicationDefault()});
  runBackfill(getFirestore(), process.argv.includes('--apply')).catch(error => { console.error(error.message); process.exitCode = 1; });
}
