import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/features/matches/matches_screen.dart';
import 'goldens/arnes.dart';

void main() {
  for (final light in [false, true])
    for (final scale in [1.0, 1.3]) {
      testWidgets(
        'partidos compactos ajustan su altura al contenido ($light,$scale)',
        (tester) async {
          final errors = await montarPantalla(
            tester,
            const MatchesScreen(),
            tema: light ? AppTheme.lightTheme : AppTheme.darkTheme,
            tamano: const Size(960, 2400),
            escala: scale,
          );
          expect(errors, isEmpty);
          await tester.ensureVisible(find.byIcon(Icons.view_list_rounded));
          await tester.tap(find.byIcon(Icons.view_list_rounded));
          await tester.pumpAndSettle();
          final cards = find.byWidgetPredicate(
            (w) =>
                w.key is ValueKey<String> &&
                (w.key as ValueKey<String>).value.startsWith('compact-match-'),
          );
          expect(cards, findsWidgets);
          for (final element in cards.evaluate()) {
            final card = find.byWidget(element.widget);
            final chevron = find.descendant(
              of: card,
              matching: find.byIcon(Icons.chevron_right),
            );
            expect(
              tester.getBottomRight(card).dy -
                  tester.getBottomRight(chevron).dy,
              lessThan(40),
              reason: 'No debe quedar una franja vacía bajo la acción',
            );
          }
          expect(tester.takeException(), isNull);
        },
      );
    }
}
