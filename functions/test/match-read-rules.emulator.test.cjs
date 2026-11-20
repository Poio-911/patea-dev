const { describe, it, before, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where, orderBy, limit } = require('firebase/firestore');

/**
 * Lectura del documento principal del partido y escritura de competiciones.
 * Las consultas de lista que hace la app tienen que seguir funcionando para
 * quien corresponde y fallar para un tercero.
 */
describe('lectura del partido y escritura de competiciones', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  let env;
  const as = (uid) => env.authenticatedContext(uid).firestore();
  const matches = (uid) => collection(as(uid), 'matches');

  before(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-patea-read',
      firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
    });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const fixtures = {
        'users/member': { groups: ['g1'] },
        'users/guest': { groups: ['g2'] },
        'users/old': { activeGroupId: 'g1' },
        'users/outsider': { groups: ['g9'] },
        'matches/priv': {
          ownerUid: 'org', captains: ['org'], playerUids: ['pl'], groupId: 'g1', participantGroupIds: ['g1', 'g2'], secondaryGroupId: 'g2',
          isPublic: false, status: 'upcoming', date: '2099-01-01', type: 'intergroup_friendly',
        },
        'matches/pub': { ownerUid: 'org', playerUids: [], groupId: 'g1', isPublic: true, status: 'upcoming', date: '2099-02-01', type: 'manual' },
        'matches/liga': { ownerUid: 'org', groupId: 'g1', status: 'upcoming', date: '2099-03-01', type: 'league', leagueInfo: { leagueId: 'L1' } },
        'feedActivities/f1': { groupId: 'g1', type: 'ovr_updated', createdAt: '2026-11-19T10:00:00Z' },
        'feedActivities/f2': { groupId: 'g2', type: 'match_finished', createdAt: '2026-11-19T11:00:00Z' },
        'players/pl/trainingLog/t1': { focusId: 'sho', createdAt: '2026-11-19T10:00:00Z' },
        'leagues/L1': { ownerUid: 'org', name: 'Liga' },
        'leagues/L1/fixtures/f1': { round: 1 },
        'cups/C1': { ownerUid: 'org', name: 'Copa' },
      };
      for (const [key, value] of Object.entries(fixtures)) await setDoc(doc(db, key), value);
    });
  });
  after(async () => { await env?.cleanup(); });

  it('un partido privado lo lee su gente: organizador, jugador, miembros de cualquiera de los dos grupos', async () => {
    for (const uid of ['org', 'pl', 'member', 'guest', 'old']) {
      await assertSucceeds(getDoc(doc(as(uid), 'matches/priv')));
    }
  });

  it('un tercero no lee un partido privado, pero sí uno público', async () => {
    await assertFails(getDoc(doc(as('outsider'), 'matches/priv')));
    await assertSucceeds(getDoc(doc(as('outsider'), 'matches/pub')));
  });

  it('listas de la app: del grupo, compartidos entre grupos y los míos', async () => {
    await assertSucceeds(getDocs(query(matches('member'), where('groupId', '==', 'g1'), orderBy('date', 'desc'), limit(50))));
    await assertSucceeds(getDocs(query(matches('guest'), where('secondaryGroupId', '==', 'g2'), orderBy('date', 'desc'), limit(50))));
    await assertSucceeds(getDocs(query(matches('pl'), where('playerUids', 'array-contains', 'pl'), limit(50))));
    await assertSucceeds(getDocs(query(matches('org'), where('ownerUid', '==', 'org'), where('status', '==', 'upcoming'), limit(50))));
  });

  it('listas de la app: públicos y de una competición los ve cualquiera', async () => {
    await assertSucceeds(getDocs(query(matches('outsider'), where('status', '==', 'upcoming'), where('isPublic', '==', true), where('date', '>=', '2000-01-01'), orderBy('date'), limit(50))));
    await assertSucceeds(getDocs(query(matches('outsider'), where('leagueInfo.leagueId', '==', 'L1'), limit(500))));
  });

  it('un tercero no lista partidos de un grupo ajeno ni los de otro jugador', async () => {
    await assertFails(getDocs(query(matches('outsider'), where('groupId', '==', 'g1'), orderBy('date', 'desc'), limit(50))));
    await assertFails(getDocs(query(matches('outsider'), where('playerUids', 'array-contains', 'pl'), limit(50))));
  });

  it('Comunidad: cada grupo ve sólo sus novedades, y nadie escribe', async () => {
    await assertSucceeds(getDocs(query(collection(as('member'), 'feedActivities'), where('groupId', '==', 'g1'), orderBy('createdAt', 'desc'), limit(25))));
    await assertSucceeds(getDocs(query(collection(as('old'), 'feedActivities'), where('groupId', '==', 'g1'), orderBy('createdAt', 'desc'), limit(25))));
    await assertFails(getDocs(query(collection(as('member'), 'feedActivities'), where('groupId', '==', 'g2'), orderBy('createdAt', 'desc'), limit(25))));
    await assertFails(getDocs(query(collection(as('outsider'), 'feedActivities'), where('groupId', '==', 'g1'), orderBy('createdAt', 'desc'), limit(25))));
    await assertFails(getDocs(collection(as('member'), 'feedActivities')));
    await assertFails(setDoc(doc(as('member'), 'feedActivities/x'), { groupId: 'g1' }));
  });

  it('el registro de entrenamiento lo lee sólo su dueño', async () => {
    await assertSucceeds(getDoc(doc(as('pl'), 'players/pl/trainingLog/t1')));
    await assertFails(getDoc(doc(as('outsider'), 'players/pl/trainingLog/t1')));
    await assertFails(setDoc(doc(as('pl'), 'players/pl/trainingLog/t2'), { focusId: 'sho' }));
  });

  it('las ligas y copas no se escriben desde el cliente, ni siquiera su dueño', async () => {
    const org = as('org');
    await assertSucceeds(getDoc(doc(org, 'leagues/L1')));
    await assertFails(updateDoc(doc(org, 'leagues/L1'), { name: 'Otra' }));
    await assertFails(setDoc(doc(org, 'leagues/nueva'), { ownerUid: 'org' }));
    await assertFails(setDoc(doc(org, 'leagues/L1/fixtures/f2'), { round: 2 }));
    await assertFails(updateDoc(doc(org, 'cups/C1'), { name: 'Otra' }));
    await assertFails(setDoc(doc(org, 'cups/nueva'), { ownerUid: 'org' }));
  });
});
