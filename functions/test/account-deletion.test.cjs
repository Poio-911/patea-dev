const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scrubDeletedUser, pickNextOwner, isRecentLogin } = require('../lib/lib/account-deletion');

test('anonimiza al usuario en partidos sin tocar a los demás', () => {
  const match = {
    id: 'm1',
    players: [
      { uid: 'a', displayName: 'Ana', photoURL: 'x', ovr: 70 },
      { uid: 'b', displayName: 'Beto', photoURL: 'y', ovr: 65 },
    ],
    teams: [{ players: [{ uid: 'a', displayName: 'Ana', photoURL: 'x' }] }],
    playerUids: ['a', 'b'],
  };
  const { value, changed } = scrubDeletedUser(match, 'a');
  assert.equal(changed, true);
  assert.equal(value.players[0].displayName, 'Jugador eliminado');
  assert.equal(value.players[0].photoURL, '');
  assert.equal(value.players[0].ovr, 70);
  assert.equal(value.players[1].displayName, 'Beto');
  assert.equal(value.teams[0].players[0].displayName, 'Jugador eliminado');
  assert.deepEqual(value.playerUids, ['a', 'b']);
  assert.equal(match.players[0].displayName, 'Ana');
});

test('no marca cambios si el usuario ya estaba anonimizado o no aparece', () => {
  const { changed } = scrubDeletedUser({ players: [{ uid: 'b', displayName: 'Beto' }] }, 'a');
  assert.equal(changed, false);
  const again = scrubDeletedUser({ players: [{ uid: 'a', displayName: 'Jugador eliminado', photoURL: '' }] }, 'a');
  assert.equal(again.changed, false);
});

test('el grupo pasa al admin más antiguo y si no hay, al integrante más antiguo', () => {
  const group = {
    members: ['o', 'x', 'y', 'z'],
    memberRoles: [
      { userId: 'o', role: 'admin', joinedAt: '2026-01-01' },
      { userId: 'x', role: 'member', joinedAt: '2026-01-02' },
      { userId: 'y', role: 'admin', joinedAt: '2026-03-01' },
      { userId: 'z', role: 'admin', joinedAt: '2026-02-01' },
    ],
  };
  assert.equal(pickNextOwner(group, 'o'), 'z');
  assert.equal(pickNextOwner({ ...group, memberRoles: group.memberRoles.map((r) => ({ ...r, role: 'member' })) }, 'o'), 'x');
  assert.equal(pickNextOwner({ members: ['o', 'q'] }, 'o'), 'q');
  assert.equal(pickNextOwner({ members: ['o'] }, 'o'), null);
});

test('la sesión reciente se mide en segundos de auth_time', () => {
  const now = 1_800_000_000_000;
  assert.equal(isRecentLogin(now / 1000 - 60, now), true);
  assert.equal(isRecentLogin(now / 1000 - 3600, now), false);
  assert.equal(isRecentLogin(undefined, now), false);
});
