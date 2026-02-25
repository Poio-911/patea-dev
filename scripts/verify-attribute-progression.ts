
import { getAdminDb } from '../src/firebase/admin-init';
import { Player, Evaluation, PerformanceTag } from '../src/lib/types';

// We import the logic from server-actions or replicate it for pure testing
// Since they are defined as constants in the file and not exported for individual testing easily,
// I will replicate the core logic here to verify the behavior of the updated Math functions.

const OVR_PROGRESSION = {
    BASELINE_RATING: 5,
    MAX_STEP: 1.5,
    MIN_OVR: 40,
    MAX_OVR: 99,
    MIN_ATTRIBUTE: 20,
    MAX_ATTRIBUTE: 99
};

const POSITION_WEIGHTS = {
    'DEL': { pac: 0.25, sho: 0.35, pas: 0.15, dri: 0.15, def: 0.05, phy: 0.05 },
    'MED': { pac: 0.15, sho: 0.15, pas: 0.30, dri: 0.20, def: 0.10, phy: 0.10 },
    'DEF': { pac: 0.15, sho: 0.05, pas: 0.15, dri: 0.05, def: 0.40, phy: 0.20 },
    'POR': { pac: 0.10, sho: 0.05, pas: 0.10, dri: 0.05, def: 0.50, phy: 0.20 },
};
const DEFAULT_WEIGHTS = { pac: 0.166, sho: 0.166, pas: 0.166, dri: 0.166, def: 0.166, phy: 0.166 };

function getMultiplier(val: number) {
    if (val >= 92) return 0.1;
    if (val >= 85) return 0.2;
    if (val >= 75) return 0.4;
    if (val >= 60) return 0.7;
    return 1.0;
}

// THE UPDATED FUNCTIONS (REPLICATED FOR VERIFICATION)
function calculateAttributeChanges(currentAttrs: any, tags: any[] = []) {
    const newAttributes = { ...currentAttrs };
    tags.forEach(tag => {
        if (!tag.effects) return;
        tag.effects.forEach((effect: any) => {
            const key = effect.attribute;
            const currentVal = newAttributes[key];
            let multiplier = getMultiplier(currentVal);
            let rawChange = effect.change * multiplier;
            let integerChange = rawChange > 0 ? Math.ceil(rawChange) : Math.floor(rawChange);
            newAttributes[key] = Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, currentVal + integerChange));
        });
    });
    return newAttributes;
}

function calculateAttributeChangesFromAI(currentAttrs: any, aiChanges: any[] = []) {
    const newAttributes = { ...currentAttrs };
    aiChanges.forEach(change => {
        const key = change.attribute;
        const currentVal = newAttributes[key];
        let multiplier = getMultiplier(currentVal);
        let rawChange = change.change * multiplier;
        let integerChange = rawChange > 0 ? Math.ceil(rawChange) : Math.floor(rawChange);
        newAttributes[key] = Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, currentVal + integerChange));
    });
    return newAttributes;
}

function calculateOvrChange(currentOvr: number, avgRating: number): number {
    if (avgRating === OVR_PROGRESSION.BASELINE_RATING) return 0;
    const ratingDelta = avgRating - OVR_PROGRESSION.BASELINE_RATING;
    let scale = 0.30;
    if (currentOvr < 50) scale = 0.50;
    else if (currentOvr < 60) scale = 0.40;
    else if (currentOvr < 70) scale = 0.30;
    else if (currentOvr < 80) scale = 0.20;
    else if (currentOvr < 90) scale = 0.10;
    else scale = 0.05;
    let rawDelta = ratingDelta * scale;
    return Math.max(-OVR_PROGRESSION.MAX_STEP, Math.min(OVR_PROGRESSION.MAX_STEP, rawDelta));
}

