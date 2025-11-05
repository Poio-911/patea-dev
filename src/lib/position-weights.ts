import type { AttributeKey } from '@/lib/types';

// Weight mapping by position: values between 0 and 1 representing tactical importance.
// Positions expected: DEL, MED, DEF, POR. Fallback uses equal weights.
export const positionAttributeWeights: Record<string, Record<AttributeKey, number>> = {
  DEL: { SHO: 1.0, PAC: 0.9, DRI: 0.85, PAS: 0.6, PHY: 0.5, DEF: 0.35 },
  MED: { PAS: 1.0, DRI: 0.85, PAC: 0.7, SHO: 0.65, DEF: 0.6, PHY: 0.55 },
  DEF: { DEF: 1.0, PHY: 0.8, PAS: 0.65, PAC: 0.6, DRI: 0.45, SHO: 0.4 },
  POR: { DEF: 0.9, PHY: 0.75, PAS: 0.6, PAC: 0.55, DRI: 0.4, SHO: 0.35 },
};

const fallbackWeights: Record<AttributeKey, number> = {
  PAC: 0.7,
  SHO: 0.7,
  PAS: 0.7,
  DRI: 0.7,
  DEF: 0.7,
  PHY: 0.7,
};

export function getWeightsForPosition(position: string): Record<AttributeKey, number> {
  return positionAttributeWeights[position as keyof typeof positionAttributeWeights] || fallbackWeights;
}

export function weightAttributes(values: Record<AttributeKey, number | undefined>, position: string) {
  const weights = getWeightsForPosition(position);
  return (Object.keys(values) as AttributeKey[]).map(key => {
    const raw = values[key];
    const weight = weights[key] ?? 0.5;
    const score = (raw ?? 0) * weight;
    return { key, raw, weight, score };
  }).sort((a, b) => b.score - a.score);
}
