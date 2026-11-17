import { HttpsError } from "firebase-functions/v2/https";
export type Data = Record<string, any>;
export const rounds = [
  "round_of_32",
  "round_of_16",
  "round_of_8",
  "semifinals",
  "final",
];
export function teamIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((t) => (typeof t === "string" ? t : t?.id))
    .filter(
      (id): id is string => typeof id === "string" && !!id && !id.includes("/"),
    );
}
export function validScore(
  match: Data,
): { team1: number; team2: number } | null {
  const raw = match.finalScore;
  const a = raw?.team1 ?? match.teams?.[0]?.score;
  const b = raw?.team2 ?? match.teams?.[1]?.score;
  if (![a, b].every((v) => Number.isInteger(v) && v >= 0 && v <= 999))
    return null;
  return { team1: a, team2: b };
}
export function standings(
  ids: string[],
  names: Record<string, string>,
  matches: Data[],
  rules: Data = {},
): Data[] {
  const win = Number.isInteger(rules.pointsForWin) ? rules.pointsForWin : 3;
  const draw = Number.isInteger(rules.pointsForDraw) ? rules.pointsForDraw : 1;
  const rows = new Map(
    ids.map((id) => [
      id,
      {
        teamId: id,
        teamName: names[id] ?? "Equipo",
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
      },
    ]),
  );
  for (const match of matches) {
    if (!["completed", "evaluated"].includes(match.status)) continue;
    const pair = teamIds(match.participantTeamIds);
    const score = validScore(match);
    if (pair.length !== 2 || pair[0] === pair[1] || !score) continue;
    const a = rows.get(pair[0]),
      b = rows.get(pair[1]);
    if (!a || !b) continue;
    a.played++;
    b.played++;
    a.goalsFor += score.team1;
    a.goalsAgainst += score.team2;
    b.goalsFor += score.team2;
    b.goalsAgainst += score.team1;
    if (score.team1 === score.team2) {
      a.drawn++;
      b.drawn++;
      a.points += draw;
      b.points += draw;
    } else if (score.team1 > score.team2) {
      a.won++;
      b.lost++;
      a.points += win;
    } else {
      b.won++;
      a.lost++;
      b.points += win;
    }
  }
  const result = [...rows.values()];
  for (const r of result) r.goalDiff = r.goalsFor - r.goalsAgainst;
  result.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName),
  );
  return result.map((r, i) => ({
    ...r,
    position: i + 1,
    matchesPlayed: r.played,
    wins: r.won,
    draws: r.drawn,
    losses: r.lost,
    goalDifference: r.goalDiff,
  }));
}
export function generateCup(
  teams: Data[],
  seeding = "random",
  random = Math.random,
): Data[] {
  if (
    ![2, 4, 8, 16, 32].includes(teams.length) ||
    new Set(teams.map((t) => t.id)).size !== teams.length
  )
    throw new HttpsError(
      "failed-precondition",
      "La copa necesita 2, 4, 8, 16 o 32 equipos distintos.",
    );
  let seeded = [...teams];
  if (seeding === "ovr_based") {
    seeded.sort(
      (a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || a.id.localeCompare(b.id),
    );
    let order = [1, 2];
    for (let size = 4; size <= seeded.length; size *= 2)
      order = order.flatMap((seed) => [seed, size + 1 - seed]);
    seeded = order.map((seed) => seeded[seed - 1]);
  } else if (seeding === "random") {
    for (let i = seeded.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [seeded[i], seeded[j]] = [seeded[j], seeded[i]];
    }
  } else throw new HttpsError("invalid-argument", "Sorteo inválido.");
  const first = rounds.indexOf(rounds[Math.log2(32 / teams.length)]);
  const bracket: Data[] = [];
  for (let r = first; r < rounds.length; r++) {
    const count = 2 ** (rounds.length - r - 1);
    for (let m = 1; m <= count; m++) {
      const a = r === first ? seeded[(m - 1) * 2] : null,
        b = r === first ? seeded[(m - 1) * 2 + 1] : null;
      bracket.push({
        id: `match_${rounds[r]}_${m}`,
        round: rounds[r],
        matchNumber: m,
        team1Id: a?.id ?? null,
        team2Id: b?.id ?? null,
        team1Name: a?.name ?? null,
        team2Name: b?.name ?? null,
        team1Jersey: a?.jersey ?? null,
        team2Jersey: b?.jersey ?? null,
        nextMatchNumber: r < rounds.length - 1 ? Math.ceil(m / 2) : null,
      });
    }
  }
  return bracket;
}
export function advanceCup(raw: Data[], matchId: string, match: Data): Data[] {
  const bracket = raw.map((b) => ({ ...b }));
  const entry = bracket.find(
    (b) =>
      b.matchId === matchId ||
      (match.bracketMatchId && b.id === match.bracketMatchId),
  );
  if (!entry)
    throw new HttpsError(
      "failed-precondition",
      "El partido no está vinculado al cuadro.",
    );
  const ids = teamIds(match.participantTeamIds);
  const score = validScore(match);
  if (
    !score ||
    ids.length !== 2 ||
    ids[0] !== entry.team1Id ||
    ids[1] !== entry.team2Id
  )
    throw new HttpsError(
      "failed-precondition",
      "El marcador o los equipos no coinciden con el cruce.",
    );
  let winner =
    score.team1 > score.team2
      ? ids[0]
      : score.team2 > score.team1
        ? ids[1]
        : null;
  if (!winner && ids.includes(match.penaltyWinnerId))
    winner = match.penaltyWinnerId;
  if (entry.winnerId && entry.winnerId !== winner)
    throw new HttpsError(
      "failed-precondition",
      "El cruce ya avanzó con otro resultado.",
    );
  Object.assign(entry, {
    matchId,
    finalScore: score,
    requiresTiebreaker: !winner,
  });
  if (!winner) return bracket;
  entry.winnerId = winner;
  entry.penaltyWinnerId = score.team1 === score.team2 ? winner : null;
  const nextRound = rounds[rounds.indexOf(entry.round) + 1];
  const next = bracket.find(
    (b) => b.round === nextRound && b.matchNumber === entry.nextMatchNumber,
  );
  if (next) {
    const slot = entry.matchNumber % 2 ? "team1" : "team2";
    if (next[`${slot}Id`] && next[`${slot}Id`] !== winner)
      throw new HttpsError(
        "failed-precondition",
        "La siguiente ronda ya tiene otro equipo.",
      );
    next[`${slot}Id`] = winner;
    next[`${slot}Name`] =
      winner === entry.team1Id ? entry.team1Name : entry.team2Name;
    next[`${slot}Jersey`] =
      winner === entry.team1Id
        ? (entry.team1Jersey ?? null)
        : (entry.team2Jersey ?? null);
  }
  return bracket;
}
