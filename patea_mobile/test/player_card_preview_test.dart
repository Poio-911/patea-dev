import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/models/player_model.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/core/widgets/patea_card.dart';
import 'package:patea_mobile/core/widgets/player_card_preview.dart';

final entry = MatchPlayerEntry(
  uid: 'preview-player',
  displayName: 'Aurelio',
  position: 'DEL',
  ovr: 57,
);
final player = PlayerModel(
  id: entry.uid,
  ownerUid: entry.uid,
  name: entry.displayName,
  position: 'DEL',
  ovr: 57,
  pac: 58,
  sho: 64,
  pas: 59,
  dri: 60,
  def: 42,
  phy: 56,
);

Future<void> mount(
  WidgetTester tester, {
  bool light = false,
  double scale = 1.3,
  Size size = const Size(360, 800),
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final router = GoRouter(
    routes: [
      GoRoute(
        path: '/',
        builder: (context, _) => Scaffold(
          body: Center(
            child: TextButton(
              onPressed: () => showPlayerCardPreview(context, entry),
              child: const Text('Abrir ficha'),
            ),
          ),
        ),
      ),
      GoRoute(
        path: '/players/:id',
        builder: (_, _) =>
            const Scaffold(body: Center(child: Text('Perfil abierto'))),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        singlePlayerStreamProvider(
          entry.uid,
        ).overrideWith((ref) => Stream.value(player)),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        theme: light ? AppTheme.lightTheme : AppTheme.darkTheme,
        debugShowCheckedModeBanner: false,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(scale),
            disableAnimations: true,
          ),
          child: RepaintBoundary(
            key: const ValueKey('preview-capture'),
            child: child!,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('Abrir ficha'));
  await tester.pumpAndSettle();
}

Future<void> capture(WidgetTester tester, String name) async {
  if (!const bool.fromEnvironment('CAPTURE_PLAYER_PREVIEW')) return;
  final boundary = tester.renderObject<RenderRepaintBoundary>(
    find.byKey(const ValueKey('preview-capture')),
  );
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    final output = File('build/overlay-review/$name.png');
    await output.parent.create(recursive: true);
    await output.writeAsBytes(bytes!.buffer.asUint8List());
    image.dispose();
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    final icons = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
    for (final weight in [
      FontWeight.w400,
      FontWeight.w600,
      FontWeight.w700,
      FontWeight.w800,
    ]) {
      AppTypography.headline(weight: weight);
      AppTypography.body(weight: weight);
      AppTypography.code(weight: weight);
      AppTypography.sportNumber(weight: weight);
    }
    await GoogleFonts.pendingFonts();
  });
  for (final light in [false, true]) {
    testWidgets('card is the only surface and close works, light=$light', (
      tester,
    ) async {
      await mount(tester, light: light);
      expect(find.byType(BottomSheet), findsNothing);
      expect(find.byType(PateaCard), findsNothing);
      expect(
        tester.widget<Dialog>(find.byType(Dialog)).backgroundColor,
        Colors.transparent,
      );
      expect(
        tester.getSize(find.byKey(const ValueKey('player-card-preview'))).width,
        greaterThan(255),
      );
      expect(find.text('Aurelio'), findsOneWidget);
      await capture(tester, light ? 'player-light' : 'player-game');
      await tester.tap(find.byTooltip('Cerrar ficha'));
      await tester.pumpAndSettle();
      expect(find.byType(Dialog), findsNothing);
      expect(tester.takeException(), isNull);
    });
    testWidgets('profile action closes preview and navigates, light=$light', (
      tester,
    ) async {
      await mount(tester, light: light);
      await tester.tap(find.text('Ver perfil completo'));
      await tester.pumpAndSettle();
      expect(find.text('Perfil abierto'), findsOneWidget);
      expect(find.byType(Dialog), findsNothing);
    });
    testWidgets(
      'small screen at text 2x keeps close and profile accessible, light=$light',
      (tester) async {
        await mount(tester, light: light, scale: 2, size: const Size(360, 640));
        expect(find.byTooltip('Cerrar ficha').hitTestable(), findsOneWidget);
        await tester.ensureVisible(find.text('Ver perfil completo'));
        expect(find.text('Ver perfil completo').hitTestable(), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
