const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildLeaguePairs } = require("../lib/lib/league-fixture");
const { startLeagueCore } = require("../lib/callable/league-management");

function fixture() {
  const records = new Map([
    ["groups/g", { ownerUid: "owner", members: ["owner"] }],
    [
      "leagues/l",
      {
        name: "Liga",
        ownerUid: "owner",
        groupId: "g",
        teams: ["a", "b", "c"],
        status: "draft",
        format: "round_robin",
      },
    ],
    ...["a", "b", "c"].flatMap((id) => [
      [
        `teams/${id}`,
        {
          name: id,
          groupId: "g",
          members: [{ playerId: id }],
          jersey: { type: "plain" },
        },
      ],
      [`players/${id}`, { name: id, ovr: 60, position: "MED" }],
    ]),
  ]);
  let next = 0;
  const doc = (path) => ({ path, id: path.split("/").at(-1) });
  const snapshot = (ref) => ({ id: ref.id, data: () => records.get(ref.path) });
  const db = {
    doc,
    collection: (path) => {
      const q = (filters) => ({
        doc: () => doc(`${path}/generated-${++next}`),
        where: (field, op, value) => q([...filters, [field, value]]),
        limit: () => ({ query: true, path, filters }),
      });
      return q([]);
    },
    runTransaction: async (action) => {
      const writes = [];
      const tx = {
        get: async (ref) =>
          ref.query
            ? {
                empty: ![...records].some(
                  ([path, data]) =>
                    path.startsWith("matches/") &&
                    ref.filters.every(
                      ([field, value]) =>
                        field.split(".").reduce((v, k) => v?.[k], data) ===
                        value,
                    ),
                ),
              }
            : snapshot(ref),
        getAll: async (...refs) => refs.map(snapshot),
        set: (ref, data) => writes.push([ref.path, data]),
        update: (ref, data) =>
          writes.push([ref.path, { ...records.get(ref.path), ...data }]),
      };
      const result = await action(tx);
      for (const [path, data] of writes) records.set(path, data);
      return result;
    },
  };
  return {
    db,
    records,
    data: { leagueId: "l", startDate: "2030-01-05", time: "21:00" },
  };
}

