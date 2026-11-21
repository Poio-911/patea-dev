import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:patea_mobile/core/models/available_player_model.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/services/explore_service.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/services/match_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/utils/explore_filters.dart';
import 'package:patea_mobile/core/utils/availability_labels.dart';
import 'package:flutter/material.dart';
import 'package:patea_mobile/features/explorar/explorar_screen.dart';
import 'goldens/arnes.dart';

class SearchFake extends Fake implements ExploreService {
  final requests = <Completer<List<AvailablePlayerModel>>>[];
  final radii = <double>[];
  int invitations = 0;
  @override
  Future<int> sendMatchInvitations({
    required String matchId,
    required List<String> playerIds,
    String? message,
  }) async {
    invitations++;
    return playerIds.length;
  }

  @override
  Future<List<AvailablePlayerModel>> getAvailableLocalPlayers({
    required double lat,
    required double lng,
    double radiusInKm = 50,
    String? dayOfWeek,
    String? timeOfDay,
    List<String> matchPlayerUids = const [],
  }) {
    radii.add(radiusInKm);
    final request = Completer<List<AvailablePlayerModel>>();
    requests.add(request);
    return request.future;
  }
}

class InvitationStoreFake extends Fake implements FirestoreService {
  @override
  Future<bool> hasPendingMatchInvitation(
    String matchId,
    String playerId,
  ) async => false;
}

class JoinFake extends Fake implements MatchService {
  int calls = 0;
  final request = Completer<bool>();
  @override
  Future<bool> joinOrRequest(MatchModel match, String uid) {
    calls++;
    return request.future;
  }
}

