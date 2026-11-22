// Una sola vez, después de desplegar los triggers de Comunidad: arma las novedades
// de los últimos 30 días a partir de lo que ya pasó (cambios de OVR y partidos
// terminados), para que la comunidad no arranque vacía. Es idempotente: los ids
// son fijos por hecho, así que correrlo dos veces no duplica nada.
//   GOOGLE_CLOUD_PROJECT=... node functions/scripts/backfill-feed.js [--dry]
const admin = require('firebase-admin');
const feed = require('../lib/lib/feed');
admin.initializeApp();
const dry = process.argv.includes('--dry');
const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

(async () => {
  const db = admin.firestore();
  const entries = [];

  // Jugador por jugador: una consulta de grupo por `date` pediría un índice nuevo.
  const players = await db.collection('players').get();
  for (const player of players.docs) {
    const history = await player.ref.collection('ovrHistory').where('date', '>=', since).get();
    for (const doc of history.docs) {
      const entry = feed.ovrFeedEntry(player.id, doc.id, player.data(), doc.data());
      if (entry) entries.push({ ...entry, data: { ...entry.data, createdAt: doc.data().date } });
    }
  }

  const matches = await db.collection('matches').where('status', 'in', ['completed', 'evaluated']).get();
  for (const doc of matches.docs) {
    const m = doc.data();
    const when = typeof m.date === 'string' && m.date ? new Date(m.date).toISOString() : null;
    if (!when || when < since) continue;
    for (const entry of feed.matchFinishedFeedEntries(doc.id, undefined, { ...m, status: 'completed' })) {
      entries.push({ ...entry, data: { ...entry.data, createdAt: when } });
    }
  }

  if (!dry) {
    for (let i = 0; i < entries.length; i += 400) {
      const batch = db.batch();
      for (const e of entries.slice(i, i + 400)) batch.set(db.doc(`feedActivities/${e.id}`), e.data);
      await batch.commit();
    }
  }
  console.log(`${dry ? '[dry] ' : ''}${entries.length} novedades`);
})();
