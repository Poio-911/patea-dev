const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

// Never initialize an Admin client unless an emulator is explicitly supplied.
// This suite must not be able to fall back to the production project.
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const projectId = 'demo-patea-workflows';
let admin;
let db;
let submitEvaluationSubmission;
let finalizeMatchEvaluation;
let processSubmission;
let submissionKey;

if (enabled) {
  admin = require('firebase-admin');
  admin.initializeApp({ projectId });
  db = admin.firestore();
  ({ submitEvaluationSubmission, finalizeMatchEvaluation } = require('../lib/callable/evaluations'));
  ({ processSubmission } = require('../lib/triggers/process-evaluation-submission'));
  ({ submissionKey } = require('../lib/lib/evaluation-submission'));
}

const options = { skip: enabled ? false : 'Requires FIRESTORE_EMULATOR_HOST', timeout: 60000 };
const suffix = () => randomUUID().replaceAll('-', '');
const request = (uid, data) => ({ auth: { uid, token: {} }, data });

async function fixture({ completed = false, ids = null } = {}) {
  const seed = suffix();
  const matchId = `match_${seed}`;
  const evaluatorId = ids?.evaluatorId ?? `evaluator_${seed}`;
  const subjectId = ids?.subjectId ?? `subject_${seed}`;
  const ownerUid = ids?.ownerUid ?? `owner_${seed}`;
  const assignmentId = `assignment_${seed}`;
  const evaluationId = `evaluation_${seed}`;
  const batch = db.batch();
  const matchRef = db.doc(`matches/${matchId}`);
  batch.set(matchRef, {
    ownerUid,
    status: 'completed',
    title: 'Emulator-only fixture',
    playerUids: [evaluatorId, subjectId],
    teams: [{ players: [{ uid: evaluatorId }] }, { players: [{ uid: subjectId }] }],
    finalScore: { team1: 9, team2: 8 },
  });
  batch.set(matchRef.collection('assignments').doc(assignmentId), {
    matchId, evaluatorId, subjectId, status: completed ? 'completed' : 'pending',
    ...(completed ? { evaluationId } : {}),
  });
  if (!ids) {
    for (const playerId of [evaluatorId, subjectId]) {
      batch.set(db.doc(`players/${playerId}`), {
        name: playerId, ownerUid: playerId, position: 'MED', ovr: 60,
        pac: 60, sho: 60, pas: 60, dri: 60, def: 60, phy: 60,
        stats: {
          matchesPlayed: 4, goals: 3, assists: 2, averageRating: 6,
          cleanSheets: 3, saves: 10, goalsConceded: 5,
          mvpVotes: 7, mvpCount: 2,
        },
      });
    }
  }
  if (completed) {
    batch.set(db.doc(`evaluations/${evaluationId}`), {
      assignmentId, playerId: subjectId, evaluatorId, matchId,
      rating: 8, evaluatedAt: new Date().toISOString(),
    });
    batch.set(matchRef.collection('selfEvaluations').doc(evaluatorId), {
      matchId, playerId: evaluatorId, goals: 2, assists: 1, mvpVote: subjectId,
    });
    batch.set(matchRef.collection('selfEvaluations').doc(subjectId), {
      matchId, playerId: subjectId, goals: 1, assists: 0,
    });
  }
  await batch.commit();
  return { matchId, evaluatorId, subjectId, ownerUid, assignmentId };
}

function submissionFor(fixture) {
  return {
    evaluatorGoals: 0, evaluatorAssists: 1, mvpVote: fixture.subjectId,
    evaluations: [{
      assignmentId: fixture.assignmentId, subjectId: fixture.subjectId,
      evaluationType: 'points', rating: 8,
    }],
  };
}

async function cleanup(fixture) {
  const evaluations = await db.collection('evaluations').where('matchId', '==', fixture.matchId).get();
  const submissions = await db.collection('evaluationSubmissions').where('matchId', '==', fixture.matchId).get();
  const batch = db.batch();
  for (const doc of [...evaluations.docs, ...submissions.docs]) batch.delete(doc.ref);
  await batch.commit();
  await db.recursiveDelete(db.doc(`matches/${fixture.matchId}`));
}

