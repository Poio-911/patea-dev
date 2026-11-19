import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/group_model.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/jersey_templates.dart';
import 'package:patea_mobile/core/widgets/jersey_painter.dart';
import 'package:patea_mobile/features/groups/jersey_designer.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'applyColorsToSvg preserva Blanco (#FFFFFF) como color primario sin que el secundario lo pise',
    () async {
      for (final entry in jerseyTemplates.entries) {
        final template = entry.value;
        final raw = await rootBundle.loadString(template.assetPath);
        final colored = applyColorsToSvg(
          raw,
          template,
          '#FFFFFF',
          '#DC2626',
        );

        expect(
          colored.contains('fill="#FFFFFF"'),
          isTrue,
          reason: 'El template ${entry.key} perdió el color primario #FFFFFF',
        );
        if (template.usesSecondaryColor) {
          expect(
            colored.contains('fill="#DC2626"'),
            isTrue,
            reason:
                'El template ${entry.key} no aplicó el color secundario #DC2626',
          );
        }
      }
    },
  );

  test(
    'applyColorsToSvg aclara el contorno cuando el color primario es negro (#171717)',
    () async {
      final template = getJerseyTemplate('plain');
      final raw = await rootBundle.loadString(template.assetPath);
      final colored = applyColorsToSvg(raw, template, '#171717', '#FFFFFF');
      expect(colored.contains('fill="#475569"'), isTrue);
    },
  );

  test('JerseyModel serializa escudo completo y calcula iniciales del equipo', () {
    expect(JerseyModel.initialsFromTeamName('Los Galácticos'), 'LG');
    expect(JerseyModel.initialsFromTeamName('La Furia Roja'), 'FR');
    expect(JerseyModel.initialsFromTeamName('Nacional'), 'NA');
    expect(JerseyModel.initialsFromTeamName(''), 'FC');

    final plain = JerseyModel(
      pattern: 'raglan',
      primaryColor: '#DC2626',
      secondaryColor: '#FFFFFF',
    );
    expect(plain.hasCrest, isFalse);
    expect(plain.toMap().containsKey('crestShape'), isFalse);

    final withCrest = plain.copyWith(
      crestShape: 'crest',
      crestPattern: 'stripes',
      crestSymbol: 'sun',
      crestInitials: 'cabj',
      crestShowBanner: true,
      crestBorderColor: '#D97706',
      crestStars: 3,
    );
    expect(withCrest.hasCrest, isTrue);
    final map = withCrest.toMap();
    expect(map['type'], 'raglan');
    expect(map['crestShape'], 'crest');
    expect(map['crestPattern'], 'stripes');
    expect(map['crestSymbol'], 'sun');
    expect(map['crestInitials'], 'CABJ');
    expect(map['crestShowBanner'], isTrue);
    expect(map['crestBorderColor'], '#D97706');
    expect(map['crestStars'], 3);

    final restored = JerseyModel.fromMap(map);
    expect(restored.pattern, 'raglan');
    expect(restored.crestShape, 'crest');
    expect(restored.crestPattern, 'stripes');
    expect(restored.crestSymbol, 'sun');
    expect(restored.crestInitials, 'CABJ');
    expect(restored.crestShowBanner, isTrue);
    expect(restored.crestBorderColor, '#D97706');
    expect(restored.crestStars, 3);
  });

  testWidgets(
    'JerseyDesigner navega por 1. Diseño -> 2. Colores -> 3. Escudo con cabecera fija',
    (tester) async {
      var current = JerseyModel(
        pattern: 'plain',
        primaryColor: '#2563EB',
        secondaryColor: '#FFFFFF',
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          home: Scaffold(
            body: JerseyDesigner(
              value: current,
              teamName: 'Los Galácticos',
              expandPanel: true,
              onChanged: (next) => current = next,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Invertir desde la cabecera fija intercambia primario y secundario.
      await tester.tap(find.text('Invertir'));
      await tester.pumpAndSettle();
      expect(current.primaryColor, '#FFFFFF');
      expect(current.secondaryColor, '#2563EB');

      // Pasar a 2. Colores y elegir una combinación clásica.
      await tester.tap(find.text('2. Colores'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Aurinegro'));
      await tester.pumpAndSettle();
      expect(current.primaryColor, '#EAB308');
      expect(current.secondaryColor, '#171717');

      // Pasar a 3. Escudo y configurar silueta, trama, emblema, marco y estrellas.
      await tester.tap(find.text('3. Escudo'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Blasón'));
      await tester.pumpAndSettle();
      expect(current.crestShape, 'crest');
      expect(find.byType(TeamCrestWidget), findsWidgets);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) => JerseyDesigner(
                value: current,
                teamName: 'Los Galácticos',
                expandPanel: true,
                onChanged: (next) => setState(() => current = next),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('3. Escudo'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Bastones'));
      await tester.pumpAndSettle();
      expect(current.crestPattern, 'stripes');

      await tester.tap(find.text('Corona'));
      await tester.pumpAndSettle();
      expect(current.crestSymbol, 'crown');

      final doradoFinder = find.text('Dorado');
      await tester.ensureVisible(doradoFinder);
      await tester.tap(doradoFinder);
      await tester.pumpAndSettle();
      expect(current.crestBorderColor, '#D97706');

      final starsFinder = find.text('★★★ 3');
      await tester.ensureVisible(starsFinder);
      await tester.tap(starsFinder);
      await tester.pumpAndSettle();
      expect(current.crestStars, 3);
    },
  );
}
