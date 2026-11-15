const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let admin, db, generateBalancedTeams;
if (enabled) {
  admin = require('firebase-admin');
  admin.initializeApp({ projectId: 'demo-patea-balancing' });
  db = admin.firestore();
  ({ generateBalancedTeams } = require('../lib/callable/generate-balanced-teams'));
}
const options = { skip: enabled ? false : 'Requires FIRESTORE_EMULATOR_HOST', timeout: 30000 };
const request = (uid, players, teamCount = 2) => ({ auth: uid ? { uid, token: {} } : null, data: { players, teamCount } });

async function fixture() {
  const suffix = randomUUID().replaceAll('-', '');
  const uid = `organizer_${suffix}`;
  const groupId = `group_${suffix}`;
  const realMemberId = `real_${suffix}`;
  const outsiderId = `outsider_${suffix}`;
  const ids = [realMemberId, ...[1, 2, 3].map(index => `manual_${index}_${suffix}`)];
  const refs = [`users/${uid}`, `groups/${groupId}`, `players/${outsiderId}`, ...ids.map(id => `players/${id}`)];
  const batch = db.batch();
  batch.set(db.doc(`users/${uid}`), { activeGroupId: groupId });
  batch.set(db.doc(`groups/${groupId}`), { ownerUid: uid, members: [uid, realMemberId] });
  ids.forEach((id, index) => batch.set(db.doc(`players/${id}`), {
    name: index < 2 ? 'Mismo nombre' : `Jugador ${index}`,
    ovr: 40 + index * 10,
    position: ['POR', 'POR', 'DEF', 'DEL'][index],
    groupId: id === realMemberId ? null : groupId,
    ownerUid: 'other-owner',
    photoUrl: `https://example.invalid/${id}`,
  }));
  batch.set(db.doc(`players/${outsiderId}`), { name: 'Outsider', position: 'MED', ovr: 90, groupId: 'another-group', ownerUid: 'other-owner' });
  await batch.commit();
  return { uid, groupId, ids, outsiderId, refs };
}
async function cleanup(fixture) {
  const batch = db.batch();
  fixture.refs.forEach(path => batch.delete(db.doc(path)));
  await batch.commit();
}

test('real Firestore: authenticated balancing hydrates authoritative IDs, ratings, names and photos', options, async () => {
  const f = await fixture();
  try {
    const forged = f.ids.map(uid => ({ uid, displayName: 'Invented', position: 'MED', ovr: 99, photoURL: 'https://attacker.invalid' }));
    const result = await generateBalancedTeams.run(request(f.uid, forged));
    const reverse = await generateBalancedTeams.run(request(f.uid, [...forged].reverse()));
    assert.deepEqual(result, reverse);
    const players = result.teams.flatMap(team => team.players);
    assert.deepEqual(new Set(players.map(player => player.uid)), new Set(f.ids));
    assert.deepEqual(players.map(player => player.ovr).sort(), [40, 50, 60, 70]);
    assert.equal(players.filter(player => player.displayName === 'Mismo nombre').length, 2);
    assert.ok(players.every(player => player.photoURL === `https://example.invalid/${player.uid}`));
    assert.ok(result.teams.every(team => team.players.filter(player => player.position === 'POR').length === 1));
    assert.equal(result.teams.reduce((sum, team) => sum + team.totalOVR, 0), 220);
  } finally { await cleanup(f); }
});

test('real Firestore: balancing rejects no auth, foreign groups/players, missing docs and duplicate IDs', options, async () => {
  const f = await fixture();
  try {
    const roster = f.ids.map(uid => ({ uid }));
    await assert.rejects(generateBalancedTeams.run(request(null, roster)), error => error.code === 'unauthenticated');
    await assert.rejects(generateBalancedTeams.run(request(f.uid, [{ uid: f.ids[0] }, { uid: f.ids[0] }])), error => error.code === 'invalid-argument');
    await assert.rejects(generateBalancedTeams.run(request(f.uid, [...roster.slice(0, 3), { uid: f.outsiderId }])), error => error.code === 'permission-denied');
    await assert.rejects(generateBalancedTeams.run(request(f.uid, [...roster.slice(0, 3), { uid: `missing_${randomUUID()}` }])), error => error.code === 'not-found');
    await db.doc(`groups/${f.groupId}`).update({ ownerUid: 'other-owner', members: [] });
    await assert.rejects(generateBalancedTeams.run(request(f.uid, roster)), error => error.code === 'permission-denied');
  } finally { await cleanup(f); }
});

test('real Firestore: malformed persisted ratings fail safely without returning a broken lineup', options, async () => {
  const f = await fixture();
  try {
    await db.doc(`players/${f.ids[0]}`).update({ ovr: NaN });
    await assert.rejects(generateBalancedTeams.run(request(f.uid, f.ids.map(uid => ({ uid })))), error => error.code === 'invalid-argument');
  } finally { await cleanup(f); }
});

test.after(async () => { if (enabled) await admin.app().delete(); });
