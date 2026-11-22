// Una sola vez, después de desplegar las reglas: les pone `secondaryGroupId` a los
// partidos entre grupos que ya existían (el otro grupo los ve en su lista por ese campo).
//   GOOGLE_APPLICATION_CREDENTIALS=... node functions/scripts/backfill-secondary-group.js [--dry]
const admin = require('firebase-admin');
admin.initializeApp();
const dry = process.argv.includes('--dry');
(async () => {
  const db = admin.firestore();
  const snap = await db.collection('matches').where('type', '==', 'intergroup_friendly').get();
  let updated = 0;
  for (const doc of snap.docs) {
    const m = doc.data();
    const groups = Array.isArray(m.participantGroupIds) ? m.participantGroupIds : [];
    const secondary = groups.find((g) => g !== m.groupId) ?? null;
    if (m.secondaryGroupId === secondary) continue;
    updated += 1;
    if (!dry) await doc.ref.update({ secondaryGroupId: secondary });
  }
  console.log(`${dry ? '[dry] ' : ''}${updated} partidos actualizados de ${snap.size}`);
})();
