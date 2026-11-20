const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;
let db, api;
if (enabled) {
  const admin = require('firebase-admin');
  admin.initializeApp({ projectId: 'demo-patea-training' });
  db = admin.firestore();
  api = require('../lib/callable/training');
}
const options = { skip: enabled ? false : 'Requires FIRESTORE_EMULATOR_HOST', timeout: 60000 };
const req = (uid, data) => ({ auth: uid ? { uid, token: {} } : undefined, data });

test('registrar una sesión de entrenamiento', options, async () => {
  const uid = 'u' + randomUUID().replaceAll('-', '');
  await assert.rejects(api.logTrainingSession.run(req(null, { focusId: 'sho' })), (e) => e.code === 'unauthenticated');
  await assert.rejects(api.logTrainingSession.run(req(uid, { focusId: 'sho' })), (e) => e.code === 'failed-precondition', 'sin ficha');
  await db.doc(`players/${uid}`).set({ name: 'A', ovr: 60 });
  await assert.rejects(api.logTrainingSession.run(req(uid, { focusId: 'inventado' })), (e) => e.code === 'invalid-argument');
  await api.logTrainingSession.run(req(uid, { focusId: 'sho' }));
  const log = await db.collection(`players/${uid}/trainingLog`).get();
  assert.equal(log.size, 1);
  assert.equal(log.docs[0].data().focusId, 'sho');
  assert.equal((await db.doc(`players/${uid}`).get()).data().ovr, 60, 'no toca el OVR');
});

test('tope de sesiones por día', options, async () => {
  const uid = 'u' + randomUUID().replaceAll('-', '');
  await db.doc(`players/${uid}`).set({ name: 'A', ovr: 60 });
  for (let i = 0; i < 5; i++) await api.logTrainingSession.run(req(uid, { focusId: 'pas' }));
  await assert.rejects(api.logTrainingSession.run(req(uid, { focusId: 'pas' })), (e) => e.code === 'resource-exhausted');
});
