import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/features/competitions/competition_hub_screen.dart';
import 'goldens/arnes.dart';

void main() {
  for (final claro in [false, true]) {
    for (final collection in ['leagues', 'cups']) {
      testWidgets('hub completo a 320px y texto 130% ($claro,$collection)', (
        tester,
      ) async {
        final errors = await montarPantalla(
          tester,
          CompetitionHubScreen(
            collection: collection,
            id: collection == 'cups' ? 'copa-1' : 'liga-1',
          ),
          tema: claro ? AppTheme.lightTheme : AppTheme.darkTheme,
          tamano: const Size(960, 2400),
          escala: 1.3,
        );
        expect(errors, isEmpty);
        for (final tab in [
          collection == 'cups' ? 'Cruces' : 'Fechas',
          if (collection == 'leagues') 'Tabla',
          'Equipos',
          'Datos',
          'Gestión',
        ]) {
          await tester.ensureVisible(find.text(tab));
          await tester.tap(find.text(tab));
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
