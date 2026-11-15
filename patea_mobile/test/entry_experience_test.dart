import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:patea_mobile/core/widgets/patea_states.dart';
import 'package:patea_mobile/core/widgets/patea_background.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/core/widgets/patea_top_header.dart';
import 'package:patea_mobile/core/widgets/patea_notifications_sheet.dart';
import 'package:patea_mobile/features/auth/login_screen.dart';
import 'package:patea_mobile/features/dashboard/dashboard_screen.dart';
import 'package:patea_mobile/features/splash/splash_screen.dart';

import 'goldens/arnes.dart';

final _captureKey = GlobalKey();

Future<void> _mount(
  WidgetTester tester,
  Widget page, {
  bool light = false,
  double scale = 1.3,
}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({'welcomeShown': true});
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ...overridesDelArnes(),
        unreadNotificationsCountProvider.overrideWith((ref) => Stream.value(2)),
      ],
      child: MaterialApp(
        theme: light ? AppTheme.lightTheme : AppTheme.darkTheme,
        debugShowCheckedModeBanner: false,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(scale),
            disableAnimations: true,
          ),
          child: child!,
        ),
        home: RepaintBoundary(
          key: _captureKey,
          child: page is DashboardScreen ? PateaBackground(child: page) : page,
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.runAsync(
    () => Future<void>.delayed(const Duration(milliseconds: 150)),
  );
  await tester.pump(const Duration(seconds: 1));
  await tester.runAsync(
    () => Future<void>.delayed(const Duration(milliseconds: 150)),
  );
  await tester.pump();
  for (var frame = 0; frame < 3; frame++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 100)),
    );
    await tester.pump();
  }
}

Future<void> _capture(WidgetTester tester, String name) async {
  if (!const bool.fromEnvironment('PATEA_CAPTURE_UI')) return;
  // Esperar las tareas reales de pintura vectorial; los delays dejan placeholders.
  for (var frame = 0; frame < 3; frame++) {
    await tester.runAsync(() => vg.waitForPendingDecodes());
    await tester.pump();
  }
  await tester.pumpAndSettle();
  await tester.runAsync(() async {
    final boundary =
        _captureKey.currentContext!.findRenderObject()!
            as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    final folder = Directory('build/visual-review')
      ..createSync(recursive: true);
    File(
      '${folder.path}/$name.png',
    ).writeAsBytesSync(bytes!.buffer.asUint8List());
    image.dispose();
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    AppTypography.headline();
    AppTypography.body();
    AppTypography.jersey();
    AppTypography.code();
    GoogleFonts.bebasNeue();
    AppTypography.condensed();
    for (final weight in [
      FontWeight.w400,
      FontWeight.w500,
      FontWeight.w600,
      FontWeight.w700,
      FontWeight.w800,
    ]) {
      AppTypography.code(weight: weight);
      AppTypography.body(weight: weight);
      if (weight.value <= FontWeight.w700.value) {
        AppTypography.headline(weight: weight);
      }
    }
    final icons = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
    await GoogleFonts.pendingFonts();
  });

  for (final light in [false, true]) {
    final mode = light ? 'claro' : 'cancha';
    testWidgets('acceso $mode: ingreso y registro legibles a 1.3x', (
      tester,
    ) async {
      await _mount(tester, const LoginScreen(), light: light);
      expect(tester.takeException(), isNull);
      await _capture(tester, 'login_$mode');
      await tester.ensureVisible(find.text('Entrar a Pateá'));
      await tester.tap(find.text('Entrar a Pateá'));
      await tester.pump();
      expect(find.text('Escribí un correo válido.'), findsOneWidget);
      expect(find.text('Escribí tu contraseña.'), findsOneWidget);
      await tester.ensureVisible(find.text('Crear cuenta'));
      await tester.tap(find.text('Crear cuenta'));
      await tester.pumpAndSettle();
      expect(find.text('Nombre o apodo'), findsOneWidget);
      expect(find.text('Golero'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('panel $mode: próxima convocatoria y acciones sin desbordes', (
      tester,
    ) async {
      await _mount(tester, const DashboardScreen(), light: light);
      expect(find.text('Armar partido'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await _capture(tester, 'dashboard_$mode');
    });

    testWidgets('cabecera $mode: marca y acciones accesibles a 1.3x', (
      tester,
    ) async {
      await _mount(
        tester,
        Scaffold(
          appBar: PateaTopHeader(
            overrideUserName: 'Un nombre extraordinariamente largo',
            onHelpTap: () {},
            onNotificationsTap: () {},
            onProfileTap: () {},
          ),
        ),
        light: light,
      );
      expect(find.byTooltip('Cómo funciona Pateá'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await _capture(tester, 'header_$mode');
    });
  }

  testWidgets('splash respeta movimiento reducido y muestra marca', (
    tester,
  ) async {
    await _mount(tester, const SplashScreen());
    await tester.pumpAndSettle();
    expect(find.text('El fútbol que nos junta.'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await _capture(tester, 'splash');
  });
  testWidgets('carga mantiene semántica en espacios pequeños sin desbordar', (
    tester,
  ) async {
    for (final height in [0.0, 24.0, 60.0, 80.0]) {
      await _mount(
        tester,
        Scaffold(
          body: Center(
            child: SizedBox(
              width: 180,
              height: height,
              child: const PateaLoading(),
            ),
          ),
        ),
      );
      expect(
        tester.takeException(),
        isNull,
        reason: 'alto disponible: $height',
      );
      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget is Semantics && widget.properties.label == 'Cargando',
        ),
        findsOneWidget,
      );
    }
  });
}
