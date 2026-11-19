import { HttpsError } from 'firebase-functions/v2/https';
import { buildMatchDateTime } from './match-date';
import { isCompetitionMatch, isMatchManager } from './match-access';

/**
 * La máquina de estados de un partido, impuesta en el servidor.
 *
 *   planning ─confirmar fecha─▶ upcoming ─iniciar─▶ active ─finalizar─▶ completed ─▶ evaluated
 *
 * Hasta ahora cada callable decidía por su cuenta y varios no miraban el estado:
 * `updateLiveState` ponía `active` desde cualquiera, `finishMatch` cerraba un
 * partido que nunca se jugó, `confirmMatchDate` volvía a `upcoming` uno terminado
 * y `deleteMatch` borraba un partido ya evaluado. Esto lo centraliza en
 * funciones puras (fáciles de probar) que los callables llaman antes de escribir.
 *
 * Reglas: ver docs/technical/REGLAS_POR_TIPO_DE_PARTIDO.md §3.
 */

type Doc = Record<string, any>;

const OPEN_STATUSES = ['planning', 'upcoming'];

/** `planning` o `upcoming`: todavía no empezó y se puede cambiar. */
export function isScheduleOpen(match: Doc): boolean {
  return OPEN_STATUSES.includes(String(match.status ?? ''));
}

/** El partido está en vivo: sólo ahí se controla el reloj y se registran eventos. */
export function assertLive(match: Doc): void {
  if (match.status !== 'active') {
    throw new HttpsError(
      'failed-precondition',
      'El partido no está en vivo. Iniciá el partido antes de controlarlo.',
    );
  }
}

/**
 * Sólo se finaliza un partido que estuvo en vivo. Si no se jugó, se elimina (o,
 * cuando exista, se cancela): cerrarlo como 0-0 inventaba un resultado y, en un
 * partido entre grupos, sumaba un empate falso al historial de rivales.
 */
export function assertFinishable(match: Doc): void {
  if (match.status !== 'active') {
    throw new HttpsError(
      'failed-precondition',
      'Sólo se finaliza un partido que está en vivo. Si no se jugó, eliminalo.',
    );
  }
}

/** La convocatoria (anotarse, pedir lugar, invitar, aprobar) sólo está abierta antes de empezar. */
export function assertConvocationOpen(match: Doc): void {
  if (!isScheduleOpen(match)) {
    throw new HttpsError('failed-precondition', 'La convocatoria ya está cerrada.');
  }
}

/** Fecha, cancha y votaciones sólo se tocan antes de que el partido empiece. */
export function assertScheduleOpen(match: Doc, what = 'cambiar esto'): void {
  if (!isScheduleOpen(match)) {
    throw new HttpsError(
      'failed-precondition',
      `El partido ya empezó o terminó: no se puede ${what}.`,
    );
  }
}

/** Confirmar la fecha es la transición `planning → upcoming`: sólo desde `planning`. */
export function assertDatePlanning(match: Doc): void {
  if (match.status !== 'planning') {
    throw new HttpsError(
      'failed-precondition',
      'La fecha sólo se confirma en un partido que está en planificación.',
    );
  }
}

/**
 * Valida una fecha y hora que manda el cliente: formato (YYYY-MM-DD o el ISO de
 * Flutter, y HH:mm) y que no haya pasado. Devuelve el instante.
 */
export function assertFutureSchedule(date: unknown, time: unknown, now = Date.now()): Date {
  const when =
    typeof date === 'string' && typeof time === 'string' ? buildMatchDateTime(date, time) : null;
  if (!when) {
    throw new HttpsError('invalid-argument', 'Elegí una fecha y hora válidas.');
  }
  if (when.getTime() < now - 60_000) {
    throw new HttpsError('invalid-argument', 'El horario elegido ya pasó.');
  }
  return when;
}

/**
 * Se borra un partido que no empezó y no tuvo actividad. Uno en vivo, terminado
 * o evaluado tiene resultado, evaluaciones y a veces OVR ya repartido: no se
 * puede borrar. Los de una competición tampoco: romperían la llave o el fixture.
 */
export function assertDeletable(match: Doc): void {
  if (isCompetitionMatch(match)) {
    throw new HttpsError(
      'failed-precondition',
      'Un partido de una competición no se borra: se gestiona desde la competición.',
    );
  }
  const hasEvents = Array.isArray(match.events) && match.events.length > 0;
  // Un partido cancelado no se jugó: se puede borrar para limpiar la lista.
  if (match.status === 'cancelled') return;
  if (!isScheduleOpen(match) || hasEvents) {
    throw new HttpsError(
      'failed-precondition',
      'Un partido que ya empezó o terminó no se puede borrar.',
    );
  }
}

/**
 * Cancelar es la salida de un partido que no se va a jugar pero que ya tenía
 * gente anotada: queda el registro (a diferencia de borrarlo) y se avisa. Sólo
 * antes de que empiece; una competición se gestiona desde la competición.
 */
export function assertCancellable(match: Doc): void {
  if (isCompetitionMatch(match)) {
    throw new HttpsError(
      'failed-precondition',
      'Un partido de una competición no se cancela: se gestiona desde la competición.',
    );
  }
  if (!isScheduleOpen(match)) {
    throw new HttpsError(
      'failed-precondition',
      match.status === 'cancelled'
        ? 'El partido ya está cancelado.'
        : 'Un partido que ya empezó o terminó no se puede cancelar.',
    );
  }
}

/**
 * Cuando entra o sale alguien de un partido de plantel abierto y los equipos ya
 * estaban armados, esos equipos quedan desactualizados: `teamsGenerated: false`
 * lo marca (la app avisa al organizador y, si el cupo se completa, se rearman).
 * Antes el que entraba después de armados los equipos no figuraba en ninguno.
 */
export function staleTeamsPatch(match: Doc): Record<string, unknown> {
  const teams = Array.isArray(match.teams) ? match.teams : [];
  const hasTeams = teams.some((team: Doc) => Array.isArray(team?.players) && team.players.length > 0);
  return hasTeams ? { teamsGenerated: false } : {};
}

/** Votan fecha y cancha los jugadores del partido y quienes lo gestionan. */
export function canVote(match: Doc, uid: string): boolean {
  if (!uid) return false;
  if (isMatchManager(match, uid)) return true;
  return Array.isArray(match.playerUids) && match.playerUids.includes(uid);
}

/**
 * Hasta ahora cualquier usuario con sesión podía votar en cualquier partido,
 * también en uno privado de otro grupo, con sólo conocer su id.
 */
export function assertCanVote(match: Doc, uid: string): void {
  if (!canVote(match, uid)) {
    throw new HttpsError(
      'permission-denied',
      'Sólo votan los jugadores del partido y quienes lo organizan.',
    );
  }
  assertScheduleOpen(match, 'votar');
}
