const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

// Solo los caminos que no llegan al modelo: permisos, validaciones y casos
// vacíos. Corren con el emulador de Firestore.
const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;
let db, api;
if (enabled) {
  const admin = require('firebase-admin');
  admin.initializeApp({ projectId: 'demo-patea-ai-assist' });
  db = admin.firestore();
  api = require('../lib/callable/ai-assist');
}
const options = { skip: enabled ? false : 'Requires FIRESTORE_EMULATOR_HOST', timeout: 60000 };
const req = (uid, data) => ({ auth: uid ? { uid, token: {} } : undefined, data });
const id = (p) => p + randomUUID().replaceAll('-', '');

test('askAppHelp: exige sesión y un mensaje válido', options, async () => {
  await assert.rejects(api.askAppHelp.run(req(null, { message: 'hola' })), (e) => e.code === 'unauthenticated');
  await assert.rejects(api.askAppHelp.run(req('u1', { message: '   ' })), (e) => e.code === 'invalid-argument');
  await assert.rejects(api.askAppHelp.run(req('u1', { message: 'x'.repeat(501) })), (e) => e.code === 'invalid-argument');
});

test('getGroupSummary: grupo inexistente y no integrantes', options, async () => {
  const groupId = id('g');
  const owner = id('o');
  await assert.rejects(api.getGroupSummary.run(req(null, { groupId })), (e) => e.code === 'unauthenticated');
  await assert.rejects(api.getGroupSummary.run(req(owner, {})), (e) => e.code === 'invalid-argument');
  await assert.rejects(api.getGroupSummary.run(req(owner, { groupId })), (e) => e.code === 'not-found');
  await db.doc(`groups/${groupId}`).set({ name: 'G', ownerUid: owner, members: [owner] });
  await assert.rejects(api.getGroupSummary.run(req(id('ajeno'), { groupId })), (e) => e.code === 'permission-denied');
});

test('recommendRecruits: solo quien administra el partido', options, async () => {
  const owner = id('o');
  const matchId = id('m');
  await db.doc(`matches/${matchId}`).set({ title: 'P', ownerUid: owner, matchSize: 10, playerUids: [owner], players: [{ uid: owner, position: 'DEL' }] });
  await assert.rejects(api.recommendRecruits.run(req(null, { matchId })), (e) => e.code === 'unauthenticated');
  await assert.rejects(api.recommendRecruits.run(req(owner, {})), (e) => e.code === 'invalid-argument');
  await assert.rejects(api.recommendRecruits.run(req(owner, { matchId: id('no') })), (e) => e.code === 'not-found');
  await assert.rejects(
    api.recommendRecruits.run(req(id('ajeno'), { matchId, candidateUids: ['x'] })),
    (e) => e.code === 'permission-denied',
  );
});

test('recommendRecruits: sin lugares o sin candidatos válidos no llama al modelo', options, async () => {
  const owner = id('o');
  const full = id('m');
  await db.doc(`matches/${full}`).set({ title: 'Lleno', ownerUid: owner, matchSize: 2, playerUids: [owner, 'b'], players: [] });
  const r1 = await api.recommendRecruits.run(req(owner, { matchId: full, candidateUids: ['x'] }));
  assert.deepEqual(r1.data ?? r1, { recommendations: [] });

  const open = id('m');
  await db.doc(`matches/${open}`).set({ title: 'Abierto', ownerUid: owner, matchSize: 10, playerUids: [owner], players: [] });
  // Sin lista, solo los que ya están, ids raros y un jugador manual (ownerUid distinto).
  await db.doc(`players/manual1`).set({ name: 'Manual', ownerUid: owner, position: 'MED', ovr: 50 });
  for (const candidateUids of [undefined, [], [owner], ['a/b', 42, ''], ['manual1', 'noexiste']]) {
    const r = await api.recommendRecruits.run(req(owner, { matchId: open, candidateUids }));
    assert.deepEqual(r.data ?? r, { recommendations: [] }, JSON.stringify(candidateUids));
  }
});
