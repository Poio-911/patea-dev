/**
 * Avisos, sedes y patrocinadores de una competición: validación y armado de
 * destinatarios, sin Firestore ni red (lo que escribe está en
 * `callable/competition-extras.ts`).
 */

export type CompetitionCollection = 'leagues' | 'cups';

export function parseCollection(raw: unknown): CompetitionCollection | null {
  return raw === 'leagues' || raw === 'cups' ? raw : null;
}

/** Identificador de documento válido: sin barras y de largo razonable. */
export function safeId(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length > 0 && raw.length <= 150 && !raw.includes('/') ? raw : null;
}

const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

// ───────────────────────────── Avisos ─────────────────────────────

export type MessageAudience = 'all' | 'captains';

export interface CompetitionMessageInput {
  subject: string;
  body: string;
  audience: MessageAudience;
}

export const MESSAGE_LIMITS = { subject: 80, body: 500, perHour: 5 } as const;

/** Valida lo que escribe el organizador. Lanza con un mensaje para mostrarle. */
export function normalizeMessage(subject: unknown, body: unknown, audience: unknown): CompetitionMessageInput {
  const s = clean(subject, MESSAGE_LIMITS.subject);
  // El cuerpo conserva los saltos de línea; solo se limpian los espacios de más.
  const b =
    typeof body === 'string'
      ? body
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
          .slice(0, MESSAGE_LIMITS.body)
      : '';
  if (s.length < 3) throw new Error('El asunto necesita al menos 3 letras.');
  if (b.length < 3) throw new Error('Escribí el mensaje.');
  if (audience !== 'all' && audience !== 'captains') throw new Error('Elegí a quién le llega.');
  return { subject: s, body: b, audience };
}

export const canSendAnother = (sentLastHour: number): boolean => sentLastHour < MESSAGE_LIMITS.perHour;

/**
 * A quiénes les llega un aviso, a partir de los equipos que juegan: todos los
 * del plantel o solo quienes crearon cada equipo (los capitanes). Devuelve ids
 * candidatos; falta descartar los que no tienen cuenta (jugadores manuales).
 */
export function candidateRecipients(teams: Record<string, any>[], audience: MessageAudience): string[] {
  const out = new Set<string>();
  for (const t of teams) {
    for (const key of ['createdBy', 'ownerUid']) {
      if (typeof t?.[key] === 'string' && t[key]) out.add(t[key]);
    }
    if (audience === 'all') {
      for (const m of Array.isArray(t?.members) ? t.members : []) {
        const id = typeof m === 'string' ? m : m?.playerId;
        if (typeof id === 'string' && id && !id.includes('/')) out.add(id);
      }
    }
  }
  return [...out];
}

// ───────────────────────────── Sedes ─────────────────────────────

export interface VenueInput {
  name: string;
  address?: string;
  capacity?: number;
  costPerMatch?: number;
  notes?: string;
}

export const MAX_VENUES = 30;

const optionalNumber = (raw: unknown, max: number, label: string): number | undefined => {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(`${label} no es válido.`);
  return Math.round(n * 100) / 100;
};

export function normalizeVenue(raw: Record<string, any> | null | undefined): VenueInput {
  const name = clean(raw?.name, 60);
  if (name.length < 2) throw new Error('La sede necesita un nombre.');
  const capacity = optionalNumber(raw?.capacity, 100000, 'La capacidad');
  const costPerMatch = optionalNumber(raw?.costPerMatch, 1_000_000, 'El costo');
  const address = clean(raw?.address, 120);
  const notes = clean(raw?.notes, 200);
  return {
    name,
    ...(address ? { address } : {}),
    ...(capacity !== undefined ? { capacity: Math.round(capacity) } : {}),
    ...(costPerMatch !== undefined ? { costPerMatch } : {}),
    ...(notes ? { notes } : {}),
  };
}

// ───────────────────────────── Patrocinadores ─────────────────────────────

export interface SponsorInput {
  name: string;
  websiteUrl?: string;
}

export const MAX_SPONSORS = 12;

/** Solo enlaces https sin usuario ni contraseña: es un link que otros van a tocar. */
export function normalizeWebsite(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return undefined;
  let url: URL;
  try {
    url = new URL(String(raw).trim());
  } catch {
    throw new Error('El enlace no es válido.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) {
    throw new Error('El enlace tiene que ser https://…');
  }
  const text = url.toString();
  if (text.length > 200) throw new Error('El enlace es demasiado largo.');
  return text;
}

export function normalizeSponsor(raw: Record<string, any> | null | undefined): SponsorInput {
  const name = clean(raw?.name, 50);
  if (name.length < 2) throw new Error('El patrocinador necesita un nombre.');
  const websiteUrl = normalizeWebsite(raw?.websiteUrl);
  return { name, ...(websiteUrl ? { websiteUrl } : {}) };
}
