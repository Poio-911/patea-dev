import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/player_model.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/core/theme/patea_colors.dart';
import 'package:patea_mobile/core/widgets/player_card_widget.dart';
import 'package:patea_mobile/core/utils/player_attribute_highlight.dart';

PlayerModel _player({
  bool tied = false,
  String position = 'MED',
}) => PlayerModel(
  id: 'marker-audit',
  name: 'Lucía Fernández',
  position: position,
  // OVR deliberately exceeds every attribute: it must not enter the maximum.
  ovr: 99,
  pac: 47,
  sho: 93,
  pas: 68,
  dri: tied ? 93 : 72,
  def: 81,
  phy: 56,
);

Future<void> _mount(
  WidgetTester tester,
  PlayerModel player,
  bool light, {
  String? sort,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: light ? AppTheme.lightTheme : AppTheme.darkTheme,
      home: MediaQuery(
        data: const MediaQueryData(disableAnimations: true),
        child: Scaffold(
          body: Center(
            child: SizedBox(
              width: 260,
              child: PlayerCardWidget(
                player: player,
                highlightStat: sort,
                assetPhoto: 'assets/avatars/player1.png',
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Color? _color(WidgetTester tester, String text) =>
    tester.widget<Text>(find.text(text)).style?.color;

void main() {
  test('standout threshold is strictly above 70', () {
    for (final score in [50, 70, 71]) {
      final player = PlayerModel.fromFirestore({
        'name': 'Prueba', 'position': 'DEL',
        for (final key in ['pac', 'sho', 'pas', 'dri', 'def', 'phy']) key: score,
      }, 'threshold');
      expect(playerAttributeHighlight(player), score > 70 ? 'SHO' : isNull);
    }
  });
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    AppTheme.darkTheme;
    AppTheme.lightTheme;
    for (final weight in [FontWeight.w400, FontWeight.w600, FontWeight.w700]) {
      AppTypography.headline(weight: weight);
      AppTypography.body(weight: weight);
    }
    AppTypography.sportNumber(weight: FontWeight.w700);
    await GoogleFonts.pendingFonts();
  });
  for (final light in [false, true]) {
    final amber = Color(light ? 0xFF885800 : 0xFFFFD56A);
    testWidgets(
      'maximum excludes OVR and persists under sorting, light=$light',
      (tester) async {
        await _mount(tester, _player(), light, sort: 'PAC');
        expect(_color(tester, '93'), amber);
        expect(_color(tester, '47'), isNot(amber));
        expect(find.text('99'), findsOneWidget);
        final sortedColor = _color(tester, 'RIT');
        expect(sortedColor, isNot(_color(tester, 'PAS')));
        await _mount(tester, _player(), light, sort: 'SHO');
        final sortedBackground = (light ? PateaColors.light : PateaColors.game)
            .primary
            .withValues(alpha: 0.08);
        final backgrounds = tester.widgetList<DecoratedBox>(
          find.ancestor(
            of: find.text('93'),
            matching: find.byType(DecoratedBox),
          ),
        );
        expect(
          backgrounds.any(
            (box) =>
                box.decoration is BoxDecoration &&
                (box.decoration as BoxDecoration).color == sortedBackground,
          ),
          isTrue,
        );
        expect(_color(tester, '93'), amber);
        expect(tester.takeException(), isNull);
      },
    );
    testWidgets('only the position-priority tied maximum is marked, light=$light', (
      tester,
    ) async {
      await _mount(tester, _player(tied: true), light);
      final maxima = tester.widgetList<Text>(find.text('93')).toList();
      expect(maxima, hasLength(2));
      expect(maxima.where((text) => text.style?.color == amber), hasLength(1));
      final regateRow = find.ancestor(of: find.text('REG'), matching: find.byType(Row)).first;
      final regateValue = tester.widget<Text>(find.descendant(of: regateRow, matching: find.text('93')));
      expect(regateValue.style?.color, amber);
      expect(_color(tester, '81'), isNot(amber));
    });
    testWidgets(
      'goalkeeper aliases retain canonical values and sort, light=$light',
      (tester) async {
        await _mount(tester, _player(position: 'POR'), light, sort: 'DEF');
        for (final entry in {
          'EST': '81',
          'REF': '72',
          'PAR': '93',
          'VEL': '47',
          'SAQ': '68',
          'POS': '56',
        }.entries) {
          final row = find
              .ancestor(of: find.text(entry.key), matching: find.byType(Row))
              .first;
          expect(
            find.descendant(of: row, matching: find.text(entry.value)),
            findsOneWidget,
          );
        }
        expect(_color(tester, '93'), amber);
        expect(_color(tester, 'EST'), isNot(_color(tester, 'SAQ')));
        expect(find.text('TIR'), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
