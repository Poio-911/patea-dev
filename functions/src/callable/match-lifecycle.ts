import { isGeneratingTeams, matchRosterIds, regenerateMatchTeams } from './match-management';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { generateBalancedTeamsCore } from './generate-balanced-teams';

/**
 * Callables para el ciclo de vida de un partido (iniciar, sumarse/bajarse,
 * registrar evento en vivo, finalizar). Existen por el mismo motivo que
 * create-match.ts: firestore.rules tiene `allow update, delete: if false`
 * en /matches/{matchId} a propósito, así que ninguna escritura puede salir
 * directo del cliente.
 */

async function getMatchOrThrow(matchId: string) {
  const db = admin.firestore();
  const ref = db.collection('matches').doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'El partido no existe.');
  return { ref, data: snap.data()! };
}

function requireAuth(request: { auth?: { uid: string } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}

export const startMatch = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const db = admin.firestore();
  const ref = db.collection('matches').doc(matchId);
  await db.runTransaction(async tx => {
    const data = (await tx.get(ref)).data();
    if (!data) throw new HttpsError('not-found', 'El partido no existe.');
    if (data.ownerUid !== uid) throw new HttpsError('permission-denied', 'Sólo el organizador puede iniciar el partido.');
    if (data.status === 'active') return;
    if (data.status !== 'upcoming') throw new HttpsError('failed-precondition', 'Confirmá fecha y equipos antes de iniciar.');
    if (isGeneratingTeams(data)) throw new HttpsError('aborted', 'Esperá a que termine el armado de equipos.');
    if (!Array.isArray(data.teams) || data.teams.length !== 2 || data.teams.some((team: any) => !team.players?.length)) {
      throw new HttpsError('failed-precondition', 'Armá los dos equipos antes de iniciar el partido.');
    }
    const roster = matchRosterIds(data);
    const assigned = data.teams.flatMap((team: any) => team.players.map((p: any) => p?.uid));
    if (assigned.length !== roster.length || new Set(assigned).size !== assigned.length ||
        roster.some(id => !assigned.includes(id))) {
      throw new HttpsError('failed-precondition', 'El plantel cambió o hay jugadores repetidos. Tocá Equilibrar equipos antes de iniciar el partido.');
    }
    tx.update(ref, { status: 'active', liveStatus: 'first_half', currentMinute: 0,
      periodStartTs: admin.firestore.FieldValue.serverTimestamp(), timerPaused: false,
      startedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  return { ok: true };
});

/**
 * @deprecated Quedó para no romper las builds ya instaladas.
 *
 * Las versiones del móvil hasta la 1.0.1 mandaban el minuto escrito a mano con
 * un botón de "+5 min". Si se borra esta función, en esos teléfonos ese botón
 * empieza a tirar error. Se puede sacar cuando no queden instalaciones
 * anteriores a la 1.0.2.
 */
export const updateLiveMinute = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const minute = Number(request.data?.minute ?? 0);
  const liveStatus = String(request.data?.liveStatus ?? '');
  const { ref, data } = await getMatchOrThrow(matchId);
  if (data.ownerUid !== uid) {
    throw new HttpsError('permission-denied', 'Solo el organizador puede actualizar el minuto en vivo.');
  }
  // Se congela el reloj en el minuto que mandó el cliente: es lo único
  // coherente, porque esas versiones no saben de `periodStartTs`.
  await ref.update({ currentMinute: minute, liveStatus, timerPaused: true });
  return { ok: true };
});

/**
 * Cambia el período del partido en vivo, o pausa/reanuda el cronómetro.
 *
 * Port de `updateLiveStateAction` en src/lib/actions/server-actions.ts. El
 * contrato del reloj, que comparten web y móvil:
 *
 *   minuto mostrado = currentMinute + (ahora - periodStartTs)   si corre
 *   minuto mostrado = currentMinute                             si está pausado
 *
 * O sea que `currentMinute` guarda el minuto BASE del tramo actual y
 * `periodStartTs` cuándo empezó a correr ese tramo. Nadie tiene que estar
 * mirando la pantalla para que el tiempo avance, y el cronómetro sobrevive a
 * que se cierre la app.
 *
 * `finished` no se maneja acá: eso es `finishMatch`, que además dispara las
 * evaluaciones.
 */
export const updateLiveState = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const liveStatus = String(request.data?.liveStatus ?? '');
  const baseMinute = Number(request.data?.baseMinute ?? 0);
  const paused = request.data?.paused === true;

  const VALID = [
    'not_started',
    'first_half',
    'half_time',
    'second_half',
    'extra_time_first',
    'extra_time_break',
    'extra_time_second',
    'penalty_shootout',
  ];
  if (!VALID.includes(liveStatus)) {
    throw new HttpsError('invalid-argument', `Estado en vivo desconocido: ${liveStatus}`);
  }

  const { ref, data } = await getMatchOrThrow(matchId);
  if (data.ownerUid !== uid) {
    throw new HttpsError('permission-denied', 'Solo el organizador puede controlar el partido en vivo.');
  }

  const updates: Record<string, unknown> = {
    liveStatus,
    currentMinute: baseMinute,
    timerPaused: paused,
    status: 'active',
  };

  // El reloj sólo se reancla cuando efectivamente arranca a correr. Si está
  // pausado, `currentMinute` ya trae el minuto congelado y `periodStartTs`
  // deja de importar hasta la próxima reanudación.
  if (!paused) {
    updates.periodStartTs = admin.firestore.FieldValue.serverTimestamp();
  }

  await ref.update(updates);
  return { ok: true };
});

