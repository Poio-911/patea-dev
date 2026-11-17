import 'package:patea_mobile/core/models/competition_model.dart';
import 'package:patea_mobile/core/services/competition_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/features/competitions/cup_bracket_screen.dart';
import 'goldens/arnes.dart';

class _DanglingCup extends CompetitionServiceFake {
  @override
  Stream<CompetitionModel?> watchCompetition(String collection, String id) =>
      Stream.value(
        CompetitionModel(
          id: id,
          name: 'Copa histórica',
          type: 'cup',
          status: 'completed',
          ownerUid: 'other',
          bracket: [
            BracketMatchModel(
              id: 'final',
              round: 'final',
              matchNumber: 1,
              team1Id: 'a',
              team2Id: 'b',
              team1Name: 'A',
              team2Name: 'B',
              winnerId: 'a',
              matchId: 'missing',
            ),
          ],
        ),
      );
  @override
  Stream<List<Map<String, dynamic>>> watchMatches(
    String collection,
    String id,
  ) => Stream.value([]);
}

void main() {
  testWidgets(
    'copa histórica conserva resultado y no abre un partido inexistente',
    (tester) async {
      final errors = await montarPantalla(
        tester,
        const CupBracketScreen(cupId: 'legacy'),
        tema: AppTheme.darkTheme,
        extraOverrides: [
          competitionServiceProvider.overrideWithValue(_DanglingCup()),
          singleMatchStreamProvider(
            'missing',
          ).overrideWith((ref) => Stream.value(null)),
        ],
      );
      expect(errors, isEmpty);
      await tester.tap(find.text('Cruces'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('El partido vinculado ya no está disponible'),
        findsOneWidget,
      );
      expect(find.text('Abrir partido'), findsNothing);
      expect(find.text('Avanza A'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  for (final claro in [false, true]) {
    for (final owner in [false, true]) {
      testWidgets(
        'copa: gestión y partidos reales según rol ($claro, $owner)',
        (tester) async {
          final errors = await montarPantalla(
            tester,
            const CupBracketScreen(cupId: 'copa-1'),
            tema: claro ? AppTheme.lightTheme : AppTheme.darkTheme,
            extraOverrides: [
              currentUidProvider.overrideWithValue(owner ? uidYo : 'spectator'),
            ],
          );
          expect(errors, isEmpty);
          expect(find.text('Gestión'), owner ? findsOneWidget : findsNothing);
          expect(
            find.byTooltip('Administrar torneo'),
            owner ? findsOneWidget : findsNothing,
          );
          await tester.tap(find.text('Cruces'));
          await tester.pumpAndSettle();
          expect(find.text('Final'), findsWidgets);
          expect(find.text('Abrir partido'), findsOneWidget);
          expect(
            find.text('Cargar resultado'),
            owner ? findsOneWidget : findsNothing,
          );
          if (owner) {
            await tester.ensureVisible(find.text('Cargar resultado'));
            await tester.tap(find.text('Cargar resultado'));
            await tester.pumpAndSettle();
            await tester.enterText(find.byType(TextField).first, '2');
            tester.testTextInput.hide();
            await tester.pumpAndSettle();
            await tester.tap(
              find.widgetWithText(FilledButton, 'Confirmar resultado'),
            );
            await tester.pumpAndSettle();
            expect(find.byType(AlertDialog), findsNothing);
          }
          expect(tester.takeException(), isNull);
        },
      );
    }
  }
}
