/**
 * Motor unificado de progresión de OVR y atributos para Pateá.
 *
 * Todos los métodos de evaluación (Nota 1–10, Etiquetas, Reseña escrita y Nota
 * de voz) se traducen a un mismo vector normalizado de 6 atributos en "unidades
 * de nota" (rango neto [-4.0, +5.0], magnitud L1 <= 5.0).
 *
 * Al cerrar un partido:
 *   1. Cada evaluación de un compañero aporta exactamente 1/N (se promedian, no
 *      se apilan ni suman en cascada entre métodos).
 *   2. Los goles y asistencias autodeclarados aportan un micro-bono uniforme
 *      (hasta +1.0 unidad de nota) independientemente del método usado.
 *   3. Se aplica UNA sola curva anti-inflación por tramo de OVR y un redondeo
 *      determinista de mayor resto (Hamilton) para evitar el sesgo de Math.ceil.
 *
 * Este archivo debe mantenerse sincronizado 1:1 con
 * `patea_mobile/lib/core/utils/ovr_calculator.dart`.
 */

export type Attr = 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy';
export const ATTRS: readonly Attr[] = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];

export type AttrVector = Record<Attr, number>;

export const OVR_PROGRESSION = {
  BASELINE_RATING: 5,
  MAX_STEP: 1.5,
  MIN_OVR: 40,
  MAX_OVR: 99,
  MIN_ATTRIBUTE: 20,
  MAX_ATTRIBUTE: 99,
  MAX_EVAL_POSITIVE: 5.0,
  MAX_EVAL_NEGATIVE: 4.0,
  MAX_EVAL_L1: 5.0,
  MAX_ATTR_DELTA: 4,
  AI_UNIT_SCALE: 0.6,
} as const;

export const POSITION_WEIGHTS: Record<string, AttrVector> = {
  DEL: { pac: 0.25, sho: 0.35, pas: 0.15, dri: 0.15, def: 0.05, phy: 0.05 },
  MED: { pac: 0.15, sho: 0.15, pas: 0.3, dri: 0.2, def: 0.1, phy: 0.1 },
  DEF: { pac: 0.15, sho: 0.05, pas: 0.15, dri: 0.05, def: 0.4, phy: 0.2 },
  POR: { pac: 0.1, sho: 0.05, pas: 0.1, dri: 0.05, def: 0.5, phy: 0.2 },
};

export const DEFAULT_WEIGHTS: AttrVector = {
  pac: 1 / 6,
  sho: 1 / 6,
  pas: 1 / 6,
  dri: 1 / 6,
  def: 1 / 6,
  phy: 1 / 6,
};

export type TagLike = {
  effects?: Array<{ attribute: string; change: number }>;
};

export type AiChangeLike = {
  attribute: string;
  change: number;
};

export type PeerEvaluationInput = {
  rating?: number | null;
  performanceTags?: TagLike[] | null;
  aiAttributeChanges?: AiChangeLike[] | null;
};

export type ProgressionResult = {
  updatedAttributes: AttrVector;
  attributeDeltas: AttrVector;
  oldOvr: number;
  newOvr: number;
  ovrDelta: number;
  equivalentRating: number;
};

const EPS = 1e-9;

export function zeroVector(): AttrVector {
  return { pac: 0, sho: 0, pas: 0, dri: 0, def: 0, phy: 0 };
}

export function roundHalfAwayFromZero(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) < EPS) return 0;
  return value > 0
    ? Math.floor(value + 0.5 + EPS)
    : -Math.floor(-value + 0.5 + EPS);
}

export function clampAttr(value: number): number {
  return Math.max(
    OVR_PROGRESSION.MIN_ATTRIBUTE,
    Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, value),
  );
}

export function computeOvr(attrs: AttrVector): number {
  const sum = ATTRS.reduce((acc, attr) => acc + attrs[attr], 0);
  const avg = Math.round(sum / ATTRS.length);
  return Math.max(OVR_PROGRESSION.MIN_OVR, Math.min(OVR_PROGRESSION.MAX_OVR, avg));
}

