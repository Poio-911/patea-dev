import 'package:patea_mobile/core/utils/clock.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/group_model.dart';
import 'package:patea_mobile/core/models/team_rival_model.dart';
import 'package:patea_mobile/core/services/team_challenge_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/features/groups/team_rivals_screen.dart';

class RivalsFake extends TeamChallengeService {
  bool manager;
  RivalsFake({this.manager = true});
  final row = <String, dynamic>{
    'rivalTeamId': 'rival',
    'name': 'Los del barrio',
    'groupName': 'Grupo visitante',
    'memberCount': 5,
    'favorite': false,
    'hidden': false,
    'played': 3,
    'wins': 2,
    'draws': 1,
    'losses': 0,
    'goalsFor': 7,
    'goalsAgainst': 3,
    'lastPlayedAt': '2026-11-18',
    'recent': [
      {'matchId': 'match', 'scoreFor': 2, 'scoreAgainst': 1},
    ],
  };
  @override
  Future<TeamRivalsPage> getTeamRivals(
    String ownTeamId, {
    bool includeHidden = false,
    String? hiddenCursor,
  }) async => TeamRivalsPage.fromMap({
    'canManage': manager,
    'rivals': [
      if (includeHidden || row['hidden'] != true)
        {...row, 'canChallenge': manager},
    ],
  });
  @override
  Future<void> setTeamRival(
    String ownTeamId,
    String rivalTeamId, {
    bool? favorite,
    bool? hidden,
    bool save = false,
  }) async {
    if (favorite != null) row['favorite'] = favorite;
    if (hidden != null) row['hidden'] = hidden;
  }
}

final team = GroupTeamModel(
  id: 'mine',
  name: 'Mi equipo',
  jersey: JerseyModel(),
  groupId: 'group',
);
Future<void> mount(
  WidgetTester tester,
  RivalsFake service, {
  bool light = false,
}) async {
  tester.view.physicalSize = const Size(960, 2100);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        teamChallengeServiceProvider.overrideWithValue(service),
        clockProvider.overrideWithValue(() => DateTime(2026, 11, 19)),
      ],
      child: MaterialApp(
        theme: light ? AppTheme.lightTheme : AppTheme.darkTheme,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: const TextScaler.linear(1.3)),
          child: child!,
        ),
        home: Scaffold(
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: TeamRivalsPanel(team: team),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    AppTheme.darkTheme;
    AppTheme.lightTheme;
    for (final w in [
      FontWeight.w400,
      FontWeight.w500,
      FontWeight.w600,
      FontWeight.w700,
    ]) {
      AppTypography.body(weight: w);
      AppTypography.headline(weight: w);
    }
    final icons = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
    await GoogleFonts.pendingFonts();
  });
  test('model keeps record and dates readable', () {
    final r = TeamRival.fromMap({
      'rivalTeamId': 'r',
      'wins': 2,
      'draws': 1,
      'losses': 0,
      'lastPlayedAt': '2026-11-19',
    });
    expect(r.record, '2G 1E 0P');
    expect(r.lastPlayedLabel(DateTime(2026, 11, 19)), 'Último partido: hoy');
  });
  for (final light in [false, true])
    testWidgets('rival controls fit 320px at 130%, light=$light', (
      tester,
    ) async {
      await mount(tester, RivalsFake(), light: light);
      expect(find.text('Los del barrio'), findsOneWidget);
      expect(find.text('2G 1E 0P'), findsOneWidget);
      expect(find.text('Revancha'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile(
          'goldens/team_rivals_${light ? 'claro' : 'game'}.png',
        ),
      );
    });
  testWidgets('read-only members cannot manage the saved list', (tester) async {
    await mount(tester, RivalsFake(manager: false));
    expect(find.text('Los del barrio'), findsOneWidget);
    expect(find.text('Revancha'), findsNothing);
    expect(find.text('Olvidar'), findsNothing);
    expect(find.byTooltip('Marcar como favorito'), findsNothing);
  });
  testWidgets(
    'favorite persists and forgetting can be undone without losing history',
    (tester) async {
      final service = RivalsFake();
      await mount(tester, service);
      await tester.tap(find.byTooltip('Marcar como favorito'));
      await tester.pumpAndSettle();
      expect(service.row['favorite'], true);
      await tester.ensureVisible(find.text('Olvidar'));
      await tester.tap(find.text('Olvidar'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Olvidar').last);
      await tester.pumpAndSettle();
      expect(service.row['hidden'], true);
      expect(service.row['played'], 3);
      await tester.tap(find.text('Deshacer'));
      await tester.pumpAndSettle();
      expect(service.row['hidden'], false);
      expect(find.text('2G 1E 0P'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('rematch proposes the message without sending immediately', (
    tester,
  ) async {
    await mount(tester, RivalsFake());
    await tester.ensureVisible(find.text('Revancha'));
    await tester.tap(find.text('Revancha'));
    await tester.pumpAndSettle();
    expect(find.text('¿Revancha?'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
