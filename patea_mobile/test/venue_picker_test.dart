import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/models/venue_model.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/services/location_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/widgets/venue_picker_field.dart';

class _FakeLocationService extends LocationService {
  String? lastQuery;
  String? lastCountryCode;
  String? lastSessionToken;
  List<LocationSuggestion> results = const [];
  int suggestCalls = 0;

  @override
  Future<List<LocationSuggestion>> suggest(
    String query, {
    String? countryCode,
    String? sessionToken,
  }) async {
    suggestCalls++;
    lastQuery = query;
    lastCountryCode = countryCode;
    lastSessionToken = sessionToken;
    return results;
  }

  @override
  Future<LocationSuggestion> resolvePlace(
    LocationSuggestion suggestion, {
    String? sessionToken,
    String? groupId,
  }) async {
    return suggestion.copyWith(
      lat: -34.8941,
      lng: -56.1654,
      photoUrl: 'https://example.com/cached-venue.jpg',
    );
  }
}

void main() {
  group('VenueModel & MatchLocationModel', () {
    test('VenueModel.fromFirestore parses coordinates, photoUrl and converts to suggestion', () {
      final venue = VenueModel.fromFirestore({
        'groupId': 'g1',
        'name': 'Plaza Fútbol 5',
        'address': 'Av. Italia 2500, Montevideo',
        'location': {'lat': -34.89, 'lng': -56.15},
        'placeId': 'ChIJ123',
        'photoUrl': 'https://example.com/plaza.jpg',
        'usageCount': 4,
      }, 'g1_ChIJ123');

      expect(venue.id, 'g1_ChIJ123');
      expect(venue.name, 'Plaza Fútbol 5');
      expect(venue.photoUrl, 'https://example.com/plaza.jpg');
      expect(venue.usageCount, 4);

      final suggestion = venue.toSuggestion();
      expect(suggestion.name, 'Plaza Fútbol 5');
      expect(suggestion.address, 'Av. Italia 2500, Montevideo');
      expect(suggestion.photoUrl, 'https://example.com/plaza.jpg');
      expect(suggestion.placeId, 'ChIJ123');
    });

    test('MatchLocationModel preserves photoUrl in fromMap and toMap', () {
      final loc = MatchLocationModel.fromMap({
        'name': 'El Clásico',
        'address': 'Bvar. Artigas 1200',
        'lat': -34.9,
        'lng': -56.16,
        'placeId': 'ChIJ999',
        'photoUrl': 'https://example.com/clasico.jpg',
      });

      expect(loc.photoUrl, 'https://example.com/clasico.jpg');
      expect(loc.toMap()['photoUrl'], 'https://example.com/clasico.jpg');
    });
  });

  group('Country helpers', () {
    test('normalizeCountryCode validates ISO-2 codes', () {
      expect(normalizeCountryCode('uy'), 'UY');
      expect(normalizeCountryCode(' ar '), 'AR');
      expect(normalizeCountryCode(''), isNull);
      expect(normalizeCountryCode('URU'), isNull);
      expect(normalizeCountryCode(null), isNull);
    });

    test('findCountryOption resolves known countries and fallback', () {
      expect(findCountryOption('UY').name, 'Uruguay');
      expect(findCountryOption(null).name, 'Todos');
    });
  });

  group('VenuePickerField', () {
    testWidgets('reutiliza cancha del grupo sin llamar a suggest', (tester) async {
      final fakeService = _FakeLocationService();
      LocationSuggestion? picked;

      final savedVenue = VenueModel(
        id: 'g1_ChIJ123',
        groupId: 'g1',
        name: 'Plaza Fútbol 5',
        address: 'Av. Italia 2500',
        lat: -34.89,
        lng: -56.15,
        placeId: 'ChIJ123',
        usageCount: 3,
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            groupVenuesStreamProvider('g1').overrideWith(
              (ref) => Stream.value([savedVenue]),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.darkTheme,
            home: Scaffold(
              body: Padding(
                padding: const EdgeInsets.all(16),
                child: VenuePickerField(
                  groupId: 'g1',
                  defaultCountryCode: 'UY',
                  selected: picked,
                  onChanged: (v) => picked = v,
                  locationService: fakeService,
                ),
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Elegir de canchas guardadas (1)'), findsOneWidget);
      await tester.tap(find.text('Elegir de canchas guardadas (1)'));
      await tester.pumpAndSettle();

      expect(find.text('Plaza Fútbol 5'), findsOneWidget);
      expect(find.text('3x'), findsOneWidget);

      await tester.tap(find.text('Plaza Fútbol 5'));
      await tester.pumpAndSettle();

      expect(fakeService.suggestCalls, 0);
      expect(picked?.name, 'Plaza Fútbol 5');
      expect(picked?.placeId, 'ChIJ123');
    });

    testWidgets('busca con filtro de país y resuelve foto al elegir', (tester) async {
      final fakeService = _FakeLocationService()
        ..results = [
          LocationSuggestion(
            label: 'El Clásico Fútbol 5, Montevideo',
            name: 'El Clásico Fútbol 5',
            address: 'Av. Rivera 3100, Montevideo',
            lat: 0,
            lng: 0,
            placeId: 'ChIJ_clasico',
          ),
        ];
      LocationSuggestion? picked;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            groupVenuesStreamProvider('g1').overrideWith(
              (ref) => Stream.value(const []),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.darkTheme,
            home: Scaffold(
              body: Padding(
                padding: const EdgeInsets.all(16),
                child: VenuePickerField(
                  groupId: 'g1',
                  defaultCountryCode: 'UY',
                  selected: picked,
                  onChanged: (v) => picked = v,
                  locationService: fakeService,
                ),
              ),
            ),
          ),
        ),
      );

      expect(find.text('UY'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'clasico');
      await tester.pump(const Duration(milliseconds: 420));
      await tester.pumpAndSettle();

      expect(fakeService.suggestCalls, 1);
      expect(fakeService.lastQuery, 'clasico');
      expect(fakeService.lastCountryCode, 'UY');
      expect(fakeService.lastSessionToken, isNotEmpty);
      expect(find.text('El Clásico Fútbol 5'), findsOneWidget);

      await tester.tap(find.text('El Clásico Fútbol 5'));
      await tester.pumpAndSettle();

      expect(picked?.lat, -34.8941);
      expect(picked?.photoUrl, 'https://example.com/cached-venue.jpg');
    });
  });
}
