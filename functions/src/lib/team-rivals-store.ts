import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { applyOutcome, emptyRival, pairDocId, resultForMatch, rivalDocId, RivalData, VISIBLE_RIVAL_LIMIT } from './team-rivals';

export function manager(team: RivalData, group: RivalData | undefined, uid: string): boolean {
  return team.createdBy === uid || group?.ownerUid === uid || !!group?.memberRoles?.some((m: RivalData) => m.userId === uid && ['admin', 'moderator'].includes(m.role));
}
export function member(team: RivalData, group: RivalData | undefined, uid: string): boolean {
  return manager(team, group, uid) || !!group?.members?.includes(uid) || !!group?.memberRoles?.some((m: RivalData) => m.userId === uid);
}
export function validId(value: unknown): string {
  if (typeof value !== 'string' || !value || value.includes('/') || value.length > 128) throw new HttpsError('invalid-argument', 'Equipo inválido.');
  return value;
}
export async function teamAccess(db: admin.firestore.Firestore, uid: string, teamId: string, edit = false, tx?: admin.firestore.Transaction) {
  const ref = db.doc(`teams/${validId(teamId)}`);
  const team = (await (tx ? tx.get(ref) : ref.get())).data();
  if (!team) throw new HttpsError('not-found', 'El equipo ya no existe.');
  const groupRef = db.doc(`groups/${validId(team.groupId)}`);
  const group = (await (tx ? tx.get(groupRef) : groupRef.get())).data();
  if (!(edit ? manager(team, group, uid) : member(team, group, uid))) throw new HttpsError('permission-denied', edit ? 'Sólo quienes administran el equipo pueden hacer esto.' : 'No pertenecés al grupo del equipo.');
  return {id: teamId, data: team, group, canManage: manager(team, group, uid)};
}

/** All reads precede writes. Team guards serialize visibility across different
 * rival pairs. History is NEVER evicted to enforce the 100-visible limit. */
export async function writeRivals(tx: admin.firestore.Transaction, db: admin.firestore.Firestore, rows: RivalData[]) {
  const plans = [];
  for (const row of rows) {
    const guard = db.doc(`teamRivalTeams/${row.ownTeamId}`);
    const guardSnap = await tx.get(guard);
    const visible = await tx.get(db.collection('teamRivals').where('ownTeamId', '==', row.ownTeamId).where('hidden', '==', false).limit(101));
    let evict: admin.firestore.DocumentReference | undefined;
    if (!row.hidden && !visible.docs.some(d => d.id === rivalDocId(row.ownTeamId, row.rivalTeamId)) && visible.size >= VISIBLE_RIVAL_LIMIT) {
      const candidates = visible.docs.filter(d => !d.data().favorite).sort((a, b) => String(a.data().lastPlayedAt ?? a.data().createdAt).localeCompare(String(b.data().lastPlayedAt ?? b.data().createdAt)));
      if (candidates.length) evict = candidates[0].ref;
      else row.hidden = true; // All 100 are favorites: retain new history in forgotten.
    }
    plans.push({row, guard, revision: Number(guardSnap.data()?.revision ?? 0) + 1, evict});
  }
  for (const p of plans) {
    if (p.evict) tx.update(p.evict, {hidden: true, updatedAt: new Date().toISOString()});
    tx.set(db.doc(`teamRivals/${rivalDocId(p.row.ownTeamId, p.row.rivalTeamId)}`), p.row);
    tx.set(p.guard, {revision: p.revision});
  }
}

export async function acceptedRivals(tx: admin.firestore.Transaction, db: admin.firestore.Firestore, teams: Array<{id: string; data: RivalData}>) {
  const now = new Date().toISOString();
  const docs = await tx.getAll(...teams.map((t, i) => db.doc(`teamRivals/${rivalDocId(t.id, teams[1 - i].id)}`)));
  const rows = teams.map((t, i) => ({...emptyRival(t, teams[1 - i], now), ...docs[i].data(),
    rivalSnapshot: {name: teams[1 - i].data.name ?? 'Equipo', jersey: teams[1 - i].data.jersey ?? null}, hidden: false, updatedAt: now}));
  await writeRivals(tx, db, rows);
}

/** Permanent per-match ledger: retry-safe beyond 50 games, correction-safe,
 * and safe to run concurrently with the live trigger or a repair/backfill. */
