import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { FeedEntry, matchFinishedFeedEntries, matchScheduledFeedEntries, ovrFeedEntry } from '../lib/feed';

/** Las escrituras son idempotentes (id fijo por hecho): un reintento no duplica la novedad. */
async function save(entries: FeedEntry[]) {
  if (entries.length === 0) return;
  const db = admin.firestore();
  const batch = db.batch();
  for (const entry of entries) batch.set(db.doc(`feedActivities/${entry.id}`), entry.data, { merge: false });
  await batch.commit();
}

/** Cambió el OVR de un jugador (la evaluación del partido escribe su historial). */
export const onOvrHistoryFeed = onDocumentCreated(
  { document: 'players/{playerId}/ovrHistory/{historyId}', region: 'us-central1' },
  async (event) => {
    const history = event.data?.data();
    if (!history) return;
    const { playerId, historyId } = event.params;
    const player = (await admin.firestore().doc(`players/${playerId}`).get()).data();
    const entry = ovrFeedEntry(playerId, historyId, player, history);
    if (entry) await save([entry]);
  },
);

/** Un partido se armó o terminó. */
export const onMatchFeed = onDocumentWritten(
  { document: 'matches/{matchId}', region: 'us-central1' },
  async (event) => {
    const after = event.data?.after.data();
    if (!after) return;
    const before = event.data?.before.data();
    const matchId = event.params.matchId;
    await save([
      ...matchScheduledFeedEntries(matchId, before, after),
      ...matchFinishedFeedEntries(matchId, before, after),
    ]);
  },
);
