const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  generateCup,
  advanceCup,
  standings,
  validScore,
} = require("../lib/lib/competition-engine");
const { competitionMatch } = require("../lib/callable/competition-management");
function teams(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    name: `Equipo ${i}`,
    ovr: 100 - i,
    jersey: { type: "plain" },
  }));
}
test("todos los tamaños de copa tienen una final y ningún equipo repetido en primera ronda", () => {
  for (const count of [2, 4, 8, 16, 32])
    for (const seeding of ["random", "ovr_based"]) {
      const b = generateCup(teams(count), seeding, () => 0.3);
      assert.equal(b.length, count - 1);
      assert.equal(b.filter((m) => m.round === "final").length, 1);
      const first = b.filter((m) => m.round === b[0].round);
      assert.equal(
        new Set(first.flatMap((m) => [m.team1Id, m.team2Id])).size,
        count,
      );
    }
});
test("cabezas por OVR ocupan mitades distintas", () => {
  const b = generateCup(teams(8), "ovr_based"),
    first = b.filter((m) => m.round === "round_of_8");
  assert.equal(first[0].team1Id, "t0");
  assert.equal(first[0].team2Id, "t7");
  assert.equal(first[2].team1Id, "t1");
});
test("resultado empatado espera penales, que no se suman a los goles", () => {
  const raw = generateCup(teams(2));
  raw[0].matchId = "real";
  const entry = raw[0];
  const m = {
    participantTeamIds: [entry.team1Id, entry.team2Id],
    finalScore: { team1: 2, team2: 2 },
  };
  const pending = advanceCup(raw, "real", m);
  assert.equal(pending[0].requiresTiebreaker, true);
  assert.equal(pending[0].winnerId, undefined);
  const result = advanceCup(raw, "real", {
    ...m,
    penaltyWinnerId: entry.team2Id,
  });
  assert.equal(result[0].winnerId, entry.team2Id);
  assert.deepEqual(result[0].finalScore, { team1: 2, team2: 2 });
});
test("avanzar es idempotente y conserva vínculos, camisetas y resultados previos", () => {
  const b = generateCup(teams(4), "ovr_based");
  b[0].matchId = "semi";
  b[2].matchId = "final-real";
  const m = {
    participantTeamIds: [b[0].team1Id, b[0].team2Id],
    finalScore: { team1: 1, team2: 0 },
  };
  const result = advanceCup(b, "semi", m),
    again = advanceCup(result, "semi", m);
  assert.deepEqual(again, result);
  assert.equal(result[2].matchId, "final-real");
  assert.equal(result[2].team1Id, b[0].team1Id);
  assert.throws(
    () =>
      advanceCup(result, "semi", { ...m, finalScore: { team1: 0, team2: 2 } }),
    { code: "failed-precondition" },
  );
});
test("no avanza otro cruce ni equipos intercambiados", () => {
  const b = generateCup(teams(2));
  b[0].matchId = "m";
  assert.throws(() =>
    advanceCup(b, "missing", {
      participantTeamIds: ["t0", "t1"],
      finalScore: { team1: 1, team2: 0 },
    }),
  );
  assert.throws(() =>
    advanceCup(b, "m", {
      participantTeamIds: [b[0].team2Id, b[0].team1Id],
      finalScore: { team1: 1, team2: 0 },
    }),
  );
});
test("tabla cuenta sólo resultados finales y conserva reglas personalizadas y aliases web", () => {
  const rows = standings(
    ["a", "b", "c"],
    { a: "A", b: "B", c: "C" },
    [
      {
        status: "completed",
        participantTeamIds: ["a", "b"],
        finalScore: { team1: 2, team2: 0 },
      },
      {
        status: "evaluated",
        participantTeamIds: ["a", "c"],
        teams: [{ score: 1 }, { score: 1 }],
      },
      {
        status: "active",
        participantTeamIds: ["b", "c"],
        finalScore: { team1: 99, team2: 0 },
      },
    ],
    { pointsForWin: 2, pointsForDraw: 0 },
  );
  assert.equal(rows[0].points, 2);
  assert.equal(rows[0].matchesPlayed, 2);
  assert.equal(rows[0].goalDifference, 2);
  assert.equal(rows[0].wins, 1);
  assert.equal(rows[1].points, 0);
});
test("marcadores inválidos no se convierten en resultados", () => {
  for (const raw of [
    { team1: -1, team2: 2 },
    { team1: "1", team2: 0 },
    { team1: 1.5, team2: 0 },
  ])
    assert.equal(validScore({ finalScore: raw }), null);
  assert.equal(validScore({ teams: [{}, {}] }), null);
});
test("partidos de copa preservan equipos, participantes, sede y marcador sin inventar horario pasado", () => {
  const t = (id) => ({
    id,
    name: id,
    jersey: { type: "plain" },
    players: [{ uid: id, ovr: 50 }],
    totalOVR: 50,
    averageOVR: 50,
  });
  const m = competitionMatch(
    {
      ownerUid: "u",
      groupId: "g",
      startDate: "2000-01-01",
      matchTime: "21:00",
    },
    "c",
    t("a"),
    t("b"),
    "final",
  );
  assert.equal(m.status, "planning");
  assert.equal(m.date, "");
  assert.deepEqual(m.playerUids, ["a", "b"]);
  assert.equal(m.bracketMatchId, "final");
  assert.equal(m.leagueInfo.leagueId, "c");
  assert.equal(m.teams[0].score, 0);
});

test("un jugador compartido figura de un solo lado en el partido de copa", () => {
  const a = { id: "a", name: "Local", players: [{ uid: "shared", ovr: 60 }, { uid: "a1", ovr: 80 }] };
  const b = { id: "b", name: "Visita", players: [{ uid: "shared", ovr: 60 }] };
  const match = competitionMatch({}, "cup", a, b, "final");
  assert.deepEqual(match.teams.map((team) => team.players.map((p) => p.uid)), [["a1"], ["shared"]]);
  assert.deepEqual(match.playerUids, ["a1", "shared"]);
  assert.equal(match.teams[1].averageOVR, 60);
  assert.equal(a.players.length, 2);
});