export async function recordTeamMatchResult(db: admin.firestore.Firestore, matchId: string) {
  return db.runTransaction(async tx => {
    const matchRef = db.doc(`matches/${validId(matchId)}`), ledgerRef = db.doc(`teamRivalResults/${matchId}`);
    const [snap, ledgerSnap] = await tx.getAll(matchRef, ledgerRef);
    const match = snap.data();
    if (!match) return {counted: false, reason: 'missing'};
    const outcome = resultForMatch(match);
    if (!outcome) return {counted: false, reason: 'incomplete-or-out-of-scope'};
    const previous = ledgerSnap.data();
    if (previous) outcome.date = previous.date;
    if (previous && JSON.stringify(previous.teamIds) !== JSON.stringify(outcome.teamIds)) return {counted: false, reason: 'identity-changed-requires-repair'};
    if (previous && JSON.stringify(previous.scores) === JSON.stringify(outcome.scores)) return {counted: false, reason: 'already-counted'};
    const teamDocs = await tx.getAll(...outcome.teamIds.map((id: string) => db.doc(`teams/${id}`)));
    const oldRows = await tx.getAll(...outcome.teamIds.map((id: string, i: number) => db.doc(`teamRivals/${rivalDocId(id, outcome.teamIds[1 - i])}`)));
    const teams = teamDocs.map((d, i) => ({id: outcome.teamIds[i], data: d.data() ?? {name: (oldRows[1 - i].data() as RivalData | undefined)?.rivalSnapshot?.name ?? 'Equipo eliminado'}}));
    const now = new Date().toISOString();
    const rows = teams.map((team, i) => {
      const old = oldRows[i].data() as RivalData | undefined;
      if (previous && !old && teamDocs[i].exists) throw new Error('El historial requiere reconstrucción desde el registro de partidos.');
      let row: RivalData = {...emptyRival(team, teams[1 - i], now), ...old};
      if (previous) row = applyOutcome(row, previous, matchId, -1);
      row = applyOutcome(row, outcome, matchId);
      return {...row, hidden: previous ? row.hidden : false, rivalDeleted: !teamDocs[1 - i].exists, updatedAt: now};
    });
    await writeRivals(tx, db, rows.filter((_, i) => teamDocs[i].exists));
    tx.set(ledgerRef, {...outcome, recordedAt: now});
    tx.update(matchRef, {rivalsRecordedAt: now});
    return {counted: true};
  });
}

export async function challengeState(tx: admin.firestore.Transaction, db: admin.firestore.Firestore, a: string, b: string) {
  const pairRef = db.doc(`teamRivalPairs/${pairDocId(a, b)}`);
  const pair = (await tx.get(pairRef)).data() ?? {};
  const games = await tx.get(db.collection('matches').where('participantTeamIds', 'array-contains', a).where('status', 'in', ['planning', 'upcoming', 'active']));
  const upcoming = games.docs.find(d => d.data().participantTeamIds?.includes(b) && ['planning', 'upcoming', 'active'].includes(d.data().status));
  return {pairRef, pair, upcoming};
}

/** Retain the opposite side's history; remove this team's own list in bounded
 * batches. The delete trigger covers web deletion as well as the callable. */
export async function cleanupTeamRivals(db: admin.firestore.Firestore, teamId: string) {
  for (const field of ['ownTeamId', 'rivalTeamId']) {
    let cursor: admin.firestore.QueryDocumentSnapshot | undefined;
    while (true) {
      let q = db.collection('teamRivals').where(field, '==', teamId).orderBy(admin.firestore.FieldPath.documentId()).limit(200);
      if (cursor) q = q.startAfter(cursor);
      const docs = await q.get(); if (docs.empty) break;
      const batch = db.batch();
      for (const doc of docs.docs) field === 'ownTeamId' ? batch.delete(doc.ref) : batch.update(doc.ref, {rivalDeleted: true});
      await batch.commit(); cursor = docs.docs[docs.size - 1];
    }
  }
}

/** Rebuild ONLY counters from the permanent ledger. The same visibility guards
 * used by live results force transaction retries if a result arrives meanwhile.
 * User metadata is reread transactionally and retained, including hidden. */
export async function reconcileRivalPair(db: admin.firestore.Firestore, a: string, b: string) {
  return db.runTransaction(async tx => {
    const ids = [a, b].sort();
    const teams = await tx.getAll(...ids.map(id => db.doc(`teams/${id}`)));
    const docs = await tx.getAll(...ids.map((id, i) => db.doc(`teamRivals/${rivalDocId(id, ids[1 - i])}`)));
    const ledger = await tx.get(db.collection('teamRivalResults').where('teamIds', 'array-contains', a));
    const results = ledger.docs.filter(d => d.data().teamIds.includes(b)).sort((x, y) => x.data().date.localeCompare(y.data().date));
    const now = new Date().toISOString();
    const rows = ids.map((id, i) => {
      const old = docs[i].data();
      let row = {...old, ...emptyRival({id, data: teams[i].data() ?? {}}, {id: ids[1 - i], data: teams[1 - i].data() ?? {name: old?.rivalSnapshot?.name}}, now),
        ...old, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, recent: [], lastMatchId: null, lastPlayedAt: null} as RivalData;
      for (const result of results) row = applyOutcome(row, result.data(), result.id);
      return {...row, rivalDeleted: !teams[1 - i].exists, updatedAt: now};
    }).filter((_, i) => teams[i].exists);
    await writeRivals(tx, db, rows);
    return {games: results.length};
  });
}
