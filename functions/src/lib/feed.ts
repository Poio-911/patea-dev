import { isCompetitionMatch } from './match-access';

/**
 * Novedades de "Comunidad Pateá": lo que pasa en los grupos de cada uno.
 *
 * La pantalla leía `feedActivities` pero nada lo escribía (sólo la web escribía
 * `socialActivities`), así que la comunidad estaba siempre vacía. Ahora el
 * servidor genera cada novedad a partir de un hecho real —el OVR que cambió con
 * una evaluación, un partido que se armó, un partido que terminó— y la deja en
 * el grupo al que pertenece, que es lo único que ven sus miembros.
 */

type Doc = Record<string, any>;

export interface FeedEntry {
  id: string;
  data: Doc;
}

/** El OVR de un jugador cambió tras una evaluación. */
export function ovrFeedEntry(
  playerId: string,
  historyId: string,
  player: Doc | undefined,
  history: Doc,
): FeedEntry | null {
  const groupId = typeof player?.groupId === 'string' ? player.groupId : '';
  const newOvr = Number(history.newOVR);
  const change = Number(history.change ?? newOvr - Number(history.oldOVR));
  if (!groupId || !Number.isFinite(newOvr) || !Number.isFinite(change)) return null;
  const name = String(player?.name ?? player?.displayName ?? 'Jugador');
  return {
    id: `ovr_${playerId}_${historyId}`,
    data: {
      type: 'ovr_updated',
      groupId,
      playerId,
      playerName: name,
      playerPhotoUrl: String(player?.photoURL ?? player?.photoUrl ?? ''),
      newOvr,
      change,
      matchId: typeof history.matchId === 'string' ? history.matchId : null,
      message:
        change > 0
          ? `Subió su nivel a OVR ${newOvr} tras la última evaluación.`
          : change < 0
            ? `Bajó a OVR ${newOvr} tras la última evaluación.`
            : `Mantuvo su OVR en ${newOvr} tras la última evaluación.`,
      createdAt: new Date().toISOString(),
    },
  };
}

/** Grupos a los que les interesa un partido (el propio y, entre grupos, el rival). */
export function matchFeedGroups(match: Doc): string[] {
  const ids = [match.groupId, ...(Array.isArray(match.participantGroupIds) ? match.participantGroupIds : [])];
  return [...new Set(ids.filter((g): g is string => typeof g === 'string' && !!g))];
}

function scoreLine(match: Doc): string | null {
  const teams = Array.isArray(match.teams) ? match.teams : [];
  if (teams.length < 2) return null;
  const score = match.finalScore;
  const a = Number(score?.[0] ?? score?.teamA ?? teams[0]?.score);
  const b = Number(score?.[1] ?? score?.teamB ?? teams[1]?.score);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return `${teams[0].name ?? 'Equipo A'} ${a} – ${b} ${teams[1].name ?? 'Equipo B'}`;
}

/** Terminó un partido: pasa de cualquier estado a `completed` por primera vez. */
export function matchFinishedFeedEntries(
  matchId: string,
  before: Doc | undefined,
  after: Doc,
): FeedEntry[] {
  if (after.status !== 'completed' || before?.status === 'completed' || before?.status === 'evaluated') return [];
  const line = scoreLine(after);
  const title = String(after.title ?? 'Partido');
  return matchFeedGroups(after).map((groupId) => ({
    id: `match_done_${matchId}_${groupId}`,
    data: {
      type: 'match_finished',
      groupId,
      matchId,
      title,
      message: line ? `Terminó "${title}": ${line}.` : `Terminó "${title}".`,
      createdAt: new Date().toISOString(),
    },
  }));
}

/** Se armó un partido: pasa a `upcoming` (no las competiciones ni un desafío sin respuesta). */
export function matchScheduledFeedEntries(
  matchId: string,
  before: Doc | undefined,
  after: Doc,
): FeedEntry[] {
  if (after.status !== 'upcoming' || before?.status === 'upcoming') return [];
  if (isCompetitionMatch(after) || after.challengeStatus === 'pending') return [];
  const title = String(after.title ?? 'Partido');
  const when = [after.date, after.time].filter((v) => typeof v === 'string' && v).join(' · ');
  return matchFeedGroups(after).map((groupId) => ({
    id: `match_new_${matchId}_${groupId}`,
    data: {
      type: 'match_scheduled',
      groupId,
      matchId,
      title,
      message: when ? `Se armó "${title}" para el ${when}.` : `Se armó "${title}".`,
      createdAt: new Date().toISOString(),
    },
  }));
}
