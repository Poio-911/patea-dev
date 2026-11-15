import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/widgets/patea_brand.dart';
import 'package:patea_mobile/core/widgets/soccer_runner_icon.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);
  for (final theme in [AppTheme.darkTheme, AppTheme.lightTheme]) {
    testWidgets('marca legible y semántica en ${theme.brightness}', (tester) async {
      final semantics = tester.ensureSemantics();
      await tester.pumpWidget(MaterialApp(
        theme: theme,
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
          child: const Scaffold(body: PateaBrand(width: 84, height: 30)),
        ),
      ));
      await tester.pump();
      expect(find.bySemanticsLabel('Pateá'), findsOneWidget);
      expect(find.byType(SoccerRunnerIcon), findsOneWidget);
      expect(find.text('Pateá'), findsOneWidget);
      expect(tester.takeException(), isNull);
      expect(tester.getSize(find.byType(PateaBrand)), const Size(84, 30));
      semantics.dispose();
    });
  }
}
