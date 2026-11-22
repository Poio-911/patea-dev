const test = require('node:test');
const assert = require('node:assert/strict');

const state = require('../lib/lib/match-state');
const access = require('../lib/lib/match-access');

const code = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error.code ?? error.message;
  }
};

// ------------------------------------------------------------- en vivo / cierre

test('sólo se controla un partido que YA está en vivo', () => {
  assert.equal(code(() => state.assertLive({ status: 'active' })), null);
  for (const status of ['planning', 'upcoming', 'completed', 'evaluated', undefined]) {
    assert.equal(code(() => state.assertLive({ status })), 'failed-precondition', String(status));
  }
});

test('sólo se finaliza un partido que estuvo en vivo', () => {
  assert.equal(code(() => state.assertFinishable({ status: 'active' })), null);
  for (const status of ['planning', 'upcoming']) {
    assert.equal(code(() => state.assertFinishable({ status })), 'failed-precondition', status);
  }
  assert.match(
    (() => { try { state.assertFinishable({ status: 'upcoming' }); } catch (e) { return e.message; } })(),
    /que está en vivo/,
  );
});

test('la convocatoria y la agenda sólo están abiertas antes de empezar', () => {
  for (const status of ['planning', 'upcoming']) {
    assert.equal(code(() => state.assertConvocationOpen({ status })), null);
    assert.equal(code(() => state.assertScheduleOpen({ status })), null);
  }
  for (const status of ['active', 'completed', 'evaluated']) {
    assert.equal(code(() => state.assertConvocationOpen({ status })), 'failed-precondition', status);
    assert.equal(code(() => state.assertScheduleOpen({ status }, 'votar')), 'failed-precondition', status);
  }
});

test('confirmar la fecha es planning → upcoming y nada más', () => {
  assert.equal(code(() => state.assertDatePlanning({ status: 'planning' })), null);
  for (const status of ['upcoming', 'active', 'completed', 'evaluated']) {
    assert.equal(code(() => state.assertDatePlanning({ status })), 'failed-precondition', status);
  }
});

// ------------------------------------------------------------------ fecha

test('fecha y hora: formato válido y no pasada', () => {
  const now = Date.parse('2030-06-01T12:00:00-03:00');
  assert.ok(state.assertFutureSchedule('2030-06-02', '20:00', now) instanceof Date);
  // El ISO que manda Flutter también sirve.
  assert.ok(state.assertFutureSchedule('2030-06-02T00:00:00.000', '20:00', now) instanceof Date);

  for (const [date, time] of [['', ''], ['2030-06-02', ''], ['no-es-fecha', '20:00'], ['2030-06-02', '25:00'], [undefined, '20:00'], [null, null]]) {
    assert.equal(code(() => state.assertFutureSchedule(date, time, now)), 'invalid-argument', `${date} ${time}`);
  }
  assert.equal(code(() => state.assertFutureSchedule('2030-05-31', '20:00', now)), 'invalid-argument');
});

// ----------------------------------------------------------------- borrar

test('se borra lo que no empezó ni tuvo actividad', () => {
  assert.equal(code(() => state.assertDeletable({ type: 'manual', status: 'planning' })), null);
  assert.equal(code(() => state.assertDeletable({ type: 'collaborative', status: 'upcoming', events: [] })), null);
  assert.equal(code(() => state.assertDeletable({ type: 'intergroup_friendly', status: 'planning' })), null);
});

test('no se borra un partido en vivo, terminado, evaluado ni con eventos', () => {
  for (const status of ['active', 'completed', 'evaluated']) {
    assert.equal(code(() => state.assertDeletable({ type: 'manual', status })), 'failed-precondition', status);
  }
  assert.equal(
    code(() => state.assertDeletable({ type: 'manual', status: 'upcoming', events: [{ type: 'goal' }] })),
    'failed-precondition',
  );
});

test('un partido de competición no se borra nunca', () => {
  for (const type of ['league', 'cup', 'league_final']) {
    for (const status of ['planning', 'upcoming']) {
      assert.equal(code(() => state.assertDeletable({ type, status })), 'failed-precondition', `${type} ${status}`);
    }
  }
});

// ------------------------------------------------------------------ votos

test('votan jugadores y gestores; el resto no', () => {
  const match = { ownerUid: 'org', captains: ['cap'], playerUids: ['p1'], status: 'planning' };
  for (const uid of ['org', 'cap', 'p1']) {
    assert.equal(state.canVote(match, uid), true, uid);
    assert.equal(code(() => state.assertCanVote(match, uid)), null, uid);
  }
  for (const uid of ['tercero', 'miembro-del-grupo', '']) {
    assert.equal(state.canVote(match, uid), false, uid);
    assert.equal(code(() => state.assertCanVote(match, uid)), 'permission-denied', uid);
  }
});

