import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { normalizeContact, manualFields, assertManualCreator, verifiedContactMatches, replacePlayerReferences } from '../lib/manual-players';

const options = { region: 'us-central1' };
function auth(request: {auth?: {uid: string} | null}) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}
function id(value: unknown) {
  if (typeof value !== 'string' || !value || value.includes('/') || value.length > 128) throw new HttpsError('invalid-argument', 'Identificador inválido.');
  return value;
}
function member(group: any, uid: string) {
  if (!group || !(group.ownerUid === uid || group.members?.includes(uid) || group.memberRoles?.some((m: any) => m.userId === uid))) throw new HttpsError('permission-denied', 'Debés pertenecer al grupo.');
}

export const createManualPlayer = onCall(options, async request => {
  const uid = auth(request), data = request.data ?? {}, groupId = id(data.groupId);
  const fields = manualFields(data), contact = normalizeContact(data);
  const db = admin.firestore(), ref = db.collection('players').doc();
  await db.runTransaction(async tx => {
    member((await tx.get(db.doc(`groups/${groupId}`))).data(), uid);
    tx.set(ref, { ...fields, groupId, ownerUid: uid, createdBy: uid, stats: {matchesPlayed: 0, goals: 0, assists: 0, averageRating: 0}, createdAt: new Date().toISOString() });
    tx.set(db.doc(`manualPlayerContacts/${ref.id}`), {...contact, createdBy: uid, groupId});
  });
  return {ok: true, id: ref.id};
});

export const getManualPlayerContact = onCall(options, async request => {
  const uid = auth(request), playerId = id(request.data?.playerId), db = admin.firestore();
  assertManualCreator((await db.doc(`players/${playerId}`).get()).data(), playerId, uid);
  const data = (await db.doc(`manualPlayerContacts/${playerId}`).get()).data();
  return {email: data?.email ?? '', phone: data?.phone ?? ''};
});

export const updateManualPlayer = onCall(options, async request => {
  const uid = auth(request), playerId = id(request.data?.playerId), db = admin.firestore();
  const fields = manualFields(request.data ?? {}), contact = normalizeContact(request.data ?? {});
  await db.runTransaction(async tx => {
    const ref = db.doc(`players/${playerId}`), player = (await tx.get(ref)).data();
    assertManualCreator(player, playerId, uid);
    member((await tx.get(db.doc(`groups/${id(player!.groupId)}`))).data(), uid);
    const history = await tx.get(ref.collection('ovrHistory').limit(1));
    const hasHistory = Number(player!.stats?.matchesPlayed ?? 0) > 0 || !history.empty;
    tx.update(ref, hasHistory ? {name: fields.name, position: fields.position} : fields);
    tx.set(db.doc(`manualPlayerContacts/${playerId}`), {...contact, createdBy: uid, groupId: player!.groupId});
  });
  return {ok: true};
});

export const deleteManualPlayer = onCall(options, async request => {
  const uid = auth(request), playerId = id(request.data?.playerId), db = admin.firestore();
  await db.runTransaction(async tx => {
    const ref = db.doc(`players/${playerId}`), player = (await tx.get(ref)).data();
    assertManualCreator(player, playerId, uid);
    member((await tx.get(db.doc(`groups/${id(player!.groupId)}`))).data(), uid);
    const matches = await tx.get(db.collection('matches').where('playerUids', 'array-contains', playerId).limit(301));
    if (matches.size > 300 || matches.docs.some(d => !['completed', 'evaluated', 'cancelled'].includes(d.data().status))) throw new HttpsError('failed-precondition', 'Primero quitá al jugador de los partidos pendientes o en vivo.');
    const teams = await tx.get(db.collection('teams').where('groupId', '==', player!.groupId).limit(301));
    if (teams.size > 300) throw new HttpsError('resource-exhausted', 'El grupo necesita una revisión antes de quitar este jugador.');
    for (const team of teams.docs) {
      const members = team.data().members;
      const playerIds = team.data().playerIds;
      const update: Record<string, unknown> = {};
      if (Array.isArray(members)) update.members = members.filter((m: any) => (typeof m === 'string' ? m : m.uid ?? m.id ?? m.playerId) !== playerId);
      if (Array.isArray(playerIds)) update.playerIds = playerIds.filter((pid: unknown) => pid !== playerId);
      if (Object.keys(update).length) tx.update(team.ref, update);
    }
    tx.update(ref, {archived: true, archivedAt: new Date().toISOString(), previousGroupId: player!.groupId, groupId: null});
    tx.delete(db.doc(`manualPlayerContacts/${playerId}`));
  });
  return {ok: true};
});

export const findManualPlayerClaims = onCall(options, async request => {
  const uid = auth(request), account = await admin.auth().getUser(uid), db = admin.firestore();
  const queries: admin.firestore.Query[] = [];
  if (account.emailVerified && account.email) queries.push(db.collection('manualPlayerContacts').where('email', '==', account.email.toLowerCase()));
  if (account.phoneNumber) queries.push(db.collection('manualPlayerContacts').where('phone', '==', account.phoneNumber));
  const contacts = (await Promise.all(queries.map(q => q.limit(21).get()))).flatMap(s => s.docs);
  const candidates = [];
  for (const contact of new Map(contacts.map(c => [c.id, c])).values()) {
    const player = (await db.doc(`players/${contact.id}`).get()).data();
    if (!player || player.archived || player.claimedBy || player.ownerUid === contact.id) continue;
    const group = player.groupId ? (await db.doc(`groups/${player.groupId}`).get()).data() : null;
    candidates.push({id: contact.id, name: player.name, position: player.position, groupName: group?.name ?? 'Plantel', matchesPlayed: player.stats?.matchesPlayed ?? 0});
  }
  return {candidates};
});

