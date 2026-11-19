import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { buildTeamSearchTokens, normalizeSearchText } from '../lib/team-search';

/**
 * Mantiene `nameLower` y `searchTokens` de cada equipo, que es lo que usa el
 * buscador de rivales (`searchTeams`).
 *
 * Los equipos se escriben desde dos lados —las Cloud Functions de la app y las
 * server actions de la web— y sólo uno de ellos sabía de los tokens. Con el
 * trigger no importa quién cambie el nombre: el índice se actualiza solo.
 *
 * Es idempotente: si ya está al día no escribe, así que no se dispara a sí
 * mismo en bucle.
 */
export const onTeamWrite = onDocumentWritten(
  { document: 'teams/{teamId}', region: 'us-central1' },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const data = after.data() ?? {};

    const nameLower = normalizeSearchText(data.name);
    const tokens = buildTeamSearchTokens(data.name);

    const current: unknown = data.searchTokens;
    const upToDate =
      data.nameLower === nameLower &&
      Array.isArray(current) &&
      current.length === tokens.length &&
      tokens.every((token) => current.includes(token));
    if (upToDate) return;

    await after.ref.update({ nameLower, searchTokens: tokens });
  },
);
