import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { buildLeaguePairs } from '../lib/league-fixture';
import { buildMatchDateTime } from '../lib/match-date';

export const startLeagueTournament = onCall({ region: 'us-central1' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Iniciá sesión.');
  return startLeagueCore(request.auth.uid, request.data, admin.firestore());
});

export async function startLeagueCore(uid: string, data: any, db: admin.firestore.Firestore) {
  const id = String(data?.leagueId ?? '');
  const startDate = String(data?.startDate ?? '');
  const time = String(data?.time ?? '');
  const start = buildMatchDateTime(startDate, time);
  if (!id || id.includes('/') || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !start || start.getTime() < Date.now()) {
    throw new HttpsError('invalid-argument', 'Elegí una fecha futura y una hora válidas.');
  }
  const leagueRef = db.doc(`leagues/${id}`);
  return db.runTransaction(async tx => {
    const league = (await tx.get(leagueRef)).data();
    if (!league) throw new HttpsError('not-found', 'Liga no encontrada.');
    if (league.ownerUid !== uid) throw new HttpsError('permission-denied', 'Sólo el organizador puede iniciar la liga.');
    if (league.status !== 'draft' && league.status !== 'open_for_applications') {
      throw new HttpsError('failed-precondition', 'La liga ya fue iniciada.');
    }
    const groupId = String(league.groupId ?? '');
    if (!groupId || groupId.includes('/')) throw new HttpsError('failed-precondition', 'La liga no tiene un grupo válido.');
    const group = (await tx.get(db.doc(`groups/${groupId}`))).data();
    if (!group || (group.ownerUid !== uid && !group.members?.includes(uid))) {
      throw new HttpsError('permission-denied', 'Ya no pertenecés al grupo.');
    }
    const ids: string[] = Array.isArray(league.teams) ? league.teams.map((t: any) => typeof t === 'string' ? t : t?.id) : [];
    if (ids.some(t => !t || t.includes('/'))) throw new HttpsError('invalid-argument', 'Equipos inválidos.');
    let pairs;
    try { pairs = buildLeaguePairs(ids, league.format === 'double_round_robin'); }
    catch (e) { throw new HttpsError('failed-precondition', (e as Error).message); }
    const existing = await tx.get(db.collection('matches').where('leagueInfo.leagueId', '==', id).limit(1));
    if (!existing.empty) throw new HttpsError('failed-precondition', 'La liga ya tiene partidos. No se duplicó el fixture.');
    const teamDocs = await tx.getAll(...ids.map(t => db.doc(`teams/${t}`)));
    const teams = new Map<string, admin.firestore.DocumentData>();
    const memberIds = new Set<string>();
    for (const doc of teamDocs) {
      const data = doc.data();
      if (!data || data.groupId !== groupId) throw new HttpsError('failed-precondition', 'Actualizá los equipos de la liga.');
      const members = Array.isArray(data.members) ? data.members : [];
      if (!members.length) throw new HttpsError('failed-precondition', `${data.name}: el plantel está vacío.`);
      for (const m of members) {
        if (typeof m.playerId !== 'string' || !m.playerId || m.playerId.includes('/') || memberIds.has(m.playerId)) {
          throw new HttpsError('failed-precondition', 'Revisá los planteles: un jugador no puede representar a dos equipos de la misma liga.');
        }
        memberIds.add(m.playerId);
      }
      teams.set(doc.id, { ...data, id: doc.id });
    }
    if (memberIds.size > 500) throw new HttpsError('failed-precondition', 'La liga supera el límite de 500 jugadores.');
    const playerDocs = await tx.getAll(...[...memberIds].map(p => db.doc(`players/${p}`)));
    const players = new Map<string, admin.firestore.DocumentData>();
    for (const doc of playerDocs) {
      const data = doc.data();
      if (!data) throw new HttpsError('failed-precondition', 'Un jugador del plantel ya no existe.');
      players.set(doc.id, { uid: doc.id, displayName: String(data.name ?? data.displayName ?? 'Jugador'), position: String(data.position ?? 'MED'), ovr: Number(data.ovr ?? 50), photoURL: String(data.photoUrl ?? data.photoURL ?? '') });
    }
    for (const pair of pairs) {
      const sides = [teams.get(pair.home)!, teams.get(pair.away)!].map(team => {
        const roster = team.members.map((m: any) => players.get(m.playerId)!);
        const totalOVR = roster.reduce((sum: number, p: any) => sum + p.ovr, 0);
        return {name: team.name, jersey: team.jersey ?? null, players: roster, totalOVR, averageOVR: totalOVR / roster.length};
      });
      const roster = sides.flatMap(t => t.players);
      const matchSize = Math.max(...sides.map(t => t.players.length)) * 2;
      if (matchSize > 100) throw new HttpsError('failed-precondition', 'Un equipo supera los 50 jugadores.');
      const day = new Date(`${startDate}T12:00:00Z`);
      day.setUTCDate(day.getUTCDate() + (pair.round - 1) * 7);
      tx.set(db.collection('matches').doc(), {
        title: `${sides[0].name} vs ${sides[1].name}`, type: 'league', status: 'upcoming',
        date: day.toISOString().slice(0, 10), time, matchSize, ownerUid: uid, groupId,
        participantTeamIds: [pair.home, pair.away], teams: sides, teamsGenerated: true,
        players: roster, playerUids: roster.map((p: any) => p.uid), isPublic: false,
        location: league.defaultLocation ?? {name: 'A definir', address: '', lat: 0, lng: 0, placeId: ''},
        leagueInfo: {leagueId: id, round: pair.round}, events: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    tx.update(leagueRef, {status: 'in_progress', startDate, matchTime: time, matchFrequency: 'weekly'});
    return {created: pairs.length};
  });
}