test('real Firestore: concurrent callable and trigger retries apply exactly one evaluation and vote', options, async () => {
  const f = await fixture();
  try {
    const results = await Promise.all(Array.from({ length: 5 }, () => submitEvaluationSubmission.run(request(f.evaluatorId, {
      matchId: f.matchId, submission: submissionFor(f),
    }))));
    assert.equal(results.filter(result => result.alreadySubmitted === false).length, 1);
    assert.equal(results.filter(result => result.alreadySubmitted === true).length, 4);
    const pending = await db.collection('evaluationSubmissions').where('matchId', '==', f.matchId).get();
    assert.equal(pending.size, 1);

    // A legacy web writer used a random document ID. It must contend on the
    // same processing marker even if it races the deterministic callable doc.
    const legacyId = `legacy_${suffix()}`;
    await db.doc(`evaluationSubmissions/${legacyId}`).set({
      evaluatorId: f.evaluatorId, matchId: f.matchId,
      submittedAt: new Date().toISOString(), submission: submissionFor(f),
    });
    const outcomes = await Promise.all([
      processSubmission(db, pending.docs[0].id),
      processSubmission(db, pending.docs[0].id),
      processSubmission(db, legacyId),
    ]);
    assert.equal(outcomes.filter(outcome => outcome === 'processed').length, 1);
    const [evaluations, selfReports, processed, remaining, subject] = await Promise.all([
      db.collection('evaluations').where('matchId', '==', f.matchId).get(),
      db.collection(`matches/${f.matchId}/selfEvaluations`).get(),
      db.collection(`matches/${f.matchId}/processedSubmissions`).get(),
      db.collection('evaluationSubmissions').where('matchId', '==', f.matchId).get(),
      db.doc(`players/${f.subjectId}`).get(),
    ]);
    assert.equal(evaluations.size, 1);
    assert.equal(selfReports.size, 1);
    assert.equal(selfReports.docs[0].data().goals, 0);
    assert.equal(processed.size, 1);
    assert.equal(processed.docs[0].id, submissionKey(f.matchId, f.evaluatorId));
    assert.equal(remaining.size, 0);
    assert.equal(subject.data().stats.mvpVotes, 8);
    assert.equal(subject.data().stats.mvpCount, 2);

    assert.equal(await processSubmission(db, pending.docs[0].id), 'missing');
    const repeat = await submitEvaluationSubmission.run(request(f.evaluatorId, {
      matchId: f.matchId, submission: submissionFor(f),
    }));
    assert.equal(repeat.alreadySubmitted, true);
    assert.equal((await db.doc(`players/${f.subjectId}`).get()).data().stats.mvpVotes, 8);
  } finally {
    await cleanup(f);
    await Promise.all([db.recursiveDelete(db.doc(`players/${f.evaluatorId}`)), db.recursiveDelete(db.doc(`players/${f.subjectId}`))]);
  }
});

test('real Firestore: finalization preserves keeper stats, separates MVP awards and keeps live score', options, async () => {
  const f = await fixture({ completed: true });
  try {
    const result = await finalizeMatchEvaluation.run(request(f.ownerUid, { matchId: f.matchId }));
    assert.equal(result.ok, true);
    assert.equal(result.playersUpdated, 2);
    const [match, subject, evaluator] = await Promise.all([
      db.doc(`matches/${f.matchId}`).get(), db.doc(`players/${f.subjectId}`).get(), db.doc(`players/${f.evaluatorId}`).get(),
    ]);
    assert.equal(match.data().status, 'evaluated');
    assert.deepEqual(match.data().finalScore, { team1: 9, team2: 8 });
    assert.equal(match.data().bestPlayerId, f.subjectId);
    for (const player of [subject, evaluator]) {
      assert.equal(player.data().stats.matchesPlayed, 5);
      assert.equal(player.data().stats.cleanSheets, 3);
      assert.equal(player.data().stats.saves, 10);
      assert.equal(player.data().stats.goalsConceded, 5);
      assert.equal(player.data().stats.mvpVotes, 7);
    }
    assert.equal(subject.data().stats.mvpCount, 3);
    assert.equal(evaluator.data().stats.mvpCount, 2);
    assert.equal(subject.data().stats.goals, 4);
    assert.equal(evaluator.data().stats.goals, 5);

    await assert.rejects(finalizeMatchEvaluation.run(request(f.ownerUid, { matchId: f.matchId })), error => error.code === 'failed-precondition');
    assert.equal((await db.doc(`players/${f.subjectId}`).get()).data().stats.matchesPlayed, 5);
    assert.equal((await db.collection(`players/${f.subjectId}/ovrHistory`).get()).size, 1);
  } finally {
    await cleanup(f);
    await Promise.all([db.recursiveDelete(db.doc(`players/${f.evaluatorId}`)), db.recursiveDelete(db.doc(`players/${f.subjectId}`))]);
  }
});

test('real Firestore: simultaneous finalization of two matches accumulates both player progressions', options, async () => {
  const first = await fixture({ completed: true });
  const second = await fixture({ completed: true, ids: first });
  try {
    const outcomes = await Promise.all([
      finalizeMatchEvaluation.run(request(first.ownerUid, { matchId: first.matchId })),
      finalizeMatchEvaluation.run(request(second.ownerUid, { matchId: second.matchId })),
    ]);
    assert.ok(outcomes.every(result => result.playersUpdated === 2));
    const subject = (await db.doc(`players/${first.subjectId}`).get()).data();
    const evaluator = (await db.doc(`players/${first.evaluatorId}`).get()).data();
    assert.equal(subject.stats.matchesPlayed, 6);
    assert.equal(evaluator.stats.matchesPlayed, 6);
    assert.equal(subject.stats.goals, 5);
    assert.equal(evaluator.stats.goals, 7);
    assert.equal(subject.stats.mvpCount, 4);
    assert.equal(subject.stats.mvpVotes, 7);
    assert.equal(subject.stats.cleanSheets, 3);
    const history = await db.collection(`players/${first.subjectId}/ovrHistory`).get();
    assert.equal(history.size, 2);
    assert.deepEqual(new Set(history.docs.map(doc => doc.data().matchId)), new Set([first.matchId, second.matchId]));
    assert.equal((await db.doc(`matches/${first.matchId}`).get()).data().status, 'evaluated');
    assert.equal((await db.doc(`matches/${second.matchId}`).get()).data().status, 'evaluated');
  } finally {
    await cleanup(first);
    await cleanup(second);
    await Promise.all([db.recursiveDelete(db.doc(`players/${first.evaluatorId}`)), db.recursiveDelete(db.doc(`players/${first.subjectId}`))]);
  }
});

test.after(async () => {
  if (enabled) await admin.app().delete();
});
