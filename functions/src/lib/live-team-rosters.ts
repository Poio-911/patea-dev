import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { createHash } from 'node:crypto';
import { buildChallengeTeams } from './challenge-roster';
import { RivalData } from './team-rivals';

export async function prepareLiveRoster(tx: admin.firestore.Transaction, db: admin.firestore.Firestore, match: RivalData) {
  // Los equipos de un partido entre equipos (del mismo grupo o de grupos
  // distintos) son los planteles de los equipos: se releen hasta que empieza.
  if (!['intergroup_friendly', 'by_teams'].includes(String(match.type)) || !['planning', 'upcoming'].includes(match.status)) return null;
  const ids = match.participantTeamIds;
  if (!Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1]) throw new HttpsError('failed-precondition', 'Revisá la identidad de los dos equipos.');
  if (match.events?.length) throw new HttpsError('failed-precondition', 'El partido ya tiene eventos: revisá el plantel antes de iniciar.');
  const docs = await tx.getAll(...ids.map(id => db.doc(`teams/${id}`)));
  if (docs.some(d => !d.exists)) throw new HttpsError('failed-precondition', 'Un equipo ya no existe.');
  const teams = docs.map(d => ({id: d.id, data: d.data()!}));
  if (match.type === 'intergroup_friendly' && teams[0].data.groupId === teams[1].data.groupId) throw new HttpsError('failed-precondition', 'Los equipos pertenecen al mismo grupo.');
  // Quien un responsable sacó de este partido (`rosterExclusions.{equipo}`) no
  // vuelve con la próxima sincronización del plantel.
  const exclusions = (match as any).rosterExclusions ?? {};
  for (const t of teams) {
    const excluded = new Set<string>(Array.isArray(exclusions[t.id]) ? exclusions[t.id] : []);
    if (excluded.size) t.data = {...t.data, members: (t.data.members ?? []).filter((m: any) => !excluded.has(String(m.playerId ?? '')))};
  }
  const playerIds = [...new Set(teams.flatMap(t => (t.data.members ?? []).map((m: any) => String(m.playerId ?? ''))))].filter(Boolean) as string[];
  if (playerIds.length > 100) throw new HttpsError('failed-precondition', 'Revisá el tamaño de los planteles.');
  const players = playerIds.length ? await tx.getAll(...playerIds.map(id => db.doc(`players/${id}`))) : [];
  const profiles = new Map(players.filter(p => p.exists).map(p => [p.id, p.data()!]));
  const sides = buildChallengeTeams(teams, profiles);
  const roster = sides.flatMap(t => t.players);
  return {teams: sides, players: roster, playerUids: roster.map(p => p.uid), matchSize: roster.length};
}

/** Trigger retries always read current team documents, never an old event's
 * roster. Starting a match reads those same docs in its freezing transaction. */
export async function syncTeamRosters(db: admin.firestore.Firestore, teamId: string) {
  const matches = await db.collection('matches').where('participantTeamIds', 'array-contains', teamId).where('status', 'in', ['planning', 'upcoming']).get();
  for (const doc of matches.docs) await db.runTransaction(async tx => {
    const match = (await tx.get(doc.ref)).data();
    if (!match || !['planning', 'upcoming'].includes(match.status)) return;
    let update;
    try { update = await prepareLiveRoster(tx, db, match); }
    catch (error) {
      if (!(error instanceof HttpsError)) throw error;
      const message = error.message;
      if (match.rosterSyncIssue === message) return;
      tx.update(doc.ref, {rosterSyncIssue: message});
      for (const uid of [...new Set<string>(match.captains ?? [])]) tx.set(db.doc(`users/${uid}/notifications/roster_issue_${doc.id}`), {
        type: 'team_roster_changed', title: 'Revisá los planteles', message, link: `/matches/${doc.id}`, isRead: false, createdAt: new Date().toISOString(),
      });
      return;
    }
    if (!update) return;
    if (JSON.stringify(match.teams) === JSON.stringify(update.teams) && JSON.stringify(match.playerUids) === JSON.stringify(update.playerUids) && !match.rosterSyncIssue) return;
    tx.update(doc.ref, {...update, rosterSyncIssue: admin.firestore.FieldValue.delete(), rosterUpdatedAt: new Date().toISOString()});
    const revision = createHash('sha256').update(JSON.stringify(update.teams)).digest('hex').slice(0, 16);
    for (const uid of [...new Set<string>(match.captains ?? [])]) tx.set(db.doc(`users/${uid}/notifications/roster_${doc.id}_${revision}`), {
      type: 'team_roster_changed', title: 'Plantel actualizado', message: 'Un equipo cambió su plantel para el próximo partido.', link: `/matches/${doc.id}`, isRead: false, createdAt: new Date().toISOString(),
    });
  });
}
