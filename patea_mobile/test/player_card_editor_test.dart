import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/core/widgets/player_card_widget.dart';
import 'package:patea_mobile/features/players/edit_profile_screen.dart';
import 'package:patea_mobile/features/players/players_list_screen.dart';
import 'goldens/arnes.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    for (final weight in [FontWeight.w400, FontWeight.w500, FontWeight.w600, FontWeight.w700]) {
      AppTypography.body(weight: weight);
      AppTypography.headline(weight: weight);
    }
    AppTypography.action();
    await GoogleFonts.pendingFonts();
  });

  for (final light in [false, true]) {
    testWidgets('plantel se adapta a texto 2x, claro=$light', (tester) async {
      final errors = await montarPantalla(
        tester,
        const PlayersListScreen(),
        tema: light ? AppTheme.lightTheme : AppTheme.darkTheme,
        escala: 2,
      );
      expect(errors, isEmpty, reason: resumirErrores(errors));
      final grid = tester.widget<SliverGrid>(find.byType(SliverGrid));
      expect((grid.gridDelegate as SliverGridDelegateWithFixedCrossAxisCount).crossAxisCount, 1);
      expect(tester.takeException(), isNull);
    });
    testWidgets('ficha editable legible con teclado y texto grande, claro=$light', (tester) async {
      final errors = await montarPantalla(
        tester,
        const EditProfileScreen(playerId: uidYo),
        tema: light ? AppTheme.lightTheme : AppTheme.darkTheme,
        escala: 1.3,
      );
      expect(errors, isEmpty, reason: resumirErrores(errors));
      expect(tester.getSize(find.byType(PlayerCardWidget)).width, 260);
      await tester.ensureVisible(find.byType(TextField).first);
      await tester.enterText(find.byType(TextField).first, 'Apodo de prueba');
      tester.view.viewInsets = const FakeViewPadding(bottom: 900);
      await tester.pump();
      await tester.ensureVisible(find.text('Guardar cambios'));
      await tester.pump();
      expect(find.text('Guardar cambios').hitTestable(), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
