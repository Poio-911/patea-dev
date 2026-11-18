const test = require('node:test');
const assert = require('node:assert/strict');
const {
  IMAGE_MODEL_CANDIDATES,
  PROMPT,
  parseSourcePhotoUrl,
  isAiGeneratedPhotoUrl,
  buildHttpsPhotoCandidates,
  resolveInitialPhotoUrl,
  extractGeneratedImage,
} = require('../lib/callable/generate-player-photo');

test('usa modelos Vertex AI priorizando Nano Banana 2.1 con fallback Pro', () => {
  assert.deepEqual([...IMAGE_MODEL_CANDIDATES], [
    'gemini-nano-banana-2.1',
    'gemini-3-pro-image',
  ]);
  assert.match(PROMPT, /exact apparent age/i);
  assert.match(PROMPT, /Do not add or deepen forehead creases/i);
  assert.doesNotMatch(PROMPT, /not a direct copy/i);
});

test('isAiGeneratedPhotoUrl y buildHttpsPhotoCandidates detectan generadas y suben miniatura de Google', () => {
  assert.equal(
    isAiGeneratedPhotoUrl(
      'https://firebasestorage.googleapis.com/v0/b/b/o/profile-images%2Fuid%2Fgenerated_1700.png?alt=media',
    ),
    true,
  );
  assert.equal(
    isAiGeneratedPhotoUrl('https://firebasestorage.googleapis.com/v0/b/b/o/profile-images%2Fuid%2Favatar.jpg'),
    false,
  );
  assert.deepEqual(
    buildHttpsPhotoCandidates('https://lh3.googleusercontent.com/a/ACg8ocTest=s96-c'),
    [
      'https://lh3.googleusercontent.com/a/ACg8ocTest=s512-c',
      'https://lh3.googleusercontent.com/a/ACg8ocTest=s96-c',
    ],
  );
  assert.deepEqual(
    buildHttpsPhotoCandidates('https://lh3.googleusercontent.com/a/ACg8ocTest=s1024-c'),
    ['https://lh3.googleusercontent.com/a/ACg8ocTest=s1024-c'],
  );
});

test('parseSourcePhotoUrl extrae rutas de Firebase Storage y URLs de Google', () => {
  assert.deepEqual(
    parseSourcePhotoUrl(
      'https://firebasestorage.googleapis.com/v0/b/mil-disculpis.firebasestorage.app/o/profile-images%2Fuid%2Ffoto.jpg?alt=media&token=abc',
      'mil-disculpis.firebasestorage.app',
    ),
    { kind: 'storage', path: 'profile-images/uid/foto.jpg' },
  );

  assert.deepEqual(
    parseSourcePhotoUrl(
      'https://lh3.googleusercontent.com/a/ACg8ocTest=s96-c',
      'mil-disculpis.firebasestorage.app',
    ),
    { kind: 'https', url: 'https://lh3.googleusercontent.com/a/ACg8ocTest=s96-c' },
  );

  assert.deepEqual(
    parseSourcePhotoUrl(
      'https://firebasestorage.googleapis.com/v0/b/mil-disculpis.appspot.com/o/profile-images%2Fuid%2Flegacy.jpg?alt=media',
      'mil-disculpis.firebasestorage.app',
    ),
    { kind: 'storage', path: 'profile-images/uid/legacy.jpg' },
  );

  assert.throws(
    () =>
      parseSourcePhotoUrl(
        'https://firebasestorage.googleapis.com/v0/b/evil-bucket.firebasestorage.app/o/secret.jpg',
        'mil-disculpis.firebasestorage.app',
      ),
    /No se pudo leer/,
  );

  assert.throws(
    () => parseSourcePhotoUrl('https://evil.example/photo.png', 'mil-disculpis.firebasestorage.app'),
    /Subí una foto tuya/,
  );
  assert.throws(
    () => parseSourcePhotoUrl('http://lh3.googleusercontent.com/a/insecure', 'mil-disculpis.firebasestorage.app'),
    /no es válida/,
  );
});

test('resolveInitialPhotoUrl respalda con users y Firebase Auth si players no tiene foto', () => {
  assert.equal(
    resolveInitialPhotoUrl({
      player: { photoUrl: '   ', photoURL: '' },
      userData: { photoURL: '' },
      tokenPicture: 'https://lh3.googleusercontent.com/a/token-pic',
      authPhotoUrl: 'https://lh3.googleusercontent.com/a/auth-pic',
    }),
    'https://lh3.googleusercontent.com/a/token-pic',
  );

  assert.equal(
    resolveInitialPhotoUrl({
      player: {},
      userData: null,
      tokenPicture: undefined,
      authPhotoUrl: ' https://lh3.googleusercontent.com/a/auth-pic ',
    }),
    'https://lh3.googleusercontent.com/a/auth-pic',
  );

  assert.equal(
    resolveInitialPhotoUrl({
      player: { photoURL: 'https://firebasestorage.googleapis.com/v0/b/b/o/p.jpg' },
      userData: { photoURL: 'https://lh3.googleusercontent.com/a/user-pic' },
      tokenPicture: 'https://lh3.googleusercontent.com/a/token-pic',
    }),
    'https://firebasestorage.googleapis.com/v0/b/b/o/p.jpg',
  );

  assert.equal(
    resolveInitialPhotoUrl({
      player: {
        photoUrl: 'https://firebasestorage.googleapis.com/v0/b/b/o/profile-images%2Fu%2Fgenerated_2.png',
        aiSourcePhotoUrl: 'https://lh3.googleusercontent.com/a/original-face=s96-c',
      },
      userData: {},
    }),
    'https://lh3.googleusercontent.com/a/original-face=s96-c',
  );

  assert.equal(
    resolveInitialPhotoUrl({
      player: {
        photoUrl: 'https://firebasestorage.googleapis.com/v0/b/b/o/profile-images%2Fu%2Fnew-upload.jpg',
        aiSourcePhotoUrl: 'https://lh3.googleusercontent.com/a/old-face=s96-c',
      },
      userData: {},
    }),
    'https://firebasestorage.googleapis.com/v0/b/b/o/profile-images%2Fu%2Fnew-upload.jpg',
  );

  assert.equal(
    resolveInitialPhotoUrl({
      player: {},
      userData: {},
    }),
    '',
  );
});

test('extractGeneratedImage prioriza imagen final no-thought y falla si no hay datos', () => {
  const draft = Buffer.from('draft').toString('base64');
  const finalImg = Buffer.from('final').toString('base64');
  const out = extractGeneratedImage({
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [
            { text: 'Borrador' },
            { thought: true, inlineData: { data: draft, mimeType: 'image/png' } },
            { inlineData: { data: finalImg, mimeType: 'image/jpeg' } },
          ],
        },
      },
    ],
  });
  assert.equal(out.mimeType, 'image/jpeg');
  assert.equal(out.data.toString(), 'final');

  assert.throws(
    () =>
      extractGeneratedImage({
        candidates: [{ finishReason: 'IMAGE_SAFETY', content: { parts: [{ text: 'blocked' }] } }],
      }),
    /finishReason: IMAGE_SAFETY/,
  );
});
