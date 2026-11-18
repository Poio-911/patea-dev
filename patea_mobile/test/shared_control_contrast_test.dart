import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';

double _contrast(Color a, Color b) {
  final x = a.computeLuminance();
  final y = b.computeLuminance();
  return (math.max(x, y) + 0.05) / (math.min(x, y) + 0.05);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;
  for (final light in [false, true]) {
    test(
      'controles distinguibles y texto deshabilitado legible, claro=$light',
      () async {
        final theme = light ? AppTheme.lightTheme : AppTheme.darkTheme;
        await GoogleFonts.pendingFonts();
        for (final states in [
          <WidgetState>{},
          {WidgetState.disabled},
          {WidgetState.selected},
          {WidgetState.selected, WidgetState.disabled},
        ]) {
          expect(
            _contrast(
              theme.switchTheme.thumbColor!.resolve(states)!,
              theme.switchTheme.trackColor!.resolve(states)!,
            ),
            greaterThanOrEqualTo(3),
            reason: 'El indicador no debe fundirse con su pista.',
          );
        }
        expect(
          theme.switchTheme.trackColor!.resolve({WidgetState.disabled}),
          isNot(theme.switchTheme.trackColor!.resolve({})),
          reason: 'El switch deshabilitado debe distinguirse del habilitado.',
        );

        final selectedChipBg = theme.chipTheme.selectedColor!;
        expect(
          _contrast(theme.chipTheme.checkmarkColor!, selectedChipBg),
          greaterThanOrEqualTo(3.0),
          reason: 'El checkmark del FilterChip debe leerse sobre selectedColor.',
        );

        final segStyle = theme.segmentedButtonTheme.style!;
        expect(
          _contrast(
            segStyle.foregroundColor!.resolve({WidgetState.selected})!,
            segStyle.backgroundColor!.resolve({WidgetState.selected})!,
          ),
          greaterThanOrEqualTo(4.5),
          reason: 'El segmento activo del SegmentedButton debe cumplir AA.',
        );
        for (final button in [
          theme.elevatedButtonTheme.style!,
          theme.filledButtonTheme.style!,
        ]) {
          expect(
            _contrast(
              button.foregroundColor!.resolve({WidgetState.disabled})!,
              button.backgroundColor!.resolve({WidgetState.disabled})!,
            ),
            greaterThanOrEqualTo(4.5),
          );
        }
        final fill = theme.inputDecorationTheme.fillColor!;
        final enabledFill = fill is WidgetStateColor ? fill.resolve({}) : fill;
        expect(
          enabledFill.a,
          1,
          reason: 'La imagen de fondo no debe atravesar los campos.',
        );
        expect(
          _contrast(theme.inputDecorationTheme.hintStyle!.color!, enabledFill),
          greaterThanOrEqualTo(4.5),
        );
      },
    );
  }
}
