import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/services/auth_service.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/services/match_clips_service.dart';
import 'package:patea_mobile/core/services/match_result_service.dart';
import 'package:patea_mobile/features/matches/match_detail_screen.dart';

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  final playerA1 = MatchPlayerEntry(uid: 'uid-a1', displayName: 'Lucas Silva', ovr: 80, position: 'DEL');
  final playerA2 = MatchPlayerEntry(uid: 'uid-a2', displayName: 'Mateo Rossi', ovr: 74, position: 'MED');
  final playerB1 = MatchPlayerEntry(uid: 'uid-b1', displayName: 'Nico Gomez', ovr: 78, position: 'DEF');
  final playerB2 = MatchPlayerEntry(uid: 'uid-b2', displayName: 'Julian Alvarez', ovr: 84, position: 'DEL');

  final teamA = MatchTeam(name: 'Los Galácticos', playerIds: ['uid-a1', 'uid-a2'], players: [playerA1, playerA2], score: 4);
  final teamB = MatchTeam(name: 'La Furia', playerIds: ['uid-b1', 'uid-b2'], players: [playerB1, playerB2], score: 2);

  testWidgets('Detalle de Partido: Partido upcoming renderiza Hero Broadcast, Sticky Action Bar y OVR promedio', (tester) async {
    tester.view.physicalSize = const Size(1080, 2424);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    final upcomingMatch = MatchModel(
      id: 'match-upcoming-1',
      title: 'Clásico del Barrio',
      date: '2026-03-10',
      time: '21:30',
      status: 'upcoming',
      type: 'manual',
      matchSize: 10,
      players: [playerA1, playerA2, playerB1, playerB2],
      playerUids: ['uid-a1', 'uid-a2', 'uid-b1', 'uid-b2'],
      teamA: teamA,
      teamB: teamB,
      location: 'Cancha 5 Prado',
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          singleMatchStreamProvider('match-upcoming-1').overrideWith((ref) => Stream.value(upcomingMatch)),
          authStateProvider.overrideWith((ref) => Stream.value(null)),
          matchClipsProvider('match-upcoming-1').overrideWith((ref) => Stream.value([])),
        ],
        child: const MaterialApp(
          home: MatchDetailScreen(matchId: 'match-upcoming-1'),
        ),
      ),
    );
    await tester.pump();

    expect(tester.takeException(), isNull);
    // El título va dos veces: en el hero y en el AppBar, que lo revela al
    // hacer scroll. Sin scroll el del AppBar está montado con opacidad 0.
    expect(find.text('CLÁSICO DEL BARRIO'), findsNWidgets(2));
    expect(find.text('AMISTOSO'), findsOneWidget);
    expect(find.text('Cancha 5 Prado'), findsOneWidget);
    expect(find.text('LOS GALÁCTICOS'), findsWidgets);
    expect(find.text('LA FURIA'), findsWidgets);
    // Team avg OVR
    expect(find.text('OVR PROM. 77.0'), findsOneWidget);
    expect(find.text('OVR PROM. 81.0'), findsOneWidget);
    // Sticky Action Bar
    expect(find.text('ANOTARME AL PARTIDO'), findsOneWidget);
  });

  testWidgets('Detalle de Partido: Partido completed muestra estado y boton EVALUAR PARTIDO', (tester) async {
    tester.view.physicalSize = const Size(1080, 2424);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    final completedMatch = MatchModel(
      id: 'match-completed-1',
      title: 'Final de Copa',
      date: '2026-03-05',
      time: '20:00',
      status: 'completed',
      type: 'collaborative',
      hasFinalScore: false,
      matchSize: 10,
      players: [playerA1, playerA2, playerB1, playerB2],
      playerUids: ['uid-a1', 'uid-a2', 'uid-b1', 'uid-b2'],
      teamA: teamA,
      teamB: teamB,
      location: 'Complejo Central',
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          singleMatchStreamProvider('match-completed-1').overrideWith((ref) => Stream.value(completedMatch)),
          authStateProvider.overrideWith((ref) => Stream.value(null)),
          matchClipsProvider('match-completed-1').overrideWith((ref) => Stream.value([])),
        ],
        child: const MaterialApp(
          home: MatchDetailScreen(matchId: 'match-completed-1'),
        ),
      ),
    );
    await tester.pump();

    expect(tester.takeException(), isNull);
    // El título va dos veces: en el hero y en el AppBar, que lo revela al
    // hacer scroll. Sin scroll el del AppBar está montado con opacidad 0.
    expect(find.text('FINAL DE COPA'), findsNWidgets(2));
    expect(find.text('Complejo Central'), findsOneWidget);
    expect(find.text('EVALUAR PARTIDO'), findsOneWidget);
  });

  testWidgets('Detalle de Partido: Partido evaluated muestra marcador final con ganador destacado y badges', (tester) async {
    tester.view.physicalSize = const Size(1080, 2424);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    final evaluatedMatch = MatchModel(
      id: 'match-evaluated-1',
      title: 'Semifinal Liga',
      date: '2026-03-01',
      time: '19:00',
      status: 'evaluated',
      type: 'manual',
      hasFinalScore: true,
      matchSize: 10,
      bestPlayerId: 'uid-a1',
      events: [
        MatchEvent(type: 'goal', playerId: 'uid-a1', playerName: 'Lucas Silva', minute: 12),
        MatchEvent(type: 'goal', playerId: 'uid-a1', playerName: 'Lucas Silva', minute: 34),
        MatchEvent(type: 'card', playerId: 'uid-b1', playerName: 'Nico Gomez', minute: 25, cardType: 'yellow'),
      ],
      players: [playerA1, playerA2, playerB1, playerB2],
      playerUids: ['uid-a1', 'uid-a2', 'uid-b1', 'uid-b2'],
      teamA: teamA,
      teamB: teamB,
      location: 'Cancha 1',
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          singleMatchStreamProvider('match-evaluated-1').overrideWith((ref) => Stream.value(evaluatedMatch)),
          authStateProvider.overrideWith((ref) => Stream.value(null)),
          matchResultStatsProvider('match-evaluated-1').overrideWith((ref) => Stream.value(MatchResultStats.empty)),
          matchClipsProvider('match-evaluated-1').overrideWith((ref) => Stream.value([])),
        ],
        child: const MaterialApp(
          home: MatchDetailScreen(matchId: 'match-evaluated-1'),
        ),
      ),
    );
    await tester.pump();

    expect(tester.takeException(), isNull);
    // Marcador final en el Hero
    expect(find.text('4'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    // Badges en el jugador
    expect(find.text('FIGURA'), findsOneWidget);
    expect(find.text('⚽ 2'), findsOneWidget);
    expect(find.text('🟨'), findsOneWidget);
    // Minuto a minuto integrado presente
    expect(find.text('MINUTO A MINUTO'), findsOneWidget);
  });
}
