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
import 'package:patea_mobile/features/groups/crest_crop_sheet.dart';
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

/// Borra la carpeta temporal sin hacer fallar el test: en Windows el
/// antivirus o el indexador pueden tener el archivo abierto un instante.
void _safeDelete(Directory dir) {
  try {
    if (dir.existsSync()) dir.deleteSync(recursive: true);
  } catch (_) {
    // Es una carpeta del temporal del sistema: si queda, no molesta.
  }
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
        final colored = applyColorsToSvg(raw, template, '#FFFFFF', '#DC2626');

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
        crestUrl: 'https://firebasestorage.googleapis.com/v0/b/patea/crest.png',
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

  test(
    'copyWith: borrar la URL sin decir el modo deja "sin escudo", no un "subido" vacío',
    () {
      final uploaded = JerseyModel(
        crestMode: 'uploaded',
        crestUrl:
            'https://firebasestorage.googleapis.com/v0/b/b/o/team-crests%2Fg%2Fu%2Fc.png',
      );
      expect(uploaded.isUploadedCrest, isTrue);

      final cleared = uploaded.copyWith(crestUrl: '');
      expect(cleared.crestMode, 'none');
      expect(cleared.isUploadedCrest, isFalse);
      expect(cleared.hasCrest, isFalse);

      // La pantalla de subida sí quiere quedarse en el modo para mostrar el
      // selector de archivo: lo pide explícito y se respeta.
      final keepsMode = uploaded.copyWith(crestUrl: '', crestMode: 'uploaded');
      expect(keepsMode.crestMode, 'uploaded');
      expect(keepsMode.isUploadedCrest, isFalse);
    },
  );

  test('las estrellas y la corona achican el escudo sin aplastarlo', () {
    const canvas = Size(120, 120);
    final plain = crestShieldRect(
      canvas,
      hasTopOrnaments: false,
      hasLaurel: false,
    );
    final aspect = plain.width / plain.height;

    for (final (top, laurel) in [(true, false), (false, true), (true, true)]) {
      final rect = crestShieldRect(
        canvas,
        hasTopOrnaments: top,
        hasLaurel: laurel,
      );
      expect(
        rect.width / rect.height,
        closeTo(aspect, 1e-6),
        reason: 'top=$top laurel=$laurel cambió la proporción del escudo',
      );
      expect(rect.height, lessThanOrEqualTo(plain.height));
      // Queda centrado y dentro del lienzo.
      expect(rect.center.dx, closeTo(canvas.width / 2, 1e-6));
      expect(rect.left, greaterThanOrEqualTo(0));
      expect(rect.right, lessThanOrEqualTo(canvas.width));
      expect(rect.bottom, lessThanOrEqualTo(canvas.height));
    }

    // Con estrellas hay lugar arriba para dibujarlas.
    final withStars = crestShieldRect(
      canvas,
      hasTopOrnaments: true,
      hasLaurel: false,
    );
    expect(withStars.top, greaterThan(plain.top));
  });

  test(
    'plantillas de escudo: cada interior existe para su silueta y no pisan colores ni textos',
    () {
      expect(crestPresets.map((p) => p.id).toSet().length, crestPresets.length);

      final base = JerseyModel(
        pattern: 'hoops',
        primaryColor: '#DC2626',
        secondaryColor: '#171717',
        crestText: 'LOS GALACTICOS',
        crestSubtitle: '1998',
      );

      for (final preset in crestPresets) {
        expect(
          crestLayoutsForShape(
            preset.shape,
          ).any((l) => l['id'] == preset.layout),
          isTrue,
          reason:
              '${preset.id}: ${preset.layout} no es válido para ${preset.shape}',
        );
        expect(
          crestShapeOptions.any((s) => s['id'] == preset.shape),
          isTrue,
          reason: '${preset.id}: silueta desconocida ${preset.shape}',
        );
        expect(
          crestSymbolOptions.any((s) => s['id'] == preset.symbol),
          isTrue,
          reason: '${preset.id}: emblema desconocido ${preset.symbol}',
        );

        final applied = preset.applyTo(base);
        expect(applied.crestMode, 'custom');
        expect(preset.matches(applied), isTrue);
        // La identidad del equipo no se toca.
        expect(applied.pattern, 'hoops');
        expect(applied.primaryColor, '#DC2626');
        expect(applied.secondaryColor, '#171717');
        expect(applied.crestText, 'LOS GALACTICOS');
        expect(applied.crestSubtitle, '1998');
        // Y tampoco una plantilla distinta se marca como activa a la vez.
        expect(crestPresets.where((p) => p.matches(applied)).map((p) => p.id), [
          preset.id,
        ]);
      }
    },
  );

  Future<void> pumpDesigner(
    WidgetTester tester, {
    required JerseyModel Function() current,
    required void Function(JerseyModel) onChanged,
    StudioTab tab = StudioTab.camiseta,
    File? Function()? local,
    void Function(File?)? onLocal,
    Future<File?> Function()? pick,
    ThemeData? theme,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: theme ?? AppTheme.darkTheme,
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) => JerseyDesigner(
              value: current(),
              teamName: 'Los Galácticos',
              initialTab: tab,
              localCrestFile: local?.call(),
              onLocalCrestFileChanged: onLocal == null
                  ? null
                  : (f) => setState(() => onLocal(f)),
              onPickCrestFile: pick,
              // En los tests el encuadre no abre la hoja: devuelve el archivo.
              onCropCrestFile: (_, f) async => f,
              expandPanel: true,
              onChanged: (next) => setState(() => onChanged(next)),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'elegir una plantilla aplica el escudo completo y queda marcada',
    (tester) async {
      var current = JerseyModel(
        primaryColor: '#2563EB',
        secondaryColor: '#FFFFFF',
      );
      await pumpDesigner(
        tester,
        current: () => current,
        onChanged: (n) => current = n,
        tab: StudioTab.escudo,
      );

      // Sin escudo todavía: las plantillas aparecen al pasar a "Diseñar".
      expect(find.text('Plantillas'), findsNothing);
      await tester.tap(find.text('Diseñar'));
      await tester.pumpAndSettle();
      expect(find.text('Plantillas'), findsOneWidget);

      await tester.tap(find.text('Campeón'));
      await tester.pumpAndSettle();

      final champion = crestPresets.firstWhere((p) => p.id == 'campeon');
      expect(champion.matches(current), isTrue);
      expect(current.crestStars, 3);
      expect(current.crestBorderColor, '#D97706');
      expect(current.primaryColor, '#2563EB');
    },
  );

  test(
    'colores parecidos: se detectan y el contraste propuesto sí se distingue',
    () {
      Color c(String hex) => hexToColor(hex);
      // Parecidos.
      expect(
        jerseyColorsTooSimilar(c('#DC2626'), c('#EA580C')),
        isTrue,
      ); // rojo/naranja
      expect(
        jerseyColorsTooSimilar(c('#2563EB'), c('#2563EB')),
        isTrue,
      ); // iguales
      expect(
        jerseyColorsTooSimilar(c('#DC2626'), c('#E11D48')),
        isTrue,
      ); // rojo/carmesí
      // Distintos.
      expect(jerseyColorsTooSimilar(c('#2563EB'), c('#FFFFFF')), isFalse);
      expect(jerseyColorsTooSimilar(c('#DC2626'), c('#171717')), isFalse);
      expect(jerseyColorsTooSimilar(c('#EAB308'), c('#171717')), isFalse);

      // Lo que propone "Contrastar" nunca es parecido al primario.
      for (final color in popularTeamColors) {
        final primary = color['hex']!;
        final fix = contrastingSecondaryHex(primary);
        expect(
          jerseyColorsTooSimilar(c(primary), c(fix)),
          isFalse,
          reason: '$primary -> $fix sigue sin distinguirse',
        );
      }
    },
  );

  testWidgets('aviso de colores parecidos con acción "Contrastar"', (
    tester,
  ) async {
    var current = JerseyModel(
      primaryColor: '#DC2626',
      secondaryColor: '#EA580C',
    );
    await pumpDesigner(
      tester,
      current: () => current,
      onChanged: (n) => current = n,
      tab: StudioTab.colores,
    );

    expect(find.textContaining('se parecen'), findsOneWidget);
    await tester.tap(find.text('Contrastar'));
    await tester.pumpAndSettle();
    expect(current.secondaryColor, '#FFFFFF');
    expect(current.primaryColor, '#DC2626');
    expect(find.textContaining('se parecen'), findsNothing);
  });

  test('adornos: cuánto achican el escudo', () {
    expect(crestOrnamentShrink(stars: 0, crownTop: false, laurel: false), 0);
    final stars = crestOrnamentShrink(stars: 3, crownTop: false, laurel: false);
    final both = crestOrnamentShrink(stars: 3, crownTop: true, laurel: true);
    expect(stars, greaterThan(0));
    expect(both, greaterThan(stars));
    expect(both, lessThan(0.5)); // sigue siendo un escudo, no un punto
  });

  testWidgets(
    'pestañas: el escudo y la camiseta quedan a la vista al cambiar de panel',
    (tester) async {
      var current = JerseyModel(
        primaryColor: '#2563EB',
        secondaryColor: '#FFFFFF',
        crestMode: 'custom',
        crestShape: 'classic',
      );
      await pumpDesigner(
        tester,
        current: () => current,
        onChanged: (n) => current = n,
      );

      for (final tab in StudioTab.values) {
        await tester.tap(find.text(tab.label));
        await tester.pumpAndSettle();
        // El lienzo de arriba no se va con la pestaña.
        expect(find.byType(JerseyWidget), findsWidgets, reason: tab.label);
        expect(find.byType(TeamCrestWidget), findsWidgets, reason: tab.label);
      }
    },
  );

  testWidgets('textos y marco sin escudo propio explican qué hacer', (
    tester,
  ) async {
    var current = JerseyModel(
      primaryColor: '#2563EB',
      secondaryColor: '#FFFFFF',
    );
    await pumpDesigner(
      tester,
      current: () => current,
      onChanged: (n) => current = n,
    );

    for (final tab in [StudioTab.textos, StudioTab.marco]) {
      await tester.tap(find.text(tab.label));
      await tester.pumpAndSettle();
      expect(find.text('Diseñar escudo'), findsOneWidget, reason: tab.label);
    }

    // Y el botón lleva directo a diseñar uno.
    await tester.tap(find.text('Diseñar escudo'));
    await tester.pumpAndSettle();
    expect(current.crestMode, 'custom');
    expect(find.text('Plantillas'), findsOneWidget);
  });

  testWidgets('adornos: un solo selector y avisa cuando achican el escudo', (
    tester,
  ) async {
    var current = JerseyModel(
      primaryColor: '#2563EB',
      secondaryColor: '#FFFFFF',
      crestMode: 'custom',
      crestShape: 'classic',
    );
    await pumpDesigner(
      tester,
      current: () => current,
      onChanged: (n) => current = n,
      tab: StudioTab.marco,
    );

    expect(find.text('Adornos'), findsOneWidget);
    expect(find.textContaining('más chico'), findsNothing);

    await tester.tap(find.text('★★★'));
    await tester.pumpAndSettle();
    expect(current.crestStars, 3);
    await tester.tap(find.text('Laureles'));
    await tester.pumpAndSettle();
    expect(current.crestLaurel, isTrue);
    await tester.tap(find.text('Corona superior'));
    await tester.pumpAndSettle();
    expect(current.crestCrownTop, isTrue);
    expect(find.textContaining('más chico'), findsOneWidget);
  });

  testWidgets('encuadre: se genera un PNG cuadrado de 512 con transparencia', (
    tester,
  ) async {
    File? png;
    await tester.runAsync(() async {
      png = await _createTempTransparentPng();
    });
    addTearDown(() {
      if (png != null && png!.parent.existsSync()) {
        _safeDelete(png!.parent);
      }
    });

    File? result;
    var closed = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.darkTheme,
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                result = await showCrestCropSheet(context, png!);
                closed = true;
              },
              child: const Text('abrir'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('abrir'));
    // Mientras decodifica hay un indicador animado: pumpAndSettle no termina.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Encuadrá tu escudo'), findsOneWidget);

    // Esperar la decodificación real de la imagen (async de verdad, no del
    // reloj falso del test): se consulta hasta que desaparece el indicador.
    for (var i = 0; i < 60; i++) {
      if (find.byType(CircularProgressIndicator).evaluate().isEmpty) break;
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 50)),
      );
      await tester.pump();
    }
    expect(find.byType(CircularProgressIndicator), findsNothing);

    await tester.tap(find.text('Usar recorte'));
    for (var i = 0; i < 60 && !closed; i++) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 50)),
      );
      await tester.pump(const Duration(milliseconds: 50));
    }
    await tester.pumpAndSettle();

    expect(closed, isTrue);
    expect(result, isNotNull);
    addTearDown(() {
      if (result != null && result!.parent.existsSync()) {
        _safeDelete(result!.parent);
      }
    });

    await tester.runAsync(() async {
      final codec = await ui.instantiateImageCodec(result!.readAsBytesSync());
      final frame = await codec.getNextFrame();
      final image = frame.image;
      expect(image.width, kCrestCropOutputSize);
      expect(image.height, kCrestCropOutputSize);
      final data = (await image.toByteData(
        format: ui.ImageByteFormat.rawRgba,
      ))!;
      int alphaAt(int x, int y) => data.getUint8((y * image.width + x) * 4 + 3);
      // El círculo rojo queda al centro y las esquinas siguen transparentes.
      expect(alphaAt(image.width ~/ 2, image.height ~/ 2), 255);
      expect(alphaAt(2, 2), 0);
    });
  });

  testWidgets('encuadre: cancelar no devuelve archivo', (tester) async {
    File? png;
    await tester.runAsync(() async {
      png = await _createTempTransparentPng();
    });
    addTearDown(() {
      if (png != null && png!.parent.existsSync()) {
        _safeDelete(png!.parent);
      }
    });

    File? result = File('sin-tocar');
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async =>
                  result = await showCrestCropSheet(context, png!),
              child: const Text('abrir'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('abrir'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(result, isNull);
  });

  testWidgets(
    'el taller adapta las opciones del escudo según la silueta y permite cargar una imagen',
    (tester) async {
      File? testPng;
      await tester.runAsync(() async {
        testPng = await _createTempTransparentPng();
      });
      addTearDown(() {
        if (testPng != null && testPng!.parent.existsSync()) {
          _safeDelete(testPng!.parent);
        }
      });

      var current = JerseyModel(
        pattern: 'plain',
        primaryColor: '#2563EB',
        secondaryColor: '#FFFFFF',
      );
      File? pickedLocal;

      await pumpDesigner(
        tester,
        current: () => current,
        onChanged: (n) => current = n,
        local: () => pickedLocal,
        onLocal: (f) => pickedLocal = f,
        pick: () async => testPng,
      );

      // Invertir colores (siempre disponible bajo el lienzo)
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

      // Elegir Circular -> layouts de círculo, sin "Franja arriba"
      final circularFinder = find.text('Circular');
      await tester.ensureVisible(circularFinder);
      await tester.tap(circularFinder);
      await tester.pumpAndSettle();
      expect(current.crestShape, 'circle');
      expect(current.crestLayout, 'ring');
      expect(find.text('Anillo y texto'), findsOneWidget);
      expect(find.text('Franja arriba'), findsNothing);

      // Diamante -> layouts de diamante
      final diamondFinder = find.text('Diamante');
      await tester.ensureVisible(diamondFinder);
      await tester.tap(diamondFinder);
      await tester.pumpAndSettle();
      expect(current.crestShape, 'diamond');
      expect(current.crestLayout, 'bevel');
      expect(find.text('Bisel interior'), findsOneWidget);

      final chevronFinder = find.text('Galón');
      await tester.ensureVisible(chevronFinder);
      await tester.tap(chevronFinder);
      await tester.pumpAndSettle();
      expect(current.crestLayout, 'chevron');

      // Textos
      await tester.tap(find.text('Textos'));
      await tester.pumpAndSettle();
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), 'PATAGONIA');
      await tester.enterText(fields.at(1), '1998');
      await tester.pumpAndSettle();
      expect(current.crestText, 'PATAGONIA');
      expect(current.crestSubtitle, '1998');

      // Marco y adornos
      await tester.tap(find.text('Marco'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('★★★'));
      await tester.pumpAndSettle();
      expect(current.crestStars, 3);
      await tester.tap(find.text('Laureles'));
      await tester.pumpAndSettle();
      expect(current.crestLaurel, isTrue);

      // Subir imagen
      await tester.tap(find.text('Escudo'));
      await tester.pumpAndSettle();
      final uploadSeg = find.text('Subir PNG');
      await tester.ensureVisible(uploadSeg);
      await tester.tap(uploadSeg);
      await tester.pumpAndSettle();

      final pickFinder = find.text('Elegir de galería');
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

      expect(find.byType(JerseyWidget), findsWidgets);
    },
  );
}
