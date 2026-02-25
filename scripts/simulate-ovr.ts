
const OVR_PROGRESSION = {
    BASELINE_RATING: 5,
    MAX_STEP: 1.5,
    MIN_OVR: 40,
    MAX_OVR: 99,
    MIN_ATTRIBUTE: 20,
    MAX_ATTRIBUTE: 99
};

const POSITION_WEIGHTS = {
    'DEL': { pac: 0.25, sho: 0.35, pas: 0.15, dric: 0.15, def: 0.05, phy: 0.05 },
    'MED': { pac: 0.15, sho: 0.15, pas: 0.30, dric: 0.20, def: 0.10, phy: 0.10 },
    'DEF': { pac: 0.15, sho: 0.05, pas: 0.15, dric: 0.05, def: 0.40, phy: 0.20 },
    'POR': { pac: 0.10, sho: 0.05, pas: 0.10, dric: 0.05, def: 0.50, phy: 0.20 },
};
const DEFAULT_WEIGHTS = { pac: 0.166, sho: 0.166, pas: 0.166, dric: 0.166, def: 0.166, phy: 0.166 };

function getMultiplier(val) {
    if (val >= 92) return 0.1;
    if (val >= 85) return 0.2;
    if (val >= 75) return 0.4;
    if (val >= 60) return 0.7;
    return 1.0;
}

function calculateOvrChange(currentOvr, avgRating) {
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

function calculateAttributeChangesFromPoints(currentAttrs, ovrChange, position) {
    if (ovrChange === 0) return { ...currentAttrs };
    const newAttributes = { ...currentAttrs };
    const attributes = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
    const weights = POSITION_WEIGHTS[position] || DEFAULT_WEIGHTS;
    const totalPointsToAdd = ovrChange * 6;
    let accumulatedError = 0;

    attributes.forEach((attr) => {
        const currentVal = newAttributes[attr];
        const targetShare = totalPointsToAdd * (weights[attr] || 1 / 6);
        let multiplier = getMultiplier(currentVal);

        const effectiveShare = targetShare > 0 ? targetShare * multiplier : targetShare;
        const pointWithDecimal = effectiveShare + accumulatedError;
        const pointRounded = Math.round(pointWithDecimal);
        accumulatedError = pointWithDecimal - pointRounded;

        newAttributes[attr] = Math.round(Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, currentVal + pointRounded)));
    });
    return newAttributes;
}

function calculateAttributeChangesFromTags(currentAttrs, tags = []) {
    const newAttributes = { ...currentAttrs };
    tags.forEach(tag => {
        if (!tag.effects) return;
        tag.effects.forEach(effect => {
            const key = effect.attribute;
            const currentVal = newAttributes[key];
            let multiplier = getMultiplier(currentVal);
            let newVal = currentVal + (effect.change * multiplier);
            newAttributes[key] = Math.round(Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, newVal)));
        });
    });
    return newAttributes;
}

function calculateAttributeChangesFromAI(currentAttrs, aiChanges = []) {
    const newAttributes = { ...currentAttrs };
    aiChanges.forEach(change => {
        const key = change.attribute;
        const currentVal = newAttributes[key];
        let multiplier = getMultiplier(currentVal);
        const newVal = currentVal + (change.change * multiplier);
        newAttributes[key] = Math.round(Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, newVal)));
    });
    return newAttributes;
}

function getOVR(attrs) {
    const sum = attrs.pac + attrs.sho + attrs.pas + attrs.dri + attrs.def + attrs.phy;
    return Math.round(sum / 6);
}

function simulate(label, player, rating, tags, aiChanges) {
    console.log(`--- Scenario: ${label} ---`);
    console.log(`Initial: OVR ${player.ovr} [PAC:${player.pac} SHO:${player.sho} PAS:${player.pas} DRI:${player.dri} DEF:${player.def} PHY:${player.phy}]`);

    let attrs = { ...player };

    // 1. Tags
    attrs = calculateAttributeChangesFromTags(attrs, tags);
    // 2. AI
    attrs = calculateAttributeChangesFromAI(attrs, aiChanges);
    // 3. Points
    const ovrChange = calculateOvrChange(getOVR(attrs), rating);
    attrs = calculateAttributeChangesFromPoints(attrs, ovrChange, player.position);

    const finalOvr = getOVR(attrs);
    console.log(`Final:   OVR ${finalOvr} [PAC:${attrs.pac} SHO:${attrs.sho} PAS:${attrs.pas} DRI:${attrs.dri} DEF:${attrs.def} PHY:${attrs.phy}]`);
    console.log(`Delta:   ${finalOvr - player.ovr} OVR\n`);
    return attrs;
}

const basePlayer = {
    ovr: 75,
    pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75,
    position: 'MED'
};

const elitePlayer = {
    ovr: 90,
    pac: 90, sho: 90, pas: 90, dri: 90, def: 90, phy: 90,
    position: 'DEL'
};

// Scenario 1: Only High Rating (9.0)
simulate("Only High Rating (9.0)", basePlayer, 9.0, [], []);

// Scenario 2: Only Positive Tags
simulate("Only Positive Tags (Pase Filtrado + Muro)", basePlayer, 5.0, [
    { effects: [{ attribute: 'pas', change: 1 }, { attribute: 'dri', change: 0.5 }] },
    { effects: [{ attribute: 'def', change: 1 }, { attribute: 'phy', change: 0.5 }] }
], []);

// Scenario 3: Only AI Boost (Shooting focus)
simulate("Only AI Boost (+2 Shooting)", basePlayer, 5.0, [], [{ attribute: 'sho', change: 2 }]);

// Scenario 4: All Mixed (Positive)
simulate("Mixed (Rating 8.5 + Tags + AI)", basePlayer, 8.5, [
    { effects: [{ attribute: 'pas', change: 0.5 }] }
], [{ attribute: 'sho', change: 1.5 }]);

// Scenario 5: Elite Player (Gains should be much smaller)
simulate("Elite Player (Rating 9.5)", elitePlayer, 10.0, [], []);

// Scenario 6: Mixed Contradictory (High Rating but Negative Tags)
simulate("High Rating (9.0) but Negative Tags (Tronco)", basePlayer, 9.0, [
    { effects: [{ attribute: 'dri', change: -2 }, { attribute: 'pas', change: -1 }] }
], []);
