const { describe, it, before, after } = require('node:test');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, collection, query, where } = require('firebase/firestore');

describe('reglas publicadas corregidas: privacidad', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  let env;
  before(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-patea-privacy',
      firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
    });
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      const fixtures = {
        'leagues/privacy-league': {ownerUid:'organizer',isPublic:true},
        'cups/privacy-cup': {ownerUid:'organizer',isPublic:true},
        'competitionApplications/privacy-application': {competitionId:'privacy-league',competitionType:'league',submittedBy:'alice',teamId:'team',status:'pending'},
        'leagues/privacy-league/applications/external': {captainName:'Privado',status:'pending'},
        'cups/privacy-cup/applications/external': {captainName:'Privado',status:'pending'},
        'matches/match': { ownerUid: 'organizer', playerUids: ['alice', 'bob'] },
        'evaluations/private-eval': { evaluatorId: 'alice', playerId: 'bob', matchId: 'match', rating: 7 },
        'evaluations/revealed-eval': { evaluatorId: 'alice', playerId: 'bob', identityRevealed: true },
        'matches/match/assignments/assignment': { evaluatorId: 'alice', subjectId: 'bob', matchId: 'match', status: 'completed' },
        'matches/match/assignments/assignment/private/evaluation': { evaluationId: 'private-eval' },
        'matches/match/processedSubmissions/submission': { evaluatorId: 'alice', submission: {} },
        'matches/match/messages/message': { senderId: 'alice', text: 'Hola' },
        'matches/match/invitations/invite': { playerId: 'bob' },
      };
      await Promise.all(Object.entries(fixtures).map(([key, value]) => setDoc(doc(db, key), value)));
    });
  });
  after(async () => { await env?.cleanup(); });

  it('solamente el autor lee evaluaciones crudas no reveladas', async () => {
    for (const uid of ['bob', 'stranger', 'organizer']) {
      await assertFails(getDoc(doc(env.authenticatedContext(uid).firestore(), 'evaluations/private-eval')));
    }
    await assertSucceeds(getDoc(doc(env.authenticatedContext('alice').firestore(), 'evaluations/private-eval')));
    await assertSucceeds(getDoc(doc(env.authenticatedContext('bob').firestore(), 'evaluations/revealed-eval')));
  });

  it('no se puede deducir autoría leyendo asignaciones o submissions ajenas', async () => {
    const db = env.authenticatedContext('bob').firestore();
    for (const key of ['matches/match/assignments/assignment', 'matches/match/processedSubmissions/submission']) {
      await assertFails(getDoc(doc(db, key)));
    }
    const aliceDb = env.authenticatedContext('alice').firestore();
    await assertSucceeds(getDocs(query(collection(aliceDb, 'matches/match/assignments'), where('evaluatorId', '==', 'alice'))));
    await assertSucceeds(getDocs(query(collection(aliceDb, 'matches/match/processedSubmissions'), where('evaluatorId', '==', 'alice'))));
    await assertSucceeds(getDocs(collection(env.authenticatedContext('organizer').firestore(), 'matches/match/assignments')));
  });

  it('el organizador ve progreso sin vínculo a evaluación y nadie lee la auditoría privada', async () => {
    const organizer = env.authenticatedContext('organizer').firestore();
    const assignment = await assertSucceeds(getDoc(doc(organizer, 'matches/match/assignments/assignment')));
    assert.equal(assignment.data().status, 'completed');
    assert.equal(Object.hasOwn(assignment.data(), 'evaluationId'), false);
    for (const uid of ['organizer', 'alice', 'bob', 'stranger']) {
      await assertFails(getDoc(doc(env.authenticatedContext(uid).firestore(), 'matches/match/assignments/assignment/private/evaluation')));
    }
  });

  it('las reglas genéricas no reabren mensajes ni invitaciones', async () => {
    const stranger = env.authenticatedContext('stranger').firestore();
    await assertFails(getDoc(doc(stranger, 'matches/match/messages/message')));
    await assertFails(getDoc(doc(stranger, 'matches/match/invitations/invite')));
    await assertSucceeds(getDoc(doc(env.authenticatedContext('alice').firestore(), 'matches/match/messages/message')));
    await assertSucceeds(getDoc(doc(env.authenticatedContext('bob').firestore(), 'matches/match/invitations/invite')));
  });
  it('postulaciones visibles sólo para el autor y el organizador, incluida la inscripción externa', async()=>{
    const alice=env.authenticatedContext('alice').firestore(), organizer=env.authenticatedContext('organizer').firestore(), stranger=env.authenticatedContext('stranger').firestore();
    await assertSucceeds(getDoc(doc(alice,'competitionApplications/privacy-application')));
    await assertSucceeds(getDoc(doc(organizer,'competitionApplications/privacy-application')));
    await assertFails(getDoc(doc(stranger,'competitionApplications/privacy-application')));
    await assertFails(getDocs(collection(stranger,'competitionApplications')));
    await assertSucceeds(getDocs(query(collection(organizer,'competitionApplications'),where('competitionId','==','privacy-league'),where('competitionType','==','league'))));
    await assertSucceeds(getDocs(query(collection(alice,'competitionApplications'),where('competitionId','==','privacy-league'),where('competitionType','==','league'),where('submittedBy','==','alice'))));
    for(const col of ['leagues/privacy-league','cups/privacy-cup']) {
      await assertSucceeds(getDoc(doc(organizer,`${col}/applications/external`)));
      await assertFails(getDoc(doc(stranger,`${col}/applications/external`)));
    }
  });

});
