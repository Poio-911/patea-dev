import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/widgets/patea_tabs.dart';

/// Regresión: al llegar al final, la barra quitaba el degradé envolviendo el
/// scroll de otra manera, se reconstruía y volvía a la posición 0, así que las
/// últimas pestañas no se podían alcanzar.
void main() {
  testWidgets('con más pestañas que ancho, se puede llegar a la última', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.625; // 411 px de ancho lógico
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.darkTheme,
        home: Scaffold(
          body: PateaTabs(
            tabs: [
              for (final l in [
                'Resumen',
                'Cruces',
                'Equipos',
                'Datos',
                'Sedes',
                'Avisos',
                'Gestión',
              ])
                PateaTab(l),
            ],
            active: 0,
            onChanged: (_) {},
          ),
        ),
      ),
    );
    await tester.pump();

    final position = tester
        .state<ScrollableState>(find.byType(Scrollable))
        .position;
    final last = find.text('Gestión');
    expect(position.maxScrollExtent, greaterThan(0));
    expect(tester.getTopRight(last).dx, greaterThan(411), reason: 'arranca fuera');

    await tester.drag(find.text('Datos'), const Offset(-300, 0));
    await tester.pumpAndSettle();

    expect(position.pixels, position.maxScrollExtent, reason: 'llegó al final');
    expect(tester.getTopRight(last).dx, lessThanOrEqualTo(411));

    // Y se queda ahí: antes volvía a 0 en el cuadro siguiente.
    await tester.pump(const Duration(milliseconds: 100));
    expect(position.pixels, position.maxScrollExtent);
  });
}
