
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

const db = getFirestore();

// --- LOGIC COPIED & ADAPTED FROM page.tsx ---

const OVR_PROGRESSION = {
    BASELINE_RATING: 5,
    SCALE: 0.6,
    MAX_STEP: 2,
    DECAY_START: 70,
    SOFT_CAP: 95,
    HARD_CAP: 99,
    MIN_OVR: 40,
    MIN_ATTRIBUTE: 20,
    MAX_ATTRIBUTE: 90
};

const calculateOvrChange = (currentOvr: number, avgRating: number): number => {
    if (avgRating === OVR_PROGRESSION.BASELINE_RATING) return 0;
    const ratingDelta = avgRating - OVR_PROGRESSION.BASELINE_RATING;
    let rawDelta = ratingDelta * OVR_PROGRESSION.SCALE;
    if (currentOvr >= OVR_PROGRESSION.DECAY_START) {
        if (currentOvr < OVR_PROGRESSION.SOFT_CAP) {
            const t = (currentOvr - OVR_PROGRESSION.DECAY_START) / (OVR_PROGRESSION.SOFT_CAP - OVR_PROGRESSION.DECAY_START);
            rawDelta *= 1 - (0.6 * t);
        } else {
            const t = (currentOvr - OVR_PROGRESSION.SOFT_CAP) / (OVR_PROGRESSION.HARD_CAP - OVR_PROGRESSION.SOFT_CAP);
            rawDelta *= 0.25 * (1 - t);
        }
    }
    // NO ROUNDING HERE (Float precision)
    return Math.max(-OVR_PROGRESSION.MAX_STEP, Math.min(OVR_PROGRESSION.MAX_STEP, rawDelta));
};

const POSITION_WEIGHTS: Record<string, any> = {
    'DEL': { pac: 0.25, sho: 0.35, pas: 0.15, dri: 0.15, def: 0.05, phy: 0.05 },
    'MED': { pac: 0.15, sho: 0.15, pas: 0.30, dri: 0.20, def: 0.10, phy: 0.10 },
    'DEF': { pac: 0.15, sho: 0.05, pas: 0.15, dri: 0.05, def: 0.40, phy: 0.20 },
    'POR': { pac: 0.10, sho: 0.05, pas: 0.10, dri: 0.05, def: 0.50, phy: 0.20 },
};
const DEFAULT_WEIGHTS = { pac: 0.166, sho: 0.166, pas: 0.166, dri: 0.166, def: 0.166, phy: 0.166 };

const calculateAttributeChangesFromPoints = (currentAttrs: any, ovrChange: number, position: string) => {
    if (ovrChange === 0) return currentAttrs;
    const newAttributes = { ...currentAttrs };
    const attributes = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
    const weights = POSITION_WEIGHTS[position] || DEFAULT_WEIGHTS;
    const totalPointsToAdd = ovrChange * 6;
    let pointsDistributed = 0;

    attributes.forEach((attr, index) => {
        const isLast = index === attributes.length - 1;
        let pointsForAttr = 0;
        if (isLast) {
            pointsForAttr = totalPointsToAdd - pointsDistributed;
        } else {
            const rawPoints = totalPointsToAdd * weights[attr];
            pointsForAttr = ovrChange > 0 ? Math.ceil(rawPoints) : Math.floor(rawPoints);
            pointsDistributed += pointsForAttr;
        }
        const currentValue = newAttributes[attr] as number;
        const newValue = currentValue + pointsForAttr;
        newAttributes[attr] = Math.round(Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, newValue)));
    });
    return newAttributes;
};

const calculateAttributeChanges = (currentAttrs: any, tags: any[] = []) => {
    const newAttributes = { ...currentAttrs };
    if (tags && tags.length > 0) {
        tags.forEach(tag => {
            if (!tag.effects) return;
            tag.effects.forEach((effect: any) => {
                const key = effect.attribute;
                if (typeof newAttributes[key] === 'number') {
                    newAttributes[key] += effect.change;
                    newAttributes[key] = Math.round(Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, newAttributes[key])));
                }
            });
        });
    }
    return newAttributes;
};

