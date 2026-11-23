/**
 * Costo del partido y enlace de transmisión: validación y normalización, sin
 * Firestore ni red (lo que escribe está en `callable/match-extras.ts`).
 */

export const COST_CURRENCIES = ['UYU', 'ARS', 'USD'] as const;
export type CostCurrency = (typeof COST_CURRENCIES)[number];

/** Tope por partido: evita typos que dejarían un monto absurdo a la vista de todos. */
export const MAX_COST = 1_000_000;

export interface MatchCost {
  total: number;
  currency: CostCurrency;
}

/**
 * Valida el costo que manda el organizador. Devuelve `null` cuando el total es
 * cero (sacar el costo) y lanza si algo no tiene sentido.
 */
export function normalizeCost(rawTotal: unknown, rawCurrency: unknown): MatchCost | null {
  const total = typeof rawTotal === 'number' ? rawTotal : Number(rawTotal);
  if (!Number.isFinite(total) || total < 0 || total > MAX_COST) {
    throw new Error('El costo tiene que ser un monto entre 0 y 1.000.000.');
  }
  const rounded = Math.round(total * 100) / 100;
  if (rounded === 0) return null;
  const currency = String(rawCurrency ?? 'UYU').toUpperCase();
  if (!(COST_CURRENCIES as readonly string[]).includes(currency)) {
    throw new Error('Moneda no válida.');
  }
  return { total: rounded, currency: currency as CostCurrency };
}

export type StreamProvider = 'youtube' | 'twitch' | 'kick';

export interface MatchStream {
  provider: StreamProvider;
  /** Video (YouTube) o canal (Twitch, Kick): mismo contrato que la web. */
  id: string;
  /** Dirección normalizada, la que abre la app. */
  url: string;
  active: true;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL = /^[A-Za-z0-9_]{3,30}$/;

/**
 * Entiende un enlace de YouTube, Twitch o Kick y lo reduce a lo que importa.
 * Se aceptan solo esos tres: un enlace libre dentro de una app con contenido
 * de usuarios sería una puerta a sitios engañosos.
 */
export function parseStreamLink(raw: unknown): MatchStream | null {
  if (typeof raw !== 'string') return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    const id = parts[0] ?? '';
    return YOUTUBE_ID.test(id) ? youtube(id) : null;
  }
  if (host === 'youtube.com') {
    const id = parts[0] === 'watch' ? (url.searchParams.get('v') ?? '') : ['live', 'embed', 'shorts'].includes(parts[0]) ? (parts[1] ?? '') : '';
    return YOUTUBE_ID.test(id) ? youtube(id) : null;
  }
  if (host === 'twitch.tv') {
    const id = (parts[0] ?? '').toLowerCase();
    return CHANNEL.test(id) ? { provider: 'twitch', id, url: `https://www.twitch.tv/${id}`, active: true } : null;
  }
  if (host === 'kick.com') {
    const id = (parts[0] ?? '').toLowerCase();
    return CHANNEL.test(id) ? { provider: 'kick', id, url: `https://kick.com/${id}`, active: true } : null;
  }
  return null;
}

function youtube(id: string): MatchStream {
  return { provider: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}`, active: true };
}

/** ¿Es alguien del plantel del partido? Incluye invitados (`guest_…`). */
export function isInRoster(playerUids: unknown, playerId: string): boolean {
  return Array.isArray(playerUids) && playerUids.includes(playerId);
}
