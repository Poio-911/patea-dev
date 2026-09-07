export type AttributeKey = 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy';

export const POSITION_WEIGHTS: Record<string, Record<AttributeKey, number>> = {
    'DEL': { pac: 0.25, sho: 0.35, pas: 0.15, dri: 0.15, def: 0.05, phy: 0.05 },
    'MED': { pac: 0.15, sho: 0.15, pas: 0.30, dri: 0.20, def: 0.10, phy: 0.10 },
    'DEF': { pac: 0.15, sho: 0.05, pas: 0.15, dri: 0.05, def: 0.40, phy: 0.20 },
    'POR': { pac: 0.10, sho: 0.05, pas: 0.10, dri: 0.05, def: 0.50, phy: 0.20 },
};

export const DEFAULT_WEIGHTS: Record<AttributeKey, number> = {
    pac: 0.166,
    sho: 0.166,
    pas: 0.166,
    dri: 0.166,
    def: 0.166,
    phy: 0.166,
};

/**
 * Computes the overall rating (OVR) of a player based on their position weights.
 * This ensures that specialized roles (e.g., Goalkeepers, Strikers, Defenders)
 * are accurately reflected without their OVR being unfairly dragged down by
 * non-essential secondary attributes.
 */
export function calculatePositionOvr(
    attrs: { pac?: number; sho?: number; pas?: number; dri?: number; def?: number; phy?: number },
    position: string = 'MED'
): number {
    const weights = POSITION_WEIGHTS[position] || DEFAULT_WEIGHTS;
    const weightedSum =
        (attrs.pac ?? 50) * weights.pac +
        (attrs.sho ?? 50) * weights.sho +
        (attrs.pas ?? 50) * weights.pas +
        (attrs.dri ?? 50) * weights.dri +
        (attrs.def ?? 50) * weights.def +
        (attrs.phy ?? 50) * weights.phy;
    return Math.round(weightedSum);
}