export function ovrTierScale(currentOvr: number): number {
  if (currentOvr < 50) return 0.5;
  if (currentOvr < 60) return 0.4;
  if (currentOvr < 70) return 0.3;
  if (currentOvr < 80) return 0.2;
  if (currentOvr < 90) return 0.1;
  return 0.05;
}

export function calculateOvrChange(currentOvr: number, avgRating: number): number {
  if (avgRating === OVR_PROGRESSION.BASELINE_RATING) return 0;
  const ratingDelta = avgRating - OVR_PROGRESSION.BASELINE_RATING;
  const rawDelta = ratingDelta * ovrTierScale(currentOvr);
  return Math.max(
    -OVR_PROGRESSION.MAX_STEP,
    Math.min(OVR_PROGRESSION.MAX_STEP, rawDelta),
  );
}

/**
 * Normaliza un vector de evaluación individual para que respete exactamente el
 * mismo techo que una Nota 1–10:
 *   - Magnitud total L1 <= 5.0 (evita inflación por múltiples etiquetas/ítems)
 *   - Suma neta dentro de [-4.0, +5.0] (1/10 = -4.0, 5/10 = 0.0, 10/10 = +5.0)
 */
export function normalizeEvalVector(raw: AttrVector): AttrVector {
  const vec: AttrVector = { ...raw };
  const l1 = ATTRS.reduce((sum, attr) => sum + Math.abs(vec[attr]), 0);
  if (l1 > OVR_PROGRESSION.MAX_EVAL_L1) {
    const factor = OVR_PROGRESSION.MAX_EVAL_L1 / l1;
    for (const attr of ATTRS) {
      vec[attr] *= factor;
    }
  }

  const net = ATTRS.reduce((sum, attr) => sum + vec[attr], 0);
  if (net < -OVR_PROGRESSION.MAX_EVAL_NEGATIVE) {
    const posSum = ATTRS.reduce((sum, attr) => sum + (vec[attr] > 0 ? vec[attr] : 0), 0);
    const negSum = ATTRS.reduce((sum, attr) => sum + (vec[attr] < 0 ? -vec[attr] : 0), 0);
    if (negSum > EPS) {
      const targetNeg = posSum + OVR_PROGRESSION.MAX_EVAL_NEGATIVE;
      const factor = targetNeg / negSum;
      for (const attr of ATTRS) {
        if (vec[attr] < 0) vec[attr] *= factor;
      }
    }
  } else if (net > OVR_PROGRESSION.MAX_EVAL_POSITIVE) {
    const posSum = ATTRS.reduce((sum, attr) => sum + (vec[attr] > 0 ? vec[attr] : 0), 0);
    const negSum = ATTRS.reduce((sum, attr) => sum + (vec[attr] < 0 ? -vec[attr] : 0), 0);
    if (posSum > EPS) {
      const targetPos = negSum + OVR_PROGRESSION.MAX_EVAL_POSITIVE;
      const factor = targetPos / posSum;
      for (const attr of ATTRS) {
        if (vec[attr] > 0) vec[attr] *= factor;
      }
    }
  }

  return vec;
}

export function vectorFromPoints(rating: number, position: string): AttrVector {
  if (!Number.isFinite(rating)) return zeroVector();
  const clamped = Math.max(1, Math.min(10, rating));
  const ratingDelta = clamped - OVR_PROGRESSION.BASELINE_RATING;
  if (Math.abs(ratingDelta) < EPS) return zeroVector();
  const weights = POSITION_WEIGHTS[(position || '').toUpperCase()] || DEFAULT_WEIGHTS;
  const vec = zeroVector();
  for (const attr of ATTRS) {
    vec[attr] = ratingDelta * weights[attr];
  }
  return normalizeEvalVector(vec);
}

/**
 * Cada etiqueta equivale a 1.0 unidad de nota repartida proporcionalmente en
 * sus atributos. Así:
 *   - 3 etiquetas positivas = +3.0 (idéntico a Nota 8/10)
 *   - 4 etiquetas positivas = +4.0 (idéntico a Nota 9/10)
 *   - 5 etiquetas positivas = +5.0 (idéntico a Nota 10/10)
 *   - 2 pos + 2 neg         =  0.0 neto (OVR neutro, mueve atributos opuestos)
 *   - 4–5 etiquetas neg     = -4.0 (idéntico a Nota 1/10)
 */
