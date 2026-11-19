import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/player_model.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/core/theme/patea_colors.dart';
import 'package:patea_mobile/core/widgets/player_card_widget.dart';

PlayerModel _player({
  String position = 'MED',
  String? photoUrl,
  double cropZoom = 1,
  int ovr = 100,
  String name = 'Santiago Fernández de la Cancha',
}) => PlayerModel(
  id: 'player-review',
  name: name,
  position: position,
  ovr: ovr,
  pac: 81,
  sho: 62,
  pas: 73,
  dri: 84,
  def: 95,
  phy: 66,
  photoUrl: photoUrl,
  cropZoom: cropZoom,
);

Future<void> _mount(
  WidgetTester tester,
  Widget content, {
  bool light = false,
  double scale = 1.3,
}) async {
  tester.view.physicalSize = const Size(1080, 2700);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: light ? AppTheme.lightTheme : AppTheme.darkTheme,
      debugShowCheckedModeBanner: false,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(
          textScaler: TextScaler.linear(scale),
          disableAnimations: true,
        ),
        child: child!,
      ),
      home: Scaffold(body: content),
    ),
  );
  await tester.pump();
  await tester.runAsync(
    () => Future<void>.delayed(const Duration(milliseconds: 80)),
  );
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    for (final weight in [FontWeight.w400, FontWeight.w600, FontWeight.w700]) {
      AppTypography.headline(weight: weight);
      AppTypography.body(weight: weight);
    }
    AppTypography.sportNumber(weight: FontWeight.w700);
    await GoogleFonts.pendingFonts();
    for (var index = 1; index <= 4; index++) {
      final ready = Completer<void>();
      AssetImage('assets/avatars/player$index.png')
          .resolve(ImageConfiguration.empty)
          .addListener(
            ImageStreamListener(
              (_, _) => ready.isCompleted ? null : ready.complete(),
              onError: (_, _) => ready.isCompleted ? null : ready.complete(),
            ),
          );
      await ready.future;
    }
  });

  for (final light in [false, true]) {
    testWidgets(
      'nombre sobre la fila compartida de posición y OVR, claro=$light',
      (tester) async {
        await _mount(
          tester,
          Center(
            child: SizedBox(
              width: 161,
              child: PlayerCardWidget(
                player: _player(name: 'Cosme', ovr: 50),
                photoStyle: CardPhotoStyle.halfTop,
              ),
            ),
          ),
          light: light,
        );
        final name = tester.getRect(find.text('Cosme'));
        final position = tester.getRect(find.text('MED'));
        final score = tester.getRect(find.text('50'));
        expect(name.bottom, lessThanOrEqualTo(position.top));
        final accountStatus = tester.getRect(find.text('Sin cuenta'));
        expect(position.bottom, lessThanOrEqualTo(accountStatus.top));
        final identityBlock = position.expandToInclude(accountStatus);
        expect((identityBlock.center.dy - score.center.dy).abs(), lessThan(2));
        expect(tester.takeException(), isNull);
      },
    );
    for (final width in [141.0, 161.0, 260.0]) {
      testWidgets(
        'ficha ${light ? 'clara' : 'cancha'} de $width mantiene datos y OVR visibles a 1.3x',
        (tester) async {
          await _mount(
            tester,
            Center(
              child: SizedBox(
                width: width,
                child: PlayerCardWidget(
                  player: _player(),
                  photoStyle: CardPhotoStyle.halfTop,
                ),
              ),
            ),
            light: light,
          );
          expect(tester.takeException(), isNull);
          for (final label in [
            'RIT',
            'TIR',
            'PAS',
            'REG',
            'DEF',
            'FIS',
            'OVR',
          ]) {
            expect(find.text(label), findsOneWidget);
          }
          final photo = tester.getRect(
            find
                .ancestor(of: find.text('OVR'), matching: find.byType(ClipRect))
                .first,
          );
          final ovr = tester.getRect(find.text('OVR'));
          expect(photo.contains(ovr.topLeft), isTrue);
          expect(
            photo.contains(ovr.bottomRight),
            isTrue,
            reason: 'La etiqueta no puede quedar recortada por el retrato.',
          );
          final material = tester.widget<Material>(
            find
                .descendant(
                  of: find.byType(PlayerCardWidget),
                  matching: find.byType(Material),
                )
                .first,
          );
          expect(
            material.color,
            light ? PateaColors.light.card : PateaColors.game.card,
          );
          final size = tester.getSize(find.byType(PlayerCardWidget));
          expect(size.height / size.width, closeTo(1.5, 0.001));
        },
      );
    }

    testWidgets(
      'ficha grande ${light ? 'clara' : 'cancha'} respeta texto 2x y atributos de golero',
      (tester) async {
        await _mount(
          tester,
          Center(
            child: SizedBox(
              width: 260,
              child: PlayerCardWidget(
                player: _player(position: 'POR'),
                matchStatusText: 'Confirmado',
                photoStyle: CardPhotoStyle.circular,
                highlightStat: 'DRI',
                manualTiltX: .1,
                manualTiltY: -.1,
              ),
            ),
          ),
          light: light,
          scale: 2,
        );
        for (final label in [
          'EST',
          'REF',
          'PAR',
          'VEL',
          'SAQ',
          'POS',
          'Confirmado',
        ]) {
          expect(find.text(label), findsOneWidget);
        }
        expect(find.text('RIT'), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets('captura ficha ${light ? 'clara' : 'cancha'}', (tester) async {
      final key = GlobalKey();
      await _mount(
        tester,
        Center(
          child: RepaintBoundary(
            key: key,
            child: Container(
              padding: const EdgeInsets.all(18),
              color: light
                  ? PateaColors.light.background
                  : PateaColors.game.background,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 141,
                        child: PlayerCardWidget(
                          player: _player(ovr: 93, name: 'Santiago Fernández'),
                          photoStyle: CardPhotoStyle.halfTop,
                        ),
                      ),
                      const SizedBox(width: 14),
                      SizedBox(
                        width: 141,
                        child: PlayerCardWidget(
                          player: _player(
                            position: 'POR',
                            ovr: 76,
                            name: 'Diego Suárez',
                          ),
                          photoStyle: CardPhotoStyle.circular,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: 260,
                    child: PlayerCardWidget(
                      player: _player(ovr: 82, name: 'Santiago Fernández'),
                      photoStyle: CardPhotoStyle.halfTop,
                      assetPhoto: 'assets/avatars/player1.png',
                      highlightStat: 'PAS',
                      matchStatusText: 'Confirmado',
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        light: light,
      );
      expect(tester.takeException(), isNull);
      if (const bool.fromEnvironment('PATEA_CAPTURE_CARD')) {
        await tester.runAsync(() async {
          final boundary =
              key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
          final picture = await boundary.toImage(pixelRatio: 2);
          final bytes = await picture.toByteData(
            format: ui.ImageByteFormat.png,
          );
          final folder = Directory('build/visual-review')
            ..createSync(recursive: true);
          File(
            '${folder.path}/player_card_${light ? 'claro' : 'cancha'}.png',
          ).writeAsBytesSync(bytes!.buffer.asUint8List());
          picture.dispose();
        });
      }
    });
  }

  testWidgets(
    'arrastrar una ficha desplaza el plantel y tocarla abre una sola vez',
    (tester) async {
      final scroll = ScrollController();
      addTearDown(scroll.dispose);
      var taps = 0;
      await _mount(
        tester,
        ListView(
          controller: scroll,
          children: [
            Center(
              child: SizedBox(
                width: 161,
                child: PlayerCardWidget(player: _player(), onTap: () => taps++),
              ),
            ),
            const SizedBox(height: 1400),
          ],
        ),
      );
      await tester.drag(find.byType(PlayerCardWidget), const Offset(0, -150));
      await tester.pumpAndSettle();
      expect(scroll.offset, greaterThan(0));
      expect(taps, 0);
      scroll.jumpTo(0);
      await tester.pumpAndSettle();
      await tester.tap(find.byType(PlayerCardWidget));
      expect(taps, 1);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('un encuadre guardado en zoom 4 conserva su ampliación', (
    tester,
  ) async {
    await _mount(
      tester,
      Center(
        child: SizedBox(
          width: 260,
          child: PlayerCardWidget(
            player: _player(cropZoom: 4),
            assetPhoto: 'assets/avatars/player1.png',
            photoStyle: CardPhotoStyle.halfTop,
          ),
        ),
      ),
    );
    final transforms = tester.widgetList<Transform>(
      find.descendant(
        of: find.byType(PlayerCardWidget),
        matching: find.byType(Transform),
      ),
    );
    expect(
      transforms.any(
        (widget) =>
            widget.transform.entry(0, 0) == 4 &&
            widget.transform.entry(1, 1) == 4,
      ),
      isTrue,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'asset ausente vuelve al avatar y conserva nombre accesible completo',
    (tester) async {
      final handle = tester.ensureSemantics();

      await _mount(
        tester,
        Center(
          child: SizedBox(
            width: 161,
            child: PlayerCardWidget(
              player: _player(),
              assetPhoto: 'assets/no-existe.png',
              onTap: () {},
            ),
          ),
        ),
      );
      expect(tester.takeException(), isNull);
      final semantics = tester
          .getSemantics(find.byType(PlayerCardWidget))
          .getSemanticsData();
      expect(semantics.label, contains('Santiago Fernández de la Cancha'));
      expect(semantics.label, contains('Pase 73'));
      expect(semantics.label, contains('OVR 100'));
      handle.dispose();
    },
  );
}
