import { HttpsError } from 'firebase-functions/v2/https';
type Doc = Record<string, any>;

function canonicalPlayer(id: string, p: Doc) {
  return {
    uid: id,
    displayName: String(p.name ?? p.displayName ?? 'Jugador'),
    ovr: Number(p.ovr ?? 50),
    position: String(p.position ?? 'MED'),
    photoURL: String(p.photoURL ?? p.photoUrl ?? ''),
  };
}

/**
 * Arma los dos equipos del partido desde los planteles de cada equipo. Nada
 * viene del cliente. Falla si un equipo queda sin jugadores o si un mismo
 * jugador está en los dos.
 */
export function buildChallengeTeams(
  teamDocs: Array<{ id: string; data: Doc }>,
  playersById: Map<string, Doc>,
): Array<Doc> {
  const assigned = new Set<string>();
  return teamDocs.map(({ id: teamId, data }) => {
    const players: Array<Doc> = [];
    for (const member of Array.isArray(data.members) ? data.members : []) {
      const id = String(member?.playerId ?? '');
      if (!id) continue;
      if (assigned.has(id)) {
        throw new HttpsError('failed-precondition', 'Un jugador está en los dos equipos. Revisá los planteles.');
      }
      const profile = playersById.get(id);
      if (!profile) throw new HttpsError('failed-precondition', 'Un equipo tiene jugadores sin perfil. Revisá su plantel.');
      assigned.add(id);
      players.push(canonicalPlayer(id, profile));
    }
    if (players.length === 0) throw new HttpsError('failed-precondition', 'Cada equipo necesita un plantel propio.');
    const totalOVR = players.reduce((sum, p) => sum + p.ovr, 0);
    return {
      teamId,
      score: 0,
      name: data.name ?? 'Equipo',
      jersey: data.jersey ?? null,
      players,
      totalOVR,
      averageOVR: players.length ? totalOVR / players.length : 0,
    };
  });
}
