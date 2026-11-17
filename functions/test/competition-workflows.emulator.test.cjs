const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let db, manage, sync, startLeague, event;
if (enabled) {
  const admin = require("firebase-admin");
  const app = admin.initializeApp(
    { projectId: "demo-patea-competitions" },
    "competitions",
  );
  db = app.firestore();
  ({
    manageCompetitionCore: manage,
    syncCompetitionResultCore: sync,
  } = require("../lib/callable/competition-management"));
  ({
    startLeagueCore: startLeague,
  } = require("../lib/callable/league-management"));
  ({ recordLiveEventCore: event } = require("../lib/callable/match-lifecycle"));
}
const options = { skip: !enabled, timeout: 60000 };
async function fixture({ publicCup = false, count = 4, capacity = 8 } = {}) {
  const nonce = randomUUID(),
    uid = `cmp-owner-${nonce}`,
    group = `cmp-group-${nonce}`,
    away = `cmp-away-${nonce}`;
  const teams = Array.from(
      { length: count },
      (_, i) => `cmp-team-${i}-${nonce}`,
    ),
    players = teams.map((_, i) => `cmp-player-${i}-${nonce}`);
  const batch = db.batch();
  batch.set(db.doc(`groups/${group}`), { ownerUid: uid, members: [uid] });
  for (let i = 0; i < count; i++) {
    batch.set(db.doc(`teams/${teams[i]}`), {
      name: `Equipo ${i}`,
      createdBy: uid,
      groupId: group,
      jersey: { type: "plain", primaryColor: "#123456" },
      members: [{ playerId: players[i], number: i + 1, status: "titular" }],
    });
    batch.set(db.doc(`players/${players[i]}`), {
      name: `Jugador ${i}`,
      ovr: 70 + i,
      position: "MED",
      ownerUid: players[i],
      groupId: group,
    });
  }
  await batch.commit();
  const create = {
    collection: "cups",
    action: "create",
    requestId: nonce,
    groupId: group,
    name: "Copa integrada",
    teams,
    format: "single_elimination",
    isPublic: publicCup,
    maxTeams: capacity,
    startDate: "2031-01-01",
    matchTime: "21:00",
  };
  const result = await manage(db, uid, create);
  return {
    uid,
    group,
    away,
    teams,
    players,
    id: result.id,
    create,
    command: (action, data = {}, actor = uid) =>
      manage(db, actor, { collection: "cups", id: result.id, action, ...data }),
  };
}
async function readCup(f) {
  return (await db.doc(`cups/${f.id}`).get()).data();
}
async function result(f, b, a = 2, c = 0, winner) {
  await f.command("recordResult", {
    matchId: b.matchId,
    team1: a,
    team2: c,
    penaltyWinnerId: winner ?? null,
  });
  await sync(db, b.matchId);
}
test(
  "crear concurrentemente con el mismo requestId crea un solo torneo y no acepta propietario inventado",
  options,
  async () => {
    const f = await fixture();
    const [a, b] = await Promise.all([
      manage(db, f.uid, { ...f.create, ownerUid: "attacker" }),
      manage(db, f.uid, f.create),
    ]);
    assert.equal(a.id, f.id);
    assert.equal(b.id, f.id);
    assert.equal((await readCup(f)).ownerUid, f.uid);
    await assert.rejects(
      () => f.command("configure", { name: "Intrusión" }, "stranger"),
      { code: "permission-denied" },
    );
  },
);
test(
  "copa de cuatro equipos: partidos reales, cierre atómico, evaluaciones y campeón sin duplicados",
  options,
  async () => {
    const f = await fixture();
    await f.command("startCup", { seedingType: "ovr_based" });
    let cup = await readCup(f);
    const semis = cup.bracket.filter((b) => b.round === "semifinals");
    assert.equal(semis.length, 2);
    for (const b of semis) {
      const m = (await db.doc(`matches/${b.matchId}`).get()).data();
      assert.equal(m.type, "cup");
      assert.equal(m.playerUids.length, 2);
      assert.equal(m.bracketMatchId, b.id);
    }
    const b = semis[0];
    await Promise.all([result(f, b), result(f, b)]);
    const assignments = await db
      .collection(`matches/${b.matchId}/assignments`)
      .get();
    assert.equal(assignments.size, 2);
    for (const a of assignments.docs) {
      const notices = await db
        .collection(`users/${a.data().evaluatorId}/notifications`)
        .get();
      assert.equal(notices.size, 1);
    }
    await result(f, semis[1]);
    cup = await readCup(f);
    const final = cup.bracket.find((b) => b.round === "final");
    const [p, q] = await Promise.all([
      f.command("prepareCupMatch", { bracketMatchId: final.id }),
      f.command("prepareCupMatch", { bracketMatchId: final.id }),
    ]);
    assert.equal(p.matchId, q.matchId);
    await result(f, { ...final, matchId: p.matchId }, 1, 1, final.team2Id);
    await sync(db, p.matchId);
    await f.command("recordResult", {
      matchId: p.matchId,
      team1: 1,
      team2: 1,
      penaltyWinnerId: final.team2Id,
    });
    cup = await readCup(f);
    assert.equal(cup.status, "completed");
    assert.equal(cup.championTeamId, final.team2Id);
    assert.equal(
      cup.bracket.find((b) => b.round === "final").finalScore.team1,
      1,
    );
    assert.equal(
      (
        await db
          .collection("matches")
          .where("leagueInfo.leagueId", "==", f.id)
          .get()
      ).size,
      3,
    );
  },
);
test(
  "un marcador final no se cambia ni se registran eventos después del cierre",
  options,
  async () => {
    const f = await fixture({ count: 2 });
    await f.command("startCup");
    const b = (await readCup(f)).bracket[0];
    await result(f, b, 3, 0);
    await assert.rejects(
      () =>
        f.command("recordResult", { matchId: b.matchId, team1: 0, team2: 3 }),
      { code: "failed-precondition" },
    );
    await assert.rejects(
      () =>
        event(db, f.uid, b.matchId, {
          id: "late",
          type: "goal",
          playerId: f.players[0],
        }),
      { code: "failed-precondition" },
    );
  },
);
test(
  "eventos concurrentes no pierden goles y el reintento no duplica el mismo evento",
  options,
  async () => {
    const f = await fixture({ count: 2 });
    await f.command("startCup");
    const b = (await readCup(f)).bracket[0];
    const ref = db.doc(`matches/${b.matchId}`);
    await ref.update({ status: "active" });
    const e = {
      id: "goal-one",
      type: "goal",
      playerId: (await ref.get()).data().teams[0].players[0].uid,
    };
    await Promise.all([
      event(db, f.uid, b.matchId, e),
      event(db, f.uid, b.matchId, e),
      event(db, f.uid, b.matchId, { ...e, id: "goal-two" }),
    ]);
    const m = (await ref.get()).data();
    assert.equal(m.teams[0].score, 2);
    assert.equal(m.events.length, 2);
  },
);
test(
  "empate de un partido ya finalizado espera penales sin sumar penales al marcador",
  options,
  async () => {
    const f = await fixture({ count: 2 });
    await f.command("startCup");
    const b = (await readCup(f)).bracket[0];
    const m = db.doc(`matches/${b.matchId}`);
    await m.update({ status: "completed", finalScore: { team1: 1, team2: 1 } });
    await sync(db, m.id);
    assert.equal((await readCup(f)).bracket[0].requiresTiebreaker, true);
    await f.command("recordResult", {
      matchId: m.id,
      team1: 1,
      team2: 1,
      penaltyWinnerId: b.team1Id,
    });
    await sync(db, m.id);
    assert.equal((await readCup(f)).championTeamId, b.team1Id);
    assert.deepEqual((await m.get()).data().finalScore, { team1: 1, team2: 1 });
  },
);
test(
  "solicitudes duplicadas y aprobación concurrente respetan cupos y no cambian equipos ajenos",
  options,
  async () => {
    const f = await fixture({ count: 2, publicCup: true, capacity: 3 });
    const applicants = [];
    for (let i = 0; i < 2; i++) {
      const actor = `applicant-${i}-${randomUUID()}`,
        team = `away-team-${randomUUID()}`,
        player = `away-player-${randomUUID()}`;
      await db
        .doc(`teams/${team}`)
        .set({
          name: `Visitante ${i}`,
          createdBy: actor,
          groupId: "another-group",
          members: [{ playerId: player }],
          jersey: { type: "plain" },
        });
      await db
        .doc(`players/${player}`)
        .set({ name: "Visitante", ownerUid: actor, ovr: 55 });
      applicants.push({ actor, team });
    }
    const a = applicants[0];
    const [one, two] = await Promise.all([
      f.command("apply", { teamId: a.team }, a.actor),
      f.command("apply", { teamId: a.team }, a.actor),
    ]);
    assert.equal(one.id, two.id);
    const second = await f.command(
      "apply",
      { teamId: applicants[1].team },
      applicants[1].actor,
    );
    const decisions = await Promise.allSettled([
      f.command("reviewApplication", {
        applicationId: one.id,
        decision: "approved",
      }),
      f.command("reviewApplication", {
        applicationId: second.id,
        decision: "approved",
      }),
    ]);
    assert.equal(decisions.filter((d) => d.status === "fulfilled").length, 1);
    assert.equal((await readCup(f)).teams.length, 3);
    assert.equal(
      (await db.doc(`teams/${a.team}`).get()).data().groupId,
      "another-group",
    );
    await assert.rejects(
      () => f.command("apply", { teamId: f.teams[0] }, "stranger"),
      { code: "permission-denied" },
    );
  },
);
test(
  "solicitud propia se retira, no se puede resolver sin permiso y el borrador no admite torneo privado vacío",
  options,
  async () => {
    const f = await fixture({ count: 2, publicCup: true });
    const applicant = `requester-${randomUUID()}`,
      team = `request-team-${randomUUID()}`;
    await db
      .doc(`teams/${team}`)
      .set({
        name: "Equipo visitante",
        createdBy: applicant,
        groupId: "away",
        members: [],
      });
    const app = await f.command("apply", { teamId: team }, applicant);
    await assert.rejects(
      () =>
        f.command(
          "reviewApplication",
          { applicationId: app.id, decision: "approved" },
          applicant,
        ),
      { code: "permission-denied" },
    );
    await f.command(
      "withdrawApplication",
      { applicationId: app.id },
      applicant,
    );
    assert.equal(
      (await db.doc(`competitionApplications/${app.id}`).get()).data().status,
      "withdrawn",
    );
    await assert.rejects(
      () => f.command("configure", { teams: [], isPublic: false }),
      { code: "failed-precondition" },
    );
  },
);
test(
  "registros externos de la web sólo se aprueban al vincular un plantel administrado",
  options,
  async () => {
    const f = await fixture({ count: 2, publicCup: true });
    const legacy = db.doc(`cups/${f.id}/applications/external`);
    await legacy.set({
      teamName: "Inscripto desde web",
      captainName: "Capitán",
      status: "pending",
    });
    const team = `linked-${randomUUID()}`;
    await db
      .doc(`teams/${team}`)
      .set({
        name: "Plantel vinculado",
        createdBy: f.uid,
        groupId: f.group,
        members: [],
      });
    await f.command("reviewApplication", {
      source: "external",
      applicationId: legacy.id,
      decision: "approved",
      teamId: team,
    });
    assert.equal((await legacy.get()).data().status, "approved");
    assert((await readCup(f)).teams.includes(team));
  },
);
test(
  "programar valida fecha, pertenencia y estados; archivar conserva historial",
  options,
  async () => {
    const f = await fixture({ count: 2 });
    await f.command("startCup");
    const b = (await readCup(f)).bracket[0];
    await assert.rejects(
      () =>
        f.command("scheduleMatch", {
          matchId: b.matchId,
          date: "2000-01-01",
          time: "21:00",
        }),
      { code: "failed-precondition" },
    );
    await f.command("scheduleMatch", {
      matchId: b.matchId,
      date: "2032-02-03",
      time: "19:30",
      location: { name: "Cancha del barrio", address: "Dirección" },
    });
    assert.equal(
      (await db.doc(`matches/${b.matchId}`).get()).data().location.name,
      "Cancha del barrio",
    );
    await assert.rejects(() => f.command("deleteDraft"), {
      code: "failed-precondition",
    });
    await f.command("archive");
    assert.equal((await readCup(f)).isArchived, true);
    assert((await db.doc(`matches/${b.matchId}`).get()).exists);
    await f.command("restore");
    assert.equal((await readCup(f)).isArchived, false);
  },
);
test(
  "liga quincenal y cierre con desempate explícito, sin declarar campeón con partidos pendientes",
  options,
  async () => {
    const f = await fixture({ count: 2 });
    const league = await manage(db, f.uid, {
      ...f.create,
      collection: "leagues",
      name: "Liga integrada",
      format: "double_round_robin",
      matchFrequency: "biweekly",
    });
    const command = (action, data = {}) =>
      manage(db, f.uid, {
        collection: "leagues",
        id: league.id,
        action,
        ...data,
      });
    await startLeague(
      f.uid,
      { leagueId: league.id, startDate: "2031-03-01", time: "20:30" },
      db,
    );
    const matches = await db
      .collection("matches")
      .where("leagueInfo.leagueId", "==", league.id)
      .where("type", "==", "league")
      .get();
    assert.equal(matches.size, 2);
    await assert.rejects(() => command("completeLeague"), {
      code: "failed-precondition",
    });
    for (const m of matches.docs) {
      await command("recordResult", { matchId: m.id, team1: 0, team2: 0 });
      await sync(db, m.id);
    }
    const tie = await command("completeLeague");
    assert.equal(tie.requiresTiebreaker, true);
    assert.equal(tie.candidates.length, 2);
    await command("completeLeague", { championTeamId: tie.candidates[1].id });
    assert.equal(
      (await db.doc(`leagues/${league.id}`).get()).data().championTeamId,
      tie.candidates[1].id,
    );
  },
);
test(
  "eliminar borrador limpia ambas fuentes de solicitudes y no toca el equipo",
  options,
  async () => {
    const f = await fixture({ count: 2, publicCup: true });
    await db.doc(`cups/${f.id}/applications/legacy`).set({ status: "pending" });
    await db
      .doc(`competitionApplications/cleanup-${f.id}`)
      .set({
        competitionId: f.id,
        competitionType: "cup",
        status: "pending",
        submittedBy: f.uid,
      });
    await f.command("deleteDraft");
    assert.equal((await db.doc(`cups/${f.id}`).get()).exists, false);
    assert.equal(
      (await db.doc(`competitionApplications/cleanup-${f.id}`).get()).exists,
      false,
    );
    assert((await db.doc(`teams/${f.teams[0]}`).get()).exists);
  },
);

test(
  "archivado bloquea iniciar y equipos legados se conservan al editar",
  options,
  async () => {
    const f = await fixture({ count: 2 });
    await f.command("archive");
    await assert.rejects(() => f.command("startCup"), {
      code: "failed-precondition",
    });
    await f.command("restore");
    const old = (await db.doc(`teams/${f.teams[0]}`).get()).data();
    await db.doc(`cups/${f.id}/teams/${f.teams[0]}`).set(old);
    await db.doc(`teams/${f.teams[0]}`).delete();
    await f.command("configure", { name: "Copa con plantel legado" });
    assert.equal((await readCup(f)).teams.length, 2);
  },
);
