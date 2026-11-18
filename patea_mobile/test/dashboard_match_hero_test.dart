import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/features/dashboard/widgets/dashboard_match_hero.dart';

MatchModel game({bool paused = true, bool teams = true, bool goal = true, bool upcoming = false}) => MatchModel(
  id: 'broadcast', title: 'Clásico del barrio', date: '2099-11-17', time: '21:00',
  status: upcoming ? 'upcoming' : 'active', type: 'manual', currentMinute: 2,
  liveStatus: 'first_half', timerPaused: paused,
  periodStartTs: DateTime.now().subtract(const Duration(minutes: 4)),
  teamA: teams ? MatchTeam(name: 'Con chaleco', playerIds: [], score: 2) : null,
  teamB: teams ? MatchTeam(name: 'Sin chaleco', playerIds: [], score: 0) : null,
  matchSize: 0, playerUids: ['ana'],
  events: goal ? [MatchEvent(type: 'goal', playerId: 'ana', playerName: 'Ana', minute: 2)] : [],
);

void main() {
  setUp(() => GoogleFonts.config.allowRuntimeFetching = false);
  Future<void> mount(WidgetTester tester, MatchModel match, {double scale = 1}) async {
    tester.view.physicalSize = const Size(360, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, state) => Scaffold(body: SingleChildScrollView(
        child: Padding(padding: const EdgeInsets.all(16), child: DashboardMatchHero(match: match, isLive: match.status == 'active'))))),
      GoRoute(path: '/matches/:id/live', builder: (_, state) => const Scaffold(body: Text('Partido abierto'))),
      GoRoute(path: '/matches/:id', builder: (_, state) => const Scaffold(body: Text('Convocatoria abierta'))),
    ]);
    addTearDown(router.dispose);
    addTearDown(() => tester.pumpWidget(const SizedBox.shrink()));
    await tester.pumpWidget(MaterialApp.router(routerConfig: router, theme: AppTheme.darkTheme,
      builder: (_, child) => MediaQuery(data: MediaQueryData(textScaler: TextScaler.linear(scale)), child: child!)));
    await tester.pump(); await tester.pump(const Duration(milliseconds: 350));
  }
  testWidgets('Paused score, actual teams and last goal appear together; opens live view', (tester) async {
    await mount(tester, game());
    expect(find.text('2 : 0'), findsOneWidget);
    expect(find.text('02:00'), findsOneWidget);
    expect(find.text('En pausa'), findsOneWidget);
    expect(find.text('Con chaleco'), findsOneWidget);
    expect(find.text('2\' · Ana'), findsOneWidget);
    await tester.tap(find.text('Seguir el partido')); await tester.pumpAndSettle();
    expect(find.text('Partido abierto'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Running clock derives elapsed minutes instead of displaying the saved base', (tester) async {
    await mount(tester, game(paused: false));
    expect(find.text('06:00'), findsOneWidget);
    expect(find.text('Primer tiempo'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('No goal or missing teams never fabricate a score or last event at 1.3x', (tester) async {
    await mount(tester, game(teams: false, goal: false), scale: 1.3);
    expect(find.text('La convocatoria está abierta'), findsOneWidget);
    expect(find.text('2 : 0'), findsNothing);
    expect(find.textContaining('Gol registrado'), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Upcoming keeps countdown and opens the existing match detail', (tester) async {
    await mount(tester, game(upcoming: true), scale: 1.3);
    expect(find.text('Próximo partido'), findsOneWidget);
    expect(find.text('02:00'), findsNothing);
    await tester.tap(find.text('Ver convocatoria')); await tester.pumpAndSettle();
    expect(find.text('Convocatoria abierta'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
