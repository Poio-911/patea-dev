import { HttpsError } from 'firebase-functions/v2/https';

// Omitido conserva el valor; null explícito elimina el dato opcional.
export function optionalProfileFields(data: Record<string, unknown>, year = new Date().getFullYear()): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  if (data.preferredFoot !== undefined) {
    if (data.preferredFoot === null) updates.preferredFoot = null;
    else {
      const foot = String(data.preferredFoot).toLowerCase();
      if (!['derecho', 'izquierdo', 'ambidiestro'].includes(foot)) throw new HttpsError('invalid-argument', 'Pie hábil inválido.');
      updates.preferredFoot = foot;
    }
  }
  if (data.birthYear !== undefined) {
    if (data.birthYear === null || data.birthYear === '') updates.birthYear = null;
    else {
      const birth = Number(data.birthYear);
      if (!Number.isInteger(birth) || birth < 1950 || birth > year - 5) throw new HttpsError('invalid-argument', `El año de nacimiento debe estar entre 1950 y ${year - 5}.`);
      updates.birthYear = birth;
    }
  }
  return updates;
}
