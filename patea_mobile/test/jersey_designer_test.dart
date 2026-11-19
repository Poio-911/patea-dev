import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/group_model.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/jersey_templates.dart';
import 'package:patea_mobile/core/widgets/jersey_painter.dart';
import 'package:patea_mobile/features/groups/jersey_designer.dart';

Future<File> _createTempTransparentPng() async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  canvas.drawCircle(
    const Offset(16, 16),
    12,
    Paint()..color = const Color(0xFFDC2626),
  );
  final picture = recorder.endRecording();
  final image = await picture.toImage(32, 32);
  final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
  final dir = Directory.systemTemp.createTempSync('patea_crest_test_');
  final file = File('${dir.path}${Platform.pathSeparator}crest.png');
  file.writeAsBytesSync(byteData!.buffer.asUint8List());
  return file;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

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

  test(
    'JerseyModel serializa escudo modular, PNG subido y compatibilidad retroactiva',
    () {
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
      expect(plain.toMap().containsKey('crestMode'), isFalse);

      final withCrest = plain.copyWith(
        crestMode: 'custom',
        crestShape: 'circle',
        crestLayout: 'ring',
        crestSymbol: 'sun',
        crestText: 'cabj',
        crestSubtitle: '1905',
        crestTextLayout: 'auto',
        crestFont: 'classic',
        crestBorderColor: '#D97706',
        crestStars: 3,
        crestLaurel: true,
        crestCrownTop: true,
      );
      expect(withCrest.hasCrest, isTrue);
      final map = withCrest.toMap();
      expect(map['type'], 'raglan');
      expect(map['crestMode'], 'custom');
      expect(map['crestShape'], 'circle');
      expect(map['crestLayout'], 'ring');
      expect(map['crestSymbol'], 'sun');
      expect(map['crestText'], 'CABJ');
      expect(map['crestInitials'], 'CABJ');
      expect(map['crestSubtitle'], '1905');
      expect(map['crestFont'], 'classic');
      expect(map['crestBorderColor'], '#D97706');
      expect(map['crestStars'], 3);
      expect(map['crestLaurel'], isTrue);
      expect(map['crestCrownTop'], isTrue);

      final restored = JerseyModel.fromMap(map);
      expect(restored.crestMode, 'custom');
      expect(restored.crestShape, 'circle');
      expect(restored.crestLayout, 'ring');
      expect(restored.crestSymbol, 'sun');
      expect(restored.crestText, 'CABJ');
      expect(restored.crestSubtitle, '1905');
      expect(restored.crestFont, 'classic');
      expect(restored.crestBorderColor, '#D97706');
      expect(restored.crestStars, 3);
      expect(restored.crestLaurel, isTrue);
      expect(restored.crestCrownTop, isTrue);

      // Datos heredados previos al rediseño
      final legacy = JerseyModel.fromMap({
        'type': 'vertical',
        'primaryColor': '#2563EB',
        'secondaryColor': '#FFFFFF',
        'crestShape': 'classic',
        'crestPattern': 'stripes',
        'crestInitials': 'PAT',
        'crestShowBanner': true,
      });
      expect(legacy.hasCrest, isTrue);
      expect(legacy.crestMode, 'custom');
      expect(legacy.crestLayout, 'stripes');
      expect(legacy.crestText, 'PAT');
      expect(legacy.crestTextLayout, 'banner');

      // PNG subido con recorte circular
      final uploaded = plain.copyWith(
        crestMode: 'uploaded',
        crestUrl:
            'https://firebasestorage.googleapis.com/v0/b/patea/crest.png',
        crestClipCircle: true,
      );
      expect(uploaded.hasCrest, isTrue);
      expect(uploaded.isUploadedCrest, isTrue);
      final uploadedMap = uploaded.toMap();
      expect(uploadedMap['crestMode'], 'uploaded');
      expect(uploadedMap['crestUrl'], contains('crest.png'));
      expect(uploadedMap['crestClipCircle'], isTrue);
      final restoredUpload = JerseyModel.fromMap(uploadedMap);
      expect(restoredUpload.isUploadedCrest, isTrue);
      expect(restoredUpload.crestClipCircle, isTrue);
    },
  );

  testWidgets(
    'CrestDesignerStep adapta las opciones interiores según la silueta y permite cargar PNG',
    (tester) async {
      File? testPng;
      await tester.runAsync(() async {
        testPng = await _createTempTransparentPng();
      });
      addTearDown(() {
        if (testPng != null && testPng!.parent.existsSync()) {
          testPng!.parent.deleteSync(recursive: true);
        }
      });

      var current = JerseyModel(
        pattern: 'plain',
        primaryColor: '#2563EB',
        secondaryColor: '#FFFFFF',
      );
      File? pickedLocal;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) => JerseyDesigner(
                value: current,
                teamName: 'Los Galácticos',
                localCrestFile: pickedLocal,
                expandPanel: true,
                onPickCrestFile: () async => testPng,
                onLocalCrestFileChanged: (f) => setState(() => pickedLocal = f),
                onChanged: (next) => setState(() => current = next),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Invertir colores en Camiseta
      await tester.tap(find.text('Invertir'));
      await tester.pumpAndSettle();
      expect(current.primaryColor, '#FFFFFF');
      expect(current.secondaryColor, '#2563EB');

      // Combinación clásica
      await tester.tap(find.text('Colores'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Aurinegro'));
      await tester.pumpAndSettle();
      expect(current.primaryColor, '#EAB308');
      expect(current.secondaryColor, '#171717');

      // Pasar a Escudo y activar Diseñar
      await tester.tap(find.text('Escudo'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Diseñar'));
      await tester.pumpAndSettle();
      expect(current.crestMode, 'custom');

      // Elegir Circular -> debe mostrar layouts de círculo y esconder "Franja arriba"
      await tester.tap(find.text('Circular'));
      await tester.pumpAndSettle();
      expect(current.crestShape, 'circle');
      expect(current.crestLayout, 'ring');
      expect(find.text('Anillo y texto'), findsOneWidget);
      expect(find.text('Franja arriba'), findsNothing);

      // Cambiar a Diamante -> cambia a layouts de diamante ("Bisel interior", "Galón")
      final diamondFinder = find.text('Diamante');
      await tester.ensureVisible(diamondFinder);
      await tester.tap(diamondFinder);
      await tester.pumpAndSettle();
      expect(current.crestShape, 'diamond');
      expect(current.crestLayout, 'bevel');
      expect(find.text('Bisel interior'), findsOneWidget);

      // Elegir Galón, emblema Corona, texto y detalles
      final chevronFinder = find.text('Galón');
      await tester.ensureVisible(chevronFinder);
      await tester.tap(chevronFinder);
      await tester.pumpAndSettle();
      expect(current.crestLayout, 'chevron');

      final fields = find.byType(TextField);
      await tester.ensureVisible(fields.at(0));
      await tester.enterText(fields.at(0), 'PATAGONIA');
      await tester.ensureVisible(fields.at(1));
      await tester.enterText(fields.at(1), '1998');
      await tester.pumpAndSettle();
      expect(current.crestText, 'PATAGONIA');
      expect(current.crestSubtitle, '1998');

      final starsFinder = find.text('★★★ 3');
      await tester.ensureVisible(starsFinder);
      await tester.tap(starsFinder);
      await tester.pumpAndSettle();
      expect(current.crestStars, 3);

      final laurelFinder = find.text('Laureles');
      await tester.ensureVisible(laurelFinder);
      await tester.tap(laurelFinder);
      await tester.pumpAndSettle();
      expect(current.crestLaurel, isTrue);

      // Cambiar a Subir PNG y seleccionar el archivo temporal
      final uploadSeg = find.text('Subir PNG');
      await tester.ensureVisible(uploadSeg);
      await tester.tap(uploadSeg);
      await tester.pumpAndSettle();

      final pickFinder = find.text('Elegir PNG de galería');
      await tester.ensureVisible(pickFinder);
      await tester.tap(pickFinder);
      await tester.pumpAndSettle();
      expect(current.crestMode, 'uploaded');
      expect(pickedLocal?.path, testPng!.path);

      final clipFinder = find.text('Recorte circular');
      await tester.ensureVisible(clipFinder);
      await tester.tap(clipFinder);
      await tester.pumpAndSettle();
      expect(current.crestClipCircle, isTrue);

      await tester.tap(find.text('En camiseta'));
      await tester.pumpAndSettle();
      expect(find.byType(JerseyWidget), findsWidgets);
    },
  );
}
