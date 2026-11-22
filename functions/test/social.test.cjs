const { test } = require('node:test');
const assert = require('node:assert/strict');

const { normalizePollInput, ALLOWED_REACTIONS } = require('../lib/callable/social.js');

test('normalizePollInput valida pregunta y entre 2 y 4 opciones', () => {
  assert.equal(normalizePollInput(null), null);
  assert.equal(normalizePollInput({ question: 'ab', options: ['Sí', 'No'] }), null);
  assert.equal(normalizePollInput({ question: '¿Sale revancha?', options: ['Sí'] }), null);

  const poll = normalizePollInput({
    question: '  ¿Quién fue la figura hoy? ',
    options: ['Juan', 'Pedro', '', 'Lucas', 'Mati', 'Extra'],
  });
  assert.ok(poll);
  assert.equal(poll.question, '¿Quién fue la figura hoy?');
  assert.equal(poll.options.length, 4);
  assert.deepEqual(poll.options[0], { id: 'opt_1', text: 'Juan' });
  assert.deepEqual(poll.votes, {});
});

test('ALLOWED_REACTIONS incluye reacciones futboleras principales', () => {
  assert.ok(ALLOWED_REACTIONS.includes('⚽'));
  assert.ok(ALLOWED_REACTIONS.includes('🔥'));
  assert.ok(ALLOWED_REACTIONS.includes('👏'));
  assert.ok(ALLOWED_REACTIONS.includes('💪'));
  assert.ok(ALLOWED_REACTIONS.includes('😂'));
});