function calculateAttributeChangesFromPoints(currentAttrs: any, ovrChange: number, position: string) {
    if (ovrChange === 0) return { ...currentAttrs };
    const newAttributes = { ...currentAttrs };
    const attributes = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
    const weights: any = (POSITION_WEIGHTS as any)[position] || DEFAULT_WEIGHTS;
    const totalPointsToAdd = ovrChange * 6;
    let accumulatedError = 0;

    attributes.forEach((attr) => {
        const currentVal = newAttributes[attr];
        const targetShare = totalPointsToAdd * weights[attr];
        let multiplier = getMultiplier(currentVal);
        const effectiveShare = targetShare > 0 ? targetShare * multiplier : targetShare;
        const pointWithDecimal = effectiveShare + accumulatedError;
        const pointRounded = effectiveShare > 0 ? Math.ceil(pointWithDecimal) : Math.floor(pointWithDecimal);
        accumulatedError = pointWithDecimal - pointRounded;
        newAttributes[attr] = Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, currentVal + pointRounded));
    });
    return newAttributes;
}

function getOVR(attrs: any) {
    const sum = attrs.pac + attrs.sho + attrs.pas + attrs.dri + attrs.def + attrs.phy;
    return Math.round(sum / 6);
}

// SIMULATION TEST
async function runVerification() {
    console.log("=== VERIFICACIÓN DE PROGRESIÓN (ENTEROS Y CERTEZA) ===\n");

    const player = {
        ovr: 78,
        pac: 80, sho: 75, pas: 82, dri: 76, def: 72, phy: 83,
        position: 'DEL'
    };

    console.log("Estado Inicial:", player);

    // 1. Simular Tags (Ej: +0.5 en PAS, +0.3 en DRI)
    const tags = [
        { effects: [{ attribute: 'pas', change: 0.5 }, { attribute: 'dri', change: 0.3 }] }
    ];
    let afterTags = calculateAttributeChanges(player, tags);
    console.log("\nDespués de Tags (con Multiplicador):");
    console.log("- PAS:", player.pas, "->", afterTags.pas, `(Delta: ${afterTags.pas - player.pas})`);
    console.log("- DRI:", player.dri, "->", afterTags.dri, `(Delta: ${afterTags.dri - player.dri})`);

    // 2. Simular IA (Ej: +1.2 en SHO)
    const aiChanges = [{ attribute: 'sho', change: 1.2 }];
    let afterAI = calculateAttributeChangesFromAI(afterTags, aiChanges);
    console.log("\nDespués de IA (con Multiplicador):");
    console.log("- SHO:", afterTags.sho, "->", afterAI.sho, `(Delta: ${afterAI.sho - afterTags.sho})`);

    // 3. Simular Puntos (Rating 9.0)
    const ovrDelta = calculateOvrChange(getOVR(afterAI), 9.0);
    let afterPoints = calculateAttributeChangesFromPoints(afterAI, ovrDelta, 'DEL');
    console.log(`\nDespués de Puntos (Rating 9.0, Delta OVR esperado: ${ovrDelta.toFixed(2)}):`);

    // Check deltas
    const finalAttributes = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
    const totalDeltas: any = {};
    finalAttributes.forEach(attr => {
        const d = (afterPoints as any)[attr] - (player as any)[attr];
        totalDeltas[attr] = d;
        console.log(`- ${attr.toUpperCase()}: ${(player as any)[attr]} -> ${(afterPoints as any)[attr]} (Suma total Match: ${d})`);
    });

    const finalOvr = getOVR(afterPoints);
    console.log(`\nOVR FINAL: ${finalOvr} (Cambio: ${finalOvr - player.ovr})`);

    // VERIFY: No floats
    const hasFloats = Object.values(afterPoints).some(v => typeof v === 'number' && v % 1 !== 0);
    console.log("\n¿Hay decimales en los atributos?:", hasFloats ? "Sí ❌" : "No ✅");

    // VERIFY: Certera (Deltas for History)
    console.log("\nEstructura para historial (attributeChanges):");
    console.log(JSON.stringify(totalDeltas, null, 2));
}

runVerification();
