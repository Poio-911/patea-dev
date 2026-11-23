// Vista previa del costo, la transmisión y el calendario de partidos con datos
// de ejemplo. No son goldens: no comparan nada.
//
//   flutter test --no-pub --update-goldens tool/match_extras_preview_test.dart
//
// Salen en `build/preview/`.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader, rootBundle;
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/features/matches/widgets/match_cost_card.dart';
import 'package:patea_mobile/features/matches/widgets/match_stream_row.dart';
import 'package:patea_mobile/features/matches/widgets/matches_calendar_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Arnés mínimo: sin el enrutador ni los providers de la app, para que esto
/// compile aunque otra pantalla esté a medio hacer.
Future<List<FlutterErrorDetails>> montarPantalla(
  WidgetTester tester,
  Widget pantalla, {
  required ThemeData tema,
}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.reset);
  final errores = <FlutterErrorDetails>[];
  final anterior = FlutterError.onError;
  FlutterError.onError = errores.add;
  try {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: tema,
          debugShowCheckedModeBanner: false,
          home: pantalla,
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 350));
  } finally {
    FlutterError.onError = anterior;
  }
  return errores;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    GoogleFonts.config.allowRuntimeFetching = false;
    final material = FontLoader('MaterialIcons');
    material.addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await material.load();
    for (final p in const [
      FontWeight.w400,
      FontWeight.w500,
      FontWeight.w600,
      FontWeight.w700,
      FontWeight.w800,
    ]) {
      AppTypography.headline(weight: p);
      AppTypography.body(weight: p);
    }
    await GoogleFonts.pendingFonts();
  });

  MatchModel partido(String id, String date, String status, {String? time}) =>
      MatchModel(
        id: id,
        title: 'Partido $id',
        date: date,
        time: time,
        status: status,
        type: 'manual',
        matchSize: 10,
        playerUids: ['a', 'b', 'c', 'd'],
        players: [
          MatchPlayerEntry(uid: 'a', displayName: 'Aurelio'),
          MatchPlayerEntry(uid: 'b', displayName: 'Beto'),
          MatchPlayerEntry(uid: 'c', displayName: 'Caro'),
          MatchPlayerEntry(uid: 'd', displayName: 'Dani'),
        ],
        cost: const MatchCost(total: 1500, currency: 'UYU'),
        costPaidUids: ['a', 'c'],
        stream: const MatchStream(
          provider: 'youtube',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        ),
      );

  for (final organizador in [true, false]) {
    testWidgets('costo y transmisión · ${organizador ? 'organizador' : 'jugador'}', (
      tester,
    ) async {
      final errors = await montarPantalla(
        tester,
        Scaffold(
          backgroundColor: Colors.transparent,
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              MatchStreamRow(
                match: partido('1', '2026-11-23T00:00:00.000', 'upcoming'),
                isManager: organizador,
              ),
              const SizedBox(height: 14),
              MatchCostCard(
                match: partido('1', '2026-11-23T00:00:00.000', 'upcoming'),
                uid: 'c',
                isManager: organizador,
              ),
            ],
          ),
        ),
        tema: AppTheme.darkTheme,
      );
      expect(errors, isEmpty);
      await tester.pump(const Duration(milliseconds: 300));
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile(
          '../build/preview/costo_${organizador ? 'organizador' : 'jugador'}.png',
        ),
      );
    });
  }

  testWidgets('calendario', (tester) async {
    final errors = await montarPantalla(
      tester,
      Scaffold(
        backgroundColor: Colors.transparent,
        body: SingleChildScrollView(
          child: MatchesCalendarView(
            today: DateTime(2026, 11, 23),
            matches: [
              partido('a', '2026-11-18T00:00:00.000', 'evaluated', time: '21:00'),
              partido('b', '2026-11-22T00:00:00.000', 'evaluated', time: '21:00'),
              partido('c', '2026-11-23T00:00:00.000', 'upcoming', time: '20:00'),
              partido('d', '2026-11-23T00:00:00.000', 'upcoming', time: '22:00'),
              partido('e', '2026-11-27T00:00:00.000', 'upcoming', time: '21:30'),
            ],
            cardBuilder: (m) => Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white24),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text('${m.title} · ${m.time}'),
            ),
          ),
        ),
      ),
      tema: AppTheme.darkTheme,
    );
    expect(errors, isEmpty);
    await tester.pump(const Duration(milliseconds: 300));
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../build/preview/calendario.png'),
    );
  });
}
