const test = require('node:test');
const assert = require('node:assert/strict');
const { ACHIEVEMENTS, emptyProgress, newlyEarned, matchOutcomeFor } = require('../lib/lib/achievements');

test('catálogo: ids únicos y metas positivas', () => {
  const ids = ACHIEVEMENTS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ACHIEVEMENTS.every((a) => a.requirement.count > 0));
});

test('solo devuelve los logros cumplidos y aún no desbloqueados', () => {
  const p = { ...emptyProgress(), goals: 10, matches: 1, ovr: 71 };
  const ids = newlyEarned(p, new Set(['first_goal'])).map((a) => a.id).sort();
  assert.deepEqual(ids, ['first_match', 'ovr_70', 'ten_goals']);
  assert.deepEqual(newlyEarned(emptyProgress(), new Set()), []);
});

test('resultado del partido: victoria y goles propios', () => {
  const match = {
    teams: [{ players: [{ uid: 'a' }, { id: 'b' }] }, { players: [{ uid: 'c' }] }],
    finalScore: { team1: 4, team2: 2 },
    events: [
      { type: 'goal', playerId: 'a' },
      { type: 'goal', playerId: 'a' },
      { type: 'goal', playerId: 'a', goalType: 'own_goal' },
      { type: 'card', playerId: 'a' },
      { type: 'goal', playerId: 'c' },
    ],
  };
  assert.deepEqual(matchOutcomeFor(match, 'a'), { won: true, goals: 2 });
  assert.deepEqual(matchOutcomeFor(match, 'b'), { won: true, goals: 0 });
  assert.deepEqual(matchOutcomeFor(match, 'c'), { won: false, goals: 1 });
  assert.deepEqual(matchOutcomeFor({ ...match, finalScore: { team1: 2, team2: 2 } }, 'a'), { won: false, goals: 2 });
  assert.deepEqual(matchOutcomeFor({ ...match, finalScore: undefined }, 'a').won, false);
  assert.deepEqual(matchOutcomeFor(match, 'zzz'), { won: false, goals: 0 });
});

const feed = require('../lib/lib/feed');

test('novedades: los más difíciles primero y como máximo tres', () => {
  const all = ACHIEVEMENTS.filter((a) => ['first_match', 'first_goal', 'ten_goals', 'champion', 'ovr_80'].includes(a.id));
  assert.deepEqual(require('../lib/lib/achievements').featuredForFeed(all).map((a) => a.id), ['champion', 'ovr_80', 'ten_goals']);
  assert.equal(require('../lib/lib/achievements').featuredForFeed(ACHIEVEMENTS).length, 3);
  assert.equal(require('../lib/lib/achievements').featuredForFeed(ACHIEVEMENTS, 5).length, 5);
  assert.deepEqual(require('../lib/lib/achievements').featuredForFeed([]), []);
});

test('novedades: entrada del feed con id fijo, y nada si no hay grupo', () => {
  const player = { name: 'Aurelio', groupId: 'g1', photoURL: 'https://x/foto.png' };
  const a = { id: 'first_goal', name: 'Primer Gol', icon: 'target' };
  const e = feed.achievementFeedEntry('uid1', a, player);
  assert.equal(e.id, 'ach_uid1_first_goal');
  assert.equal(e.data.type, 'achievement_unlocked');
  assert.equal(e.data.groupId, 'g1');
  assert.equal(e.data.playerName, 'Aurelio');
  assert.equal(e.data.message, 'Consiguió el logro «Primer Gol».');
  assert.equal(feed.achievementFeedEntry('uid1', a, { name: 'Sin grupo' }), null);
  assert.equal(feed.achievementFeedEntry('uid1', a, undefined), null);
  assert.equal(feed.achievementFeedEntry('uid1', { id: '', name: 'x', icon: '' }, player), null);
});
