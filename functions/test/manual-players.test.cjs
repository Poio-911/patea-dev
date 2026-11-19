const test = require('node:test');
const assert = require('node:assert/strict');
const {normalizeContact, manualFields, assertManualCreator, verifiedContactMatches, replacePlayerReferences} = require('../lib/lib/manual-players');
const {generateEvaluationAssignments} = require('../lib/callable/match-lifecycle');

test('contact normalization rejects local phones and malformed addresses', () => {
  assert.deepEqual(normalizeContact({email:' TEST@Example.com ',phone:'+598 (99) 123-456'}), {email:'test@example.com',phone:'+59899123456'});
  for (const data of [{phone:'099123456'}, {email:'not-an-email'}, {phone:'+0000'}]) assert.throws(() => normalizeContact(data));
});
test('OVR is computed server-side and arbitrary ratings and positions are rejected', () => {
  assert.equal(manualFields({name:' Jugador ',position:'med',ovr:99}).ovr,70);
  for (const data of [{position:'ABC'}, {pac:100}, {pac:NaN}, {pac:'70'}, {name:' '.repeat(8)}]) assert.throws(() => manualFields({name:'Jugador',position:'MED',...data}));
});
test('only the creator of an active manual profile can manage it', () => {
  assert.doesNotThrow(() => assertManualCreator({ownerUid:'creator'},'manual','creator'));
  for (const p of [undefined,{ownerUid:'other'},{ownerUid:'manual'},{ownerUid:'creator',claimedBy:'account'},{ownerUid:'creator',archived:true}]) assert.throws(() => assertManualCreator(p,'manual','creator'));
});
test('claims require verified Auth contact, never an unverified matching email', () => {
  const contact={email:'player@example.com',phone:'+59899123456'};
  assert.equal(verifiedContactMatches(contact,{email:'player@example.com',emailVerified:false}),false);
  assert.equal(verifiedContactMatches(contact,{email:'PLAYER@example.com',emailVerified:true}),true);
  assert.equal(verifiedContactMatches(contact,{email:'other@example.com',emailVerified:true}),false);
  assert.equal(verifiedContactMatches(contact,{phoneNumber:'+59899123456'}),true);
});
test('migration updates nested references and vote-map keys while preserving display text and timestamps', () => {
  const input={playerUids:['manual','other'],teams:[{players:[{uid:'manual',displayName:'manual'}]}],events:[{playerId:'manual',assistId:'manual',playerInId:'manual',playerOutId:'manual',description:'manual'}],bestPlayerId:'manual',votes:{manual:true},title:'manual',date:new Date(0)};
  const out=replacePlayerReferences(input,'manual','account');
  assert.deepEqual(out.playerUids,['account','other']);
  assert.equal(out.teams[0].players[0].uid,'account');
  assert.equal(out.teams[0].players[0].displayName,'manual');
  assert.equal(out.events[0].playerId,'account');
  assert.equal(out.events[0].assistId,'account');
  assert.equal(out.events[0].playerInId,'account');
  assert.equal(out.events[0].playerOutId,'account');
  assert.equal(out.bestPlayerId,'account');
  assert.equal(out.events[0].description,'manual');
  assert.deepEqual(out.votes,{account:true});
  assert.equal(out.title,'manual');
  assert.equal(out.date,input.date);
});
test('every manual participant receives a review even with only one registered evaluator', () => {
  const players=[{id:'account',ownerUid:'account'},...Array.from({length:9},(_,i)=>({id:`manual${i}`,ownerUid:'creator'}))];
  const assignments=generateEvaluationAssignments({id:'match',playerUids:players.map(p=>p.id)},players);
  assert.equal(assignments.length,9);
  assert.deepEqual(new Set(assignments.map(a=>a.subjectId)),new Set(players.slice(1).map(p=>p.id)));
  assert.ok(assignments.every(a=>a.evaluatorId==='account' && a.subjectId!=='account'));
});
test('manual-only match does not assign impossible evaluation tasks', () => {
  assert.deepEqual(generateEvaluationAssignments({id:'match',playerUids:['manual']},[{id:'manual',ownerUid:'creator'}]),[]);
});
