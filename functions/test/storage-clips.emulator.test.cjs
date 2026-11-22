const { describe, it, before, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc } = require('firebase/firestore');
const { ref, uploadBytes, deleteObject, getBytes } = require('firebase/storage');

/**
 * Storage de los clips (`match-clips/{partido}/{uid}/{0-9}.mp4`): suben los
 * vinculados al partido —organizador, capitanes, jugadores de cualquiera de los
 * dos equipos y miembros de los grupos que participan— con el partido en vivo o
 * terminado, y a lo sumo 10 por persona. Antes cualquier usuario con sesión
 * podía subir 40 MB a cualquier partido.
 *
 * Necesita los emuladores de Firestore y Storage a la vez: las reglas de Storage
 * leen el partido y el usuario de Firestore.
 */
const enabled = !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_STORAGE_EMULATOR_HOST;

describe('clips en Storage', { skip: !enabled && 'Requiere los emuladores de Firestore y Storage' }, () => {
  let env;
  const storageOf = (uid) => env.authenticatedContext(uid).storage();
  const video = () => new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
  const upload = (uid, matchId, file, contentType = 'video/mp4', asUid = uid) =>
    uploadBytes(ref(storageOf(uid), `match-clips/${matchId}/${asUid}/${file}`), video(), { contentType });

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
      projectId: 'demo-patea-storage',
      firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
      storage: { rules: fs.readFileSync(path.resolve(__dirname, '../../storage.rules'), 'utf8') },
    });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const fixtures = {
        'users/member': { groups: ['g2'] },
        'users/oldmember': { activeGroupId: 'g1' },
        'users/outsider': { groups: ['g9'], activeGroupId: 'g9' },
        'matches/live': { ...base, status: 'active' },
        'matches/done': { ...base, status: 'completed' },
        'matches/soon': { ...base, status: 'upcoming' },
        'matches/open': { ...base, status: 'completed', isPublic: true },
      };
      for (const [key, value] of Object.entries(fixtures)) await setDoc(doc(db, key), value);
    });
  });
  after(async () => { await env?.cleanup(); });

  it('suben todos los vinculados, de cualquiera de los dos equipos', async () => {
    for (const uid of ['org', 'cap', 'capB', 'pl', 'plB', 'member', 'oldmember']) {
      await assertSucceeds(upload(uid, 'live', '0.mp4'));
    }
  });

  it('un tercero sin vínculo no sube, ni en la ruta de otro', async () => {
    await assertFails(upload('outsider', 'live', '0.mp4'));
    await assertFails(upload('outsider', 'live', '1.mp4', 'video/mp4', 'pl'));
    await assertFails(upload('pl', 'live', '1.mp4', 'video/mp4', 'plB'));
  });

  it('el nombre del archivo fija el tope: un dígito, y sólo video', async () => {
    await assertSucceeds(upload('pl', 'live', '9.mov', 'video/quicktime'));
    await assertSucceeds(upload('pl', 'live', '8.webm', 'video/webm'));
    await assertFails(upload('pl', 'live', '10.mp4'));
    await assertFails(upload('pl', 'live', 'clip.mp4'));
    await assertFails(upload('pl', 'live', '2.mp4', 'image/png'));
  });

  it('sólo con el partido en vivo o terminado', async () => {
    await assertFails(upload('pl', 'soon', '0.mp4'));
    await assertSucceeds(upload('pl', 'done', '0.mp4'));
  });

  it('un partido privado no lo ve un tercero; uno público, sí', async () => {
    await assertSucceeds(upload('pl', 'open', '0.mp4'));
    await assertFails(getBytes(ref(storageOf('outsider'), 'match-clips/done/pl/0.mp4')));
    await assertSucceeds(getBytes(ref(storageOf('member'), 'match-clips/done/pl/0.mp4')));
    await assertSucceeds(getBytes(ref(storageOf('outsider'), 'match-clips/open/pl/0.mp4')));
  });

  it('cada uno borra lo suyo y los gestores cualquiera', async () => {
    await assertSucceeds(upload('pl', 'live', '5.mp4'));
    await assertFails(deleteObject(ref(storageOf('member'), 'match-clips/live/pl/5.mp4')));
    await assertFails(deleteObject(ref(storageOf('outsider'), 'match-clips/live/pl/5.mp4')));
    await assertSucceeds(deleteObject(ref(storageOf('capB'), 'match-clips/live/pl/5.mp4')));
    await assertSucceeds(deleteObject(ref(storageOf('pl'), 'match-clips/live/pl/0.mp4')));
  });
});
