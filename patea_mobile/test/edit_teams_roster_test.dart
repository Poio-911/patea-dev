import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/services/match_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/features/matches/widgets/edit_teams_sheet.dart';

class _MatchService extends MatchService {
  Map<String, int>? saved;
  final done = Completer<void>();
  @override
  Future<void> updateMatchTeams(
    String matchId,
    Map<String, int> assignments,
  ) async {
    saved = Map.of(assignments);
    await done.future;
  }
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });
  testWidgets(
    'editor incluye convocado omitido y congela reparto durante guardado',
    (tester) async {
      final a = MatchPlayerEntry(
        uid: 'a',
        displayName: 'Jugador A',
        ovr: 80,
        position: 'DEL',
      );
      final b = MatchPlayerEntry(
        uid: 'b',
        displayName: 'Jugador B',
        ovr: 60,
        position: 'DEF',
      );
      final c = MatchPlayerEntry(
        uid: 'c',
        displayName: 'Jugador C',
        ovr: 70,
        position: 'POR',
      );
      final service = _MatchService();
      final match = MatchModel(
        id: 'match',
        title: 'Partido',
        date: '2099-01-01',
        status: 'upcoming',
        type: 'manual',
        ownerUid: 'owner',
        playerUids: ['a', 'b', 'c'],
        players: [a, b, c],
        teamA: MatchTeam(name: 'A', playerIds: ['a'], players: [a]),
        teamB: MatchTeam(name: 'B', playerIds: ['b'], players: [b]),
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUidProvider.overrideWithValue('owner'),
            matchServiceProvider.overrideWithValue(service),
          ],
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: Scaffold(body: EditTeamsSheet(match: match)),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('Jugador C'), findsOneWidget);
      expect(find.textContaining('Diferencia de nivel medio:'), findsOneWidget);
      await tester.tap(find.text('Guardar equipos'));
      await tester.pump();
      expect(service.saved!.keys.toSet(), {'a', 'b', 'c'});
      final before = Map<String, int>.of(service.saved!);
      await tester.tap(find.text('Jugador A'));
      await tester.pump();
      expect(service.saved, before);
      // Dispose while request is pending: completion must not update a dead sheet.
      await tester.pumpWidget(const SizedBox());
      service.done.complete();
      await tester.pump();
      expect(tester.takeException(), isNull);
    },
  );
}
