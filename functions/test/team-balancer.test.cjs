const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { balanceTeams, normalizeTeamPartition } = require('../lib/lib/team-balancer');

function fixture(count, overrides = () => ({})) {
  return Array.from({ length: count }, (_, index) => ({
    uid: `player_${String(index).padStart(3, '0')}`,
    displayName: index < 2 ? 'Santiago' : `Jugador ${index}`,
    position: ['POR', 'DEF', 'MED', 'DEL'][index % 4],
    ovr: 40 + (index * 17) % 60,
    photoURL: `https://example.invalid/player-${index}.png`,
    ...overrides(index),
  }));
}
function assertPartition(result, players, count = 2) {
  assert.equal(result.teams.length, count);
  const actual = result.teams.flatMap(team => team.players);
  assert.equal(actual.length, players.length);
  assert.deepEqual(new Set(actual.map(player => player.uid)), new Set(players.map(player => player.uid)));
  assert.equal(new Set(actual.map(player => player.uid)).size, players.length);
  assert.ok(Math.max(...result.teams.map(team => team.players.length)) - Math.min(...result.teams.map(team => team.players.length)) <= 1);
  for (const position of ['POR', 'DEF', 'MED', 'DEL']) {
    const counts = result.teams.map(team => team.players.filter(player => player.position === position).length);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `${position} must be divided evenly`);
  }
  const round = number => Math.round((number + Number.EPSILON) * 100) / 100;
  for (const team of result.teams) {
    assert.equal(team.totalOVR, round(team.players.reduce((sum, player) => sum + player.ovr, 0)));
    assert.equal(team.averageOVR, round(team.totalOVR / team.players.length));
    assert.ok(team.players.every(player => players.some(original => original.uid === player.uid && original.ovr === player.ovr)));
  }
  const averages = result.teams.map(team => team.averageOVR);
  assert.equal(result.balanceMetrics.ovrDifference, round(Math.max(...averages) - Math.min(...averages)));
  assert.ok(result.balanceMetrics.fairnessPercentage >= 0 && result.balanceMetrics.fairnessPercentage <= 100);
}

function bruteMinimum(players) {
  const size = Math.floor(players.length / 2);
  let best = Infinity;
  const total = players.reduce((sum, player) => sum + player.ovr, 0);
  for (let mask = 0; mask < 2 ** players.length; mask++) {
    const selected = players.filter((_, index) => mask & (1 << index));
    if (selected.length !== size) continue;
    if (['POR', 'DEF', 'MED', 'DEL'].some(position => {
      const all = players.filter(player => player.position === position).length;
      const own = selected.filter(player => player.position === position).length;
      return Math.abs(own - (all - own)) > 1;
    })) continue;
    const sum = selected.reduce((value, player) => value + player.ovr, 0);
    best = Math.min(best, Math.abs(sum / size - (total - sum) / (players.length - size)));
  }
  return best;
}

test('same names never merge identities; input order and object mutation do not alter the partition', () => {
  const players = fixture(10);
  const before = JSON.stringify(players);
  const result = balanceTeams(players);
  assertPartition(result, players);
  assert.deepEqual(result, balanceTeams([...players].reverse()));
  assert.equal(JSON.stringify(players), before);
  const homonyms = result.teams.flatMap(team => team.players).filter(player => player.displayName === 'Santiago');
  assert.equal(homonyms.length, 2);
  assert.notEqual(homonyms[0].uid, homonyms[1].uid);
  assert.notEqual(homonyms[0].photoURL, homonyms[1].photoURL);
});

test('exact search finds the minimum possible average OVR gap within balanced positional quotas', () => {
  for (let seed = 0; seed < 8; seed++) {
    const players = fixture(9 + seed % 2, index => ({ ovr: 40 + (index * (seed + 5) + seed * 13) % 60 }));
    const result = balanceTeams(players);
    assertPartition(result, players);
    const averages = result.teams.map(team => team.players.reduce((sum, player) => sum + player.ovr, 0) / team.players.length);
    assert.ok(Math.abs(Math.abs(averages[0] - averages[1]) - bruteMinimum(players)) < 1e-8);
  }
});

