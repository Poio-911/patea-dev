const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../lib/lib/competition-extras');

test('colección e id: solo ligas y copas, sin barras', () => {
  assert.equal(c.parseCollection('leagues'), 'leagues');
  assert.equal(c.parseCollection('cups'), 'cups');
  for (const bad of ['users', '', null, undefined, 'leagues/x']) assert.equal(c.parseCollection(bad), null);
  assert.equal(c.safeId('abc_123'), 'abc_123');
  for (const bad of ['', 'a/b', 'x'.repeat(151), 5, null]) assert.equal(c.safeId(bad), null);
});

test('aviso: limpia, respeta saltos de línea y exige lo mínimo', () => {
  const m = c.normalizeMessage('  Cambio   de cancha ', 'Jugamos en\n\n\n\nla  otra cancha.  ', 'all');
  assert.deepEqual(m, { subject: 'Cambio de cancha', body: 'Jugamos en\n\nla otra cancha.', audience: 'all' });
  assert.throws(() => c.normalizeMessage('ab', 'hola que tal', 'all'), /asunto/);
  assert.throws(() => c.normalizeMessage('Asunto', '  ', 'all'), /mensaje/);
  assert.throws(() => c.normalizeMessage('Asunto', 'cuerpo', 'todos'), /a quién/);
  assert.throws(() => c.normalizeMessage(null, 'cuerpo', 'all'));
  const largo = c.normalizeMessage('x'.repeat(200), 'y'.repeat(2000), 'captains');
  assert.equal(largo.subject.length, c.MESSAGE_LIMITS.subject);
  assert.equal(largo.body.length, c.MESSAGE_LIMITS.body);
});

test('aviso: tope por hora', () => {
  assert.equal(c.canSendAnother(0), true);
  assert.equal(c.canSendAnother(c.MESSAGE_LIMITS.perHour - 1), true);
  assert.equal(c.canSendAnother(c.MESSAGE_LIMITS.perHour), false);
});

test('destinatarios: todos los del plantel o solo quienes crearon el equipo', () => {
  const teams = [
    { createdBy: 'cap1', members: [{ playerId: 'p1' }, { playerId: 'p2' }, { playerId: 'cap1' }] },
    { createdBy: 'cap2', ownerUid: 'cap2', members: [{ playerId: 'p2' }, 'p3', { playerId: 'a/b' }, {}] },
    null,
  ];
  assert.deepEqual(c.candidateRecipients(teams, 'all').sort(), ['cap1', 'cap2', 'p1', 'p2', 'p3']);
  assert.deepEqual(c.candidateRecipients(teams, 'captains').sort(), ['cap1', 'cap2']);
  assert.deepEqual(c.candidateRecipients([], 'all'), []);
});

test('sede: nombre obligatorio, números acotados y lo vacío no se guarda', () => {
  assert.deepEqual(c.normalizeVenue({ name: '  Cancha 1 ' }), { name: 'Cancha 1' });
  assert.deepEqual(
    c.normalizeVenue({ name: 'Club', address: 'Av. 18 de Julio 1234', capacity: '120.4', costPerMatch: 1500.555, notes: 'Vestuarios' }),
    { name: 'Club', address: 'Av. 18 de Julio 1234', capacity: 120, costPerMatch: 1500.56, notes: 'Vestuarios' },
  );
  assert.deepEqual(c.normalizeVenue({ name: 'Club', capacity: '', costPerMatch: null }), { name: 'Club' });
  assert.throws(() => c.normalizeVenue({ name: 'x' }), /nombre/);
  assert.throws(() => c.normalizeVenue(null), /nombre/);
  assert.throws(() => c.normalizeVenue({ name: 'Club', capacity: -1 }), /capacidad/);
  assert.throws(() => c.normalizeVenue({ name: 'Club', costPerMatch: 'mucho' }), /costo/);
  assert.throws(() => c.normalizeVenue({ name: 'Club', costPerMatch: 2_000_000 }), /costo/);
});

test('patrocinador: nombre y enlace https', () => {
  assert.deepEqual(c.normalizeSponsor({ name: ' Pizzería  Don Pepe ' }), { name: 'Pizzería Don Pepe' });
  assert.deepEqual(c.normalizeSponsor({ name: 'Don Pepe', websiteUrl: 'https://donpepe.com.uy/menu' }), {
    name: 'Don Pepe',
    websiteUrl: 'https://donpepe.com.uy/menu',
  });
  assert.deepEqual(c.normalizeSponsor({ name: 'Don Pepe', websiteUrl: '  ' }), { name: 'Don Pepe' });
  assert.throws(() => c.normalizeSponsor({ name: 'a' }), /nombre/);
  for (const bad of ['http://donpepe.com', 'javascript:alert(1)', 'https://u:p@donpepe.com', 'donpepe', 'https://localhost', 'https://' + 'a'.repeat(200) + '.com']) {
    assert.throws(() => c.normalizeSponsor({ name: 'Don Pepe', websiteUrl: bad }), /enlace/, bad);
  }
});
