const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { normalizeSubmission, validateEvaluationSubmission, submissionKey } = require('../lib/lib/evaluation-submission');
const { processSubmission } = require('../lib/triggers/process-evaluation-submission');

function submission(overrides = {}) {
  return {
    evaluatorGoals: 0,
    evaluatorAssists: 0,
    evaluations: [{ assignmentId: 'assignment', subjectId: 'subject', evaluationType: 'points', rating: 7 }],
    ...overrides,
  };
}

function database(extra = {}) {
  const state = new Map(Object.entries({
    'matches/match': { status: 'completed', playerUids: ['evaluator', 'subject'] },
    'matches/match/assignments/assignment': {
      matchId: 'match', evaluatorId: 'evaluator', subjectId: 'subject', status: 'pending',
    },
    'players/subject': { stats: { mvpVotes: 0 } },
    ...extra,
  }));
  const writes = [];
  let version = 0;
  let retries = 0;
  const doc = path => ({
    path, id: path.split('/').at(-1),
    async get() {
      const value = state.get(path);
      return { id: path.split('/').at(-1), exists: value !== undefined, data: () => value };
    },
  });
  const query = (path, filters = [], limit = Infinity) => ({
    path, filters, count: limit,
    doc: (id = randomUUID()) => doc(`${path}/${id}`),
    where: (field, op, value) => { assert.equal(op, '=='); return query(path, [...filters, [field, value]], limit); },
    limit: size => query(path, filters, size),
  });
  const db = {
    doc,
    collection: path => query(path),
    async runTransaction(callback) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const readVersion = version;
        const snapshot = new Map(state);
        const pending = [];
        let startedWriting = false;
        const snap = (path, value) => ({ id: path.split('/').at(-1), exists: value !== undefined, data: () => value });
        const transaction = {
          async get(reference) {
            assert.equal(startedWriting, false, 'Firestore forbids reads after writes');
            await Promise.resolve();
            if (reference.filters) {
              const docs = [...snapshot].filter(([path, value]) => {
                if (!path.startsWith(`${reference.path}/`) || path.split('/').length !== reference.path.split('/').length + 1) return false;
                return reference.filters.every(([field, expected]) => value[field] === expected);
              }).slice(0, reference.count).map(([path, value]) => snap(path, value));
              return { docs, empty: docs.length === 0 };
            }
            return snap(reference.path, snapshot.get(reference.path));
          },
          set(reference, data) { startedWriting = true; pending.push(['set', reference.path, data]); },
          update(reference, data) { startedWriting = true; pending.push(['update', reference.path, data]); },
          delete(reference) { startedWriting = true; pending.push(['delete', reference.path]); },
        };
        const result = await callback(transaction);
        if (version !== readVersion) { retries++; continue; }
        for (const [operation, path, data] of pending) {
          if (operation === 'delete') state.delete(path);
          else if (operation === 'set') state.set(path, data);
          else {
            assert.ok(state.has(path), `Updating nonexistent doc ${path}`);
            const updated = { ...state.get(path), ...data };
            for (const [key, value] of Object.entries(data)) {
              if (value && typeof value.isEqual === 'function' && value.isEqual(FieldValue.delete())) delete updated[key];
            }
            state.set(path, updated);
          }
          writes.push({ operation, path, data });
        }
        version++;
        return result;
      }
      throw Error('Transaction did not converge');
    },
  };
  return { db, state, writes, get retries() { return retries; } };
}

const invalid = code => error => error.code === code;

test('canonical web and mobile tags replace forged effects and identities', () => {
  for (const id of ['atajadon_espectacular', 'el_pulpo']) {
    const normalized = normalizeSubmission(submission({
      evaluatorId: 'intruder',
      evaluations: [{ assignmentId: 'assignment', subjectId: 'subject', evaluationType: 'tags',
        performanceTags: [{ id, name: 'Injected', effects: [{ attribute: 'ovr', change: 9999 }] }] }],
    }));
    assert.equal(normalized.evaluatorId, undefined);
    const tag = normalized.evaluations[0].performanceTags[0];
    assert.notEqual(tag.name, 'Injected');
    assert.ok(tag.effects.every(effect => effect.attribute !== 'ovr' && Math.abs(effect.change) <= 3));
  }
});

