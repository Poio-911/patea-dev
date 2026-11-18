import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:patea_mobile/core/widgets/ovr_accent.dart';
import 'package:patea_mobile/core/theme/patea_colors.dart';

void main() {
  Widget sample({int ovr = 90, bool reduced = false, bool offscreen = false}) =>
      MaterialApp(
        home: MediaQuery(
          data: MediaQueryData(
            size: const Size(800, 600),
            disableAnimations: reduced,
          ),
          child: Scaffold(
            body: Center(
              child: Transform.translate(
                offset: Offset(0, offscreen ? 2000 : 0),
                child: OvrPrismNumber(
                  ovr: ovr,
                  seed: '',
                  style: const TextStyle(
                    fontSize: 32,
                    color: Color(0xFFA42D51),
                  ),
                ),
              ),
            ),
          ),
        ),
      );

  testWidgets('Prisma appears temporarily while base color stays solid', (
    tester,
  ) async {
    await tester.pumpWidget(sample());
    expect(find.byType(ShaderMask), findsNothing);
    await tester.pump(const Duration(milliseconds: 900));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.byType(ShaderMask), findsOneWidget);
    expect(
      tester.widget<Text>(find.text('90').first).style!.color,
      const Color(0xFFA42D51),
    );
    await tester.pump(const Duration(seconds: 2));
    expect(find.byType(ShaderMask), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
  });
  testWidgets('70, reduced motion and offscreen numbers do not flash', (
    tester,
  ) async {
    for (final widget in [
      sample(ovr: 70),
      sample(reduced: true),
      sample(offscreen: true),
    ]) {
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpWidget(widget);
      await tester.pump(const Duration(milliseconds: 900));
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.byType(ShaderMask), findsNothing);
    }
    await tester.pumpWidget(const SizedBox.shrink());
  });
  test('categories use the approved thresholds', () {
    for (final entry in {
      50: '',
      69: '',
      70: 'PRO',
      79: 'PRO',
      80: 'ELITE',
      89: 'ELITE',
      90: 'ELITE+',
      99: 'ELITE+',
    }.entries) {
      expect(ovrCategory(entry.key), entry.value);
    }
    expect(ovrPrismPause(99), lessThan(ovrPrismPause(71)));
  });
  test('ELITE+ uses Granate only in Claro', () {
    expect(ovrAccentColor(PateaColors.light, 90).toARGB32(), 0xFFA42D51);
    expect(ovrAccentColor(PateaColors.light, 99).toARGB32(), 0xFFA42D51);
    expect(ovrAccentColor(PateaColors.game, 90).toARGB32(), 0xFFF2C230);
    expect(ovrAccentColor(PateaColors.game, 99).toARGB32(), 0xFFEE9AF2);
  });
  for (final colors in [PateaColors.game, PateaColors.light]) {
    test(
      'category accents remain distinct and legible on the card (${colors.isDarkSurface})',
      () {
        final accents = [
          50,
          70,
          80,
          90,
        ].map((v) => ovrAccentColor(colors, v)).toList();
        expect(accents.toSet().length, 4);
        for (final color in accents) {
          final a = color.computeLuminance(),
              b = colors.card.computeLuminance();
          final contrast = ((a > b ? a : b) + 0.05) / ((a < b ? a : b) + 0.05);
          expect(contrast, greaterThanOrEqualTo(4.5));
        }
      },
    );
  }
}
