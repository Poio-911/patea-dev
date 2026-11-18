import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/services/profile_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/features/players/portrait_studio_screen.dart';
import 'goldens/arnes.dart';

class StudioService extends Fake implements ProfileService {
  int previews = 0, applies = 0;
  String? primary, pattern;
  @override
  Future<String> uploadProfilePhoto(File file) async =>
      'https://example.com/source.png';
  @override
  Future<PortraitDraft> previewAiPhoto({
    String? sourcePhotoUrl,
    required String primaryColor,
    required String secondaryColor,
    required String pattern,
  }) async {
    previews++;
    primary = primaryColor;
    this.pattern = pattern;
    return const PortraitDraft(
      id: 'draft',
      photoUrl: 'https://example.com/result.png',
      creditsRemaining: 0,
    );
  }

  @override
  Future<void> applyAiPhoto(String id) async {
    applies++;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(
    () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (_) async => null),
  );
  for (final light in [false, true]) {
    testWidgets('studio colors, credit and unapplied preview ($light)', (
      tester,
    ) async {
      final service = StudioService();
      final boundary = GlobalKey();
      final errors = await montarPantalla(
        tester,
        RepaintBoundary(
          key: boundary,
          child: PortraitStudioScreen(
            player: jugadores.first,
            initialPhoto: File(
              '../output/profile-photo-smoke/2026-11-18/source.png',
            ),
          ),
        ),
        tema: light ? AppTheme.lightTheme : AppTheme.darkTheme,
        extraOverrides: [profileServiceProvider.overrideWithValue(service)],
      );
      expect(errors, isEmpty);
      await tester.scrollUntilVisible(find.text('Color principal'), 250);
      await tester.tap(find.byTooltip('Rojo').first);
      await tester.scrollUntilVisible(find.text('Generar con IA'), 250);
      await tester.tap(find.text('Generar con IA'));
      await tester.pump(const Duration(milliseconds: 400));
      expect(service.previews, 1);
      expect(service.primary, '#D64A41');
      expect(service.pattern, 'plain');
      expect(service.applies, 0);
      await tester.scrollUntilVisible(find.text('Usar esta foto'), 200);
      expect(
        find.text('Aplicar esta foto no usa otro crédito.'),
        findsOneWidget,
      );
      expect(find.text('Sin créditos disponibles este mes.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