test('unknown or repeated tags cannot create arbitrary progression', () => {
  for (const tags of [[{ id: 'invented' }], [{ id: 'el_pulpo' }, { id: 'el_pulpo' }]]) {
    assert.throws(() => normalizeSubmission(submission({ evaluations: [{
      assignmentId: 'assignment', subjectId: 'subject', evaluationType: 'tags', performanceTags: tags,
    }] })), invalid('invalid-argument'));
  }
});

test('invalid ratings, counts, paths and repeated assignments are rejected', () => {
  for (const rating of [NaN, Infinity, 0, 11, '7']) {
    assert.throws(() => normalizeSubmission(submission({ evaluations: [{ assignmentId: 'assignment', subjectId: 'subject', evaluationType: 'points', rating }] })), invalid('invalid-argument'));
  }
  for (const evaluatorGoals of [-1, 21, 0.5, '2']) {
    assert.throws(() => normalizeSubmission(submission({ evaluatorGoals })), invalid('invalid-argument'));
  }
  const peer = submission().evaluations[0];
  assert.throws(() => normalizeSubmission(submission({ evaluations: [peer, peer] })), invalid('invalid-argument'));
  assert.throws(() => normalizeSubmission(submission({ evaluations: [{ ...peer, subjectId: '../subject' }] })), invalid('invalid-argument'));
});

test('text remains testimony without trusting client AI progression', () => {
  const result = normalizeSubmission(submission({ evaluations: [{
    assignmentId: 'assignment', subjectId: 'subject', evaluationType: 'text',
    textDescription: 'Buen partido, corrió hasta el final.',
    aiAttributeChanges: [{ attribute: 'sho', change: 1000 }], aiSummary: 'inventado', aiConfidence: 1,
  }] })).evaluations[0];
  assert.deepEqual(Object.keys(result).sort(), ['assignmentId', 'subjectId', 'evaluationType', 'textDescription'].sort());
});

test('only participants can submit their own pending assignments for the assigned subject', async () => {
  const scenarios = [
    [{ 'matches/match': { status: 'completed', playerUids: ['subject'] } }, 'permission-denied'],
    [{ 'matches/match': { status: 'upcoming', playerUids: ['evaluator', 'subject'] } }, 'failed-precondition'],
    [{ 'matches/match/assignments/assignment': { matchId: 'match', evaluatorId: 'other', subjectId: 'subject', status: 'pending' } }, 'permission-denied'],
    [{ 'matches/match/assignments/assignment': { matchId: 'match', evaluatorId: 'evaluator', subjectId: 'other', status: 'pending' } }, 'permission-denied'],
    [{ 'matches/match/assignments/assignment': { matchId: 'match', evaluatorId: 'evaluator', subjectId: 'subject', status: 'completed' } }, 'failed-precondition'],
  ];
  for (const [extra, code] of scenarios) {
    const { db } = database(extra);
    await assert.rejects(db.runTransaction(tx => validateEvaluationSubmission(db, tx, 'match', 'evaluator', submission())), invalid(code));
  }
});

test('MVP must be a participant and all assignments must be submitted', async () => {
  const { db } = database({
    'matches/match/assignments/second': { matchId: 'match', evaluatorId: 'evaluator', subjectId: 'subject', status: 'pending' },
  });
  await assert.rejects(db.runTransaction(tx => validateEvaluationSubmission(db, tx, 'match', 'evaluator', submission())), invalid('invalid-argument'));
  await assert.rejects(db.runTransaction(tx => validateEvaluationSubmission(db, tx, 'match', 'evaluator', submission({ mvpVote: 'outside' }))), invalid('invalid-argument'));
});

