import { createHash } from 'node:crypto';

export type RivalData = Record<string, any>;
export const VISIBLE_RIVAL_LIMIT = 100;
export const finishedStatuses = ['completed', 'evaluated'];
export const pendingMatchStatuses = ['planning', 'upcoming', 'active'];
export function rivalDocId(own: string, rival: string): string {
  return createHash('sha256').update(JSON.stringify([own, rival])).digest('hex');
}
export function pairDocId(a: string, b: string): string { return rivalDocId(...[a, b].sort() as [string, string]); }
export function asIso(value: any): string {
  const date = value?.toDate instanceof Function ? value.toDate() : new Date(value ?? 0);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}
export function isCountableMatch(match: RivalData): boolean {
  return match.type === 'intergroup_friendly' && finishedStatuses.includes(match.status)
    && Array.isArray(match.participantTeamIds) && match.participantTeamIds.length === 2
    && match.participantTeamIds.every((id: unknown) => typeof id === 'string' && !!id && !id.includes('/'))
    && match.participantTeamIds[0] !== match.participantTeamIds[1]
    && Array.isArray(match.teams) && match.teams.length === 2 && !match.competitionId && !match.leagueId && !match.cupId;
}
/** Never resolve identity from a mutable name or the current roster. Legacy
 * challenges have a guaranteed parallel-array order, established at creation. */
export function resultForMatch(match: RivalData): RivalData | null {
  if (!isCountableMatch(match)) return null;
  const ids: string[] = match.participantTeamIds;
  let teams = match.teams;
  const stable = teams.map((t: RivalData) => t.teamId);
  if (stable.some(Boolean)) {
    if (new Set(stable).size !== 2 || !ids.every(id => stable.includes(id))) return null;
    teams = ids.map(id => teams.find((t: RivalData) => t.teamId === id));
  }
  // Legacy web challenges use the documented parallel-array contract. New
  // matches always carry teamId, so names and current membership never decide.
  const score = (team: RivalData, index: number) => {
    const originalIndex = match.teams.indexOf(team);
    const final = match.finalScore?.[originalIndex === 0 ? 'team1' : 'team2'];
    const value = final ?? team.score;
    if (Number.isInteger(value) && value >= 0 && value <= 999) return value;
    return null;
  };
  const scores = teams.map(score);
  if (scores.some((s: number | null) => s === null)) return null;
  const ordered = [...ids].sort();
  return {teamIds: ordered, scores: ordered.map(id => scores[ids.indexOf(id)]), date: asIso(match.completedAt ?? match.finalizedAt ?? match.date ?? match.createdAt)};
}
export function emptyRival(own: {id: string; data: RivalData}, rival: {id: string; data: RivalData}, now: string, origin = 'challenge'): RivalData {
  return {ownTeamId: own.id, rivalTeamId: rival.id, ownGroupId: own.data.groupId ?? '', rivalGroupId: rival.data.groupId ?? '',
    rivalSnapshot: {name: rival.data.name ?? 'Equipo', jersey: rival.data.jersey ?? null}, origin,
    favorite: false, hidden: false, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, recent: [], createdAt: now, updatedAt: now};
}
export function applyOutcome(doc: RivalData, result: RivalData, matchId: string, direction: 1 | -1 = 1): RivalData {
  const side = result.teamIds.indexOf(doc.ownTeamId);
  if (side < 0) throw new Error('El equipo no pertenece al resultado.');
  const own = result.scores[side], other = result.scores[1 - side];
  const recent = (doc.recent ?? []).filter((m: RivalData) => m.matchId !== matchId);
  if (direction === 1) recent.push({matchId, date: result.date, scoreFor: own, scoreAgainst: other});
  recent.sort((a: RivalData, b: RivalData) => b.date.localeCompare(a.date) || a.matchId.localeCompare(b.matchId));
  const next = {...doc, played: doc.played + direction, wins: doc.wins + (own > other ? direction : 0), draws: doc.draws + (own === other ? direction : 0),
    losses: doc.losses + (own < other ? direction : 0), goalsFor: doc.goalsFor + own * direction, goalsAgainst: doc.goalsAgainst + other * direction, recent: recent.slice(0, 5)};
  return {...next, lastMatchId: next.recent[0]?.matchId ?? null, lastPlayedAt: next.recent[0]?.date ?? null};
}
export function sortRivals(list: RivalData[]): RivalData[] {
  return [...list].sort((a, b) => Number(b.favorite) - Number(a.favorite) || String(b.lastPlayedAt ?? b.createdAt).localeCompare(String(a.lastPlayedAt ?? a.createdAt)) || String(a.name ?? a.rivalSnapshot?.name).localeCompare(String(b.name ?? b.rivalSnapshot?.name)));
}
