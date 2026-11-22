import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import {
  Data,
  teamIds,
  generateCup,
  advanceCup,
  standings,
  validScore,
} from "../lib/competition-engine";
import { buildMatchDateTime } from "../lib/match-date";
import { sendPushToUsers } from "../lib/fcm-push";
import { generateEvaluationAssignments } from "./match-lifecycle";
const editable = ["draft", "open_for_applications"];
const closed = ["completed", "evaluated", "cancelled"];
function fail(message: string): never {
  throw new HttpsError("failed-precondition", message);
}
function id(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 150 ||
    value.includes("/")
  )
    throw new HttpsError("invalid-argument", "Identificador inválido.");
  return value;
}
function owner(data: Data, uid: string) {
  if (data.ownerUid !== uid)
    throw new HttpsError(
      "permission-denied",
      "Sólo el organizador puede realizar esta acción.",
    );
}
function integer(v: unknown, max = 999): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > max)
    throw new HttpsError("invalid-argument", "Valor numérico inválido.");
  return v;
}
function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
export function competitionLocation(v: unknown): Data {
  const d = (v && typeof v === "object" ? v : {}) as Data;
  return {
    name: text(d.name, 120) || "A definir",
    address: text(d.address, 250),
    lat: Number.isFinite(d.lat) ? d.lat : 0,
    lng: Number.isFinite(d.lng) ? d.lng : 0,
    placeId: text(d.placeId, 200),
  };
}
function settings(d: Data, isCup: boolean): Data {
  const name = text(d.name, 80);
  if (name.length < 3) fail("El nombre debe tener entre 3 y 80 caracteres.");
  const rules = {
    pointsForWin: integer(d.rules?.pointsForWin ?? 3, 10),
    pointsForDraw: integer(d.rules?.pointsForDraw ?? 1, 10),
  };
  if (rules.pointsForDraw >= rules.pointsForWin)
    fail("Ganar debe otorgar más puntos que empatar.");
  const frequency = d.matchFrequency ?? "weekly";
  if (!["weekly", "biweekly"].includes(frequency)) fail("Frecuencia inválida.");
  const time = text(d.matchTime, 5) || "21:00",
    day = text(d.startDate, 10);
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
    (day && !buildMatchDateTime(day, time))
  )
    fail("Fecha u hora inválida.");
  const count = d.maxTeams ?? (isCup ? 32 : 16);
  integer(count, isCup ? 32 : 16);
  if (count < 2) fail("El cupo mínimo es de dos equipos.");
  return {
    name,
    description: text(d.description, 500),
    isPublic: d.isPublic === true,
    format: isCup
      ? "single_elimination"
      : d.format === "double_round_robin"
        ? "double_round_robin"
        : "round_robin",
    matchFrequency: frequency,
    matchTime: time,
    startDate: day,
    defaultLocation: competitionLocation(d.defaultLocation),
    rules,
    maxTeams: count,
  };
}
export async function loadCompetitionTeams(
  db: admin.firestore.Firestore,
  tx: admin.firestore.Transaction,
  ref: admin.firestore.DocumentReference,
  ids: string[],
): Promise<Data[]> {
  if (ids.length < 2 || ids.length > 32 || new Set(ids).size !== ids.length)
    fail("Revisá los equipos participantes.");
  const docs = await tx.getAll(...ids.map((t) => db.doc(`teams/${id(t)}`)));
  const teams: Data[] = [];
  for (let i = 0; i < docs.length; i++) {
    let value = docs[i].data();
    if (!value)
      value = (await tx.get(ref.collection("teams").doc(ids[i]))).data();
    if (!value) fail("Un equipo ya no existe. Revisá los participantes.");
    teams.push({ ...value, id: ids[i] });
  }
  const seen = new Set<string>();
  for (const t of teams) {
    if (!Array.isArray(t.members) || !t.members.length || t.members.length > 50)
      fail(`${t.name}: el plantel necesita entre 1 y 50 jugadores.`);
    for (const m of t.members) {
      const key = id(m.playerId);
      if (seen.has(key))
        fail("Un jugador no puede representar a dos equipos del torneo.");
      seen.add(key);
    }
  }
  if (seen.size > 500) fail("El torneo supera los 500 jugadores.");
  const profiles = await tx.getAll(
    ...[...seen].map((p) => db.doc(`players/${p}`)),
  );
  const players = new Map<string, Data>();
  for (const p of profiles) {
    const v = p.data();
    if (!v) fail("Un jugador del plantel ya no existe.");
    players.set(p.id, {
      uid: p.id,
      displayName: v.name ?? v.displayName ?? "Jugador",
      position: v.position ?? "MED",
      ovr: Number(v.ovr ?? 50),
      photoURL: v.photoUrl ?? v.photoURL ?? "",
    });
  }
  return teams.map((t) => {
    const roster = t.members.map((m: Data) => players.get(m.playerId)!);
    const total = roster.reduce((sum: number, p: Data) => sum + p.ovr, 0);
    return {
      ...t,
      players: roster,
      totalOVR: total,
      averageOVR: total / roster.length,
      ovr: total / roster.length,
    };
  });
}
export function competitionMatch(
  comp: Data,
  competitionId: string,
  a: Data,
  b: Data,
  bracketMatchId: string,
): Data {
  const date = comp.startDate ?? "",
    time = comp.matchTime ?? "21:00";
  const scheduled = buildMatchDateTime(date, time);
  const players = [...a.players, ...b.players];
  return {
    title: `${a.name} vs ${b.name}`,
    type: "cup",
    status:
      scheduled && scheduled.getTime() > Date.now() ? "upcoming" : "planning",
    date: scheduled && scheduled.getTime() > Date.now() ? date : "",
    time: scheduled && scheduled.getTime() > Date.now() ? time : "",
    ownerUid: comp.ownerUid,
    groupId: comp.groupId,
    matchSize: Math.max(a.players.length, b.players.length) * 2,
    isPublic: false,
    participantTeamIds: [a.id, b.id],
    teams: [a, b].map((t) => ({
      id: t.id,
      name: t.name,
      jersey: t.jersey ?? null,
      players: t.players,
      totalOVR: t.totalOVR,
      averageOVR: t.averageOVR,
      score: 0,
    })),
    players,
    playerUids: players.map((p) => p.uid),
    teamsGenerated: true,
    events: [],
    location: competitionLocation(comp.defaultLocation),
    bracketMatchId,
    leagueInfo: { leagueId: competitionId, round: 0 },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}
export const manageCompetition = onCall(
  { region: "us-central1", timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Iniciá sesión.");
    return manageCompetitionCore(
      admin.firestore(),
      request.auth.uid,
      request.data ?? {},
    );
  },
);
export async function manageCompetitionCore(
  db: admin.firestore.Firestore,
  uid: string,
  d: Data,
): Promise<Data> {
  const col = d.collection;
  if (!["cups", "leagues"].includes(col)) fail("Competición inválida.");
  const isCup = col === "cups",
    action = d.action;
  if (action === "syncResult") {
    const comp = (await db.collection(col).doc(id(d.id)).get()).data();
    if (!comp) fail("El torneo ya no existe.");
    owner(comp, uid);
    const match = (await db.doc(`matches/${id(d.matchId)}`).get()).data();
    if (
      !match ||
      match.leagueInfo?.leagueId !== d.id ||
      match.type !== (isCup ? "cup" : "league")
    )
      fail("Partido inválido.");
    await syncCompetitionResultCore(db, d.matchId);
    return { ok: true };
  }
  const ref = db
    .collection(col)
    .doc(
      action === "create"
        ? `${isCup ? "cup" : "league"}_${uid}_${id(d.requestId)}`
        : id(d.id),
    );
  let evalPush: { uids: string[]; matchId: string; title: string } | null = null;
  const result = await db.runTransaction(async (tx) => {
    const existing = (await tx.get(ref)).data();
    if (action === "create") {
      if (existing) {
        owner(existing, uid);
        return { id: ref.id };
      }
      const groupId = id(d.groupId),
        group = (await tx.get(db.doc(`groups/${groupId}`))).data();
      if (!group || (group.ownerUid !== uid && !group.members?.includes(uid)))
        throw new HttpsError(
          "permission-denied",
          "Elegí un grupo al que pertenezcas.",
        );
      const config = settings(d, isCup),
        ids = teamIds(d.teams);
      if (
        ids.length !== ((d.teams ?? []) as any[]).length ||
        new Set(ids).size !== ids.length ||
        ids.length > config.maxTeams ||
        (!config.isPublic && ids.length < 2)
      )
        fail("Revisá los equipos seleccionados.");
      const teams = ids.length
        ? await tx.getAll(...ids.map((t) => db.doc(`teams/${t}`)))
        : [];
      for (const t of teams)
        if (!t.exists || t.data()!.groupId !== groupId)
          fail("Seleccioná equipos de tu grupo.");
      tx.set(ref, {
        ...config,
        ownerUid: uid,
        groupId,
        teams: ids,
        status: config.isPublic ? "open_for_applications" : "draft",
        createdAt: new Date().toISOString(),
        teamSnapshots: Object.fromEntries(
          teams.map((t) => [
            t.id,
            { name: t.data()!.name, jersey: t.data()!.jersey ?? null },
          ]),
        ),
      });
      return { id: ref.id };
    }
    if (!existing) throw new HttpsError("not-found", "El torneo ya no existe.");
    const comp = existing;
    if (action === "apply") {
      if (
        !comp.isPublic ||
        comp.status !== "open_for_applications" ||
        comp.isArchived
      )
        fail("Las inscripciones están cerradas.");
      const teamId = id(d.teamId),
        team = (await tx.get(db.doc(`teams/${teamId}`))).data();
      if (!team || (team.createdBy !== uid && team.ownerUid !== uid))
        throw new HttpsError(
          "permission-denied",
          "Sólo quien administra el equipo puede postularlo.",
        );
      if (teamIds(comp.teams).includes(teamId)) fail("El equipo ya participa.");
      if (teamIds(comp.teams).length >= (comp.maxTeams ?? (isCup ? 32 : 16)))
        fail("El cupo del torneo está completo.");
      const application = db
          .collection("competitionApplications")
          .doc(`${col}_${ref.id}_${teamId}`),
        old = (await tx.get(application)).data();
      const legacy = await tx.get(
        db
          .collection("competitionApplications")
          .where("competitionId", "==", ref.id)
          .where("competitionType", "==", isCup ? "cup" : "league")
          .where("teamId", "==", teamId),
      );
      if (old && ["pending", "approved"].includes(old.status))
        return { id: application.id };
      if (
        legacy.docs.some((s) =>
          ["pending", "approved"].includes(s.data().status),
        )
      )
        fail("El equipo ya tiene una solicitud vigente.");
      tx.set(application, {
        competitionId: ref.id,
        competitionType: isCup ? "cup" : "league",
        teamId,
        teamName: team.name,
        teamJersey: team.jersey ?? null,
        submittedBy: uid,
        status: "pending",
        message: text(d.message, 500),
        submittedAt: new Date().toISOString(),
      });
      return { id: application.id };
    }
    if (action === "reviewApplication" && d.source === "external") {
      owner(comp, uid);
      if (!editable.includes(comp.status) || comp.isArchived)
        fail("Las inscripciones ya están cerradas.");
      const application = ref
          .collection("applications")
          .doc(id(d.applicationId)),
        a = (await tx.get(application)).data();
      if (
        !a ||
        a.status !== "pending" ||
        !["approved", "rejected"].includes(d.decision)
      )
        fail("La solicitud ya fue resuelta.");
      if (d.decision === "rejected") {
        tx.update(application, {
          status: "rejected",
          reviewedBy: uid,
          reviewedAt: new Date().toISOString(),
        });
        return { ok: true };
      }
      const teamId = id(d.teamId),
        team = (await tx.get(db.doc(`teams/${teamId}`))).data();
      if (!team || (team.createdBy !== uid && team.ownerUid !== uid))
        fail(
          "Vinculá un equipo que administres para representar esta inscripción externa.",
        );
      const ids = teamIds(comp.teams);
      if (
        ids.includes(teamId) ||
        ids.length >= (comp.maxTeams ?? (isCup ? 32 : 16))
      )
        fail("El equipo ya participa o no queda cupo.");
      tx.update(ref, {
        teams: [...ids, teamId],
        teamSnapshots: {
          ...(comp.teamSnapshots ?? {}),
          [teamId]: { name: team.name, jersey: team.jersey ?? null },
        },
      });
      tx.update(application, {
        status: "approved",
        teamId,
        reviewedBy: uid,
        reviewedAt: new Date().toISOString(),
      });
      return { ok: true };
    }
    if (action === "reviewApplication" || action === "withdrawApplication") {
      const application = db
          .collection("competitionApplications")
          .doc(id(d.applicationId)),
        a = (await tx.get(application)).data();
      if (
        !a ||
        a.competitionId !== ref.id ||
        a.competitionType !== (isCup ? "cup" : "league")
      )
        fail("Solicitud inválida.");
      if (action === "withdrawApplication") {
        if (a.submittedBy !== uid || a.status !== "pending")
          fail("Sólo podés retirar tu solicitud pendiente.");
        tx.update(application, {
          status: "withdrawn",
          reviewedAt: new Date().toISOString(),
        });
        return { ok: true };
      }
      owner(comp, uid);
      if (!editable.includes(comp.status) || comp.isArchived)
        fail("La competición ya no admite cambios de equipos.");
      const result = d.decision;
      if (!["approved", "rejected", "revoked"].includes(result))
        fail("Decisión inválida.");
      if (a.status === result) return { ok: true };
      if (result !== "revoked" && a.status !== "pending")
        fail("La solicitud ya fue resuelta.");
      if (result === "revoked" && a.status !== "approved")
        fail("Sólo se revocan solicitudes aprobadas.");
      const ids = teamIds(comp.teams),
        snapshot = { ...(comp.teamSnapshots ?? {}) };
      if (result === "approved") {
        if (ids.includes(a.teamId)) fail("El equipo ya participa.");
        if (ids.length >= (comp.maxTeams ?? (isCup ? 32 : 16)))
          fail("El cupo del torneo está completo.");
        const team = (await tx.get(db.doc(`teams/${id(a.teamId)}`))).data();
        if (!team) fail("El equipo ya no existe.");
        ids.push(a.teamId);
        snapshot[a.teamId] = { name: team.name, jersey: team.jersey ?? null };
      }
      if (result === "revoked")
        ids.splice(ids.indexOf(a.teamId), ids.includes(a.teamId) ? 1 : 0);
      tx.update(ref, { teams: ids, teamSnapshots: snapshot });
      tx.update(application, {
        status: result,
        reviewedBy: uid,
        reviewedAt: new Date().toISOString(),
        reviewNotes: text(d.notes, 500),
      });
      return { ok: true };
    }
    owner(comp, uid);
    if (
      comp.isArchived &&
      !["archive", "restore", "deleteDraft"].includes(action)
    )
      fail("Restaurá el torneo antes de administrarlo.");
    if (action === "configure") {
      if (!editable.includes(comp.status) || comp.isArchived)
        fail("La configuración deportiva se edita antes de iniciar.");
      const config = settings({ ...comp, ...d }, isCup),
        ids = d.teams === undefined ? teamIds(comp.teams) : teamIds(d.teams);
      if (
        new Set(ids).size !== ids.length ||
        ids.length > config.maxTeams ||
        (!config.isPublic && ids.length < 2)
      )
        fail("Revisá los equipos y el cupo.");
      const docs = ids.length
        ? await tx.getAll(...ids.map((t) => db.doc(`teams/${id(t)}`)))
        : [];
      if (d.teams !== undefined && ids.length !== d.teams.length)
        fail("Equipos inválidos.");
      const applications = await tx.get(
        db
          .collection("competitionApplications")
          .where("competitionId", "==", ref.id)
          .where("competitionType", "==", isCup ? "cup" : "league"),
      );
      const old = teamIds(comp.teams),
        snapshots = { ...(comp.teamSnapshots ?? {}) };
      const legacy = new Map<string, Data>();
      for (const doc of docs.filter(
        (doc) => !doc.exists && old.includes(doc.id),
      )) {
        const embedded = await tx.get(ref.collection("teams").doc(doc.id));
        if (embedded.exists) legacy.set(doc.id, embedded.data()!);
      }
      for (const doc of docs) {
        const t = doc.data() ?? legacy.get(doc.id);
        if (!t || (t.groupId !== comp.groupId && !old.includes(doc.id)))
          fail("No podés añadir un equipo externo sin inscripción aprobada.");
        snapshots[doc.id] = { name: t.name, jersey: t.jersey ?? null };
      }
      for (const application of applications.docs) {
        const a = application.data();
        if (
          a.status === "approved" &&
          old.includes(a.teamId) &&
          !ids.includes(a.teamId)
        )
          tx.update(application.ref, {
            status: "revoked",
            reviewedBy: uid,
            reviewedAt: new Date().toISOString(),
          });
      }
      tx.update(ref, {
        ...config,
        teams: ids,
        teamSnapshots: snapshots,
        status: config.isPublic ? "open_for_applications" : "draft",
      });
      return { ok: true };
    }
    if (action === "startCup") {
      if (!isCup || !editable.includes(comp.status) || comp.bracket?.length)
        fail("La copa ya fue iniciada.");
      const teams = await loadCompetitionTeams(
        db,
        tx,
        ref,
        teamIds(comp.teams),
      );
      const bracket = generateCup(teams, d.seedingType ?? "random");
      const first = bracket[0].round;
      for (const b of bracket.filter((b) => b.round === first)) {
        const m = db.collection("matches").doc();
        b.matchId = m.id;
        tx.set(
          m,
          competitionMatch(
            comp,
            ref.id,
            teams.find((t) => t.id === b.team1Id)!,
            teams.find((t) => t.id === b.team2Id)!,
            b.id,
          ),
        );
      }
      tx.update(ref, {
        bracket,
        status: "in_progress",
        currentRound: first,
        seedingType: d.seedingType ?? "random",
      });
      return { ok: true };
    }
    if (action === "prepareCupMatch") {
      if (!isCup || comp.status !== "in_progress")
        fail("La copa no está en juego.");
      const bracket = (comp.bracket ?? []).map((b: Data) => ({ ...b })),
        entry = bracket.find((b: Data) => b.id === d.bracketMatchId);
      if (!entry || !entry.team1Id || !entry.team2Id)
        fail("Los dos equipos todavía no están definidos.");
      if (entry.matchId) return { matchId: entry.matchId };
      if (entry.winnerId) fail("El cruce ya finalizó.");
      const teams = await loadCompetitionTeams(db, tx, ref, [
        entry.team1Id,
        entry.team2Id,
      ]);
      const m = db.collection("matches").doc();
      entry.matchId = m.id;
      const nextComp = { ...comp, startDate: "", matchTime: "" };
      tx.set(
        m,
        competitionMatch(nextComp, ref.id, teams[0], teams[1], entry.id),
      );
      tx.update(ref, { bracket });
      return { matchId: m.id };
    }
    if (action === "scheduleMatch" || action === "recordResult") {
      if (
        comp.isArchived ||
        comp.status === "cancelled" ||
        (comp.status === "completed" && action === "scheduleMatch")
      )
        fail("El torneo está cerrado.");
      const mref = db.doc(`matches/${id(d.matchId)}`),
        match = (await tx.get(mref)).data();
      if (
        !match ||
        match.leagueInfo?.leagueId !== ref.id ||
        match.type !== (isCup ? "cup" : "league")
      )
        fail("El partido no pertenece al torneo.");
      if (match.ownerUid !== uid)
        throw new HttpsError("permission-denied", "No organizás este partido.");
      if (action === "scheduleMatch") {
        if (closed.includes(match.status) || match.status === "active")
          fail("No se puede reprogramar un partido iniciado o cerrado.");
        const date = text(d.date, 10),
          time = text(d.time, 5),
          when = buildMatchDateTime(date, time);
        if (!when || when.getTime() < Date.now())
          fail("Elegí un horario futuro válido.");
        tx.update(mref, {
          date,
          time,
          location: competitionLocation(d.location),
          status: "upcoming",
        });
        return { ok: true };
      }
      if (match.status === "cancelled") fail("El partido fue cancelado.");
      if (
        comp.status === "completed" &&
        !["completed", "evaluated"].includes(match.status)
      )
        fail("El torneo está cerrado.");
      const score = { team1: integer(d.team1), team2: integer(d.team2) },
        pair = teamIds(match.participantTeamIds);
      const penalty = d.penaltyWinnerId ?? null;
      if (
        penalty &&
        (!isCup || score.team1 !== score.team2 || !pair.includes(penalty))
      )
        fail(
          "El ganador por penales debe ser uno de los equipos de un cruce empatado.",
        );
      if (isCup && score.team1 === score.team2 && !penalty)
        fail("Elegí el ganador por penales para resolver el empate.");
      if (closed.includes(match.status)) {
        const old = validScore(match);
        if (
          !old ||
          old.team1 !== score.team1 ||
          old.team2 !== score.team2 ||
          (match.penaltyWinnerId && match.penaltyWinnerId !== penalty)
        )
          fail("El resultado final ya está confirmado.");
      }
      const sides = (match.teams ?? []).map((t: Data, i: number) => ({
        ...t,
        score: i === 0 ? score.team1 : score.team2,
      }));
      const assignments: Data[] = [];
      if (!closed.includes(match.status)) {
        const uids = teamIds(match.playerUids);
        if (uids.length > 100 || new Set(uids).size !== uids.length)
          fail("Plantel inválido.");
        const profiles = uids.length
          ? await tx.getAll(...uids.map((p) => db.doc(`players/${p}`)))
          : [];
        if (profiles.some((p) => !p.exists))
          fail("Falta un perfil del plantel. Revisalo antes de cerrar.");
        const previous = await tx.get(
          mref.collection("assignments").limit(301),
        );
        if (previous.size >= 301)
          fail("El partido requiere revisión de asignaciones.");
        const pairs = new Set(
          previous.docs.map(
            (s) => `${s.data().evaluatorId}/${s.data().subjectId}`,
          ),
        );
        for (const a of generateEvaluationAssignments(
          { id: mref.id, playerUids: uids, teams: sides as any },
          profiles.map((p) => ({ id: p.id, ...p.data() })),
        )) {
          if (!pairs.has(`${a.evaluatorId}/${a.subjectId}`))
            assignments.push(a);
        }
      }
      tx.update(mref, {
        finalScore: score,
        teams: sides,
        penaltyWinnerId: penalty,
        status: match.status === "evaluated" ? "evaluated" : "completed",
        // Auditoría: cada carga o corrección de resultado queda registrada con
        // quién la hizo y cuál era el marcador anterior.
        resultHistory: admin.firestore.FieldValue.arrayUnion({
          by: uid,
          at: new Date().toISOString(),
          score: score ?? null,
          previous: match.finalScore ?? null,
        }),
      });
      for (const a of assignments)
        tx.set(mref.collection("assignments").doc(), a);
      const evaluators = [
        ...new Set(assignments.map((a) => String(a.evaluatorId))),
      ];
      for (const evaluator of evaluators)
        tx.set(
          db
            .collection(`users/${evaluator}/notifications`)
            .doc(`competition-evaluation-${mref.id}`),
          {
            type: "evaluation_pending",
            title: "¡Evaluación pendiente!",
            message: `Es hora de evaluar el partido "${match.title ?? ""}".`,
            link: `/evaluations/${mref.id}`,
            isRead: false,
            createdAt: new Date().toISOString(),
            metadata: { fromUserId: uid },
          },
        );
      if (evaluators.length > 0) {
        evalPush = {
          uids: evaluators,
          matchId: mref.id,
          title: String(match.title ?? ""),
        };
      }
      return {
        ok: true,
        needsFinish: false,
        assignmentsCount: assignments.length,
      };
    }
    if (action === "completeLeague") {
      if (isCup || comp.status !== "in_progress")
        fail("La liga no está en juego.");
      const matches = await tx.get(
        db
          .collection("matches")
          .where("leagueInfo.leagueId", "==", ref.id)
          .where("type", "==", isCup ? "cup" : "league"),
      );
      const data = matches.docs.map((m) => m.data());
      if (
        !data.length ||
        data.some(
          (m) =>
            !closed.includes(m.status) ||
            (m.status !== "cancelled" && !validScore(m)),
        )
      )
        fail("Todavía hay partidos o resultados pendientes.");
      const names = Object.fromEntries(
        Object.entries(comp.teamSnapshots ?? {}).map(([k, v]) => [
          k,
          (v as Data).name,
        ]),
      );
      const rows = standings(teamIds(comp.teams), names, data, comp.rules);
      if (!rows.length || !rows.some((r) => r.played))
        fail("No hay partidos jugados.");
      const tied = rows.filter(
        (r) =>
          r.points === rows[0].points &&
          r.goalDiff === rows[0].goalDiff &&
          r.goalsFor === rows[0].goalsFor,
      );
      let champion: Data | undefined = tied[0];
      if (tied.length > 1) {
        champion = tied.find((r) => r.teamId === d.championTeamId);
        if (!champion)
          return {
            requiresTiebreaker: true,
            candidates: tied.map((r) => ({ id: r.teamId, name: r.teamName })),
          };
      }
      tx.update(ref, {
        status: "completed",
        standings: rows,
        championTeamId: champion.teamId,
        championTeamName: champion.teamName,
        completedAt: new Date().toISOString(),
        requiresTiebreaker: false,
      });
      return { ok: true };
    }
    if (action === "deleteDraft") {
      if (!editable.includes(comp.status) || comp.bracket?.length)
        fail("Un torneo iniciado se archiva para conservar su historial.");
      const matches = await tx.get(
        db
          .collection("matches")
          .where("leagueInfo.leagueId", "==", ref.id)
          .where("type", "==", isCup ? "cup" : "league")
          .limit(1),
      );
      if (!matches.empty)
        fail("El torneo tiene partidos: archivá para conservar el historial.");
      const references: admin.firestore.DocumentReference[] = [];
      for (const sub of [
        "fixtures",
        "teams",
        "applications",
        "venues",
        "referees",
      ]) {
        const snap = await tx.get(ref.collection(sub).limit(100));
        if (snap.size >= 100)
          fail("Este torneo requiere limpieza desde administración.");
        references.push(...snap.docs.map((s) => s.ref));
      }
      const apps = await tx.get(
        db
          .collection("competitionApplications")
          .where("competitionId", "==", ref.id)
          .where("competitionType", "==", isCup ? "cup" : "league")
          .limit(100),
      );
      if (apps.size >= 100 || references.length + apps.size > 400)
        fail("Este torneo requiere limpieza desde administración.");
      for (const child of [
        ...references,
        ...apps.docs
          .filter(
            (s) => s.data().competitionType === (isCup ? "cup" : "league"),
          )
          .map((s) => s.ref),
      ])
        tx.delete(child);
      tx.delete(ref);
      return { ok: true };
    }
    if (action === "archive" || action === "restore") {
      tx.update(ref, { isArchived: action === "archive" });
      return { ok: true };
    }
    fail("Acción no reconocida.");
  });
  if (evalPush && admin.apps.length > 0) {
    const push: { uids: string[]; matchId: string; title: string } = evalPush;
    await sendPushToUsers(
      push.uids,
      {
        title: "¡Evaluación pendiente!",
        body: `Es hora de evaluar el partido "${push.title}".`,
        type: "evaluation_pending",
        link: `/evaluations/${push.matchId}`,
        extraData: { matchId: push.matchId },
      },
      "RecordCompetitionResult",
    );
  }
  return result;
}
export const syncCompetitionResult = onDocumentWritten(
  { document: "matches/{matchId}", region: "us-central1", retry: true },
  async (event) => {
    const after = event.data?.after.data();
    if (
      !after ||
      !["league", "cup"].includes(after.type) ||
      !["completed", "evaluated"].includes(after.status) ||
      !validScore(after)
    )
      return;
    await syncCompetitionResultCore(admin.firestore(), event.params.matchId);
  },
);
export async function syncCompetitionResultCore(
  db: admin.firestore.Firestore,
  matchId: string,
): Promise<void> {
  await db.runTransaction(async (tx) => {
    const match = (await tx.get(db.doc(`matches/${id(matchId)}`))).data();
    if (
      !match ||
      !["completed", "evaluated"].includes(match.status) ||
      !["league", "cup"].includes(match.type) ||
      !validScore(match)
    )
      return;
    if (
      typeof match.leagueInfo?.leagueId !== "string" ||
      !match.leagueInfo.leagueId ||
      match.leagueInfo.leagueId.includes("/")
    )
      return;
    const competitionId = id(match.leagueInfo.leagueId),
      ref = db.doc(
        `${match.type === "cup" ? "cups" : "leagues"}/${competitionId}`,
      ),
      comp = (await tx.get(ref)).data();
    if (!comp) return;
    if (match.type === "league") {
      const all = await tx.get(
        db
          .collection("matches")
          .where("leagueInfo.leagueId", "==", competitionId)
          .where("type", "==", "league"),
      );
      const names: Record<string, string> = Object.fromEntries(
        Object.entries(comp.teamSnapshots ?? {}).map(([k, v]) => [
          k,
          (v as Data).name,
        ]),
      );
      for (const doc of all.docs) {
        const m = doc.data(),
          ids = teamIds(m.participantTeamIds);
        ids.forEach((key, i) => {
          if (m.teams?.[i]?.name) names[key] = m.teams[i].name;
        });
      }
      const rows = standings(
        teamIds(comp.teams),
        names,
        all.docs.map((m) => m.data()),
        comp.rules,
      );
      if (!match.finalScore)
        tx.update(db.doc(`matches/${matchId}`), {
          finalScore: validScore(match),
        });
      if (JSON.stringify(comp.standings) !== JSON.stringify(rows))
        tx.update(ref, { standings: rows });
      return;
    }
    let bracket: Data[];
    try {
      bracket = advanceCup(comp.bracket ?? [], matchId, match);
    } catch (error) {
      if (error instanceof HttpsError) {
        tx.update(ref, { resultConflict: { matchId, message: error.message } });
        return;
      }
      throw error;
    }
    if (!match.finalScore)
      tx.update(db.doc(`matches/${matchId}`), {
        finalScore: validScore(match),
      });
    const final = bracket.find((b) => b.round === "final"),
      pending = bracket.find((b) => !b.winnerId);
    const update: Data = {
      bracket,
      currentRound: pending?.round ?? "final",
      resultConflict: admin.firestore.FieldValue.delete(),
    };
    if (final?.winnerId)
      Object.assign(update, {
        status: "completed",
        championTeamId: final.winnerId,
        championTeamName:
          final.winnerId === final.team1Id ? final.team1Name : final.team2Name,
        completedAt: comp.completedAt ?? new Date().toISOString(),
      });
    if (
      JSON.stringify(comp.bracket) !== JSON.stringify(bracket) ||
      (final?.winnerId && comp.status !== "completed")
    )
      tx.update(ref, update);
  });
}