export const claimManualPlayer = onCall({...options, timeoutSeconds: 120}, async request => {
  const uid = auth(request), playerId = id(request.data?.playerId), db = admin.firestore();
  if (playerId === uid || request.data?.confirmed !== true) throw new HttpsError('invalid-argument', 'Confirmá que sos este jugador.');
  const account = await admin.auth().getUser(uid);
  return claimManualPlayerCore(db, uid, playerId, account);
});

export async function claimManualPlayerCore(db: admin.firestore.Firestore, uid: string, playerId: string, account: {email?: string; emailVerified?: boolean; phoneNumber?: string}) {
  await db.runTransaction(async tx => {
    const sourceRef = db.doc(`players/${playerId}`), targetRef = db.doc(`players/${uid}`), contactRef = db.doc(`manualPlayerContacts/${playerId}`), userRef = db.doc(`users/${uid}`);
    const [sourceDoc, targetDoc, contactDoc, userDoc] = await tx.getAll(sourceRef, targetRef, contactRef, userRef);
    const source = sourceDoc.data(), target = targetDoc.data(), contact = contactDoc.data();
    if (source?.claimedBy === uid) return;
    if (!source || source.archived || source.claimedBy || source.ownerUid === playerId || !contact || !verifiedContactMatches(contact, account)) throw new HttpsError('permission-denied', 'El contacto verificado no coincide o el perfil ya no está disponible.');
    const groupId = id(source.groupId), groupRef = db.doc(`groups/${groupId}`), group = (await tx.get(groupRef)).data();
    if (!group || !userDoc.exists || !targetDoc.exists) throw new HttpsError('failed-precondition', 'Primero completá el registro de tu cuenta.');
    const ownMatches = await tx.get(db.collection('matches').where('playerUids', 'array-contains', uid).limit(1));
    const ownEvals = await tx.get(db.collection('evaluations').where('playerId', '==', uid).limit(1));
    const ownHistory = await tx.get(targetRef.collection('ovrHistory').limit(1));
    if (target?.claimedFrom || Number(target?.stats?.matchesPlayed ?? 0) > 0 || !ownMatches.empty || !ownEvals.empty || !ownHistory.empty) throw new HttpsError('failed-precondition', 'Tu cuenta ya tiene actividad. No podemos mezclar dos historiales automáticamente.');
    const writes = new Map<string, {ref: admin.firestore.DocumentReference; data: any}>();
    const stage = (doc: admin.firestore.QueryDocumentSnapshot) => {
      const data = replacePlayerReferences(doc.data(), playerId, uid);
      if (JSON.stringify(data) !== JSON.stringify(doc.data())) writes.set(doc.ref.path, {ref: doc.ref, data});
    };
    const matches = await tx.get(db.collection('matches').where('playerUids', 'array-contains', playerId).limit(151));
    if (matches.size > 150) throw new HttpsError('resource-exhausted', 'Este historial requiere una migración asistida. No se modificó ningún dato.');
    for (const match of matches.docs) {
      if (['active', 'live'].includes(match.data().status)) throw new HttpsError('failed-precondition', 'Esperá a que termine el partido en vivo para recuperar tu perfil.');
      const pending = await tx.get(db.collection('evaluationSubmissions').where('matchId', '==', match.id).limit(1));
      if (!pending.empty) throw new HttpsError('aborted', 'Hay evaluaciones procesándose. Volvé a intentar en unos segundos.');
      stage(match);
      for (const name of ['assignments', 'selfEvaluations', 'processedSubmissions']) {
        const docs = await tx.get(match.ref.collection(name).limit(401));
        if (docs.size > 400) throw new HttpsError('resource-exhausted', 'Este historial requiere una migración asistida.');
        docs.docs.forEach(stage);
      }
    }
    const evals = await tx.get(db.collection('evaluations').where('playerId', '==', playerId).limit(401));
    const teams = await tx.get(db.collection('teams').where('groupId', '==', groupId).limit(401));
    const history = await tx.get(sourceRef.collection('ovrHistory').limit(401));
    if ([evals, teams, history].some(s => s.size > 400) || writes.size + evals.size + teams.size + history.size + 6 > 400) throw new HttpsError('resource-exhausted', 'Este historial requiere una migración asistida. No se modificó ningún dato.');
    evals.docs.forEach(stage); teams.docs.forEach(stage);
    for (const write of writes.values()) tx.set(write.ref, write.data);
    for (const doc of history.docs) tx.set(targetRef.collection('ovrHistory').doc(doc.id), doc.data());
    tx.set(targetRef, {...target, ...source, ownerUid: uid, createdBy: source.createdBy ?? source.ownerUid, claimedFrom: playerId, claimedAt: new Date().toISOString(), cardGenerationCredits: target?.cardGenerationCredits ?? 3});
    tx.update(sourceRef, {claimedBy: uid, archived: true, groupId: null, previousGroupId: groupId});
    tx.delete(contactRef);
    tx.set(userRef, {groups: admin.firestore.FieldValue.arrayUnion(groupId), activeGroupId: groupId, displayName: source.name}, {merge: true});
    const roles = Array.isArray(group.memberRoles) ? [...group.memberRoles] : [];
    if (!roles.some((r: any) => r.userId === uid)) roles.push({userId: uid, role: 'member', joinedAt: new Date().toISOString(), addedBy: source.ownerUid});
    tx.update(groupRef, {members: admin.firestore.FieldValue.arrayUnion(uid), memberRoles: roles});
  });
  return {ok: true, playerId: uid};
}