/**
 * Si el partido acaba de llegar a cupo completo, genera los equipos con IA
 * y pasa a 'upcoming' — port 1:1 de triggerMatchFullSequence en
 * src/lib/match-logic.ts (llamada por joinMatchAction tras cada join). Usa
 * el mismo flag `teamsGenerated` como lock para evitar que dos joins
 * concurrentes disparen la generación dos veces.
 */
async function maybeGenerateTeamsIfFull(matchId: string) {
  return regenerateMatchTeams(admin.firestore(), matchId, undefined, true);
}

/**
 * Port 1:1 de joinMatchAction en src/lib/actions/match-actions.ts: agrega
 * al jugador tanto a `playerUids` como a `players` (con su perfil embebido
 * — displayName/ovr/position/photoURL), valida cupo e invitaciones
 * pendientes dentro de una transacción para evitar sobrecupo por joins
 * concurrentes, notifica al organizador, y dispara la generación
 * automática de equipos si el partido queda completo.
 */
export const joinMatch = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const db = admin.firestore();
  const ref = db.collection('matches').doc(matchId);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'El partido no existe.');
    const match = snap.data()!;
    if (!['planning', 'upcoming'].includes(match.status)) throw new HttpsError('failed-precondition', 'La convocatoria ya está cerrada.');
    if (isGeneratingTeams(match)) throw new HttpsError('aborted', 'Se están armando los equipos. Reintentá en unos segundos.');

    const playerUids: string[] = Array.isArray(match.playerUids) ? match.playerUids : [];
    if (playerUids.includes(uid)) return; // idempotente, igual que la web

    const invitationSnap = await transaction.get(db.collection(`matches/${matchId}/invitations`).doc(uid));
    if (invitationSnap.exists && invitationSnap.data()?.status !== 'declined') return;

    const players: Array<Record<string, unknown>> = Array.isArray(match.players) ? match.players : [];
    const matchSize = Number(match.matchSize ?? 0);
    if (matchSize > 0 && players.length >= matchSize) {
      throw new HttpsError('failed-precondition', 'El partido está lleno.');
    }

    const playerSnap = await transaction.get(db.collection('players').doc(uid));
    if (!playerSnap.exists) {
      throw new HttpsError('failed-precondition', 'No se encontró tu perfil de jugador.');
    }
    const player = playerSnap.data()!;

    const playerPayload = {
      uid,
      displayName: player.name ?? '',
      ovr: player.ovr ?? 0,
      position: player.position ?? '',
      photoURL: player.photoURL || player.photoUrl || '',
    };

    transaction.update(ref, {
      players: admin.firestore.FieldValue.arrayUnion(playerPayload),
      playerUids: admin.firestore.FieldValue.arrayUnion(uid),
    });

    if (match.ownerUid && match.ownerUid !== uid) {
      transaction.set(db.collection(`users/${match.ownerUid}/notifications`).doc(), {
        type: 'new_joiner',
        title: '¡Nuevo Jugador!',
        message: `${playerPayload.displayName} se ha apuntado a tu partido "${match.title ?? ''}".`,
        link: `/matches/${matchId}`,
        isRead: false,
        createdAt: new Date().toISOString(),
        metadata: { fromUserId: uid, matchId },
      });
    }
  });

  await maybeGenerateTeamsIfFull(matchId).catch((error) => {
    console.error('[joinMatch] Error generando equipos al completarse el cupo', error);
  });

  return { ok: true };
});

