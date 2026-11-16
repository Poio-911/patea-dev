import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/widgets/patea_button_progress.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    AppTheme.darkTheme;
    AppTheme.lightTheme;
    await GoogleFonts.pendingFonts();
  });
  for (final light in [false, true]) {
    for (final enabled in [false, true]) {
      testWidgets(
        'button progress follows resolved foreground, light=$light enabled=$enabled',
        (tester) async {
          for (final reduced in [false, true]) {
            await tester.pumpWidget(
              MaterialApp(
                theme: light ? AppTheme.lightTheme : AppTheme.darkTheme,
                home: MediaQuery(
                  data: MediaQueryData(disableAnimations: reduced),
                  child: Scaffold(
                    body: Center(
                      child: ElevatedButton(
                        onPressed: enabled ? () {} : null,
                        child: const SizedBox(
                          width: 20,
                          height: 20,
                          child: PateaButtonProgress(),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );
            await tester.pump();
            final spinner = tester.widget<CircularProgressIndicator>(
              find.byType(CircularProgressIndicator),
            );
            final context = tester.element(find.byType(PateaButtonProgress));
            expect(spinner.color, DefaultTextStyle.of(context).style.color);
            expect(spinner.strokeWidth, 2);
            expect(spinner.value, reduced ? 0.75 : null);
            final material = tester.widget<Material>(
              find
                  .descendant(
                    of: find.byType(ElevatedButton),
                    matching: find.byType(Material),
                  )
                  .first,
            );
            final foregroundLuminance = spinner.color!.computeLuminance();
            final backgroundLuminance = material.color!.computeLuminance();
            final lighter = foregroundLuminance > backgroundLuminance
                ? foregroundLuminance
                : backgroundLuminance;
            final darker = foregroundLuminance < backgroundLuminance
                ? foregroundLuminance
                : backgroundLuminance;
            expect((lighter + 0.05) / (darker + 0.05), greaterThanOrEqualTo(3));
            expect(tester.takeException(), isNull);
          }
        },
      );
    }
  }
}
