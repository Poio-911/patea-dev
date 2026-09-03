import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/theme/app_colors.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/widgets/patea_page_header.dart';

/// Tests que no necesitan Firebase inicializado.
///
/// Un widget test que monte `PateaApp` fallaría: el arranque inicializa
/// Firebase, Crashlytics y App Check. Para cubrir pantallas completas hace
/// falta `integration_test/` corriendo en un dispositivo, no este entorno.
void main() {
  group('tema', () {
    test('el AppBar no tiñe el fondo al scrollear', () {
      // Material 3 aplica un overlay de surfaceTint sobre el AppBar cuando el
      // contenido pasa por debajo. Eso producía un fondo verde oliva raro
      // detrás de los títulos de sección al scrollear. Se apaga globalmente.
      final appBar = AppTheme.darkTheme.appBarTheme;
      expect(appBar.scrolledUnderElevation, 0);
      expect(appBar.surfaceTintColor, Colors.transparent);
    });

    test('el tema es oscuro y usa el fondo de la marca', () {
      expect(AppTheme.darkTheme.brightness, Brightness.dark);
      expect(AppTheme.darkTheme.scaffoldBackgroundColor, AppColors.background);
    });
  });

  group('AppColors', () {
    test('los tiers de OVR respetan los cortes reales', () {
      expect(AppColors.getOvrBorderColor(90), AppColors.eliteBorder);
      expect(AppColors.getOvrBorderColor(86), AppColors.eliteBorder);
      expect(AppColors.getOvrBorderColor(85), AppColors.goldBorder);
      expect(AppColors.getOvrBorderColor(76), AppColors.goldBorder);
      expect(AppColors.getOvrBorderColor(75), AppColors.silverBorder);
      expect(AppColors.getOvrBorderColor(65), AppColors.silverBorder);
      expect(AppColors.getOvrBorderColor(64), AppColors.bronzeBorder);
    });

    test('cada posición tiene su color y lo desconocido no rompe', () {
      expect(AppColors.getPositionColor('DEL'), AppColors.posDel);
      expect(AppColors.getPositionColor('med'), AppColors.posMed);
      expect(AppColors.getPositionColor('DEF'), AppColors.posDef);
      expect(AppColors.getPositionColor('POR'), AppColors.posPor);
      expect(AppColors.getPositionColor('XXX'), AppColors.textSecondary);
    });
  });

  group('PateaPageHeader', () {
    // La norma de la app: toda sección con acción muestra título, descripción
    // y el botón DEBAJO, como el PageHeader de la web en mobile (flex-col).
    // Nunca un AppBar fijo con un FAB flotante.
    testWidgets('muestra título, descripción y el botón de acción', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          home: Scaffold(
            body: PateaPageHeader(
              title: 'Plantel',
              description: 'Gestioná la plantilla de tu equipo.',
              currentCount: 12,
              totalCount: 20,
              actionButton: ElevatedButton(
                onPressed: () {},
                child: const Text('Agregar Jugador'),
              ),
            ),
          ),
        ),
      );

      expect(find.text('Plantel'), findsOneWidget);
      expect(find.text('Gestioná la plantilla de tu equipo.'), findsOneWidget);
      expect(find.text('Agregar Jugador'), findsOneWidget);
      expect(find.textContaining('12'), findsWidgets);
    });

    testWidgets('oculta la fila de conteo cuando se pide', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          home: const Scaffold(
            body: PateaPageHeader(
              title: 'Partidos',
              description: 'Organizá y gestioná todos tus partidos.',
              showCountRow: false,
            ),
          ),
        ),
      );

      expect(find.text('Partidos'), findsOneWidget);
      expect(find.textContaining('jugadores'), findsNothing);
    });
  });
}
