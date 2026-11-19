const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ATTRS,
  OVR_PROGRESSION,
  applyRatingVector,
  calculateOvrChange,
  computeMatchProgression,
  equivalentRatingFromVector,
  selfReportMicroBonusVector,
  vectorFromAI,
  vectorFromPoints,
  vectorFromTags,
} = require('../lib/lib/ovr-progression');
const { canonicalPerformanceTags } = require('../lib/lib/performance-tags');

function uniformAttrs(val) {
  return { pac: val, sho: val, pas: val, dri: val, def: val, phy: val };
}

function sumDeltas(deltas) {
  return ATTRS.reduce((sum, attr) => sum + deltas[attr], 0);
}

const tagById = new Map(canonicalPerformanceTags.map((t) => [t.id, t]));

test('canonical performance tags are clean (positive > 0, negative < 0, no duplicate IDs)', () => {
  const seen = new Set();
  for (const tag of canonicalPerformanceTags) {
    assert.equal(seen.has(tag.id), false, `Duplicate tag id: ${tag.id}`);
    seen.add(tag.id);
    assert.ok(tag.effects.length > 0, `Empty effects on ${tag.id}`);
    for (const effect of tag.effects) {
      if (tag.impact === 'positive') {
        assert.ok(effect.change > 0, `Positive tag ${tag.id} must not have negative effect ${effect.attribute}: ${effect.change}`);
      } else {
        assert.ok(effect.change < 0, `Negative tag ${tag.id} must not have positive effect ${effect.attribute}: ${effect.change}`);
      }
    }
  }
});

test('all 4 evaluation modes have identical OVR & total attribute power across all OVR tiers', () => {
  const fivePosTags = [
    tagById.get('goleador_nato'),
    tagById.get('endiablado'),
    tagById.get('terror_area'),
    tagById.get('asistidor'),
    tagById.get('correcaminos'),
  ];
  const threePosTags = fivePosTags.slice(0, 3);
  const raveAi = [
    { attribute: 'sho', change: 3 },
    { attribute: 'dri', change: 3 },
    { attribute: 'pas', change: 2 },
    { attribute: 'pac', change: 2 },
  ];
  const goodAi = [
    { attribute: 'sho', change: 2 },
    { attribute: 'dri', change: 2 },
    { attribute: 'pac', change: 1 },
  ];
  const fiveNegTags = [
    tagById.get('se_comio_elefante'),
    tagById.get('lento_definiendo'),
    tagById.get('sin_presion_arriba'),
    tagById.get('decision_mal'),
    tagById.get('control_cemento'),
  ];
  const harshAi = [
    { attribute: 'sho', change: -3 },
    { attribute: 'dri', change: -3 },
    { attribute: 'pas', change: -2 },
    { attribute: 'pac', change: -2 },
  ];

  for (const ovr of [55, 65, 75, 85, 93]) {
    const attrs = uniformAttrs(ovr);

    // 10/10 == 5 positive tags == rave text/audio review
    const p10 = computeMatchProgression({ currentAttrs: attrs, currentOvr: ovr, position: 'DEL', peerEvaluations: [{ rating: 10 }] });
    const t5 = computeMatchProgression({ currentAttrs: attrs, currentOvr: ovr, position: 'DEL', peerEvaluations: [{ performanceTags: fivePosTags }] });
    const aRave = computeMatchProgression({ currentAttrs: attrs, currentOvr: ovr, position: 'DEL', peerEvaluations: [{ aiAttributeChanges: raveAi }] });
    assert.equal(sumDeltas(t5.attributeDeltas), sumDeltas(p10.attributeDeltas), `OVR ${ovr}: 5 pos tags vs 10/10`);
    assert.equal(sumDeltas(aRave.attributeDeltas), sumDeltas(p10.attributeDeltas), `OVR ${ovr}: rave AI vs 10/10`);
    assert.equal(t5.newOvr, p10.newOvr, `OVR ${ovr}: newOvr 5 pos tags vs 10/10`);
    assert.equal(aRave.newOvr, p10.newOvr, `OVR ${ovr}: newOvr rave AI vs 10/10`);

    // 8/10 == 3 positive tags == good text/audio review
    const p8 = computeMatchProgression({ currentAttrs: attrs, currentOvr: ovr, position: 'DEL', peerEvaluations: [{ rating: 8 }] });
    const t3 = computeMatchProgression({ currentAttrs: attrs, currentOvr: ovr, position: 'DEL', peerEvaluations: [{ performanceTags: threePosTags }] });
    const aGood = computeMatchProgression({ currentAttrs: attrs, currentOvr: ovr, position: 'DEL', peerEvaluations: [{ aiAttributeChanges: goodAi }] });
    assert.equal(sumDeltas(t3.attributeDeltas), sumDeltas(p8.attributeDeltas), `OVR ${ovr}: 3 pos tags vs 8/10`);
    assert.equal(sumDeltas(aGood.attributeDeltas), sumDeltas(p8.attributeDeltas), `OVR ${ovr}: good AI vs 8/10`);
    assert.equal(t3.newOvr, p8.newOvr, `OVR ${ovr}: newOvr 3 pos tags vs 8/10`);
    assert.equal(aGood.newOvr, p8.newOvr, `OVR ${ovr}: newOvr good AI vs 8/10`);

    // 1/10 == 5 negative tags == harsh text/audio review
    const p1 = computeMatchProgression({ currentAttrs: attrs, currentOvr: ovr, position: 'DEL', peerEvaluations: [{ rating: 1 }] });
    const t5Neg = computeMatchProgression({ currentAttrs: attrs, currentOvr: ovr, position: 'DEL', peerEvaluations: [{ performanceTags: fiveNegTags }] });
    const aHarsh = computeMatchProgression({ currentAttrs: attrs, currentOvr: ovr, position: 'DEL', peerEvaluations: [{ aiAttributeChanges: harshAi }] });
    assert.equal(sumDeltas(t5Neg.attributeDeltas), sumDeltas(p1.attributeDeltas), `OVR ${ovr}: 5 neg tags vs 1/10`);
    assert.equal(sumDeltas(aHarsh.attributeDeltas), sumDeltas(p1.attributeDeltas), `OVR ${ovr}: harsh AI vs 1/10`);
    assert.equal(t5Neg.newOvr, p1.newOvr, `OVR ${ovr}: newOvr 5 neg tags vs 1/10`);
    assert.equal(aHarsh.newOvr, p1.newOvr, `OVR ${ovr}: newOvr harsh AI vs 1/10`);
  }
});

