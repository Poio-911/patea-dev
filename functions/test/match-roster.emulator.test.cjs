const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;
let db, management, requests, roster, lifecycle;
if (enabled) {
  const admin = require('firebase-admin');
  admin.initializeApp({ projectId: 'demo-patea-match-roster' });
  db = admin.firestore();
  management = require('../lib/callable/match-management');
  requests = require('../lib/callable/match-join-requests');
  roster = require('../lib/callable/match-roster');
  lifecycle = require('../lib/callable/match-lifecycle');
}
const options = { skip: enabled ? false : 'Requires FIRESTORE_EMULATOR_HOST', timeout: 60000 };
const req = (uid, data) => ({ auth: { uid, token: {} }, data });
const code = (e) => e.code;
const p = (uid, ovr = 60) => ({ uid, displayName: uid, ovr, position: 'MED', photoURL: '' });
const team = (id, players) => ({ teamId: id, name: id, score: 0, players, totalOVR: 0, averageOVR: 0 });
const uniq = (prefix) => prefix + randomUUID().replaceAll('-', '');

async function matchFixture(extra = {}) {
  const id = uniq('m');
  await db.doc(`matches/${id}`).set({
    title: 'Partido', type: 'collaborative', status: 'upcoming', ownerUid: 'org', captains: ['org'],
    matchSize: 10, players: [p('org'), p('a')], playerUids: ['org', 'a'], teams: [], events: [], ...extra,
  });
  return id;
}

test('cancelar: el organizador cancela, se avisa y queda borrable', options, async () => {
  const id = await matchFixture();
  await assert.rejects(management.cancelMatch.run(req('a', { matchId: id })), (e) => code(e) === 'permission-denied');
  await management.cancelMatch.run(req('org', { matchId: id, reason: 'Llueve' }));
  const m = (await db.doc(`matches/${id}`).get()).data();
  assert.equal(m.status, 'cancelled');
  assert.equal(m.cancelReason, 'Llueve');
  const notes = await db.collection('users/a/notifications').get();
  assert.ok(notes.docs.some((d) => d.data().title === 'Partido cancelado'));
  await assert.rejects(management.cancelMatch.run(req('org', { matchId: id })), (e) => code(e) === 'failed-precondition');
  await management.deleteMatch.run(req('org', { matchId: id }));
  assert.equal((await db.doc(`matches/${id}`).get()).exists, false);
});

test('cancelar un desafío pendiente cierra la invitación', options, async () => {
  const toTeam = uniq('t');
  const inv = uniq('i');
  await db.doc(`teams/${toTeam}/invitations/${inv}`).set({ status: 'pending' });
  const id = await matchFixture({
    type: 'intergroup_friendly', status: 'planning', challengeStatus: 'pending',
    challengeInvitationId: inv, challengeToTeamId: toTeam,
  });
  await management.cancelMatch.run(req('org', { matchId: id }));
  assert.equal((await db.doc(`teams/${toTeam}/invitations/${inv}`).get()).data().status, 'cancelled');
  assert.equal((await db.doc(`matches/${id}`).get()).data().challengeStatus, 'cancelled');
});

test('una competición no se cancela', options, async () => {
  const id = await matchFixture({ type: 'league' });
  await assert.rejects(management.cancelMatch.run(req('org', { matchId: id })), (e) => code(e) === 'failed-precondition');
});

test('invitación: el invitado acepta o rechaza; sin invitación no entra', options, async () => {
  const id = await matchFixture();
  const guest = uniq('g');
  await db.doc(`players/${guest}`).set({ name: 'Invitado', ovr: 70, position: 'DEL' });
  await assert.rejects(requests.respondMatchInvitation.run(req(guest, { matchId: id, accepted: true })), (e) => code(e) === 'not-found');
  await db.collection(`matches/${id}/invitations`).doc().set({ playerId: guest, status: 'pending' });
  await requests.respondMatchInvitation.run(req(guest, { matchId: id, accepted: true }));
  const m = (await db.doc(`matches/${id}`).get()).data();
  assert.ok(m.playerUids.includes(guest));

  const other = uniq('g');
  await db.doc(`players/${other}`).set({ name: 'Otro', ovr: 70, position: 'DEL' });
  await db.collection(`matches/${id}/invitations`).doc().set({ playerId: other, status: 'pending' });
  await requests.respondMatchInvitation.run(req(other, { matchId: id, accepted: false }));
  assert.ok(!(await db.doc(`matches/${id}`).get()).data().playerUids.includes(other));
});

