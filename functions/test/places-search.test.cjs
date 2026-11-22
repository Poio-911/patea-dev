const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildNominatimUri,
  normalizeCountryCode,
  parseGoogleAutocompleteSuggestions,
  parseGooglePlaceDetails,
  venueDocId,
} = require('../lib/lib/places-search');

test('normalizeCountryCode valida códigos ISO-2 y descarta inválidos', () => {
  assert.equal(normalizeCountryCode('UY'), 'uy');
  assert.equal(normalizeCountryCode(' ar '), 'ar');
  assert.equal(normalizeCountryCode('uru'), null);
  assert.equal(normalizeCountryCode('12'), null);
  assert.equal(normalizeCountryCode(''), null);
  assert.equal(normalizeCountryCode(null), null);
});

test('buildNominatimUri aplica countrycodes cuando está presente', () => {
  const withCountry = buildNominatimUri('Complejo Parque', 'uy');
  assert.ok(withCountry.includes('countrycodes=uy'));
  assert.ok(withCountry.includes('q=Complejo+Parque'));

  const withoutCountry = buildNominatimUri('Complejo Parque', null);
  assert.equal(withoutCountry.includes('countrycodes='), false);
});

test('parseGoogleAutocompleteSuggestions extrae nombre, dirección y placeId', () => {
  const parsed = parseGoogleAutocompleteSuggestions({
    suggestions: [
      {
        placePrediction: {
          placeId: 'ChIJ123',
          text: { text: 'El Clásico Fútbol 5 Montevideo, Dr. Alejandro Gallinal, Montevideo' },
          structuredFormat: {
            mainText: { text: 'El Clásico Fútbol 5 Montevideo' },
            secondaryText: { text: 'Dr. Alejandro Gallinal, Montevideo, Uruguay' },
          },
        },
      },
      { queryPrediction: { text: { text: 'ignorar' } } },
    ],
  });

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].placeId, 'ChIJ123');
  assert.equal(parsed[0].name, 'El Clásico Fútbol 5 Montevideo');
  assert.equal(parsed[0].address, 'Dr. Alejandro Gallinal, Montevideo, Uruguay');
  assert.ok(parsed[0].label.includes('El Clásico Fútbol 5 Montevideo'));
});

test('parseGooglePlaceDetails extrae coordenadas y primera foto', () => {
  const details = parseGooglePlaceDetails({
    id: 'ChIJ123',
    displayName: { text: 'Plaza Fútbol 5' },
    formattedAddress: 'Av. Rivera 3200, Montevideo, Uruguay',
    location: { latitude: -34.9011, longitude: -56.1645 },
    photos: [{ name: 'places/ChIJ123/photos/abc' }],
  });

  assert.ok(details);
  assert.equal(details.placeId, 'ChIJ123');
  assert.equal(details.name, 'Plaza Fútbol 5');
  assert.equal(details.lat, -34.9011);
  assert.equal(details.lng, -56.1645);
  assert.equal(details.photoName, 'places/ChIJ123/photos/abc');

  assert.equal(parseGooglePlaceDetails({ id: 'x', location: { latitude: 0, longitude: 0 } }), null);
});

test('venueDocId es determinístico por grupo + placeId o coordenadas', () => {
  const a = venueDocId('grp-1', 'ChIJ123', 'Plaza 5', -34.9, -56.1);
  const b = venueDocId('grp-1', 'ChIJ123', 'Otro nombre', -34.9, -56.1);
  const c = venueDocId('grp-2', 'ChIJ123', 'Plaza 5', -34.9, -56.1);
  assert.equal(a, b);
  assert.notEqual(a, c);
});