test('multiple evaluators and mixed modes average cleanly instead of stacking', () => {
  const attrs = uniformAttrs(75);
  const fivePosTags = [
    tagById.get('goleador_nato'),
    tagById.get('endiablado'),
    tagById.get('terror_area'),
    tagById.get('asistidor'),
    tagById.get('correcaminos'),
  ];
  const raveAi = [
    { attribute: 'sho', change: 3 },
    { attribute: 'dri', change: 3 },
    { attribute: 'pas', change: 2 },
    { attribute: 'pac', change: 2 },
  ];

  const oneEval = computeMatchProgression({
    currentAttrs: attrs,
    currentOvr: 75,
    position: 'DEL',
    peerEvaluations: [{ rating: 10 }],
  });
  const threeEvaluatorsMixed = computeMatchProgression({
    currentAttrs: attrs,
    currentOvr: 75,
    position: 'DEL',
    peerEvaluations: [
      { rating: 10 },
      { performanceTags: fivePosTags },
      { aiAttributeChanges: raveAi },
    ],
  });

  // Mixing Points + Tags + Audio must NOT triple progression
  assert.equal(sumDeltas(threeEvaluatorsMixed.attributeDeltas), sumDeltas(oneEval.attributeDeltas));
  assert.equal(threeEvaluatorsMixed.newOvr, oneEval.newOvr);
  assert.equal(threeEvaluatorsMixed.equivalentRating, 10);

  // Two opposite evaluators cancel out cleanly
  const balanced = computeMatchProgression({
    currentAttrs: attrs,
    currentOvr: 75,
    position: 'DEL',
    peerEvaluations: [
      { rating: 8 },
      { performanceTags: [tagById.get('se_comio_elefante'), tagById.get('lento_definiendo'), tagById.get('decision_mal')] },
    ],
  });
  assert.equal(balanced.newOvr, 75);
  assert.equal(balanced.equivalentRating, 5);
});

test('position weights prioritize primary attributes without first-attr bias', () => {
  const attrs = uniformAttrs(75);
  const por = computeMatchProgression({
    currentAttrs: attrs,
    currentOvr: 75,
    position: 'POR',
    peerEvaluations: [{ rating: 10 }],
  });
  assert.equal(por.attributeDeltas.def, 3);
  assert.ok(por.attributeDeltas.def > por.attributeDeltas.pac);
  assert.equal(sumDeltas(por.attributeDeltas), 6);

  const del = computeMatchProgression({
    currentAttrs: attrs,
    currentOvr: 75,
    position: 'DEL',
    peerEvaluations: [{ rating: 10 }],
  });
  assert.ok(del.attributeDeltas.sho >= 2);
  assert.ok(del.attributeDeltas.sho > del.attributeDeltas.def);
  assert.equal(sumDeltas(del.attributeDeltas), 6);
});

