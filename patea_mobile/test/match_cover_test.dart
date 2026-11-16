import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/features/matches/widgets/match_cover.dart';

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });
  for (final scale in [1.0, 1.3, 2.0]) {
    for (final finalScore in [false, true]) {
      testWidgets('portada a escala $scale, resultado confirmado $finalScore', (
        tester,
      ) async {
        tester.view.physicalSize = const Size(320, 1300);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        final match = MatchModel(
          id: 'cover',
          title: 'Amistoso Fecha 1 - Solo Etiquetas',
          date: '2026-09-06',
          status: finalScore ? 'evaluated' : 'upcoming',
          type: 'manual',
          hasFinalScore: finalScore,
          teamA: MatchTeam(
            name: 'Equipo Blanco',
            score: 5,
            playerIds: [],
            players: [],
          ),
          teamB: MatchTeam(
            name: 'Equipo Azul',
            score: 4,
            playerIds: [],
            players: [],
          ),
        );
        await tester.pumpWidget(
          MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(scale)),
              child: Scaffold(
                body: SingleChildScrollView(
                  child: MatchCover(match: match, onOpenMaps: () {}),
                ),
              ),
            ),
          ),
        );
        await tester.pump();
        expect(tester.takeException(), isNull);
        expect(find.text(finalScore ? '5 – 4' : 'VS'), findsOneWidget);
        expect(find.text('Equipo Blanco'), findsOneWidget);
        expect(find.text('Sede a confirmar'), findsOneWidget);
        if (!finalScore) expect(find.text('5 – 4'), findsNothing);
      });
    }
  }
}