export function vectorFromTags(tags: TagLike[] | null | undefined): AttrVector {
  const vec = zeroVector();
  for (const tag of tags || []) {
    const effects = (tag?.effects || []).filter(
      (e) => ATTRS.includes(e.attribute as Attr) && Number.isFinite(e.change) && e.change !== 0,
    );
    const magnitude = effects.reduce((sum, e) => sum + Math.abs(e.change), 0);
    if (magnitude <= EPS) continue;
    for (const effect of effects) {
      const attr = effect.attribute as Attr;
      vec[attr] += effect.change / magnitude;
    }
  }
  return normalizeEvalVector(vec);
}

/**
 * Traduce los cambios de atributos devueltos por IA (reseña escrita o nota de
 * voz, 1–4 atributos en [-3..+3]) al mismo presupuesto de Nota y Etiquetas.
 */
export function vectorFromAI(aiChanges: AiChangeLike[] | null | undefined): AttrVector {
  const vec = zeroVector();
  for (const item of aiChanges || []) {
    const attr = String(item?.attribute || '').toLowerCase() as Attr;
    if (!ATTRS.includes(attr)) continue;
    const change = Number(item?.change);
    if (!Number.isFinite(change) || change === 0) continue;
    const clamped = Math.max(-3, Math.min(3, change));
    vec[attr] += clamped * OVR_PROGRESSION.AI_UNIT_SCALE;
  }
  return normalizeEvalVector(vec);
}

export function vectorForPeerEvaluation(
  ev: PeerEvaluationInput,
  position: string,
): AttrVector | null {
  if (typeof ev.rating === 'number' && Number.isFinite(ev.rating)) {
    return vectorFromPoints(ev.rating, position);
  }
  if (Array.isArray(ev.performanceTags) && ev.performanceTags.length > 0) {
    return vectorFromTags(ev.performanceTags);
  }
  if (Array.isArray(ev.aiAttributeChanges) && ev.aiAttributeChanges.length > 0) {
    return vectorFromAI(ev.aiAttributeChanges);
  }
  return null;
}

/**
 * Micro-bono uniforme por goles y asistencias autodeclarados.
 * Aplica igual sin importar qué método usaron los compañeros (tope +1.0 unidad
 * de nota para no eclipsar las evaluaciones del grupo).
 */
export function selfReportMicroBonusVector(goals: number, assists: number): AttrVector {
  const g = Number.isFinite(goals) ? Math.max(0, Math.floor(goals)) : 0;
  const a = Number.isFinite(assists) ? Math.max(0, Math.floor(assists)) : 0;
  const total = g + a;
  if (total <= 0) return zeroVector();

  const bonusUnits = total === 1 ? 0.4 : total === 2 ? 0.7 : 1.0;
  const goalShare = bonusUnits * (g / total);
  const assistShare = bonusUnits * (a / total);

  return {
    pac: goalShare * 0.3,
    sho: goalShare * 0.7,
    pas: assistShare * 0.7,
    dri: assistShare * 0.3,
    def: 0,
    phy: 0,
  };
}

export function equivalentRatingFromVector(vec: AttrVector): number {
  const net = ATTRS.reduce((sum, attr) => sum + vec[attr], 0);
  const raw = OVR_PROGRESSION.BASELINE_RATING + net;
  return Math.max(1, Math.min(10, Math.round(raw * 10) / 10));
}

function allocateHamilton(magnitudes: Array<{ attr: Attr; value: number }>): Record<Attr, number> {
  const result = zeroVector();
  const total = magnitudes.reduce((sum, item) => sum + item.value, 0);
  const budget = roundHalfAwayFromZero(total);
  if (budget <= 0) return result;

  let assigned = 0;
  const remainders: Array<{ attr: Attr; rem: number; mag: number; order: number }> = [];
  for (const item of magnitudes) {
    const base = Math.floor(item.value + EPS);
    result[item.attr] = base;
    assigned += base;
    remainders.push({
      attr: item.attr,
      rem: Math.max(0, item.value - base),
      mag: item.value,
      order: ATTRS.indexOf(item.attr),
    });
  }

  let left = budget - assigned;
  if (left > 0) {
    remainders.sort((a, b) => {
      if (Math.abs(b.rem - a.rem) > EPS) return b.rem - a.rem;
      if (Math.abs(b.mag - a.mag) > EPS) return b.mag - a.mag;
      return a.order - b.order;
    });
    for (let i = 0; i < left && i < remainders.length; i++) {
      result[remainders[i].attr] += 1;
    }
  }
  return result;
}

