const test = require('node:test');
const assert = require('node:assert/strict');

const search = require('../lib/lib/team-search');
const access = require('../lib/lib/match-access');
const challenges = require('../lib/callable/team-challenges');

// ---------------------------------------------------------------- buscador

test('normaliza sin tildes, mayúsculas ni signos', () => {
  assert.equal(search.normalizeSearchText('  Los GALÁCTICOS!! '), 'los galacticos');
  assert.equal(search.normalizeSearchText('Peñarol-Sub 17'), 'penarol sub 17');
  assert.equal(search.normalizeSearchText(null), '');
});

test('tokens: todos los prefijos de cada palabra, desde 2 letras', () => {
  const tokens = search.buildTeamSearchTokens('Los Galácticos');
  for (const expected of ['lo', 'los', 'ga', 'gal', 'galac', 'galacticos']) {
    assert.ok(tokens.includes(expected), `falta ${expected}`);
  }
  assert.ok(!tokens.includes('g'), 'una sola letra no se indexa');
  assert.ok(!tokens.includes('l'));
  assert.equal(new Set(tokens).size, tokens.length, 'sin repetidos');
});

test('tokens: limita palabras largas y cantidad de palabras', () => {
  const long = search.buildTeamSearchTokens('a'.repeat(60));
  assert.ok(Math.max(...long.map((t) => t.length)) <= 20);
  const many = search.buildTeamSearchTokens(Array.from({ length: 30 }, (_, i) => `palabra${i}`).join(' '));
  assert.ok(many.length < 600, 'no crece sin tope');
});

test('consulta: con menos de 2 letras no se busca (la pantalla no lista nada)', () => {
  assert.equal(search.parseTeamQuery(''), null);
  assert.equal(search.parseTeamQuery('   '), null);
  assert.equal(search.parseTeamQuery('g'), null);
  assert.equal(search.parseTeamQuery(' g  7 '), null);
  assert.equal(search.parseTeamQuery(undefined), null);
});

test('consulta: usa la palabra más larga como ancla del índice', () => {
  assert.equal(search.parseTeamQuery('ga').anchor, 'ga');
  assert.equal(search.parseTeamQuery('los gal').anchor, 'gal');
  assert.equal(search.parseTeamQuery('LOS').anchor, 'los');
  assert.deepEqual(search.parseTeamQuery('Los Galácticos').words, ['los', 'galacticos']);
});

test('coincidencia por prefijo en cualquier palabra, ignorando tildes', () => {
  const q = (text) => search.parseTeamQuery(text);
  assert.ok(search.matchesTeamQuery('Los Galácticos', q('gal')));
  assert.ok(search.matchesTeamQuery('Los Galácticos', q('galáctic')));
  assert.ok(search.matchesTeamQuery('Los Galácticos', q('los gal')));
  assert.ok(search.matchesTeamQuery('Los Galácticos', q('gal los')), 'el orden no importa');
  assert.ok(!search.matchesTeamQuery('Los Galácticos', q('xyz')));
  assert.ok(!search.matchesTeamQuery('Los Galácticos', q('galacticos del sur')));
  // Prefijo, no subcadena suelta.
  assert.ok(!search.matchesTeamQuery('Los Galácticos', q('actic')));
});

test('orden: exacto, luego empieza con lo escrito, luego en otra palabra', () => {
  const q = search.parseTeamQuery('gal');
  const names = ['Los Galácticos', 'Galácticos FC', 'Gal', 'Atlético Galense'];
  const sorted = [...names].sort((a, b) => search.rankTeamMatch(a, q) - search.rankTeamMatch(b, q));
  assert.equal(sorted[0], 'Gal');
  assert.equal(sorted[1], 'Galácticos FC');
});

// ------------------------------------------------------------------ acceso

const priv = { ownerUid: 'owner', groupId: 'g1', isPublic: false, playerUids: ['p1'], captains: ['cap'] };

