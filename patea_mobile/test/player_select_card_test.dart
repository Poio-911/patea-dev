import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/core/widgets/player_select_card.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    AppTheme.lightTheme;
    AppTheme.darkTheme;
    AppTypography.headline(weight: FontWeight.w700);
    AppTypography.code(weight: FontWeight.w600);
    AppTypography.code(weight: FontWeight.w800);
    AppTypography.sportNumber();
    await GoogleFonts.pendingFonts();
  });
  for (final light in [false, true]) {
    testWidgets('selection remains usable at 1.3x, light=$light', (
      tester,
    ) async {
      var selected = false;
      var disabled = false;
      var taps = 0;
      late StateSetter update;
      await tester.pumpWidget(
        MaterialApp(
          theme: light ? AppTheme.lightTheme : AppTheme.darkTheme,
          home: MediaQuery(
            data: const MediaQueryData(
              textScaler: TextScaler.linear(1.3),
              disableAnimations: true,
            ),
            child: Scaffold(
              body: Center(
                child: SizedBox(
                  width: 320,
                  child: StatefulBuilder(
                    builder: (context, setState) {
                      update = setState;
                      return PlayerSelectCard(
                        name: 'María de los Ángeles Fernández',
                        position: 'MED',
                        ovr: 86,
                        selected: selected,
                        disabled: disabled,
                        dense: true,
                        stats: const {'pac': 92, 'sho': 83, 'pas': 99},
                        onTap: () => setState(() {
                          taps++;
                          selected = !selected;
                        }),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      expect(tester.takeException(), isNull);
      expect(find.textContaining('RIT', findRichText: true), findsOneWidget);
      for (final animation in tester.widgetList<AnimatedContainer>(
        find.byType(AnimatedContainer),
      )) {
        expect(animation.duration, Duration.zero);
      }
      await tester.tap(find.byType(PlayerSelectCard));
      await tester.pump();
      expect(selected, isTrue);
      update(() => disabled = true);
      await tester.pump();
      // A selected player remains removable even when the roster is full.
      await tester.tap(find.byType(PlayerSelectCard));
      await tester.pump();
      expect(selected, isFalse);
      expect(taps, 2);
      await tester.tap(find.byType(PlayerSelectCard));
      await tester.pump();
      expect(taps, 2);
      expect(tester.takeException(), isNull);
    });
  }
}