test('mixed positive + negative tags keep OVR neutral while moving opposing attributes', () => {
  const attrs = uniformAttrs(75);
  const res = computeMatchProgression({
    currentAttrs: attrs,
    currentOvr: 75,
    position: 'DEL',
    peerEvaluations: [{
      performanceTags: [
        tagById.get('goleador_nato'),
        tagById.get('asistidor'),
        tagById.get('sin_presion_arriba'),
        tagById.get('se_escondio'),
      ],
    }],
  });
  assert.equal(res.newOvr, 75);
  assert.equal(res.equivalentRating, 5);
  assert.ok(res.attributeDeltas.sho > 0 || res.attributeDeltas.pas > 0);
  assert.ok(res.attributeDeltas.def < 0 || res.attributeDeltas.phy < 0 || res.attributeDeltas.pac < 0);
});

test('uniform goals & assists micro-bonus applies identically across all modes and caps safely', () => {
  const attrs = uniformAttrs(75);
  const threePosTags = [
    tagById.get('goleador_nato'),
    tagById.get('endiablado'),
    tagById.get('terror_area'),
  ];
  const goodAi = [
    { attribute: 'sho', change: 2 },
    { attribute: 'dri', change: 2 },
    { attribute: 'pac', change: 1 },
  ];

  const withPoints = computeMatchProgression({
    currentAttrs: attrs,
    currentOvr: 75,
    position: 'DEL',
    peerEvaluations: [{ rating: 8 }],
    goals: 2,
    assists: 1,
  });
  const withTags = computeMatchProgression({
    currentAttrs: attrs,
    currentOvr: 75,
    position: 'DEL',
    peerEvaluations: [{ performanceTags: threePosTags }],
    goals: 2,
    assists: 1,
  });
  const withAi = computeMatchProgression({
    currentAttrs: attrs,
    currentOvr: 75,
    position: 'DEL',
    peerEvaluations: [{ aiAttributeChanges: goodAi }],
    goals: 2,
    assists: 1,
  });

  // Same total boost regardless of peer evaluation method!
  assert.equal(sumDeltas(withTags.attributeDeltas), sumDeltas(withPoints.attributeDeltas));
  assert.equal(sumDeltas(withAi.attributeDeltas), sumDeltas(withPoints.attributeDeltas));

  // Self-reporting 20 goals cannot break the +1.0 micro-bonus cap
  const b3 = selfReportMicroBonusVector(3, 0);
  const b20 = selfReportMicroBonusVector(20, 0);
  assert.deepEqual(b20, b3);
  assert.ok(Math.abs(sumDeltas(b20) - 1.0) < 1e-9);
});

test('legacy 10-tag payload still caps to 10/10 budget and respects attribute bounds', () => {
  const tenPosTags = canonicalPerformanceTags.filter((t) => t.impact === 'positive').slice(0, 10);
  const vec = vectorFromTags(tenPosTags);
  const l1 = ATTRS.reduce((s, a) => s + Math.abs(vec[a]), 0);
  assert.ok(l1 <= OVR_PROGRESSION.MAX_EVAL_L1 + 1e-9);

  // Near ceiling (99) and floor (20) clamping
  const nearMax = applyRatingVector(uniformAttrs(99), 99, vectorFromPoints(10, 'DEL'));
  assert.equal(nearMax.newOvr, 99);
  assert.equal(sumDeltas(nearMax.attributeDeltas), 0);

  const nearMin = applyRatingVector(uniformAttrs(20), 40, vectorFromPoints(1, 'DEL'));
  assert.equal(nearMin.newOvr, 40);
  assert.equal(sumDeltas(nearMin.attributeDeltas), 0);

  // Classic calculateOvrChange tier curve preserved
  assert.equal(calculateOvrChange(75, 5), 0);
  assert.ok(Math.abs(calculateOvrChange(75, 8) - 0.6) < 1e-9);
  assert.equal(calculateOvrChange(45, 10), 1.5);
  assert.equal(equivalentRatingFromVector(vectorFromAI([{ attribute: 'sho', change: 3 }])), 6.8);
});

test('players with positional OVR differing from simple average never drop on neutral matches', () => {
  const attrs = { pac: 78, sho: 74, pas: 86, dri: 83, def: 71, phy: 76 }; // simple avg = 78
  const neutral = computeMatchProgression({
    currentAttrs: attrs,
    currentOvr: 82,
    position: 'MED',
    peerEvaluations: [{ rating: 5 }],
  });
  assert.equal(neutral.newOvr, 82);
  assert.equal(neutral.ovrDelta, 0);

  const great = computeMatchProgression({
    currentAttrs: attrs,
    currentOvr: 82,
    position: 'MED',
    peerEvaluations: [{ rating: 10 }],
  });
  assert.equal(great.newOvr, 83);
  assert.equal(great.ovrDelta, 1);
});