test('invitación a un partido ya cerrado o entre equipos no se acepta', options, async () => {
  const guest = uniq('g');
  await db.doc(`players/${guest}`).set({ name: 'X', ovr: 70, position: 'DEL' });
  for (const extra of [{ status: 'active' }, { type: 'by_teams' }]) {
    const id = await matchFixture(extra);
    await db.collection(`matches/${id}/invitations`).doc().set({ playerId: guest, status: 'pending' });
    await assert.rejects(requests.respondMatchInvitation.run(req(guest, { matchId: id, accepted: true })), (e) => code(e) === 'failed-precondition');
  }
});

test('anotarse con equipos armados los marca desactualizados', options, async () => {
  const id = await matchFixture({
    teamsGenerated: true, isPublic: true,
    teams: [team('A', [p('org')]), team('B', [p('a')])],
  });
  const guest = uniq('g');
  await db.doc(`players/${guest}`).set({ name: 'Nuevo', ovr: 70, position: 'DEL' });
  await lifecycle.joinMatch.run(req(guest, { matchId: id }));
  assert.equal((await db.doc(`matches/${id}`).get()).data().teamsGenerated, false);
});

test('sacar a un jugador de un partido por convocatoria', options, async () => {
  const id = await matchFixture({ teamsGenerated: true, teams: [team('A', [p('org')]), team('B', [p('a')])] });
  await assert.rejects(roster.removeMatchPlayer.run(req('a', { matchId: id, playerId: 'org' })), (e) => code(e) === 'permission-denied');
  await assert.rejects(roster.removeMatchPlayer.run(req('org', { matchId: id, playerId: 'org' })), (e) => code(e) === 'failed-precondition');
  await roster.removeMatchPlayer.run(req('org', { matchId: id, playerId: 'a' }));
  const m = (await db.doc(`matches/${id}`).get()).data();
  assert.deepEqual(m.playerUids, ['org']);
  assert.equal(m.teamsGenerated, false);
  assert.equal(m.teams[1].players.length, 0);
});

test('"No puedo ir" sólo en partidos de plantel fijo y sólo para quien juega', options, async () => {
  const fixed = await matchFixture({ type: 'by_teams', captains: ['org', 'cap'] });
  await assert.rejects(roster.reportMatchUnavailable.run(req('zz', { matchId: fixed })), (e) => code(e) === 'failed-precondition');
  await roster.reportMatchUnavailable.run(req('a', { matchId: fixed }));
  assert.deepEqual((await db.doc(`matches/${fixed}`).get()).data().unavailablePlayerUids, ['a']);
  assert.ok((await db.collection('users/cap/notifications').get()).docs.some((d) => d.data().title === 'No puede ir'));
  await roster.reportMatchUnavailable.run(req('a', { matchId: fixed, unavailable: false }));
  assert.deepEqual((await db.doc(`matches/${fixed}`).get()).data().unavailablePlayerUids, []);
  const open = await matchFixture();
  await assert.rejects(roster.reportMatchUnavailable.run(req('a', { matchId: open })), (e) => code(e) === 'failed-precondition');
});

test('en un partido entre equipos la exclusión la decide quien administra ese equipo', options, async () => {
  const gid = uniq('g');
  const tid = uniq('t');
  await db.doc(`groups/${gid}`).set({ name: 'G', ownerUid: 'dueno', members: ['dueno', 'tm'], memberRoles: [] });
  await db.doc(`teams/${tid}`).set({ name: 'T', groupId: gid, createdBy: 'tm', members: [{ playerId: 'x' }, { playerId: 'y' }] });
  const id = await matchFixture({
    type: 'by_teams', captains: ['org', 'tm'], playerUids: ['x', 'y', 'z'],
    players: [p('x'), p('y'), p('z')], teams: [team(tid, [p('x'), p('y')]), team('otro', [p('z')])],
  });
  await assert.rejects(roster.removeMatchPlayer.run(req('cap-intruso', { matchId: id, playerId: 'x' })), (e) => code(e) === 'permission-denied');
  // El organizador del partido entre equipos del mismo grupo puede.
  await roster.removeMatchPlayer.run(req('org', { matchId: id, playerId: 'x' }));
  const m = (await db.doc(`matches/${id}`).get()).data();
  assert.deepEqual(m.rosterExclusions[tid], ['x']);
  assert.ok(!m.playerUids.includes('x'));
  await roster.removeMatchPlayer.run(req('org', { matchId: id, playerId: 'x', restore: true }));
  assert.equal((await db.doc(`matches/${id}`).get()).data().rosterExclusions[tid], undefined);
});
