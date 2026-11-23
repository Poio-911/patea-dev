// Dibuja las pantallas de Logros y Configuración con datos de ejemplo, para
// mirarlas sin un teléfono ni el servidor. No son goldens: no comparan nada.
//
//   flutter test --no-pub --update-goldens tool/screens_preview_test.dart
//
// Salen en `build/preview/`.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader, rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:patea_mobile/core/models/achievement_model.dart';
import 'package:patea_mobile/core/services/achievements_service.dart';
import 'package:patea_mobile/core/services/credits_store_service.dart';
import 'package:patea_mobile/core/services/social_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/features/achievements/achievements_screen.dart';
import 'package:patea_mobile/features/settings/settings_screen.dart';

import '../test/goldens/arnes.dart';

Achievement _a(
  String id,
  String name,
  String desc,
  String icon,
  AchievementCategory cat,
  int req,
  int cur, {
  bool done = false,
}) => Achievement(
  id: id,
  name: name,
  description: desc,
  icon: icon,
  category: cat,
  required: req,
  current: cur,
  unlockedAt: done ? DateTime(2026, 11, 20) : null,
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    GoogleFonts.config.allowRuntimeFetching = false;
    final material = FontLoader('MaterialIcons');
    material.addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await material.load();
    for (final p in const [
      FontWeight.w400,
      FontWeight.w500,
      FontWeight.w600,
      FontWeight.w700,
      FontWeight.w800,
    ]) {
      AppTypography.headline(weight: p);
      AppTypography.body(weight: p);
    }
    await GoogleFonts.pendingFonts();
  });

  final result = AchievementsResult(
    [
      _a('first_goal', 'Primer Gol', 'Marcaste tu primer gol', 'target',
          AchievementCategory.performance, 1, 1, done: true),
      _a('ten_goals', 'Goleador', 'Marcaste 10 goles en total', 'flame',
          AchievementCategory.performance, 10, 5),
      _a('fifty_goals', 'Leyenda', 'Marcaste 50 goles en total', 'crown',
          AchievementCategory.performance, 50, 5),
      _a('first_match', 'Debut', 'Jugaste tu primer partido', 'play',
          AchievementCategory.milestones, 1, 1, done: true),
      _a('ten_matches', 'Regular', 'Jugaste 10 partidos', 'calendar',
          AchievementCategory.milestones, 10, 3),
      _a('champion', 'Campeón', 'Ganaste una liga o copa', 'trophy',
          AchievementCategory.competition, 1, 0),
      _a('first_follower', 'Conocido', 'Conseguiste tu primer seguidor',
          'user-plus', AchievementCategory.social, 1, 1, done: true),
    ],
    {'first_follower'},
  );

  testWidgets('logros', (tester) async {
    final errors = await montarPantalla(
      tester,
      const AchievementsScreen(),
      tema: AppTheme.darkTheme,
      extraOverrides: [
        achievementsProvider.overrideWith((ref) async => result),
      ],
    );
    expect(errors, isEmpty);
    await tester.pump(const Duration(milliseconds: 400));
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../build/preview/logros.png'),
    );
  });

  testWidgets('configuración', (tester) async {
    final errors = await montarPantalla(
      tester,
      const SettingsScreen(),
      tema: AppTheme.darkTheme,
      extraOverrides: [
        notificationsAllowedProvider.overrideWith((ref) async => false),
        blockedUidsStreamProvider.overrideWith(
          (ref) => Stream.value(const {'a', 'b'}),
        ),
        creditsStoreEnabledProvider.overrideWith((ref) async => true),
      ],
    );
    expect(errors, isEmpty);
    await tester.pump(const Duration(milliseconds: 400));
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../build/preview/configuracion.png'),
    );
  });
}