async function applyOvrUpdates(matchId: string) {
    console.log(`\n🚀 APPLYING OVR UPDATES FOR MATCH: ${matchId}`);

    const matchRef = db.doc(`matches/${matchId}`);
    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) { console.error('Match not found'); return; }

    const match = matchDoc.data();
    const playerIds = match?.playerUids || [];

    // Get all needed data
    const evaluationsSnap = await db.collection('evaluations').where('matchId', '==', matchId).get();
    const selfEvalsSnap = await db.collection(`matches/${matchId}/selfEvaluations`).get();

    const evalsByPlayer: Record<string, any[]> = {};
    evaluationsSnap.docs.forEach(doc => {
        const d = doc.data();
        if (!evalsByPlayer[d.playerId]) evalsByPlayer[d.playerId] = [];
        evalsByPlayer[d.playerId].push(d);
    });

    const selfEvalsByPlayer: Record<string, any> = {};
    selfEvalsSnap.docs.forEach(doc => {
        const d = doc.data();
        selfEvalsByPlayer[d.playerId] = d;
    });

    // Update each player
    for (const playerId of playerIds) {
        const playerRef = db.doc(`players/${playerId}`);
        const playerDoc = await playerRef.get();
        if (!playerDoc.exists) continue;
        const player = playerDoc.data() as any;

        const playerEvals = evalsByPlayer[playerId] || [];
        const pointEvals = playerEvals.filter(e => e.rating !== undefined);
        const tagEvals = playerEvals.filter(e => e.performanceTags?.length > 0);

        let updatedAttributes = { ...player };

        // 1. Tags
        if (tagEvals.length > 0) {
            const combinedTags = tagEvals.flatMap(e => e.performanceTags);
            updatedAttributes = calculateAttributeChanges(updatedAttributes, combinedTags);
        }

        // 2. Points (with Fallback)
        let avgRating = 5;
        const selfEval = selfEvalsByPlayer[playerId];
        const goals = selfEval?.goals || 0;
        const assists = selfEval?.assists || 0;

        if (pointEvals.length > 0) {
            const sum = pointEvals.reduce((a: number, b: any) => a + b.rating, 0);
            avgRating = sum / pointEvals.length;
        } else {
            // Fallback
            if (goals >= 2 || assists >= 2 || (goals + assists >= 3)) avgRating = 8;
            else if (goals === 1 || assists === 1) avgRating = 7;
            else avgRating = 5;
        }

        const ovrChangeFromPoints = calculateOvrChange(player.ovr, avgRating);
        console.log(`   👤 ${player.name} (${player.position}): Avg ${avgRating.toFixed(2)} -> OVR Change ${ovrChangeFromPoints.toFixed(2)}`);

        // 3. Apply Points
        updatedAttributes = calculateAttributeChangesFromPoints(updatedAttributes, ovrChangeFromPoints, player.position || 'MED');

        // 4. Recalc OVR
        let newOvr = Math.round((updatedAttributes.pac + updatedAttributes.sho + updatedAttributes.pas + updatedAttributes.dri + updatedAttributes.def + updatedAttributes.phy) / 6);
        newOvr = Math.max(OVR_PROGRESSION.MIN_OVR, Math.min(OVR_PROGRESSION.HARD_CAP, newOvr));

        const finalChange = newOvr - player.ovr;
        console.log(`      Final OVR: ${player.ovr} -> ${newOvr} (${finalChange > 0 ? '+' : ''}${finalChange})`);

        // Update DB
        await playerRef.update({
            ...updatedAttributes,
            ovr: newOvr,
            'stats.matchesPlayed': FieldValue.increment(1),
            // Note: Simplification for average rating update
            'stats.averageRating': ((player.stats?.averageRating || 0) * (player.stats?.matchesPlayed || 0) + avgRating) / ((player.stats?.matchesPlayed || 0) + 1)
        });

        // History
        await db.collection(`players/${playerId}/ovrHistory`).add({
            date: new Date().toISOString(),
            oldOVR: player.ovr,
            newOVR: newOvr,
            change: finalChange,
            matchId: matchId,
            viaScript: true
        });
    }
    console.log('✅ Done.');
}

const matchId = process.argv[2];
if (!matchId) { console.error('Provide matchId'); process.exit(1); }
applyOvrUpdates(matchId).catch(console.error).finally(() => process.exit(0));
