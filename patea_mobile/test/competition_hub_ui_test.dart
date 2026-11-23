import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/services/competition_extras_service.dart';
import 'package:patea_mobile/features/competitions/competition_hub_screen.dart';
import 'package:patea_mobile/core/widgets/patea_tabs.dart';
import 'goldens/arnes.dart';

void main() {
  for (final claro in [false, true]) {
    for (final collection in ['leagues', 'cups']) {
      testWidgets('hub completo a 320px y texto 130% ($claro,$collection)', (
        tester,
      ) async {
        final id = collection == 'cups' ? 'copa-1' : 'liga-1';
        final errors = await montarPantalla(
          tester,
          CompetitionHubScreen(collection: collection, id: id),
          tema: claro ? AppTheme.lightTheme : AppTheme.darkTheme,
          tamano: const Size(960, 2400),
          escala: 1.3,
          extraOverrides: [
            competitionMessagesProvider((
              collection,
              id,
            )).overrideWith((ref) => Stream.value(const [])),
            competitionVenuesProvider((
              collection,
              id,
            )).overrideWith((ref) => Stream.value(const [])),
          ],
        );
        expect(errors, isEmpty);
        final shortcut = find.text(
          collection == 'cups' ? 'Ver cruces' : 'Ver tabla',
        );
        await tester.ensureVisible(shortcut);
        await tester.tap(shortcut);
        await tester.pumpAndSettle();
        expect(
          find.text(
            collection == 'cups' ? 'Cuadro de la copa' : 'Tabla de posiciones',
          ),
          findsOneWidget,
        );
        for (final tab in [
          collection == 'cups' ? 'Cruces' : 'Fechas',
          if (collection == 'leagues') 'Tabla',
          'Equipos',
          'Estadísticas',
          'Gestión',
          'Sedes',
        ]) {
          final tabTitle = find.descendant(
            of: find.byType(PateaTabs).first,
            matching: find.text(tab),
          );
          await tester.ensureVisible(tabTitle);
          await tester.pump();
          await tester.tap(tabTitle);
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull, reason: tab);
          if (tab == 'Equipos') {
            await tester.tap(find.text(equipos.first.name).first);
            await tester.pumpAndSettle();
            expect(find.textContaining('Dorsal'), findsWidgets);
            expect(tester.takeException(), isNull);
          }
        }
      });
    }
  }
}
