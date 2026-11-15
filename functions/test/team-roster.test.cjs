const test = require('node:test');
const assert = require('node:assert/strict');
const { matchRosterIds, assignMatchRoster, isGeneratingTeams, regenerateMatchTeams } = require('../lib/callable/match-management');

const roster = [{ uid: 'a', ovr: 80 }, { uid: 'b', ovr: 60 }, { uid: 'c', ovr: 70 }];
const match = () => ({ ownerUid: 'owner', status: 'upcoming', playerUids: ['a', 'b', 'c'],
  players: roster, teams: [{ name: 'A', players: roster.slice(0, 2) }, { name: 'B', players: roster.slice(2) }] });

test('editor rechaza repartos parciales sin perder el convocado que falta', () => {
  assert.throws(() => assignMatchRoster(match(), { a: 0, b: 1 }, roster), /plantel cambió/);
  assert.throws(() => assignMatchRoster(match(), { a: 0, b: 1, c: 1, stranger: 0 }, roster), /plantel cambió/);
});
test('editor preserva identidad, calcula promedios y rechaza lado o equipo vacío', () => {
  const teams = assignMatchRoster(match(), { a: 0, b: 1, c: 1 }, roster);
  assert.equal(teams[0].name, 'A');
  assert.equal(teams[1].averageOVR, 65);
  assert.deepEqual(teams.flatMap(t => t.players.map(p => p.uid)).sort(), ['a', 'b', 'c']);
  assert.throws(() => assignMatchRoster(match(), { a: 0, b: 0, c: 0 }, roster), /al menos un jugador/);
  assert.throws(() => assignMatchRoster(match(), { a: '0', b: 1, c: 1 }, roster), /uno de los dos/);
});
test('roster legado deduplica equipos, roster actual excluye jugadores ya retirados', () => {
  assert.deepEqual(matchRosterIds({ teams: [{players: [{uid:'a'}, {uid:'a'}]}, {players: [{uid:'b'}]}] }), ['a', 'b']);
  assert.deepEqual(matchRosterIds({ playerUids: ['b'], players: [{uid:'a'}, {uid:'b'}] }), ['b']);
});
test('lease vence y no bloquea para siempre un reintento tras cierre de proceso', () => {
  assert.equal(isGeneratingTeams({ teamGenerationUntil: 101 }, 100), true);
  assert.equal(isGeneratingTeams({ teamGenerationUntil: 99 }, 100), false);
  assert.equal(isGeneratingTeams({ teamsGenerated: true }, 100), false);
});
test('generación descarta resultado si el plantel cambia antes de confirmar', async () => {
  const generator = require('../lib/callable/generate-balanced-teams');
  const original = generator.generateBalancedTeamsCore;
  const current = match();
  const ref = {};
  const tx = { get: async () => ({data: () => current}), update: (_ref, patch) => Object.assign(current, patch) };
  const db = {
    collection: () => ({doc: () => ref}), doc: id => id,
    runTransaction: callback => callback(tx),
    getAll: async () => roster.map(p => ({id: p.uid, exists: true, data: () => p})),
  };
  generator.generateBalancedTeamsCore = async () => {
    current.playerUids = ['a', 'b'];
    return {teams: [{players: roster}], balanceMetrics: {}};
  };
  try {
    await assert.rejects(regenerateMatchTeams(db, 'match', 'owner'), /partido cambió/);
    assert.equal(current.teams[0].name, 'A');
  } finally { generator.generateBalancedTeamsCore = original; }
});
