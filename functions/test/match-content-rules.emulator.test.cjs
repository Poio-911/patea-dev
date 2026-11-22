const { describe, it, before, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, arrayUnion } = require('firebase/firestore');

/**
 * Reglas de lo que cuelga de un partido: clips, chat, presencia, solicitudes y
 * asignaciones. Ver docs/technical/REGLAS_POR_TIPO_DE_PARTIDO.md §6 y §7.
 *
 * Cada persona de los fixtures representa un rol distinto:
 *   org / cap / capB  organizador y capitanes     pl / plB  jugadores (equipo A y B)
 *   member            miembro de un grupo participante que no juega
 *   oldmember         ídem, pero sólo con `activeGroupId` (usuarios anteriores a `groups`)
 *   outsider          usuario con sesión sin ningún vínculo
 */
describe('reglas de contenido del partido', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  let env;
  const as = (uid) => env.authenticatedContext(uid).firestore();
  const clip = (uid, extra = {}) => ({ minute: 12, url: 'https://example.com/c.mp4', uploadedBy: uid, ...extra });

  const base = {
    ownerUid: 'org',
    captains: ['org', 'cap', 'capB'],
    playerUids: ['pl', 'plB'],
    groupId: 'g1',
    participantGroupIds: ['g1', 'g2'],
    type: 'intergroup_friendly',
    isPublic: false,
  };

  before(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-patea-content',
      firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
    });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const fixtures = {
        'users/member': { groups: ['g2'] },
        'users/oldmember': { activeGroupId: 'g1' },
        'users/outsider': { groups: ['g9'], activeGroupId: 'g9' },
        'users/pl': { groups: ['g1'] },
        'matches/live': { ...base, status: 'active' },
        'matches/done': { ...base, status: 'completed' },
        'matches/soon': { ...base, status: 'upcoming' },
        'matches/open': { ...base, status: 'completed', isPublic: true },
        // Un partido sin `captains` (todos los anteriores a los desafíos).
        'matches/legacy': { ownerUid: 'org', playerUids: ['pl'], groupId: 'g1', status: 'completed', type: 'manual' },
        'matches/done/messages/m1': { senderId: 'pl', text: 'hola', reactions: [] },
        'matches/done/clips/pl_0': clip('pl'),
        'matches/done/clips/legacy-1700000000000': clip('plB'),
        'matches/done/joinRequests/outsider': { uid: 'outsider', displayName: 'X' },
        'matches/done/selfEvaluations/s1': { playerId: 'pl', goals: 1 },
        'matches/done/assignments/a1': { evaluatorId: 'plB', subjectId: 'pl' },
        'matches/legacy/assignments/a1': { evaluatorId: 'pl', subjectId: 'x' },
      };
      for (const [key, value] of Object.entries(fixtures)) await setDoc(doc(db, key), value);
    });
  });
  after(async () => { await env?.cleanup(); });

  // ------------------------------------------------------------------ clips

  it('suben clips todos los vinculados, de cualquiera de los dos equipos', async () => {
    // organizador, capitanes de los dos equipos, jugadores de los dos equipos
    // y miembros de los grupos que participan (también el que sólo tiene activeGroupId)
    for (const uid of ['org', 'cap', 'capB', 'pl', 'plB', 'member', 'oldmember']) {
      await assertSucceeds(setDoc(doc(as(uid), `matches/live/clips/${uid}_0`), clip(uid)));
    }
  });

  it('un tercero sin vínculo no sube clips, ni firmando como otro', async () => {
    const db = as('outsider');
    await assertFails(setDoc(doc(db, 'matches/live/clips/outsider_0'), clip('outsider')));
    await assertFails(setDoc(doc(db, 'matches/live/clips/pl_1'), clip('pl')));
    await assertFails(setDoc(doc(as('pl'), 'matches/live/clips/pl_2'), clip('plB')));
  });

  it('el id del clip fija el tope: {uid}_{0-9}, a lo sumo 10 por persona', async () => {
    const db = as('pl');
    await assertSucceeds(setDoc(doc(db, 'matches/live/clips/pl_9'), clip('pl')));
    await assertFails(setDoc(doc(db, 'matches/live/clips/pl_10'), clip('pl')));
    await assertFails(setDoc(doc(db, 'matches/live/clips/cualquier-id'), clip('pl')));
    // No se pisa un clip existente.
    await assertFails(setDoc(doc(db, 'matches/live/clips/pl_9'), clip('pl', { minute: 99 })));
  });

  it('sólo con el partido en vivo o terminado', async () => {
    await assertFails(setDoc(doc(as('pl'), 'matches/soon/clips/pl_0'), clip('pl')));
    await assertSucceeds(setDoc(doc(as('pl'), 'matches/done/clips/pl_3'), clip('pl')));
  });

  it('un partido sin captains (anterior a los desafíos) sigue funcionando', async () => {
    await assertSucceeds(setDoc(doc(as('pl'), 'matches/legacy/clips/pl_0'), clip('pl')));
    await assertFails(setDoc(doc(as('outsider'), 'matches/legacy/clips/outsider_0'), clip('outsider')));
  });

  it('un partido privado no lo ve un tercero; uno público, sí', async () => {
    await assertFails(getDocs(collection(as('outsider'), 'matches/done/clips')));
    await assertSucceeds(getDocs(collection(as('member'), 'matches/done/clips')));
    await assertSucceeds(getDocs(collection(as('outsider'), 'matches/open/clips')));
  });

  it('cada uno borra lo suyo y los gestores cualquiera; el resto, nada', async () => {
    await assertFails(deleteDoc(doc(as('member'), 'matches/done/clips/pl_0')));
    await assertFails(deleteDoc(doc(as('outsider'), 'matches/done/clips/pl_0')));
    // Los clips anteriores a esta regla (id con milisegundos) se pueden borrar igual.
    await assertSucceeds(deleteDoc(doc(as('capB'), 'matches/done/clips/legacy-1700000000000')));
    await assertSucceeds(deleteDoc(doc(as('cap'), 'matches/done/clips/pl_0')));
    await assertSucceeds(deleteDoc(doc(as('pl'), 'matches/done/clips/pl_3')));
  });

  // ------------------------------------------------------------------- chat

  it('en el chat se reacciona y se marca como leído, pero no se reescribe lo ajeno', async () => {
    const plB = as('plB');
    const message = doc(plB, 'matches/done/messages/m1');
    await assertSucceeds(updateDoc(message, { reactions: arrayUnion({ emoji: '👍', userId: 'plB' }) }));
    await assertSucceeds(updateDoc(message, { readBy: arrayUnion('plB'), status: 'read' }));
    await assertFails(updateDoc(message, { text: 'reescrito' }));
    await assertFails(updateDoc(message, { senderId: 'plB' }));
  });

  it('cada uno edita sólo su propio mensaje, y no puede cambiar el autor', async () => {
    const pl = as('pl');
    const message = doc(pl, 'matches/done/messages/m1');
    await assertSucceeds(updateDoc(message, { text: 'hola (editado)', editedAt: 'ahora' }));
    await assertFails(updateDoc(message, { senderId: 'plB' }));
    await assertFails(updateDoc(doc(as('outsider'), 'matches/done/messages/m1'), { text: 'x' }));
  });

  // -------------------------------------------------------------- presencia

  it('la presencia: privado sólo vinculados; público, cualquiera; y sólo la propia', async () => {
    await assertSucceeds(setDoc(doc(as('member'), 'matches/done/presence/member'), { at: 1 }));
    await assertFails(setDoc(doc(as('outsider'), 'matches/done/presence/outsider'), { at: 1 }));
    await assertFails(setDoc(doc(as('member'), 'matches/done/presence/pl'), { at: 1 }));
    await assertSucceeds(setDoc(doc(as('outsider'), 'matches/open/presence/outsider'), { at: 1 }));
    await assertFails(getDocs(collection(as('outsider'), 'matches/done/presence')));
  });

  // ---------------------------------------------------------- solicitudes

  it('las solicitudes las ven el organizador, los capitanes y quien pidió; nadie más', async () => {
    await assertSucceeds(getDoc(doc(as('org'), 'matches/done/joinRequests/outsider')));
    await assertSucceeds(getDoc(doc(as('cap'), 'matches/done/joinRequests/outsider')));
    await assertSucceeds(getDoc(doc(as('outsider'), 'matches/done/joinRequests/outsider')));
    for (const uid of ['pl', 'member']) {
      await assertFails(getDoc(doc(as(uid), 'matches/done/joinRequests/outsider')));
    }
    await assertFails(setDoc(doc(as('org'), 'matches/done/joinRequests/x'), { uid: 'x' }));
  });

  // ------------------------------------------------------- autoevaluaciones

  it('las autoevaluaciones las leen los participantes, no un tercero ni un miembro del grupo', async () => {
    for (const uid of ['org', 'cap', 'pl', 'plB']) {
      await assertSucceeds(getDoc(doc(as(uid), 'matches/done/selfEvaluations/s1')));
    }
    for (const uid of ['outsider', 'member']) {
      await assertFails(getDoc(doc(as(uid), 'matches/done/selfEvaluations/s1')));
    }
    await assertFails(setDoc(doc(as('pl'), 'matches/done/selfEvaluations/s2'), { playerId: 'pl' }));
  });

  // ------------------------------------------------------------ asignaciones

  it('en un partido entre grupos los dos capitanes ven las asignaciones', async () => {
    for (const uid of ['org', 'cap', 'capB']) {
      await assertSucceeds(getDoc(doc(as(uid), 'matches/done/assignments/a1')));
    }
    await assertSucceeds(getDoc(doc(as('plB'), 'matches/done/assignments/a1'))); // su propio evaluador
    await assertFails(getDoc(doc(as('member'), 'matches/done/assignments/a1')));
  });

  it('en cualquier otro tipo, sólo el organizador', async () => {
    await assertSucceeds(getDoc(doc(as('org'), 'matches/legacy/assignments/a1')));
    await assertFails(getDoc(doc(as('member'), 'matches/legacy/assignments/a1')));
  });
});
