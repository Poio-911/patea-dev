import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/features/players/create_player_dialog.dart';

void main() {
  setUpAll(() async {
    final icons = FontLoader('MaterialIcons')..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
    GoogleFonts.config.allowRuntimeFetching = false;
    AppTheme.darkTheme;
    AppTheme.lightTheme;
    for (final w in [FontWeight.w400, FontWeight.w600, FontWeight.w700]) {
      AppTypography.body(weight: w);
      AppTypography.headline(weight: w);
    }
    AppTypography.sportNumber();
    await GoogleFonts.pendingFonts();
  });
  for (final light in [false, true]) {
    testWidgets('manual form scrolls and validates contact, light=$light', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: light ? AppTheme.lightTheme : AppTheme.darkTheme,
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: const TextScaler.linear(1.2)),
              child: child!,
            ),
            home: const Scaffold(body: CreatePlayerDialog()),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Sumar al plantel'), findsOneWidget);
      expect(find.byType(Slider), findsNothing);
      expect(tester.takeException(), isNull);
      await expectLater(
        find.byType(Dialog),
        matchesGoldenFile(
          'goldens/manual_player_form_${light ? 'claro' : 'game'}.png',
        ),
      );
      await tester.tap(find.text('Vincular su futura cuenta'));
      await tester.pumpAndSettle();
      final email = find.widgetWithText(TextFormField, 'Correo electrónico');
      await tester.ensureVisible(email);
      await tester.enterText(email, 'invalido');
      await tester.pumpAndSettle();
      final form = tester.state<FormState>(find.byType(Form));
      expect(form.validate(), isFalse);
      await tester.pumpAndSettle();
      expect(find.text('Revisá el correo'), findsOneWidget);
      await tester.enterText(email, 'jugador@example.com');
      final name = find.widgetWithText(TextFormField, 'Nombre o apodo');
      await tester.ensureVisible(name);
      await tester.enterText(name, 'Jugador prueba');
      expect(form.validate(), isTrue);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  }
}
