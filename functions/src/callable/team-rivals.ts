import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { emptyRival, rivalDocId, sortRivals } from '../lib/team-rivals';
import { teamAccess, validId, writeRivals } from '../lib/team-rivals-store';

function auth(request: {auth?: {uid: string} | null}) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}
const region = {region: 'us-central1'};

export const getTeamRivals = onCall(region, async request => {
  const uid = auth(request), ownTeamId = validId(request.data?.ownTeamId), db = admin.firestore();
  const access = await teamAccess(db, uid, ownTeamId);
  const visible = await db.collection('teamRivals').where('ownTeamId', '==', ownTeamId).where('hidden', '==', false).limit(100).get();
  let hiddenQuery = db.collection('teamRivals').where('ownTeamId', '==', ownTeamId).where('hidden', '==', true).orderBy(admin.firestore.FieldPath.documentId()).limit(101);
  const cursor = request.data?.hiddenCursor;
  if (cursor != null) hiddenQuery = hiddenQuery.startAfter(validId(cursor));
  const hidden = request.data?.includeHidden === true ? await hiddenQuery.get() : null;
  const docs = [...visible.docs, ...(hidden?.docs.slice(0, 100) ?? [])];
  const teamIds = [...new Set(docs.map(d => String(d.data().rivalTeamId)))];
  const teams = teamIds.length ? await db.getAll(...teamIds.map(id => db.doc(`teams/${id}`))) : [];
  const teamMap = new Map(teams.filter(d => d.exists).map(d => [d.id, d.data()!]));
  const groupIds = [...new Set([...teamMap.values()].map(t => t.groupId).filter(Boolean))];
  const groups = groupIds.length ? await db.getAll(...groupIds.map(id => db.doc(`groups/${id}`))) : [];
  const groupMap = new Map(groups.map(g => [g.id, g.data()?.name ?? 'Grupo']));
  const [outgoing, incoming, matches] = await Promise.all([
    db.collectionGroup('invitations').where('fromTeamId', '==', ownTeamId).where('status', '==', 'pending').get(),
    db.collection(`teams/${ownTeamId}/invitations`).where('status', '==', 'pending').get(),
    db.collection('matches').where('participantTeamIds', 'array-contains', ownTeamId).where('status', 'in', ['planning', 'upcoming', 'active']).get(),
  ]);
  const pendingIds = new Set([...outgoing.docs.map(d => d.data().toTeamId ?? d.ref.parent.parent?.id), ...incoming.docs.map(d => d.data().fromTeamId)]);
  const rivals = docs.map(doc => {
    const data = doc.data(), rival = teamMap.get(data.rivalTeamId);
    const upcoming = matches.docs.find(m => m.data().participantTeamIds?.includes(data.rivalTeamId));
    const pendingChallenge = pendingIds.has(data.rivalTeamId);
    const reason = !rival ? 'Equipo eliminado' : rival.groupId === access.data.groupId ? 'Ahora pertenece a tu grupo' : rival.challengeOptOut ? 'No recibe desafíos' : !rival.members?.length ? 'Sin plantel' : pendingChallenge ? 'Desafío pendiente' : upcoming ? 'Partido acordado' : '';
    return {...data, name: rival?.name ?? data.rivalSnapshot?.name ?? 'Equipo eliminado', jersey: rival?.jersey ?? data.rivalSnapshot?.jersey ?? null,
      groupName: rival ? groupMap.get(rival.groupId) ?? 'Grupo' : data.rivalSnapshot?.groupName ?? '', memberCount: rival?.members?.length ?? 0,
      pendingChallenge, hasUpcomingMatch: !!upcoming, upcomingMatchId: upcoming?.id ?? null, canChallenge: access.canManage && !reason, unavailableReason: reason};
  });
  // Cache only changed artwork/name as a fallback for a later deletion. Never
  // merge-create a missing row: deletion must not resurrect partial history.
  await Promise.all(docs.map(async doc => {
    const rival = teamMap.get(doc.data().rivalTeamId);
    if (!rival) return;
    const snapshot = {name: rival.name ?? 'Equipo', jersey: rival.jersey ?? null, groupName: groupMap.get(rival.groupId) ?? ''};
    if (JSON.stringify(snapshot) !== JSON.stringify(doc.data().rivalSnapshot)) {
      try { await doc.ref.update({rivalSnapshot: snapshot}); }
      catch (error) { console.warn('Could not refresh rival fallback', doc.id); }
    }
  }));
  return {rivals: sortRivals(rivals), canManage: access.canManage, hasMoreHidden: (hidden?.size ?? 0) > 100, hiddenCursor: hidden?.docs[Math.min(99, hidden.size - 1)]?.id ?? null};
});