/** Port 1:1 de leaveMatchAction: saca al jugador de `players` y `playerUids` juntos. */
export const leaveMatch = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const db = admin.firestore();
  const ref = db.collection('matches').doc(matchId);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'El partido no existe.');
    const match = snap.data()!;
    if (!['planning', 'upcoming'].includes(match.status)) throw new HttpsError('failed-precondition', 'La convocatoria ya está cerrada.');
    if (isGeneratingTeams(match)) throw new HttpsError('aborted', 'Se están armando los equipos. Reintentá en unos segundos.');

    const playerUids: string[] = Array.isArray(match.playerUids) ? match.playerUids : [];
    if (!playerUids.includes(uid)) return; // idempotente

    const players: Array<Record<string, unknown>> = Array.isArray(match.players) ? match.players : [];
    transaction.update(ref, {
      players: players.filter((p) => p.uid !== uid),
      playerUids: playerUids.filter((id) => id !== uid),
      teamsGenerated: false,
      teams: (Array.isArray(match.teams) ? match.teams : []).map((team: any) => {
        const remaining = (Array.isArray(team.players) ? team.players : []).filter((p: any) => p.uid !== uid);
        const totalOVR = remaining.reduce((sum: number, p: any) => sum + Number(p.ovr ?? 0), 0);
        return { ...team, players: remaining, totalOVR, averageOVR: remaining.length ? totalOVR / remaining.length : 0 };
      }),
    });
  });

  return { ok: true };
});

export const recordLiveEvent = onCall({ region: 'us-central1' }, async (request) => {
  const uid=requireAuth(request), matchId=String(request.data?.matchId??''), event=request.data?.event as Record<string, any> | undefined;
  if(!matchId || matchId.includes('/') || !event || typeof event.type!=='string') throw new HttpsError('invalid-argument','Evento inválido.');
  return recordLiveEventCore(admin.firestore(),uid,matchId,event);
});
export async function recordLiveEventCore(db: admin.firestore.Firestore,uid: string,matchId: string,event: Record<string,any>) {
  const ref=db.collection('matches').doc(matchId);
  return db.runTransaction(async tx=>{
    const match=(await tx.get(ref)).data();
    if(!match) throw new HttpsError('not-found','El partido no existe.');
    if(match.ownerUid!==uid) throw new HttpsError('permission-denied','Sólo el organizador registra eventos.');
    if(match.status!=='active') throw new HttpsError('failed-precondition','El partido debe estar en vivo y sin cerrar.');
    const events=Array.isArray(match.events)?match.events:[];
    if(events.some((e:any)=>event.id ? e.id===event.id : JSON.stringify(e)===JSON.stringify(event))) return {ok:true};
    const sides=Array.isArray(match.teams)?match.teams.map((t:any)=>({...t})):[];
    const index=sides.findIndex((t:any)=>t.players?.some((p:any)=>(p.uid??p.id)===event.playerId));
    if(index<0 || index>1) throw new HttpsError('failed-precondition','El jugador no está en el partido.');
    const updates:Record<string,unknown>={events:admin.firestore.FieldValue.arrayUnion({...event,recordedBy:uid})};
    if(event.type==='goal') {
      const scoring=event.goalType==='own_goal'?1-index:index;
      const current=Number(sides[scoring].score??0);
      if(!Number.isInteger(current) || current<0 || current>=999) throw new HttpsError('failed-precondition','Marcador inválido.');
      sides[scoring].score=current+1;updates.teams=sides;
    }
    tx.update(ref,updates);return {ok:true};
  });
}

type LifecyclePlayer = {
  id: string;
  photoURL?: string;
  photoUrl?: string;
  name?: string;
  displayName?: string;
  ovr?: number;
  position?: string;
  ownerUid?: string;
};

type LifecycleTeam = {
  players: { uid: string }[];
};

/** Port 1:1 de isRealUser en src/lib/actions/match-actions.ts. */
function isRealUser(player: LifecyclePlayer): boolean {
  return player.id === player.ownerUid;
}

