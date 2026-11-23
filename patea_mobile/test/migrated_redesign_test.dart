import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:patea_mobile/core/models/achievement_model.dart';
import 'package:patea_mobile/core/models/coach_models.dart';
import 'package:patea_mobile/core/services/achievements_service.dart';
import 'package:patea_mobile/core/services/auth_service.dart';
import 'package:patea_mobile/core/services/coach_service.dart';
import 'package:patea_mobile/core/services/credits_store_service.dart';
import 'package:patea_mobile/core/services/social_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/widgets/patea_background.dart';
import 'package:patea_mobile/features/achievements/achievements_screen.dart';
import 'package:patea_mobile/features/coach/ai_chat_screen.dart';
import 'package:patea_mobile/features/coach/player_analysis_screen.dart';
import 'package:patea_mobile/features/settings/settings_screen.dart';

Widget _wrap({
  required Widget child,
  required ThemeData theme,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      theme: theme,
      builder: (context, inner) => MediaQuery(
        data: MediaQuery.of(context).copyWith(
          textScaler: const TextScaler.linear(1.3),
        ),
        child: PateaBackground(child: inner ?? const SizedBox.shrink()),
      ),
      home: child,
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  final fakeAchievements = AchievementsResult(
    [
      Achievement(
        id: 'first_goal',
        name: 'Primer grito',
        description: 'Convertiste tu primer gol en un partido.',
        icon: 'target',
        category: AchievementCategory.performance,
        required: 1,
        current: 1,
        unlockedAt: DateTime(2026, 9, 10),
      ),
      const Achievement(
        id: 'streak_5',
        name: 'En racha',
        description: 'Jugá 5 partidos seguidos con tu grupo.',
        icon: 'flame',
        category: AchievementCategory.milestones,
        required: 5,
        current: 3,
        unlockedAt: null,
      ),
    ],
    {'first_goal'},
  );

  const fakeAnalysis = AnalysisResult(
    PlayerAnalysis(
      headline: 'Volante con llegada y buen pase corto',
      summary: 'Venís sosteniendo un nivel parejo en los últimos cuatro partidos.',
      strengths: [
        AnalysisItem('Primer toque limpio', 'Perdés pocas pelotas saliendo del fondo.'),
      ],
      improvements: [
        AnalysisItem('Definición de media distancia', 'Probá más al arco cuando quedás de frente.'),
      ],
      patterns: ['Rendís mejor cuando jugás por el centro.'],
      plan: ['Buscá descargas rápidas al pivot.', 'Llegá al área en segunda línea.'],
    ),
  );

  for (final entry in {
    'dark': AppTheme.darkTheme,
    'light': AppTheme.lightTheme,
  }.entries) {
    final themeName = entry.key;
    final theme = entry.value;

    testWidgets('AchievementsScreen ($themeName, 1.3x)', (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        _wrap(
          theme: theme,
          overrides: [
            achievementsProvider.overrideWith((ref) async => fakeAchievements),
          ],
          child: const AchievementsScreen(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Vitrina de logros'), findsOneWidget);
      expect(find.text('Primer grito'), findsOneWidget);
      expect(find.text('En racha'), findsOneWidget);
      expect(find.text('NUEVO'), findsOneWidget);

      await tester.tap(find.text('Conseguidos'));
      await tester.pumpAndSettle();
      expect(find.text('Primer grito'), findsOneWidget);
      expect(find.text('En racha'), findsNothing);

      await tester.tap(find.text('En progreso'));
      await tester.pumpAndSettle();
      expect(find.text('Primer grito'), findsNothing);
      expect(find.text('En racha'), findsOneWidget);

      expect(tester.takeException(), isNull);
    });

    testWidgets('SettingsScreen ($themeName, 1.3x)', (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        _wrap(
          theme: theme,
          overrides: [
            authStateProvider.overrideWith((ref) => Stream.value(null)),
            notificationsAllowedProvider.overrideWith((ref) async => true),
            blockedUidsStreamProvider.overrideWith((ref) => Stream.value({})),
            creditsStoreEnabledProvider.overrideWith((ref) async => false),
          ],
          child: const SettingsScreen(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Configuración'), findsOneWidget);
      expect(find.text('Apariencia'), findsOneWidget);
      expect(find.text('ACTIVAS'), findsOneWidget);
      expect(find.text('Cerrar sesión'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('PlayerAnalysisScreen ($themeName, 1.3x)', (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        _wrap(
          theme: theme,
          overrides: [
            playerAnalysisProvider.overrideWith((ref) async => fakeAnalysis),
          ],
          child: const PlayerAnalysisScreen(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Volante con llegada y buen pase corto'), findsOneWidget);
      expect(find.text('Lo que te sale'), findsOneWidget);
      expect(find.text('Para trabajar'), findsOneWidget);
      expect(find.text('Lo que se repite'), findsOneWidget);
      expect(find.text('Para los próximos partidos'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('AiChatScreen.coach & .help ($themeName, 1.3x)', (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        _wrap(
          theme: theme,
          child: AiChatScreen.coach(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Datos reales de tus partidos'), findsOneWidget);
      expect(find.text('IDEAS PARA ARRANCAR'), findsOneWidget);
      expect(find.text('¿Cómo vengo jugando?'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(
        _wrap(
          theme: theme,
          child: AiChatScreen.help(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Guía oficial de Pateá'), findsOneWidget);
      expect(find.text('¿Cómo armo un partido?'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