test('partido privado: sólo vinculados; público: cualquiera', () => {
  const group = { ownerUid: 'owner', members: ['owner', 'm1'] };
  assert.equal(access.canJoinMatch(priv, 'stranger', [group]), false);
  assert.equal(access.canJoinMatch(priv, 'm1', [group]), true, 'miembro del grupo');
  assert.equal(access.canJoinMatch(priv, 'owner', []), true, 'organizador');
  assert.equal(access.canJoinMatch(priv, 'cap', []), true, 'capitán');
  assert.equal(access.canJoinMatch(priv, 'p1', []), true, 'ya convocado');
  assert.equal(access.canJoinMatch({ ...priv, isPublic: true }, 'stranger', []), true);
});

test('un partido entre grupos se ve desde los dos grupos', () => {
  const match = { ...priv, groupId: 'g1', participantGroupIds: ['g1', 'g2'] };
  assert.deepEqual(access.matchGroupIds(match).sort(), ['g1', 'g2']);
  const other = { ownerUid: 'x', members: ['rival'] };
  assert.equal(access.canJoinMatch(match, 'rival', [null, other]), true);
  assert.deepEqual(access.matchGroupIds({ groupId: 'g1', participantGroupIds: ['g1', 'a/b', ''] }), ['g1']);
});

test('partidos entre equipos no admiten jugadores sueltos', () => {
  for (const type of ['by_teams', 'intergroup_friendly']) {
    assert.equal(access.isTeamMatch({ type }), true);
    assert.throws(() => access.assertNotTeamMatch({ type }), /entre equipos con plantel armado/);
  }
  for (const type of ['manual', 'collaborative', 'league', 'cup', undefined]) {
    assert.equal(access.isTeamMatch({ type }), false);
    assert.doesNotThrow(() => access.assertNotTeamMatch({ type }));
  }
});

test('organizador o capitán gestionan; el resto no', () => {
  const match = { ownerUid: 'owner', captains: ['capA', 'capB'] };
  assert.equal(access.isMatchManager(match, 'owner'), true);
  assert.equal(access.isMatchManager(match, 'capB'), true);
  assert.equal(access.isMatchManager(match, 'player'), false);
  assert.equal(access.isMatchManager(match, ''), false);
  assert.equal(access.isMatchManager({ ownerUid: 'owner' }, 'capA'), false);
});

// --------------------------------------------------------------- desafíos

test('quienes administran un equipo: creador, dueño y admins/moderadores del grupo', () => {
  const team = { createdBy: 'creator' };
  const group = {
    ownerUid: 'owner',
    memberRoles: [
      { userId: 'adm', role: 'admin' },
      { userId: 'mod', role: 'moderator' },
      { userId: 'mem', role: 'member' },
    ],
  };
  assert.deepEqual(challenges.teamManagerUids(team, group).sort(), ['adm', 'creator', 'mod', 'owner']);
  assert.deepEqual(challenges.teamManagerUids(team, null), ['creator']);
});

test('propuesta de fecha: opcional, válida y futura', () => {
  assert.equal(challenges.parseProposal('', ''), null);
  assert.equal(challenges.parseProposal(undefined, undefined), null);
  assert.throws(() => challenges.parseProposal('2030-01-01', ''), /fecha y hora válidas/);
  assert.throws(() => challenges.parseProposal('no-es-fecha', '20:00'), /fecha y hora válidas/);
  assert.throws(() => challenges.parseProposal('2020-01-01', '20:00'), /ya pasó/);
  assert.deepEqual(
    challenges.parseProposal('2020-01-01', '20:00', { requireFuture: false }),
    { date: '2020-01-01', time: '20:00' },
  );
  assert.deepEqual(challenges.parseProposal('2099-01-01', '20:00'), { date: '2099-01-01', time: '20:00' });
});

