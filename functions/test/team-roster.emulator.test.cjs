const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let admin, db, createMatch, updateMatchTeams, finishMatch, startMatch;
if (enabled) {
  admin = require('firebase-admin');
  admin.initializeApp({ projectId: 'demo-patea-team-integration' });
  db = admin.firestore();
  ({createMatch} = require('../lib/callable/create-match'));
  ({updateMatchTeams} = require('../lib/callable/match-management'));
  ({finishMatch, startMatch} = require('../lib/callable/match-lifecycle'));
}
const options = {skip: enabled ? false : 'Requires FIRESTORE_EMULATOR_HOST', timeout: 60000};
const request = (uid, data) => ({auth: {uid, token: {}}, data});
async function fixture() {
  const suffix = randomUUID().replaceAll('-', '');
  const owner = `owner_${suffix}`, group = `group_${suffix}`;
  const ids = ['a', 'b', 'c', 'd'].map(id => `${id}_${suffix}`);
  const batch = db.batch();
  batch.set(db.doc(`users/${owner}`), {activeGroupId: group});
  batch.set(db.doc(`groups/${group}`), {ownerUid: owner, members: [owner]});
  ids.forEach((id, i) => batch.set(db.doc(`players/${id}`), {
    name: `Player ${i}`, position: i === 0 ? 'POR' : 'MED', ovr: 60 + i,
    groupId: group, ownerUid: owner, photoURL: `https://photo/${id}`,
  }));
  await batch.commit();
  return {owner, group, ids, suffix};
}
test('crear cliente legado ignora OVR/equipos inventados y reintentos concurrentes no duplican', options, async () => {
  const {owner, ids, suffix} = await fixture();
  const data = {title: 'Partido de integración', type: 'manual', matchSize: 4,
    date: '2099-12-01T00:00:00.000', time: '21:30', playerUids: ids,
    players: ids.map(uid => ({uid, ovr: 99})), teams: [{players: [{uid:'intruder'}]}], requestId: suffix};
  const [first, second] = await Promise.all([createMatch.run(request(owner, data)), createMatch.run(request(owner, data))]);
  assert.equal(first.matchId, second.matchId);
  const result = (await db.doc(`matches/${first.matchId}`).get()).data();
  const roster = result.teams.flatMap(team => team.players);
  assert.deepEqual(roster.map(p => p.uid).sort(), ids.sort());
  assert.ok(roster.every(p => p.ovr >= 60 && p.ovr <= 63));
  assert.ok(roster.every(p => p.photoURL.startsWith('https://photo/')));
  await assert.rejects(updateMatchTeams.run(request(owner, {matchId:first.matchId, assignments: {[ids[0]]:0}})), /plantel cambió/);
  const preserved = (await db.doc(`matches/${first.matchId}`).get()).data();
  assert.equal(preserved.teams.flatMap(team => team.players).length, 4);
});
test('crear por equipos deduplica UID compartido y conserva cada jugador una vez', options, async () => {
  const {owner, ids, group, suffix} = await fixture();
  const teamIds = [`teamA_${suffix}`, `teamB_${suffix}`];
  await db.doc(`teams/${teamIds[0]}`).set({groupId:group, name:'A', members:[{playerId:ids[0]}, {playerId:ids[1]}]});
  await db.doc(`teams/${teamIds[1]}`).set({groupId:group, name:'B', members:[{playerId:ids[1]}, {playerId:ids[2]}, {playerId:ids[3]}]});
  const result = await createMatch.run(request(owner, {title:'Por equipos', type:'by_teams', matchSize:4,
    date:'2099-12-01', time:'20:00', selectedTeams:teamIds}));
  const match = (await db.doc(`matches/${result.matchId}`).get()).data();
  assert.equal(new Set(match.playerUids).size, 4);
  assert.equal(match.playerUids.length, 4);
  assert.equal(match.teams[1].players.length, 2);
});
test('finalizar dos veces concurrentemente crea una sola tanda de asignaciones', options, async () => {
  const {owner, ids} = await fixture();
  await Promise.all(ids.map(id => db.doc(`players/${id}`).update({ownerUid:id})));
  const created = await createMatch.run(request(owner, {title:'Finalizar una vez', type:'manual', matchSize:4,
    date:'2099-12-01', time:'21:00', playerUids:ids}));
  // Sólo se finaliza un partido que estuvo en vivo: primero se inicia.
  await startMatch.run(request(owner, {matchId:created.matchId}));
  await Promise.all([finishMatch.run(request(owner, {matchId:created.matchId})), finishMatch.run(request(owner, {matchId:created.matchId}))]);
  const assignments = await db.collection(`matches/${created.matchId}/assignments`).get();
  assert.equal(assignments.size, 8);
  assert.equal(new Set(assignments.docs.map(doc => `${doc.data().evaluatorId}:${doc.data().subjectId}`)).size, 8);
});
test('iniciar rechaza particiones obsoletas o duplicadas y permite plantel exacto', options, async () => {
  const {owner, ids} = await fixture();
  const created = await createMatch.run(request(owner, {title:'Inicio validado', type:'manual', matchSize:4,
    date:'2099-12-01', time:'21:00', playerUids:ids}));
  const ref = db.doc(`matches/${created.matchId}`);
  const goodTeams = (await ref.get()).data().teams;
  const duplicateTeams = JSON.parse(JSON.stringify(goodTeams));
  duplicateTeams[1].players[0] = duplicateTeams[0].players[0];
  await ref.update({teams:duplicateTeams});
  await assert.rejects(startMatch.run(request(owner, {matchId:created.matchId})), /Equilibrar equipos/);
  assert.equal((await ref.get()).data().status, 'upcoming');
  const missingTeams = JSON.parse(JSON.stringify(goodTeams));
  missingTeams[0].players.pop();
  await ref.update({teams:missingTeams});
  await assert.rejects(startMatch.run(request(owner, {matchId:created.matchId})), /Equilibrar equipos/);
  await ref.update({teams:goodTeams});
  await startMatch.run(request(owner, {matchId:created.matchId}));
  assert.equal((await ref.get()).data().status, 'active');
});
test.after(async () => {if (admin) await admin.app().delete();});
