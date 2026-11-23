const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../lib/lib/match-extras');

test('costo: redondea a centavos, normaliza la moneda y el cero lo saca', () => {
  assert.deepEqual(m.normalizeCost(1500, 'uyu'), { total: 1500, currency: 'UYU' });
  assert.deepEqual(m.normalizeCost('1234.567', 'ARS'), { total: 1234.57, currency: 'ARS' });
  assert.deepEqual(m.normalizeCost(10), { total: 10, currency: 'UYU' }, 'moneda por defecto');
  assert.equal(m.normalizeCost(0, 'UYU'), null);
  assert.equal(m.normalizeCost(0.004, 'UYU'), null, 'menos de un centavo es cero');
});

test('costo: rechaza lo absurdo', () => {
  for (const bad of [-1, NaN, 'abc', undefined, null, Infinity, m.MAX_COST + 1]) {
    // null → Number(null) = 0 es válido (saca el costo); el resto no.
    if (bad === null) { assert.equal(m.normalizeCost(bad, 'UYU'), null); continue; }
    assert.throws(() => m.normalizeCost(bad, 'UYU'), /monto entre 0/, String(bad));
  }
  assert.throws(() => m.normalizeCost(100, 'EUR'), /Moneda/);
  assert.deepEqual(m.normalizeCost(m.MAX_COST, 'USD'), { total: m.MAX_COST, currency: 'USD' });
});

test('transmisión: entiende los enlaces de YouTube', () => {
  const id = 'dQw4w9WgXcQ';
  const want = { provider: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}`, active: true };
  for (const url of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=10s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/live/${id}`,
    `  https://www.youtube.com/embed/${id}  `,
  ]) assert.deepEqual(m.parseStreamLink(url), want, url);
  assert.equal(m.parseStreamLink('https://www.youtube.com/watch?v=corto'), null);
  assert.equal(m.parseStreamLink('https://www.youtube.com/@canal'), null);
});

test('transmisión: Twitch y Kick quedan en minúscula y con enlace propio', () => {
  assert.deepEqual(m.parseStreamLink('https://www.twitch.tv/MiCanal'), { provider: 'twitch', id: 'micanal', url: 'https://www.twitch.tv/micanal', active: true });
  assert.deepEqual(m.parseStreamLink('https://kick.com/Mi_Canal/clips'), { provider: 'kick', id: 'mi_canal', url: 'https://kick.com/mi_canal', active: true });
  assert.equal(m.parseStreamLink('https://www.twitch.tv/'), null);
});

test('transmisión: rechaza otros sitios, http y trampas de dirección', () => {
  for (const bad of [
    'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.malo.com/watch?v=dQw4w9WgXcQ',
    'https://malo.com/https://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://example.com/live',
    'javascript:alert(1)',
    'no es un enlace',
    '',
    null,
    42,
  ]) assert.equal(m.parseStreamLink(bad), null, String(bad));
});

test('plantel: reconoce invitados y descarta lo que no está', () => {
  assert.equal(m.isInRoster(['a', 'guest_1'], 'guest_1'), true);
  assert.equal(m.isInRoster(['a'], 'b'), false);
  assert.equal(m.isInRoster(undefined, 'a'), false);
});
