const test = require('node:test');
const assert = require('node:assert/strict');

const feed = require('../lib/lib/feed');

const teams = [{ name: 'Rivadavia', score: 3 }, { name: '19 De Abril', score: 1 }];

test('el cambio de OVR queda en el grupo del jugador, con id fijo por hecho', () => {
  const entry = feed.ovrFeedEntry('p1', 'h1', { name: 'Aurelio', groupId: 'g1', photoURL: 'x' }, { oldOVR: 55, newOVR: 57, change: 2, matchId: 'm1' });
  assert.equal(entry.id, 'ovr_p1_h1');
  assert.equal(entry.data.groupId, 'g1');
  assert.equal(entry.data.newOvr, 57);
  assert.equal(entry.data.change, 2);
  assert.match(entry.data.message, /Subió su nivel a OVR 57/);
});

test('sin grupo o con datos rotos no hay novedad', () => {
  assert.equal(feed.ovrFeedEntry('p1', 'h1', { name: 'A' }, { newOVR: 57, change: 2 }), null);
  assert.equal(feed.ovrFeedEntry('p1', 'h1', { groupId: 'g' }, { newOVR: 'x' }), null);
});

test('bajar de OVR y mantenerlo se cuentan distinto', () => {
  const down = feed.ovrFeedEntry('p', 'h', { groupId: 'g' }, { newOVR: 50, change: -3 });
  const same = feed.ovrFeedEntry('p', 'h', { groupId: 'g' }, { newOVR: 50, change: 0 });
  assert.match(down.data.message, /Bajó a OVR 50/);
  assert.match(same.data.message, /Mantuvo su OVR en 50/);
});

test('un partido que termina avisa a cada grupo que participa, una sola vez', () => {
  const match = { status: 'completed', title: 'Clásico', groupId: 'g1', participantGroupIds: ['g1', 'g2'], teams };
  const entries = feed.matchFinishedFeedEntries('m1', { status: 'active' }, match);
  assert.deepEqual(entries.map((e) => e.id).sort(), ['match_done_m1_g1', 'match_done_m1_g2']);
  assert.match(entries[0].data.message, /Rivadavia 3 – 1 19 De Abril/);
  // Ya estaba terminado (p. ej. pasa a evaluated): no vuelve a avisar.
  assert.deepEqual(feed.matchFinishedFeedEntries('m1', { status: 'completed' }, match), []);
  assert.deepEqual(feed.matchFinishedFeedEntries('m1', { status: 'completed' }, { ...match, status: 'evaluated' }), []);
});

test('un partido sin marcador igual avisa que terminó', () => {
  const entries = feed.matchFinishedFeedEntries('m2', undefined, { status: 'completed', title: 'Picado', groupId: 'g1' });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].data.message, 'Terminó "Picado".');
});

test('se arma un partido: avisa al pasar a upcoming, no por competición ni desafío pendiente', () => {
  const base = { status: 'upcoming', title: 'Jueves', groupId: 'g1', date: '2026-11-20', time: '20:00', type: 'manual' };
  const entries = feed.matchScheduledFeedEntries('m3', { status: 'planning' }, base);
  assert.equal(entries.length, 1);
  assert.match(entries[0].data.message, /Se armó "Jueves" para el 2026-11-20 · 20:00/);
  assert.deepEqual(feed.matchScheduledFeedEntries('m3', { status: 'upcoming' }, base), []);
  assert.deepEqual(feed.matchScheduledFeedEntries('m3', undefined, { ...base, type: 'league' }), []);
  assert.deepEqual(feed.matchScheduledFeedEntries('m3', undefined, { ...base, type: 'intergroup_friendly', challengeStatus: 'pending' }), []);
});
