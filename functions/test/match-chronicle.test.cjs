const test = require('node:test');
const assert = require('node:assert/strict');
const { parseChronicle } = require('../lib/callable/match-chronicle');

test('crónica JSON conserva contrato y elimina campos ajenos del modelo', () => {
  assert.deepEqual(parseChronicle(JSON.stringify({ headline: 'Un clásico', story: 'Ganó Norte.', secret: 'extra', playerVoices: [{ playerName: 'Ana', quote: 'Buen partido', extra: true }] }), 'STOP'), {
    headline: 'Un clásico', story: 'Ganó Norte.', playerVoices: [{ playerName: 'Ana', quote: 'Buen partido' }],
  });
});

test('crónica sin testimonios es válida', () => {
  assert.deepEqual(parseChronicle('{"headline":"Final","story":"Fue 3 a 2."}', 'STOP'), { headline: 'Final', story: 'Fue 3 a 2.' });
});

test('respuesta truncada o bloqueada no se acepta aunque contenga JSON válido', () => {
  for (const reason of ['MAX_TOKENS', 'SAFETY', undefined]) {
    assert.throws(() => parseChronicle('{"headline":"Final","story":"Parcial"}', reason), /incompleta/);
  }
});

test('salida inválida no puede persistirse como crónica', () => {
  for (const value of [null, [], {}, { headline: ' ', story: 'Texto' }, { headline: 'Título', story: 2 }, { headline: 'Título', story: 'Texto', playerVoices: [null] }]) {
    assert.throws(() => parseChronicle(JSON.stringify(value), 'STOP'));
  }
  assert.throws(() => parseChronicle('```json', 'STOP'));
});