test("fixture par, impar e ida/vuelta no repite cruces ni equipos por fecha", () => {
  for (let count = 2; count <= 16; count++)
    for (const returnLeg of [false, true]) {
      const ids = Array.from({ length: count }, (_, i) => String(i));
      const pairs = buildLeaguePairs(ids, returnLeg);
      assert.equal(
        pairs.length,
        ((count * (count - 1)) / 2) * (returnLeg ? 2 : 1),
      );
      const rounds = new Map(),
        seen = new Map();
      for (const p of pairs) {
        const used = rounds.get(p.round) ?? new Set();
        assert(!used.has(p.home));
        assert(!used.has(p.away));
        used.add(p.home);
        used.add(p.away);
        rounds.set(p.round, used);
        const key = [p.home, p.away].sort().join("-");
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      for (const count of seen.values()) assert.equal(count, returnLeg ? 2 : 1);
      if (returnLeg)
        for (const p of pairs.slice(0, pairs.length / 2))
          assert(pairs.some((q) => q.home === p.away && q.away === p.home));
    }
});
test("rechaza cantidades y equipos duplicados", () => {
  for (const ids of [
    [],
    ["a"],
    ["a", "a"],
    Array.from({ length: 17 }, (_, i) => String(i)),
  ])
    assert.throws(() => buildLeaguePairs(ids, false));
});
test("crea fechas semanales, jugadores reales y liga de forma atómica", async () => {
  const { db, records, data } = fixture();
  const result = await startLeagueCore("owner", data, db);
  assert.equal(result.created, 3);
  const matches = [...records]
    .filter(([path]) => path.startsWith("matches/"))
    .map(([, data]) => data);
  assert.deepEqual(
    matches.map((m) => m.date),
    ["2030-01-05", "2030-01-12", "2030-01-19"],
  );
  for (const m of matches) {
    assert.equal(m.teams.length, 2);
    assert.equal(m.players.length, 2);
    assert.equal(m.playerUids.length, 2);
    assert.equal(m.type, "league");
    assert.equal(m.ownerUid, "owner");
    assert.equal(m.leagueInfo.leagueId, "l");
    assert.equal(m.time, "21:00");
  }
  assert.equal(records.get("leagues/l").status, "in_progress");
  await assert.rejects(() => startLeagueCore("owner", data, db), {
    code: "failed-precondition",
  });
  assert.equal(
    [...records.keys()].filter((p) => p.startsWith("matches/")).length,
    3,
  );
});
test("no permite iniciar torneos ajenos, ni de grupos abandonados", async () => {
  const { db, records, data } = fixture();
  await assert.rejects(() => startLeagueCore("other", data, db), {
    code: "permission-denied",
  });
  records.set("groups/g", { ownerUid: "other", members: [] });
  await assert.rejects(() => startLeagueCore("owner", data, db), {
    code: "permission-denied",
  });
  assert.equal(records.get("leagues/l").status, "draft");
});
test("no duplica un fixture existente aunque el estado sea borrador", async () => {
  const { db, records, data } = fixture();
  records.set("matches/existing", {
    type: "league",
    leagueInfo: { leagueId: "l" },
  });
  await assert.rejects(() => startLeagueCore("owner", data, db), {
    code: "failed-precondition",
  });
  assert.equal(records.get("leagues/l").status, "draft");
});
test("rechaza fechas pasadas e inválidas", async () => {
  const { db, data } = fixture();
  for (const startDate of ["2000-01-01", "2030-02-30", "bad"])
    await assert.rejects(
      () => startLeagueCore("owner", { ...data, startDate }, db),
      { code: "invalid-argument" },
    );
});
test("rechaza planteles vacíos y perfiles faltantes sin escrituras parciales", async () => {
  for (const fault of ["empty", "missing"]) {
    const { db, records, data } = fixture();
    if (fault === "empty") records.get("teams/a").members = [];
    if (fault === "missing") records.delete("players/a");
    if (fault === "otherGroup") records.get("teams/a").groupId = "other";
    await assert.rejects(() => startLeagueCore("owner", data, db), {
      code: "failed-precondition",
    });
    assert.equal(records.get("leagues/l").status, "draft");
    assert.equal(
      [...records.keys()].some((p) => p.startsWith("matches/")),
      false,
    );
  }
});

test("admite participantes registrados de otros grupos y frecuencia quincenal", async () => {
  const { db, records, data } = fixture();
  records.get("teams/a").groupId = "away";
  const result = await startLeagueCore(
    "owner",
    { ...data, matchFrequency: "biweekly" },
    db,
  );
  assert.equal(result.created, 3);
  const matches = [...records]
    .filter(([path]) => path.startsWith("matches/"))
    .map(([, data]) => data);
  assert.deepEqual(
    matches.map((m) => m.date),
    ["2030-01-05", "2030-01-19", "2030-02-02"],
  );
});

test("una liga archivada no se puede iniciar aunque sea borrador", async () => {
  const { db, records, data } = fixture();
  records.get("leagues/l").isArchived = true;
  await assert.rejects(() => startLeagueCore("owner", data, db), {
    code: "failed-precondition",
  });
  assert.equal(
    [...records.keys()].some((p) => p.startsWith("matches/")),
    false,
  );
});

test("la liga admite jugadores en varios equipos sin duplicarlos en el mismo partido", async () => {
  const { db, records, data } = fixture();
  records.get("teams/b").members.push({ playerId: "a" });
  await startLeagueCore("owner", data, db);

  const matches = [...records].filter(([path]) => path.startsWith("matches/"));
  assert.equal(matches.length, 3);
  const direct = matches.find(([, match]) =>
    ["a", "b"].every((id) => match.participantTeamIds.includes(id))
  )[1];
  assert.deepEqual(new Set(direct.playerUids), new Set(["a", "b"]));
  assert.equal(direct.teams.flatMap((team) => team.players).length, 2);
  assert.equal(direct.teams.every((team) => team.players.length === 1), true);
  assert.equal(records.get("teams/b").members.length, 2);
});
