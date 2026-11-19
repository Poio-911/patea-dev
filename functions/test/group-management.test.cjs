const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeJerseyPayload } = require('../lib/callable/group-management');

test('sanitizeJerseyPayload conserva camiseta básica y limpia modo none', () => {
  assert.deepEqual(
    sanitizeJerseyPayload({
      type: 'raglan',
      primaryColor: '#FFFFFF',
      secondaryColor: '#DC2626',
      crestMode: 'none',
      crestShape: 'classic',
    }),
    {
      type: 'raglan',
      primaryColor: '#FFFFFF',
      secondaryColor: '#DC2626',
    },
  );
});

test('sanitizeJerseyPayload valida crestUrl en modo PNG subido y rechaza URLs externas', () => {
  assert.deepEqual(
    sanitizeJerseyPayload({
      type: 'plain',
      primaryColor: '#2563EB',
      secondaryColor: '#FFFFFF',
      crestMode: 'uploaded',
      crestUrl:
        'https://firebasestorage.googleapis.com/v0/b/mil-disculpis.firebasestorage.app/o/team-crests%2Fg%2Fu%2Fcrest.png?alt=media&token=123',
      crestClipCircle: true,
    }),
    {
      type: 'plain',
      primaryColor: '#2563EB',
      secondaryColor: '#FFFFFF',
      crestMode: 'uploaded',
      crestUrl:
        'https://firebasestorage.googleapis.com/v0/b/mil-disculpis.firebasestorage.app/o/team-crests%2Fg%2Fu%2Fcrest.png?alt=media&token=123',
      crestClipCircle: true,
    },
  );

  assert.throws(
    () =>
      sanitizeJerseyPayload({
        type: 'plain',
        crestMode: 'uploaded',
        crestUrl: 'https://evil.example/crest.png',
      }),
    /Storage del proyecto/,
  );
});

test('sanitizeJerseyPayload normaliza escudo vectorial con textos, forma, estrellas y adornos', () => {
  const res = sanitizeJerseyPayload({
    type: 'multi_stripes',
    primaryColor: '#1E3A8A',
    secondaryColor: '#D97706',
    crestMode: 'custom',
    crestShape: 'circle',
    crestLayout: 'ring',
    crestSymbol: 'crown',
    crestText: 'LOS GALÁCTICOS DE ORO',
    crestSubtitle: 'EST. 2026',
    crestTextLayout: 'auto',
    crestFont: 'classic',
    crestBorderColor: '#D97706',
    crestStars: 5,
    crestLaurel: true,
    crestCrownTop: true,
  });

  assert.equal(res.crestMode, 'custom');
  assert.equal(res.crestShape, 'circle');
  assert.equal(res.crestLayout, 'ring');
  assert.equal(res.crestSymbol, 'crown');
  assert.equal(res.crestText, 'LOS GALÁCTICOS');
  assert.equal(res.crestInitials, 'LOS ');
  assert.equal(res.crestSubtitle, 'EST. 2026');
  assert.equal(res.crestTextLayout, 'auto');
  assert.equal(res.crestFont, 'classic');
  assert.equal(res.crestBorderColor, '#D97706');
  assert.equal(res.crestStars, 3);
  assert.equal(res.crestLaurel, true);
  assert.equal(res.crestCrownTop, true);
});
