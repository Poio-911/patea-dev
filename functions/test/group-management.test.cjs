// Estos tests dependen del bucket del proyecto real. En CI los emuladores corren con
// otro proyecto (`demo-patea-privacy`), que cambiaría el bucket esperado: se fija acá.
process.env.GCLOUD_PROJECT = 'mil-disculpis';
delete process.env.GOOGLE_CLOUD_PROJECT;
delete process.env.FIREBASE_CONFIG;

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

test('sanitizeJerseyPayload sólo acepta escudos del bucket del proyecto, de team-crests y del grupo', () => {
  const project = 'https://firebasestorage.googleapis.com/v0/b/mil-disculpis.firebasestorage.app/o/';
  const build = (url) => () =>
    sanitizeJerseyPayload({ type: 'plain', crestMode: 'uploaded', crestUrl: url }, { groupId: 'g1' });

  // Válidas: Firebase y el host de GCS, ambas dentro de team-crests/g1/.
  assert.equal(
    build(`${project}team-crests%2Fg1%2Fu%2Fcrest.png?alt=media&token=1`)().crestMode,
    'uploaded',
  );
  assert.equal(
    build('https://storage.googleapis.com/mil-disculpis.firebasestorage.app/team-crests/g1/u/c.png')().crestMode,
    'uploaded',
  );

  // Otro bucket, otra carpeta, otro grupo, http y escape con '..' se rechazan.
  const rejected = [
    'https://firebasestorage.googleapis.com/v0/b/otro-proyecto.appspot.com/o/team-crests%2Fg1%2Fu%2Fc.png',
    `${project}profile-images%2Fu%2Ffoto.png`,
    `${project}team-crests%2Fg2%2Fu%2Fc.png`,
    `${project}team-crests%2Fg1%2F..%2F..%2Fprofile-images%2Fu%2Ffoto.png`,
    'http://firebasestorage.googleapis.com/v0/b/mil-disculpis.firebasestorage.app/o/team-crests%2Fg1%2Fu%2Fc.png',
    'https://firebasestorage.googleapis.com.evil.example/v0/b/mil-disculpis.firebasestorage.app/o/team-crests%2Fg1%2Fu%2Fc.png',
  ];
  for (const url of rejected) {
    assert.throws(build(url), /Storage del proyecto/, url);
  }
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
  assert.equal(res.crestInitials, 'LOS');
  assert.equal(res.crestSubtitle, 'EST. 2026');
  assert.equal(res.crestTextLayout, 'auto');
  assert.equal(res.crestFont, 'classic');
  assert.equal(res.crestBorderColor, '#D97706');
  assert.equal(res.crestStars, 3);
  assert.equal(res.crestLaurel, true);
  assert.equal(res.crestCrownTop, true);
});