export const setTeamRival = onCall(region, async request => {
  const uid = auth(request), ownId = validId(request.data?.ownTeamId), rivalId = validId(request.data?.rivalTeamId), db = admin.firestore();
  if (ownId === rivalId) throw new HttpsError('invalid-argument', 'Elegí otro equipo.');
  for (const field of ['favorite', 'hidden', 'save']) if (request.data?.[field] !== undefined && typeof request.data[field] !== 'boolean') throw new HttpsError('invalid-argument', 'Opción inválida.');
  return db.runTransaction(async tx => {
    const own = await teamAccess(db, uid, ownId, true, tx);
    const [rivalSnap, doc] = await tx.getAll(db.doc(`teams/${rivalId}`), db.doc(`teamRivals/${rivalDocId(ownId, rivalId)}`));
    const rival = rivalSnap.data(), old = doc.data();
    if (!old && request.data?.save !== true) throw new HttpsError('not-found', 'El rival no está guardado.');
    if (!old && (!rival || rival.challengeOptOut || rival.groupId === own.data.groupId)) throw new HttpsError('failed-precondition', 'Este equipo no se puede guardar como rival.');
    const now = new Date().toISOString();
    const row = {...emptyRival(own, {id: rivalId, data: rival ?? {}}, now, 'manual'), ...old,
      ...(request.data?.favorite !== undefined ? {favorite: request.data.favorite} : {}),
      ...(request.data?.hidden !== undefined ? {hidden: request.data.hidden} : {}),
      ...(request.data?.save === true ? {hidden: false} : {}), updatedAt: now};
    await writeRivals(tx, db, [row]);
    if (row.hidden && (request.data?.save === true || request.data?.hidden === false)) throw new HttpsError('resource-exhausted', 'Tenés 100 rivales visibles y todos son favoritos. Olvidá uno antes de recuperar o guardar otro.');
    return {ok: true, hidden: row.hidden};
  });
});

export const getTeamRivalSeries = onCall(region, async request => {
  const uid = auth(request), matchId = validId(request.data?.matchId), db = admin.firestore();
  const match = (await db.doc(`matches/${matchId}`).get()).data();
  if (!match || match.type !== 'intergroup_friendly' || match.participantTeamIds?.length !== 2) return {series: null};
  for (const ownTeamId of match.participantTeamIds) {
    try {
      const own = await teamAccess(db, uid, ownTeamId);
      const rivalTeamId = match.participantTeamIds.find((id: string) => id !== ownTeamId);
      const [row, rival] = await db.getAll(db.doc(`teamRivals/${rivalDocId(ownTeamId, rivalTeamId)}`), db.doc(`teams/${rivalTeamId}`));
      return {rosterSyncIssue: match.rosterSyncIssue ?? null, series: row.exists && ['completed', 'evaluated'].includes(match.status) ? {...row.data(), name: rival.data()?.name ?? row.data()?.rivalSnapshot?.name, canManage: own.canManage} : null};
    } catch (error) {
      if (!(error instanceof HttpsError) || !['permission-denied', 'not-found'].includes(error.code)) throw error;
    }
  }
  // Match participants retain their own historical series even after leaving
  // the group; arbitrary authenticated users cannot enumerate it.
  if (match.playerUids?.includes(uid) || match.captains?.includes(uid)) return {series: null};
  throw new HttpsError('permission-denied', 'No participás en este partido.');
});
