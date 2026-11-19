import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/core/widgets/patea_help_dialog.dart';
import 'package:patea_mobile/features/players/create_player_dialog.dart';
import 'package:patea_mobile/features/evaluations/evaluations_inbox_screen.dart';
import 'goldens/arnes.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    for (final weight in [
      FontWeight.w400,
      FontWeight.w500,
      FontWeight.w600,
      FontWeight.w700,
    ]) {
      AppTypography.body(weight: weight);
      AppTypography.headline(weight: weight);
    }
    AppTypography.action();
    AppTypography.code();
    await GoogleFonts.pendingFonts();
  });

  Future<void> mount(
    WidgetTester tester,
    Widget dialog,
    ThemeData theme,
  ) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: overridesDelArnes(),
        child: MaterialApp(
          theme: theme,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: const TextScaler.linear(1.3),
              disableAnimations: true,
            ),
            child: child!,
          ),
          home: Scaffold(body: dialog),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  for (final theme in [AppTheme.darkTheme, AppTheme.lightTheme]) {
    testWidgets(
      'solicitudes conserva ambas decisiones legibles a 1.3x ${theme.brightness}',
      (tester) async {
        await mount(tester, const EvaluationsInboxScreen(), theme);
        await tester.ensureVisible(find.text('Solicitudes'));
        await tester.tap(find.text('Solicitudes'));
        await tester.pumpAndSettle();
        for (final action in ['Mantener anonimato', 'Revelar identidad']) {
          await tester.ensureVisible(find.text(action));
          expect(find.text(action).hitTestable(), findsOneWidget);
        }
        expect(tester.takeException(), isNull);
      },
    );
    testWidgets(
      'crear jugador conserva controles legibles a 1.3x ${theme.brightness}',
      (tester) async {
        await mount(tester, const CreatePlayerDialog(), theme);
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.text('Añadir jugador'));
        expect(find.text('Añadir jugador').hitTestable(), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'tutorial mantiene acciones y seis páginas a 1.3x ${theme.brightness}',
      (tester) async {
        await mount(tester, const PateaHelpDialog(), theme);
        for (var page = 0; page < 5; page++) {
          expect(tester.takeException(), isNull, reason: 'paso $page');
          await tester.tap(find.text('Siguiente'));
          await tester.pumpAndSettle();
        }
        expect(find.text('Empezar a jugar').hitTestable(), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
