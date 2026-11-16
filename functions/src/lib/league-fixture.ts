export interface LeaguePair { home: string; away: string; round: number; }

export function buildLeaguePairs(ids: string[], returnLeg: boolean): LeaguePair[] {
  if (ids.length < 2 || ids.length > 16 || new Set(ids).size !== ids.length) {
    throw new Error('Elegí entre 2 y 16 equipos distintos.');
  }
  const rotation: Array<string | null> = [...ids];
  if (rotation.length % 2) rotation.push(null);
  const rounds = rotation.length - 1;
  const first: LeaguePair[] = [];
  for (let round = 1; round <= rounds; round++) {
    for (let i = 0; i < rotation.length / 2; i++) {
      const a = rotation[i], b = rotation[rotation.length - 1 - i];
      if (a && b) first.push({ home: round % 2 ? a : b, away: round % 2 ? b : a, round });
    }
    rotation.splice(1, 0, rotation.pop()!);
  }
  return returnLeg ? [...first, ...first.map(p => ({home: p.away, away: p.home, round: p.round + rounds}))] : first;
}
