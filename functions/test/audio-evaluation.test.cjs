const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isValidEvaluationAudioPath,
  parseAudioPerformance,
} = require('../lib/lib/text-performance-analyzer');
const { maskEvaluation } = require('../lib/lib/evaluation-privacy');
const { normalizeSubmission } = require('../lib/lib/evaluation-submission');

test('isValidEvaluationAudioPath exige carpeta del partido y del autor y extensión de audio', () => {
  assert.equal(
    isValidEvaluationAudioPath('evaluation-audios/match-1/user-a/assign-1.m4a', 'match-1', 'user-a'),
    true,
  );
  assert.equal(
    isValidEvaluationAudioPath('evaluation-audios/match-1/user-b/assign-1.m4a', 'match-1', 'user-a'),
    false,
  );
  assert.equal(
    isValidEvaluationAudioPath('evaluation-audios/match-2/user-a/assign-1.m4a', 'match-1', 'user-a'),
    false,
  );
  assert.equal(
    isValidEvaluationAudioPath('evaluation-audios/match-1/user-a/../other.m4a', 'match-1', 'user-a'),
    false,
  );
  assert.equal(
    isValidEvaluationAudioPath('evaluation-audios/match-1/user-a/script.js', 'match-1', 'user-a'),
    false,
  );
});

test('parseAudioPerformance extrae transcript, summary y cambios acotados, y rechaza silencio', () => {
  const ok = parseAudioPerformance(
    JSON.stringify({
      transcript: 'La rompió toda, metió dos pases filtrados y corrió los 90 minutos.',
      summary: 'Gran despliegue físico y precisión en los pases decisivos.',
      confidence: 0.92,
      attributeChanges: [
        { attribute: 'pas', change: 5, reason: 'Dos pases gol' },
        { attribute: 'phy', change: 2, reason: 'Corrió todo el partido' },
        { attribute: 'pas', change: 1, reason: 'Duplicado que debe ignorarse' },
      ],
    }),
    'STOP',
  );
  assert.equal(ok.transcript.includes('pases filtrados'), true);
  assert.equal(ok.attributeChanges.length, 2);
  assert.equal(ok.attributeChanges[0].change, 3);
  assert.equal(ok.summary.length > 0, true);

  assert.throws(
    () =>
      parseAudioPerformance(
        JSON.stringify({
          transcript: '   ',
          summary: 'Sin datos',
          confidence: 0.1,
          attributeChanges: [{ attribute: 'pac', change: 1, reason: 'N/A' }],
        }),
        'STOP',
      ),
    /comentario claro/,
  );
});

test('maskEvaluation oculta audioPath y transcripción literal mientras sea anónima, y los desbloquea al revelarse', () => {
  const raw = {
    id: 'ev-1',
    evaluatorId: 'author-1',
    evaluatorDisplayName: 'Lucas',
    assignmentId: 'assign-1',
    audioPath: 'evaluation-audios/m1/author-1/assign-1.m4a',
    audioDurationSec: 18,
    textDescription: 'Che soy Lucas, hoy estuviste imparable por afuera.',
    aiSummary: 'Gran desequilibrio por banda durante todo el partido.',
    identityRevealed: false,
  };

  const anonView = maskEvaluation(raw, 'subject-2');
  assert.equal(anonView.evaluatorId, 'anonymous');
  assert.equal(anonView.isAnonymous, true);
  assert.equal(anonView.hasAudio, true);
  assert.equal(anonView.audioDurationSec, 18);
  assert.equal(anonView.audioPath, undefined);
  assert.equal(anonView.textDescription, undefined);
  assert.equal(anonView.aiSummary, raw.aiSummary);

  const revealedView = maskEvaluation({ ...raw, identityRevealed: true }, 'subject-2');
  assert.equal(revealedView.evaluatorDisplayName, 'Lucas');
  assert.equal(revealedView.hasAudio, true);
  assert.equal(revealedView.audioPath, undefined);
  assert.equal(revealedView.textDescription, raw.textDescription);
});

test('normalizeSubmission admite reseña por audio sin textDescription y valida duración', () => {
  const normalized = normalizeSubmission({
    evaluatorGoals: 1,
    evaluatorAssists: 0,
    evaluations: [
      {
        assignmentId: 'a1',
        subjectId: 'p1',
        evaluationType: 'text',
        audioPath: 'evaluation-audios/m1/u1/a1.m4a',
        audioDurationSec: 24,
      },
    ],
  });
  assert.equal(normalized.evaluations[0].audioPath, 'evaluation-audios/m1/u1/a1.m4a');
  assert.equal(normalized.evaluations[0].audioDurationSec, 24);
  assert.equal(normalized.evaluations[0].textDescription, undefined);

  assert.throws(
    () =>
      normalizeSubmission({
        evaluations: [
          {
            assignmentId: 'a1',
            subjectId: 'p1',
            evaluationType: 'text',
            audioPath: 'evaluation-audios/m1/u1/a1.m4a',
            audioDurationSec: 200,
          },
        ],
      }),
    /duración/,
  );
});