test('zero, one, two and surplus goalkeepers have explicit predictable distributions', () => {
  for (const keepers of [0, 1, 2, 4]) {
    const players = fixture(10, index => ({ position: index < keepers ? 'POR' : ['DEF', 'MED', 'DEL'][index % 3] }));
    const result = balanceTeams(players);
    assertPartition(result, players);
    const counts = result.teams.map(team => team.players.filter(player => player.position === 'POR').length).sort();
    assert.deepEqual(counts, [Math.floor(keepers / 2), Math.ceil(keepers / 2)]);
    if (keepers === 0) assert.ok(result.teams.every(team => team.tags.includes('Sin golero fijo')));
    if (keepers === 1) assert.equal(result.teams.filter(team => team.tags.includes('Sin golero fijo')).length, 1);
    if (keepers === 4) assert.ok(result.teams.every(team => team.tags.includes('Rotación de goleros')));
  }
});

test('odd rosters retain every participant and compare average strengths rather than unequal totals', () => {
  const players = fixture(11, () => ({ ovr: 60 }));
  const result = balanceTeams(players);
  assertPartition(result, players);
  assert.deepEqual(result.teams.map(team => team.players.length), [5, 6]);
  assert.equal(result.balanceMetrics.ovrDifference, 0);
  assert.equal(result.balanceMetrics.fairnessPercentage, 100);
});

test('two-player and zero-OVR edge cases stay finite', () => {
  const players = fixture(2, () => ({ ovr: 0 }));
  const result = balanceTeams(players);
  assertPartition(result, players);
  assert.equal(result.balanceMetrics.fairnessPercentage, 100);
});

test('malformed IDs, duplicate participants, invalid OVRs, positions and team counts are rejected', () => {
  for (const raw of [null, {}, [], fixture(1), fixture(101)]) assert.throws(() => balanceTeams(raw));
  const players = fixture(10);
  for (const patch of [{ uid: players[1].uid }, { uid: '../other' }, { uid: '' }, { ovr: NaN }, { ovr: Infinity }, { ovr: -1 }, { ovr: 100 }, { ovr: '99' }, { position: 'captain' }]) {
    assert.throws(() => balanceTeams([{ ...players[0], ...patch }, ...players.slice(1)]));
  }
  for (const count of [0, 1, 1.5, 9, NaN, '2']) assert.throws(() => balanceTeams(players, count));
  assert.equal(balanceTeams([{ ...players[0], position: 'arquero' }, ...players.slice(1)]).teams.flatMap(team => team.players).find(player => player.uid === players[0].uid).position, 'POR');
});

test('untrusted AI/cache partitions cannot invent, duplicate or omit players and metrics are rebuilt', () => {
  const players = fixture(10);
  const good = balanceTeams(players);
  const forged = structuredClone(good);
  forged.teams.forEach(team => { team.totalOVR = 999; team.averageOVR = 999; team.players.forEach(player => { player.ovr = 99; player.displayName = 'forged'; }); });
  forged.balanceMetrics = { ovrDifference: 0, fairnessPercentage: 100 };
  assert.deepEqual(normalizeTeamPartition(forged, players), good);
  const duplicate = structuredClone(good);
  duplicate.teams[1].players[0].uid = duplicate.teams[0].players[0].uid;
  assert.throws(() => normalizeTeamPartition(duplicate, players));
  const missing = structuredClone(good); missing.teams[0].players.pop();
  assert.throws(() => normalizeTeamPartition(missing, players));
  const outsider = structuredClone(good); outsider.teams[0].players[0].uid = 'unknown';
  assert.throws(() => normalizeTeamPartition(outsider, players));
});

test('20/22-player exact search has a bounded runtime, including all players in one role', { timeout: 6000 }, () => {
  const started = performance.now();
  for (const count of [20, 22]) {
    const players = fixture(count, () => ({ position: 'MED' }));
    assertPartition(balanceTeams(players), players);
  }
  assert.ok(performance.now() - started < 5000, '22-player search must not become unbounded');
});

test('large and multi-team drafts preserve sizes, role quotas and real metrics', { timeout: 10000 }, () => {
  for (const [count, teams] of [[23, 2], [30, 3], [41, 8], [100, 8]]) {
    const players = fixture(count);
    assertPartition(balanceTeams(players, teams), players, teams);
  }
});