test('plantel del partido: se arma desde los equipos y rechaza jugadores repetidos o sin perfil', () => {
  const profiles = new Map([
    ['a', { name: 'Ana', ovr: 80, position: 'DEL' }],
    ['b', { name: 'Beto', ovr: 60, position: 'DEF', photoUrl: 'u' }],
    ['c', { name: 'Cata', ovr: 70, position: 'MED' }],
  ]);
  const home = { id: 't1', data: { name: 'Los A', jersey: { type: 'plain' }, members: [{ playerId: 'a' }, { playerId: 'b' }] } };
  const away = { id: 't2', data: { name: 'Los C', jersey: null, members: [{ playerId: 'c' }] } };

  const teams = challenges.buildChallengeTeams([home, away], profiles);
  assert.equal(teams.length, 2);
  assert.equal(teams[0].name, 'Los A');
  assert.deepEqual(teams[0].players.map((p) => p.uid), ['a', 'b']);
  assert.equal(teams[0].totalOVR, 140);
  assert.equal(teams[0].averageOVR, 70);
  assert.equal(teams[1].players[0].displayName, 'Cata');

  // Un jugador en los dos equipos.
  const shared = { id: 't2', data: { name: 'Los C', members: [{ playerId: 'b' }] } };
  assert.throws(() => challenges.buildChallengeTeams([home, shared], profiles), /en los dos equipos/);
  // Jugador sin perfil.
  const ghost = { id: 't2', data: { name: 'Los C', members: [{ playerId: 'zzz' }] } };
  assert.throws(() => challenges.buildChallengeTeams([home, ghost], profiles), /sin perfil/);
  // Equipo sin jugadores.
  const empty = { id: 't2', data: { name: 'Los C', members: [] } };
  assert.throws(() => challenges.buildChallengeTeams([home, empty], profiles), /plantel propio/);
});

test('searchTeamsCore encuentra equipos heredados sin searchTokens y los auto-indexa', async () => {
  const teams = new Map([
    ['t-hura', { name: 'Huracán del Parque', groupId: 'g-rival', members: [{ playerId: 'p1' }] }],
    ['t-same-group', { name: 'Huracán Local', groupId: 'g-mine', members: [{ playerId: 'p2' }] }],
    ['t-optout', { name: 'Huracán Oculto', groupId: 'g-other', challengeOptOut: true, members: [{ playerId: 'p3' }] }],
    ['t-empty', { name: 'Huracán Sin Jugadores', groupId: 'g-other', members: [] }],
  ]);
  const groups = new Map([['g-rival', { name: 'Fútbol del Parque' }]]);
  const updated = [];

  const makeSnap = (entries) => ({
    docs: entries.map(([id, data]) => ({
      id,
      ref: { path: `teams/${id}` },
      data: () => data,
    })),
  });

  const db = {
    collection: (col) => {
      assert.equal(col, 'teams');
      return {
        where: (_field, _op, token) => ({
          limit: () => ({
            async get() {
              const matched = [...teams.entries()].filter(([, d]) =>
                Array.isArray(d.searchTokens) && d.searchTokens.includes(token),
              );
              return makeSnap(matched);
            },
          }),
        }),
        limit: () => ({
          async get() {
            return makeSnap([...teams.entries()]);
          },
        }),
      };
    },
    doc: (path) => ({ path }),
    async getAll(...refs) {
      return refs.map((r) => {
        const id = r.path.split('/').at(-1);
        const data = groups.get(id);
        return { id, exists: Boolean(data), data: () => data };
      });
    },
    batch: () => ({
      update(ref, patch) {
        updated.push({ path: ref.path, patch });
        const id = ref.path.split('/').at(-1);
        teams.set(id, { ...teams.get(id), ...patch });
      },
      async commit() {},
    }),
  };

  const res = await challenges.searchTeamsCore(db, {
    query: 'hura',
    excludeTeamId: 't-mine',
    excludeGroupId: 'g-mine',
  });

  assert.equal(res.ok, true);
  assert.equal(res.teams.length, 1);
  assert.equal(res.teams[0].id, 't-hura');
  assert.equal(res.teams[0].groupName, 'Fútbol del Parque');
  assert.ok(updated.some((u) => u.path === 'teams/t-hura' && u.patch.searchTokens.includes('hura')));
});