export function applyRatingVector(
  currentAttrs: AttrVector,
  currentOvr: number,
  totalVector: AttrVector,
): Omit<ProgressionResult, 'equivalentRating'> {
  const scale = ovrTierScale(currentOvr);
  const ovrVec = zeroVector();
  for (const attr of ATTRS) {
    ovrVec[attr] = totalVector[attr] * scale;
  }

  const l1Ovr = ATTRS.reduce((sum, attr) => sum + Math.abs(ovrVec[attr]), 0);
  if (l1Ovr > OVR_PROGRESSION.MAX_STEP) {
    const factor = OVR_PROGRESSION.MAX_STEP / l1Ovr;
    for (const attr of ATTRS) {
      ovrVec[attr] *= factor;
    }
  }

  const posItems: Array<{ attr: Attr; value: number }> = [];
  const negItems: Array<{ attr: Attr; value: number }> = [];
  for (const attr of ATTRS) {
    const targetPts = ovrVec[attr] * ATTRS.length;
    if (targetPts > EPS) posItems.push({ attr, value: targetPts });
    else if (targetPts < -EPS) negItems.push({ attr, value: -targetPts });
  }

  const posInts = allocateHamilton(posItems);
  const negInts = allocateHamilton(negItems);

  const updatedAttributes = { ...currentAttrs };
  const attributeDeltas = zeroVector();
  for (const attr of ATTRS) {
    const rawDelta = posInts[attr] - negInts[attr];
    const cappedDelta = Math.max(
      -OVR_PROGRESSION.MAX_ATTR_DELTA,
      Math.min(OVR_PROGRESSION.MAX_ATTR_DELTA, rawDelta),
    );
    const nextVal = clampAttr(currentAttrs[attr] + cappedDelta);
    updatedAttributes[attr] = nextVal;
    attributeDeltas[attr] = nextVal - currentAttrs[attr];
  }

  const baseAvgOvr = Math.round(
    ATTRS.reduce((acc, attr) => acc + currentAttrs[attr], 0) / ATTRS.length,
  );
  const nextAvgOvr = Math.round(
    ATTRS.reduce((acc, attr) => acc + updatedAttributes[attr], 0) / ATTRS.length,
  );
  const newOvr = Math.max(
    OVR_PROGRESSION.MIN_OVR,
    Math.min(OVR_PROGRESSION.MAX_OVR, currentOvr + (nextAvgOvr - baseAvgOvr)),
  );
  return {
    updatedAttributes,
    attributeDeltas,
    oldOvr: currentOvr,
    newOvr,
    ovrDelta: newOvr - currentOvr,
  };
}

export function computeMatchProgression(input: {
  currentAttrs: AttrVector;
  currentOvr: number;
  position: string;
  peerEvaluations: PeerEvaluationInput[];
  goals?: number;
  assists?: number;
}): ProgressionResult {
  const vectors = (input.peerEvaluations || [])
    .map((ev) => vectorForPeerEvaluation(ev, input.position))
    .filter((v): v is AttrVector => v !== null);

  const avgPeerVector = zeroVector();
  if (vectors.length > 0) {
    for (const vec of vectors) {
      for (const attr of ATTRS) {
        avgPeerVector[attr] += vec[attr];
      }
    }
    for (const attr of ATTRS) {
      avgPeerVector[attr] /= vectors.length;
    }
  }

  const bonusVector = selfReportMicroBonusVector(input.goals ?? 0, input.assists ?? 0);
  const totalVector = zeroVector();
  for (const attr of ATTRS) {
    totalVector[attr] = avgPeerVector[attr] + bonusVector[attr];
  }

  const applied = applyRatingVector(input.currentAttrs, input.currentOvr, totalVector);
  const equivalentRating = equivalentRatingFromVector(avgPeerVector);

  return {
    ...applied,
    equivalentRating,
  };
}