/**
 * Port 1:1 de generateEvaluationAssignments en
 * src/lib/actions/match-actions.ts — NO simplificar ni "mejorar" el
 * algoritmo, la web depende de este mismo shuffle+round-robin para que las
 * asignaciones de evaluación (matches/{id}/assignments) salgan parejas.
 */
export function generateEvaluationAssignments(
  match: { id: string; playerUids: string[]; teams?: LifecycleTeam[] },
  allPlayers: LifecyclePlayer[]
): { matchId: string; evaluatorId: string; subjectId: string; status: 'pending' }[] {
  const assignments: { matchId: string; evaluatorId: string; subjectId: string; status: 'pending' }[] = [];
  const matchPlayers = allPlayers.filter((player) => match.playerUids.includes(player.id));
  const realPlayerUids = matchPlayers.filter(isRealUser).map((player) => player.id);
  const incomingCounts: Record<string, number> = {};

  matchPlayers.forEach((player) => {
    incomingCounts[player.id] = 0;
  });

  const shuffledEvaluators = [...realPlayerUids];
  for (let index = shuffledEvaluators.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffledEvaluators[index], shuffledEvaluators[swapIndex]] = [shuffledEvaluators[swapIndex], shuffledEvaluators[index]];
  }

  shuffledEvaluators.forEach((evaluatorId) => {
    const evaluatorTeam = match.teams?.find((team) => team.players.some((player) => player.uid === evaluatorId));
    const candidates = matchPlayers
      .filter((player) => player.id !== evaluatorId)
      .sort((left, right) => {
        const countDiff = incomingCounts[left.id] - incomingCounts[right.id];
        if (countDiff !== 0) {
          return countDiff;
        }

        const leftIsTeammate = evaluatorTeam?.players.some((teamPlayer) => teamPlayer.uid === left.id);
        const rightIsTeammate = evaluatorTeam?.players.some((teamPlayer) => teamPlayer.uid === right.id);

        if (leftIsTeammate && !rightIsTeammate) {
          return -1;
        }
        if (!leftIsTeammate && rightIsTeammate) {
          return 1;
        }
        return 0;
      });

    const selectedPeers = candidates.slice(0, 2);

    if (selectedPeers.length === 0) {
      assignments.push({ matchId: match.id, evaluatorId, subjectId: evaluatorId, status: 'pending' });
      return;
    }

    selectedPeers.forEach((subject) => {
      incomingCounts[subject.id] += 1;
      assignments.push({ matchId: match.id, evaluatorId, subjectId: subject.id, status: 'pending' });
    });
  });

  return assignments;
}

/**
 * Port 1:1 de finishMatchAction en src/lib/actions/match-actions.ts.
 * A diferencia de la versión anterior de esta función (que solo ponía
 * status+score, comportamiento incorrecto ya en producción), la real:
 * (a) genera equipos con IA si el partido no los tiene todavía y ya hay
 *     cupo completo, (b) pone status:'completed' (sin tocar el score —
 *     el marcador sale de los eventos en vivo, no se pasa acá),
 * (c) genera y escribe matches/{id}/assignments vía el mismo algoritmo de
 *     generateEvaluationAssignments, (d) notifica evaluation_pending a
 *     cada evaluador. El envío push (notifyEvaluationAvailableAction en la
 *     web) queda fuera: la infraestructura de push notifications todavía
 *     no está portada a Flutter (dominio 0% del plan de migración).
 */
