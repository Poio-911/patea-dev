import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/services/match_result_service.dart';
import 'package:patea_mobile/features/dashboard/widgets/latest_match_review.dart';

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });
  final ana = MatchPlayerEntry(uid: 'ana', displayName: 'Ana', position: 'DEL');
  MatchModel match({bool confirmed = true}) => MatchModel(
    type: 'manual',
    id: 'review',
    title: 'Fecha del grupo',
    date: '2026-11-15',
    status: confirmed ? 'evaluated' : 'completed',
    hasFinalScore: confirmed,
    players: [ana],
    teamA: MatchTeam(
      name: 'Norte',
      players: [ana],
      playerIds: ['ana'],
      score: 2,
    ),
    teamB: MatchTeam(name: 'Sur', players: [], playerIds: [], score: 1),
    chronicle: confirmed
        ? const MatchChronicle(
            headline: 'Una fecha inolvidable',
            story: 'El relato guardado del encuentro.',
          )
        : null,
  );
  const stats = MatchResultStats(
    mvpId: 'ana',
    mvpVotes: 4,
    tallies: [
      MatchPlayerTally(playerId: 'ana', goals: 2, assists: 1, mvpVotes: 4),
    ],
  );

  Future<GoRouter> mount(
    WidgetTester tester,
    MatchModel fixture,
    Stream<MatchResultStats> stream,
  ) async {
    tester.view.physicalSize = const Size(360, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, state) => Scaffold(
            body: SingleChildScrollView(
              child: LatestMatchReview(match: fixture),
            ),
          ),
        ),
        GoRoute(
          path: '/players/:id',
          builder: (_, state) =>
              Scaffold(body: Text('Perfil ${state.pathParameters['id']}')),
        ),
        GoRoute(
          path: '/matches/:id',
          builder: (_, state) =>
              Scaffold(body: Text('Detalle ${state.pathParameters['id']}')),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          matchResultStatsProvider(fixture.id).overrideWith((ref) => stream),
        ],
        child: MaterialApp.router(
          routerConfig: router,
          builder: (_, child) => MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
            child: child!,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    return router;
  }

  testWidgets(
    'última fecha muestra resultado, figura, votos, goleadores y crónica reales',
    (tester) async {
      await mount(tester, match(), Stream.value(stats));
      expect(find.text('2 – 1'), findsOneWidget);
      expect(find.text('Figura del partido'), findsOneWidget);
      expect(find.text('4 votos'), findsOneWidget);
      expect(find.text('Goleadores'), findsOneWidget);
      expect(find.text('Una fecha inolvidable'), findsOneWidget);
      await tester.tap(find.text('Ana').first);
      await tester.pumpAndSettle();
      expect(find.text('Perfil ana'), findsOneWidget);
    },
  );

  testWidgets(
    'resultado sin confirmar y error de evaluaciones no inventan datos',
    (tester) async {
      await mount(
        tester,
        match(confirmed: false),
        Stream.error(Exception('offline')),
      );
      expect(find.text('2 – 1'), findsNothing);
      expect(find.text('Resultado pendiente de confirmación'), findsOneWidget);
      expect(find.text('Figura del partido'), findsNothing);
      expect(find.text('Goleadores'), findsNothing);
      expect(
        find.text('El resumen de evaluaciones no está disponible ahora.'),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'acceso del resumen abre el partido existente sin generar una crónica',
    (tester) async {
      await mount(tester, match(), Stream.value(stats));
      final action = find.text('Ver partido y crónica');
      await tester.ensureVisible(action);
      await tester.tap(action);
      await tester.pumpAndSettle();
      expect(find.text('Detalle review'), findsOneWidget);
    },
  );
}
