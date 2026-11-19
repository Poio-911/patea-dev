/**
 * Búsqueda de equipos por nombre.
 *
 * Firestore no busca por subcadena, y traer todos los equipos para filtrar en
 * el cliente (lo que hace la web en `find-opponent`) no escala y filtra
 * información que no hace falta. Cada equipo guarda `searchTokens`: todos los
 * prefijos de cada palabra de su nombre, ya normalizados. Con eso una consulta
 * `array-contains` por el primer pedazo que escribe la persona encuentra
 * "Los Galácticos" tanto con "gal" como con "galac" o "los".
 */

/** Mínimo de caracteres de la consulta; con menos no se busca ni se lista nada. */
export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 40;
const MIN_TOKEN = 2;
const MAX_TOKEN = 20;
const MAX_WORDS = 8;

/** Minúsculas, sin tildes y sólo letras y números separados por espacios. */
export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

/** Palabras normalizadas de un texto, sin repetir y con un tope razonable. */
export function searchWords(value: unknown): string[] {
  return [...new Set(normalizeSearchText(value).split(' ').filter(Boolean))].slice(0, MAX_WORDS);
}

/** Todos los prefijos (de 2 a 20 letras) de cada palabra del nombre. */
export function buildTeamSearchTokens(name: unknown): string[] {
  const tokens = new Set<string>();
  for (const word of searchWords(name)) {
    const max = Math.min(word.length, MAX_TOKEN);
    for (let length = MIN_TOKEN; length <= max; length += 1) {
      tokens.add(word.slice(0, length));
    }
    // Palabras de una sola letra ("A", "7") no se pueden buscar solas, pero
    // sí por el prefijo de otra; nada que agregar.
  }
  return [...tokens];
}

export interface ParsedQuery {
  /** Palabras de la consulta, en orden. */
  words: string[];
  /** La palabra con la que se consulta el índice (la más larga: filtra mejor). */
  anchor: string;
}

/**
 * Interpreta lo que escribió la persona. Devuelve `null` si es demasiado corto
 * para buscar: la pantalla no debe listar equipos hasta que haya algo escrito.
 */
export function parseTeamQuery(raw: unknown): ParsedQuery | null {
  const text = String(raw ?? '').slice(0, MAX_QUERY_LENGTH);
  const words = searchWords(text).filter((word) => word.length >= 1);
  const usable = words.filter((word) => word.length >= MIN_TOKEN);
  if (usable.length === 0) return null;
  // La más larga filtra mejor el índice; a igualdad, la última, que es la que
  // la persona está escribiendo ("los gal" -> "gal", no "los").
  const anchor = [...usable]
    .sort((a, b) => b.length - a.length || usable.lastIndexOf(b) - usable.lastIndexOf(a))[0]
    .slice(0, MAX_TOKEN);
  return { words, anchor };
}

/** Todas las palabras de la consulta tienen que ser prefijo de alguna del nombre. */
export function matchesTeamQuery(name: unknown, query: ParsedQuery): boolean {
  const nameWords = searchWords(name);
  return query.words.every((queryWord) => nameWords.some((nameWord) => nameWord.startsWith(queryWord)));
}

/**
 * Orden de los resultados: primero los que empiezan con lo escrito, después
 * los que lo tienen en otra palabra, y a igualdad el nombre más corto.
 */
export function rankTeamMatch(name: unknown, query: ParsedQuery): number {
  const normalized = normalizeSearchText(name);
  const typed = query.words.join(' ');
  if (normalized === typed) return 0;
  if (normalized.startsWith(typed)) return 1;
  if (query.words.every((word, i) => searchWords(name)[i]?.startsWith(word))) return 2;
  return 3;
}