export const finishMatch = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');

  const db = admin.firestore();
  const { ref, data } = await getMatchOrThrow(matchId);
  if (data.ownerUid !== uid) {
    throw new HttpsError('permission-denied', 'Solo el organizador puede finalizar el partido.');
  }
  if (data.status === 'completed' || data.status === 'evaluated') return { ok: true, assignmentsCount: 0 };
  if (isGeneratingTeams(data)) throw new HttpsError('aborted', 'Esperá a que termine el armado de equipos.');

  const playerUids: string[] = Array.isArray(data.playerUids) ? data.playerUids : [];
  const playerRefs = playerUids.map((playerId) => db.collection('players').doc(playerId));
  const playerDocs = playerRefs.length > 0 ? await db.getAll(...playerRefs) : [];
  const allPlayers: LifecyclePlayer[] = playerDocs
    .filter((doc) => doc.exists)
    .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));

  if (allPlayers.length !== new Set(playerUids).size) throw new HttpsError('failed-precondition', 'Falta un perfil del plantel. Revisá la convocatoria antes de finalizar.');
  const matchSize = Number(data.matchSize ?? 0);
  let finalTeams = Array.isArray(data.teams) ? (data.teams as LifecycleTeam[]) : undefined;
  const matchUpdateData: Record<string, unknown> = { status: 'completed' };

  if ((!finalTeams || finalTeams.length === 0) && playerUids.length >= matchSize && matchSize > 0) {
    const playersToBalance = allPlayers
      .filter((player) => playerUids.includes(player.id))
      .map((player) => ({
        uid: player.id,
        displayName: player.displayName || player.name || '',
        position: player.position || '',
        ovr: player.ovr || 0,
        photoURL: String(player.photoURL ?? player.photoUrl ?? ''),
      }));
    const teamGenerationResult = await generateBalancedTeamsCore(playersToBalance, 2);
    finalTeams = teamGenerationResult.teams as unknown as LifecycleTeam[];
    matchUpdateData.teams = finalTeams;
  }

  const matchForAssignments = { id: matchId, playerUids, teams: finalTeams };
  const assignments = generateEvaluationAssignments(matchForAssignments, allPlayers);

  await db.runTransaction(async batch => {
    const fresh = (await batch.get(ref)).data();
    if (!fresh) throw new HttpsError('not-found', 'El partido no existe.');
    if (fresh.ownerUid !== uid) throw new HttpsError('permission-denied', 'Sólo el organizador puede finalizar.');
    if (fresh.status === 'completed' || fresh.status === 'evaluated') return;
    if (isGeneratingTeams(fresh) || JSON.stringify(fresh.playerUids ?? []) !== JSON.stringify(playerUids) || JSON.stringify(fresh.teams ?? []) !== JSON.stringify(data.teams ?? [])) {
      throw new HttpsError('aborted', 'El plantel cambió. Actualizá el partido antes de finalizar.');
    }
    batch.update(ref, matchUpdateData);

    assignments.forEach((assignment) => {
      const assignmentRef = db.collection(`matches/${matchId}/assignments`).doc();
      batch.set(assignmentRef, assignment);
    });

    const uniqueEvaluatorIds = [...new Set(assignments.map((assignment) => assignment.evaluatorId))];
    uniqueEvaluatorIds.forEach((evaluatorId) => {
      const notificationRef = db.collection(`users/${evaluatorId}/notifications`).doc();
      batch.set(notificationRef, {
        type: 'evaluation_pending',
        title: '¡Evaluación pendiente!',
        message: `Es hora de evaluar a tus compañeros del partido "${data.title ?? ''}".`,
        link: `/evaluations/${matchId}`,
        isRead: false,
        createdAt: new Date().toISOString(),
        metadata: { fromUserId: uid },
      });
    });
  });

  return { ok: true, assignmentsCount: assignments.length };
});

/**
 * Port 1:1 de finalizePendingMatchesAction en
 * src/lib/actions/match-actions.ts — usada por el botón "Finalizar N
 * Partidos" del PendingFinalizationDialog en la lista de partidos.
 */
export const finalizePendingMatches = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchIdsInput = request.data?.matchIds;
  const matchIds: string[] = Array.isArray(matchIdsInput) ? matchIdsInput.filter(Boolean) : [];
  const uniqueMatchIds = [...new Set(matchIds)];

  if (uniqueMatchIds.length === 0) {
    return { ok: true, finalizedCount: 0 };
  }

  const db = admin.firestore();
  const matchRefs = uniqueMatchIds.map((matchId) => db.collection('matches').doc(matchId));
  const matchDocs = await db.getAll(...matchRefs);
  const batch = db.batch();
  const finalizedAt = new Date().toISOString();
  const competitionTypes = new Set(['league', 'cup', 'league_final']);
  let finalizedCount = 0;

  for (const matchDoc of matchDocs) {
    if (!matchDoc.exists) continue;
    const match = matchDoc.data() as Record<string, unknown>;

    if (match.ownerUid !== uid) continue;
    if (match.status !== 'upcoming' || competitionTypes.has(String(match.type))) continue;

    batch.update(matchDoc.ref, { status: 'completed', finalizedAt });
    finalizedCount += 1;
  }

  if (finalizedCount > 0) {
    await batch.commit();
  }

  return { ok: true, finalizedCount };
});