test('zero-goal report is retained; event redelivery never repeats side effects', async () => {
  const fixture = database({ 'evaluationSubmissions/source': {
    matchId: 'match', evaluatorId: 'evaluator', submission: submission({ mvpVote: 'subject' }),
  } });
  assert.equal(await processSubmission(fixture.db, 'source'), 'processed');
  const writeCount = fixture.writes.length;
  assert.equal(await processSubmission(fixture.db, 'source'), 'missing');
  assert.equal(fixture.writes.length, writeCount);
  assert.equal(fixture.state.get('matches/match/selfEvaluations/evaluator').goals, 0);
  assert.equal(fixture.state.get('matches/match/assignments/assignment').status, 'completed');
  assert.equal(fixture.writes.filter(write => write.path === 'players/subject').length, 1);
});

test('concurrent legacy submissions retry and share one processing marker', async () => {
  const source = { matchId: 'match', evaluatorId: 'evaluator', submission: submission({ mvpVote: 'subject' }) };
  const fixture = database({ 'evaluationSubmissions/first': source, 'evaluationSubmissions/second': source });
  const results = await Promise.all([processSubmission(fixture.db, 'first'), processSubmission(fixture.db, 'second')]);
  assert.deepEqual(results.sort(), ['duplicate', 'processed']);
  assert.ok(fixture.retries > 0, 'Both transactions initially read the same missing marker');
  assert.equal(fixture.writes.filter(write => write.path === 'players/subject').length, 1);
  assert.equal([...fixture.state.keys()].filter(path => path.startsWith('evaluations/')).length, 1);
  assert.ok(fixture.state.has(`matches/match/processedSubmissions/${submissionKey('match', 'evaluator')}`));
  assert.equal(fixture.state.has('evaluationSubmissions/first'), false);
  assert.equal(fixture.state.has('evaluationSubmissions/second'), false);
});

test('historic processed submissions block resubmission even without a deterministic marker', async () => {
  const fixture = database({
    'matches/match/processedSubmissions/legacy': { evaluatorId: 'evaluator', processingStatus: 'completed' },
    'evaluationSubmissions/repeated': { matchId: 'match', evaluatorId: 'evaluator', submission: submission() },
  });
  assert.equal(await processSubmission(fixture.db, 'repeated'), 'duplicate');
  assert.equal([...fixture.state.keys()].filter(path => path.startsWith('evaluations/')).length, 0);
});

test('invalid legacy documents are consumed and expose an error only under the author path', async () => {
  const fixture = database({ 'evaluationSubmissions/invalid': {
    matchId: 'match', evaluatorId: 'evaluator', submission: submission({ evaluatorGoals: 99 }),
  } });
  assert.equal(await processSubmission(fixture.db, 'invalid'), 'rejected');
  assert.equal(fixture.state.has('evaluationSubmissions/invalid'), false);
  assert.equal(fixture.state.has('users/evaluator/evaluationSubmissionErrors/invalid'), true);
  assert.equal(fixture.state.get('users/evaluator/evaluationSubmissionErrors/invalid').submission, undefined);
  assert.equal([...fixture.state.keys()].filter(path => path.startsWith('evaluations/')).length, 0);
});


test('organizer-visible assignments cannot reveal or predict anonymous evaluation IDs', async () => {
  const fixture = database({
    'matches/match/assignments/assignment': {
      matchId: 'match', evaluatorId: 'evaluator', subjectId: 'subject', status: 'pending',
      evaluationId: 'old-public-binding',
    },
    'evaluationSubmissions/privacy': {
      matchId: 'match', evaluatorId: 'evaluator', submission: submission(),
    },
  });
  assert.equal(await processSubmission(fixture.db, 'privacy'), 'processed');
  const assignment = fixture.state.get('matches/match/assignments/assignment');
  assert.equal(Object.hasOwn(assignment, 'evaluationId'), false);
  const binding = fixture.state.get('matches/match/assignments/assignment/private/evaluation');
  assert.ok(binding?.evaluationId);
  assert.notEqual(binding.evaluationId, submissionKey('match', 'assignment'));
  assert.ok(fixture.state.has(`evaluations/${binding.evaluationId}`));
  const beforeRetry = [...fixture.state.keys()].filter(path => path.startsWith('evaluations/'));
  assert.equal(await processSubmission(fixture.db, 'privacy'), 'missing');
  assert.deepEqual([...fixture.state.keys()].filter(path => path.startsWith('evaluations/')), beforeRetry);
});