test('no se vota cuando el partido ya empezó', () => {
  const match = { ownerUid: 'org', playerUids: ['p1'], status: 'active' };
  assert.equal(code(() => state.assertCanVote(match, 'p1')), 'failed-precondition');
});

// ------------------------------------------------- plantel fijo (acceso)

test('competiciones: no admiten jugadores sueltos, ni salir, ni invitar', () => {
  for (const type of ['league', 'cup', 'league_final']) {
    assert.equal(access.isCompetitionMatch({ type }), true, type);
    assert.equal(access.hasFixedRoster({ type }), true, type);
    for (const action of ['join', 'leave', 'invite']) {
      assert.equal(code(() => access.assertOpenRoster({ type }, action)), 'failed-precondition', `${type} ${action}`);
    }
  }
});

test('equipos: tampoco, y salir tiene su propio mensaje', () => {
  for (const type of ['by_teams', 'intergroup_friendly']) {
    assert.equal(access.hasFixedRoster({ type }), true, type);
    assert.equal(code(() => access.assertOpenRoster({ type }, 'join')), 'failed-precondition');
    assert.equal(code(() => access.assertOpenRoster({ type }, 'invite')), 'failed-precondition');
    assert.equal(code(() => access.assertOpenRoster({ type }, 'leave')), 'failed-precondition');
  }
  assert.match(
    (() => { try { access.assertOpenRoster({ type: 'by_teams' }, 'leave'); } catch (e) { return e.message; } })(),
    /avisale al capitán/,
  );
});

test('manual y colaborativo siguen admitiendo jugadores sueltos', () => {
  for (const type of ['manual', 'collaborative', undefined]) {
    assert.equal(access.hasFixedRoster({ type }), false, String(type));
    for (const action of ['join', 'leave', 'invite']) {
      assert.equal(code(() => access.assertOpenRoster({ type }, action)), null, `${type} ${action}`);
    }
  }
});

test('assertCanJoinMatch rechaza competiciones antes de mirar el grupo', async () => {
  const db = { getAll: async () => { throw new Error('no debería leer grupos'); } };
  await assert.rejects(
    () => access.assertCanJoinMatch(db, { type: 'league', isPublic: false, groupId: 'g' }, 'u'),
    /competición/,
  );
});

test('cancelar: sólo antes de empezar, y nunca una competición', () => {
  for (const status of ['planning', 'upcoming']) {
    assert.equal(code(() => state.assertCancellable({ status, type: 'manual' })), null, status);
  }
  for (const status of ['active', 'completed', 'evaluated', 'cancelled']) {
    assert.equal(code(() => state.assertCancellable({ status, type: 'manual' })), 'failed-precondition', status);
  }
  assert.equal(code(() => state.assertCancellable({ status: 'upcoming', type: 'league' })), 'failed-precondition');
});

test('un partido cancelado se puede borrar; uno terminado, no', () => {
  assert.equal(code(() => state.assertDeletable({ status: 'cancelled', type: 'manual' })), null);
  assert.equal(code(() => state.assertDeletable({ status: 'completed', type: 'manual' })), 'failed-precondition');
});

test('equipos desactualizados: sólo si ya estaban armados', () => {
  assert.deepEqual(state.staleTeamsPatch({ teams: [] }), {});
  assert.deepEqual(state.staleTeamsPatch({}), {});
  assert.deepEqual(state.staleTeamsPatch({ teams: [{ players: [] }, { players: [] }] }), {});
  assert.deepEqual(state.staleTeamsPatch({ teams: [{ players: [{ uid: 'a' }] }, { players: [] }] }), { teamsGenerated: false });
});

test('cerrar la evaluación: los dos capitanes entre grupos; en el resto, el organizador', () => {
  const inter = { type: 'intergroup_friendly', ownerUid: 'org', captains: ['org', 'capB'] };
  assert.equal(access.canFinalizeEvaluation(inter, 'org'), true);
  assert.equal(access.canFinalizeEvaluation(inter, 'capB'), true);
  assert.equal(access.canFinalizeEvaluation(inter, 'otro'), false);
  const byTeams = { type: 'by_teams', ownerUid: 'org', captains: ['org', 'cap'] };
  assert.equal(access.canFinalizeEvaluation(byTeams, 'cap'), false);
  assert.equal(access.canFinalizeEvaluation(byTeams, 'org'), true);
});