MatchModel fixture({
  String id = 'public',
  String? owner = 'host',
  String type = 'manual',
  String date = '2099-11-17',
  String? time = '21:00',
  String status = 'upcoming',
  List<String> players = const ['host'],
  List<String> pending = const [],
  int size = 10,
}) => MatchModel(
  id: id,
  title: 'Partido para probar',
  date: date,
  time: time,
  status: status,
  type: type,
  ownerUid: owner,
  playerUids: players,
  pendingPlayerUids: pending,
  matchSize: size,
  location: 'Cancha Centro',
  locationDetail: MatchLocationModel(
    name: 'Cancha Centro',
    lat: -34.9011,
    lng: -56.1645,
  ),
);

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({});
  });
  final now = DateTime(2026, 11, 16, 20);
  test('availability is grouped chronologically without repeated badges', () {
    expect(
      availabilitySummary({
        'jueves': ['noche'],
        'miércoles': ['noche'],
      }),
      'Mié y Jue · Noche',
    );
    expect(
      availabilityDescriptions({
        'jueves': ['noche'],
        'miércoles': ['noche'],
      }),
      ['Miércoles y jueves por la noche.'],
    );
    expect(
      availabilitySummary({
        for (final day in [
          'lunes',
          'martes',
          'miercoles',
          'jueves',
          'viernes',
          'sabado',
          'domingo',
        ])
          day: ['mañana', 'tarde', 'noche'],
      }),
      'Todos los días · Cualquier horario',
    );
    expect(
      availabilityDescriptions({
        'lunes': [],
        '': ['noche'],
      }),
      isEmpty,
    );
    expect(
      availabilitySummary({
        'lunes': ['mañana'],
        'jueves': ['noche'],
      }),
      'Lun y Jue · Horarios variados',
    );
  });
  test(
    'Today uses kickoff, not midnight; expired or active games are excluded',
    () {
      expect(
        isDiscoverableFuture(fixture(date: '2026-11-16', time: '21:00'), now),
        isTrue,
      );
      expect(
        isDiscoverableFuture(fixture(date: '2026-11-16', time: '19:00'), now),
        isFalse,
      );
      expect(isDiscoverableFuture(fixture(status: 'active'), now), isFalse);
      expect(isDiscoverableFuture(fixture(date: 'invalid'), now), isFalse);
    },
  );
  test('Recruitment requires ownership and remaining capacity', () {
    expect(canRecruitFor(fixture(owner: uidYo), uidYo, now), isTrue);
    expect(canRecruitFor(fixture(players: [uidYo]), uidYo, now), isFalse);
    expect(
      canRecruitFor(
        fixture(owner: uidYo, size: 1, players: [uidYo]),
        uidYo,
        now,
      ),
      isFalse,
    );
    expect(canRecruitFor(fixture(owner: uidYo, size: 0), uidYo, now), isTrue);
  });
  test(
    'Public discovery excludes own games and retains joined/pending full games',
    () {
      expect(
        isPublicDiscoveryMatch(fixture(owner: uidYo), uidYo, now),
        isFalse,
      );
      expect(isPublicDiscoveryMatch(fixture(size: 1), uidYo, now), isFalse);
      expect(
        isPublicDiscoveryMatch(fixture(size: 1, pending: [uidYo]), uidYo, now),
        isTrue,
      );
      expect(
        isPublicDiscoveryMatch(fixture(size: 1, players: [uidYo]), uidYo, now),
        isTrue,
      );
    },
  );
  test('Distance measures the selected zone accurately', () {
    expect(discoveryDistance(-34.9, -56.16, -34.9, -56.16), 0);
    expect(discoveryDistance(-34.9, -56.16, -34.8, -56.16), closeTo(11.12, .1));
  });

  Future<void> mount(
    WidgetTester tester,
    SearchFake search, {
    List<MatchModel> games = const [],
    List<MatchModel> owned = const [],
    JoinFake? join,
  }) async {
    final errors = await montarPantalla(
      tester,
      const ExplorarScreen(),
      tema: AppTheme.darkTheme,
      extraOverrides: [
        exploreServiceProvider.overrideWithValue(search),
        firestoreServiceProvider.overrideWithValue(InvitationStoreFake()),
        publicMatchesStreamProvider.overrideWith((ref) => Stream.value(games)),
        ownedUpcomingMatchesProvider(
          uidYo,
        ).overrideWith((ref) => Stream.value(owned)),
        if (join != null) matchServiceProvider.overrideWithValue(join),
      ],
    );
    expect(errors, isEmpty);
  }

  Future<void> tapVisible(WidgetTester tester, Finder finder) async {
    await tester.ensureVisible(finder);
    await tester.pump();
    await tester.tap(finder);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
  }

  testWidgets(
    'player detail explains availability and chooses a match before inviting',
    (tester) async {
      final search = SearchFake();
      await mount(tester, search, owned: [fixture(owner: uidYo)]);
      search.requests.single.complete([
        AvailablePlayerModel(
          uid: 'guest',
          displayName: 'Roberto P.',
          position: 'POR',
          ovr: 57,
          availability: {
            'jueves': ['noche'],
            'miercoles': ['noche'],
          },
        ),
      ]);
      await tester.pump();
      expect(find.text('Tu disponibilidad'), findsOneWidget);
      await tapVisible(tester, find.text('Roberto P.'));
      expect(find.text('Miércoles y jueves por la noche.'), findsOneWidget);
      await tapVisible(tester, find.text('Elegir partido para invitar'));
      expect(find.text('Elegí tu partido'), findsOneWidget);
      await tapVisible(tester, find.textContaining('Partido para probar').last);
      expect(find.text('Enviar invitación'), findsOneWidget);
      expect(search.invitations, 0);
      await tapVisible(tester, find.text('Volver'));
      expect(search.invitations, 0);
    },
  );

  testWidgets(
    'Browsing works without an owned match and stale searches cannot replace new results',
    (tester) async {
      final search = SearchFake();
      await mount(tester, search);
      expect(search.requests.length, 1);
      await tapVisible(tester, find.byTooltip('Distancia de búsqueda').first);
      await tapVisible(
        tester,
        find.widgetWithText(CheckedPopupMenuItem<double>, 'Hasta 30 km'),
      );
      await tester.pump();
      expect(search.radii, [15, 30]);
      search.requests.last.complete([
        AvailablePlayerModel(
          uid: 'new',
          displayName: 'Resultado nuevo',
          position: 'DEF',
        ),
      ]);
      await tester.pump();
      search.requests.first.complete([
        AvailablePlayerModel(uid: 'old', displayName: 'Resultado viejo'),
      ]);
      await tester.pump();
      expect(find.text('Resultado nuevo'), findsOneWidget);
      expect(find.text('Resultado viejo'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'selected recruitment context is visible before confirming an invitation',
    (tester) async {
      final search = SearchFake();
      final guest = AvailablePlayerModel(
        uid: 'guest',
        displayName: 'Roberto P.',
        position: 'POR',
        ovr: 57,
        availability: {
          'jueves': ['noche'],
        },
      );
      await mount(tester, search, owned: [fixture(owner: uidYo)]);
      search.requests.single.complete([guest]);
      await tester.pump();
      await tapVisible(tester, find.byType(DropdownButton<String>));
      await tapVisible(tester, find.text('Partido para probar').last);
      expect(search.requests, hasLength(2));
      search.requests.last.complete([guest]);
      await tester.pump();
      await tapVisible(tester, find.text('Roberto P.'));
      expect(find.text('Tu convocatoria'), findsOneWidget);
      await tapVisible(tester, find.text('Invitar a Partido para probar'));
      expect(find.text('Elegí tu partido'), findsNothing);
      expect(find.text('Enviar invitación'), findsOneWidget);
      expect(search.invitations, 0);
      await tapVisible(tester, find.text('Volver'));
      expect(search.invitations, 0);
    },
  );
  testWidgets(
    'Search errors offer retry instead of a misleading empty result',
    (tester) async {
      final search = SearchFake();
      await mount(tester, search);
      search.requests.single.completeError(StateError('offline'));
      await tester.pump();
      expect(
        find.text('No pudimos buscar jugadores. Volvé a intentar.'),
        findsOneWidget,
      );
      await tapVisible(tester, find.text('Reintentar'));
      expect(search.requests.length, 2);
      search.requests.last.complete([]);
      await tester.pump();
      expect(
        find.text('Todavía no hay jugadores en esta zona'),
        findsOneWidget,
      );
    },
  );
  testWidgets('Partidos permite filtrar por ingreso y restablecer', (
    tester,
  ) async {
    final search = SearchFake();
    await mount(tester, search, games: [fixture()]);
    search.requests.single.complete([]);
    await tester.pump();
    await tapVisible(tester, find.text('Partidos').first);
    expect(find.text('1 partido para jugar'), findsOneWidget);

    await tapVisible(tester, find.byTooltip('Ingreso'));
    await tapVisible(
      tester,
      find.widgetWithText(CheckedPopupMenuItem<String>, 'Ingreso directo'),
    );
    expect(find.text('0 partidos para jugar'), findsOneWidget);

    await tapVisible(tester, find.text('Restablecer filtros'));
    expect(find.text('1 partido para jugar'), findsOneWidget);
  });

  testWidgets(
    'Request requires review, cancellation sends nothing, and confirmed request is retained',
    (tester) async {
      final search = SearchFake();
      final join = JoinFake();
      await mount(tester, search, games: [fixture()], join: join);
      search.requests.single.complete([]);
      await tester.pump();
      await tapVisible(tester, find.text('Partidos').first);
      await tapVisible(tester, find.text('Solicitar'));
      expect(join.calls, 0);
      expect(
        find.textContaining('Todavía no ocupás un lugar.'),
        findsOneWidget,
      );
      await tapVisible(tester, find.text('Volver'));
      expect(join.calls, 0);
      await tapVisible(tester, find.text('Solicitar'));
      await tapVisible(tester, find.text('Enviar solicitud'));
      expect(join.calls, 1);
      join.request.complete(true);
      await tester.pump();
      expect(find.text('Pedido enviado'), findsOneWidget);
      expect(find.text('Partido para probar'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'Direct join has its own explanation and preserves a joined status',
    (tester) async {
      final search = SearchFake();
      final join = JoinFake();
      await mount(
        tester,
        search,
        games: [fixture(type: 'collaborative')],
        join: join,
      );
      search.requests.single.complete([]);
      await tester.pump();
      await tapVisible(tester, find.text('Partidos').first);
      await tapVisible(tester, find.text('Unirme'));
      expect(find.textContaining('Vas a ocupar un lugar'), findsOneWidget);
      expect(join.calls, 0);
      await tapVisible(tester, find.text('Confirmar'));
      expect(join.calls, 1);
      join.request.complete(false);
      await tester.pump();
      expect(find.text('Ya participás'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  for (final theme in [AppTheme.darkTheme, AppTheme.lightTheme]) {
    testWidgets(
      'player discovery and invitation stay readable at 2x in ${theme.brightness}',
      (tester) async {
        final search = SearchFake();
        final errors = await montarPantalla(
          tester,
          const ExplorarScreen(),
          tema: theme,
          escala: 2,
          extraOverrides: [
            exploreServiceProvider.overrideWithValue(search),
            ownedUpcomingMatchesProvider(
              uidYo,
            ).overrideWith((ref) => Stream.value([])),
          ],
        );
        expect(errors, isEmpty);
        search.requests.single.complete([
          AvailablePlayerModel(
            uid: 'guest',
            displayName: 'Roberto Fernández',
            position: 'POR',
            ovr: 57,
            distanceKm: 0.3,
            availability: {
              'miercoles': ['noche'],
              'jueves': ['noche'],
            },
          ),
        ]);
        await tester.pump();
        await tapVisible(tester, find.text('Roberto Fernández'));
        expect(find.text('Miércoles y jueves por la noche.'), findsOneWidget);
        await tester.ensureVisible(find.text('Elegir partido para invitar'));
        expect(tester.takeException(), isNull);
      },
    );
    testWidgets(
      'Public discovery remains readable at 1.3x in ${theme.brightness}',
      (tester) async {
        final search = SearchFake();
        final errors = await montarPantalla(
          tester,
          ProviderScope(
            overrides: [
              exploreServiceProvider.overrideWithValue(search),
              publicMatchesStreamProvider.overrideWith(
                (ref) => Stream.value([
                  fixture(pending: [uidYo], size: 1),
                ]),
              ),
            ],
            child: const ExplorarScreen(),
          ),
          tema: theme,
          escala: 1.3,
        );
        expect(errors, isEmpty);
        search.requests.single.complete([]);
        await tester.pump();
        await tapVisible(tester, find.text('Partidos').first);
        await tester.ensureVisible(find.text('Pedido enviado'));
        await tester.pump();
        expect(find.text('Pedido enviado'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
