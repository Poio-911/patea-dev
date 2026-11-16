import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:patea_mobile/core/models/player_model.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/widgets/patea_avatar.dart';
import 'package:patea_mobile/core/widgets/patea_tabs.dart';
import 'package:patea_mobile/features/coach/ai_coach_screen.dart';
import 'package:patea_mobile/features/coach/training_focus.dart';
import 'package:patea_mobile/features/social/leaderboard_screen.dart';
import 'package:patea_mobile/core/widgets/patea_user_menu_sheet.dart';
import 'goldens/arnes.dart';

PlayerModel player(String id, {int ovr = 70, int goals = 0, int assists = 0, String position = 'DEL'}) => PlayerModel(
  id: id, name: id, position: position, ovr: ovr,
  pac: 80, sho: 40, pas: 76, dri: 65, def: 30, phy: 71,
  stats: PlayerStats(goals: goals, assists: assists),
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({});
  });

  test('Ranking uses the selected statistic and never mutates the roster', () {
    final roster = [player('Z', ovr: 90, goals: 1), player('A', ovr: 60, goals: 5, assists: 3), player('B', ovr: 70, assists: 4)];
    expect(rankPlayers(roster, RankingMetric.ovr).first.id, 'Z');
    expect(rankPlayers(roster, RankingMetric.goals).first.id, 'A');
    expect(rankPlayers(roster, RankingMetric.assists).first.id, 'B');
    expect(roster.map((p) => p.id), ['Z', 'A', 'B']);
  });

  test('Training selects the lowest saved attribute, not OVR or a fixed answer', () {
    final focuses = trainingFocusFor(player('A'));
    final suggestion = suggestedFocus(focuses);
    expect(suggestion.id, 'def');
    expect(suggestion.value, 30);
    expect(suggestion.exercise, 'Perfil defensivo');
  });

  test('Goalkeepers use goalkeeper attribute mappings and drills', () {
    final focuses = trainingFocusFor(player('Keeper', position: 'POR'));
    expect(suggestedFocus(focuses).label, 'Estirada');
    expect(focuses.firstWhere((f) => f.id == 'sho').label, 'Paradas');
    expect(focuses.firstWhere((f) => f.id == 'sho').value, 40);
    expect(focuses.every((f) => f.steps.length == 3), isTrue);
  });

  testWidgets('Ranking tabs reorder actual player rows', (tester) async {
    final errors = await montarPantalla(tester, const LeaderboardScreen(), tema: AppTheme.lightTheme);
    expect(errors, isEmpty);
    final tabs = find.byType(PateaTabs);
    await tester.tap(find.descendant(of: tabs, matching: find.text('Goles')));
    await tester.pump();
    expect(find.text('Ordenado por Goles. Los empates comparten puesto.'), findsOneWidget);
    final firstAvatar = tester.widget<PateaAvatar>(find.byType(PateaAvatar).first);
    expect(firstAvatar.seed, rankPlayers(jugadores, RankingMetric.goals).first.id);
  });

  testWidgets('Equal scores share places and the next place skips correctly', (tester) async {
    final roster = [player('A', ovr: 80), player('B', ovr: 80), player('C', ovr: 60)];
    final errors = await montarPantalla(tester, ProviderScope(
      overrides: [activeGroupPlayersProvider.overrideWith((ref) => Stream.value(roster))],
      child: const LeaderboardScreen(),
    ), tema: AppTheme.darkTheme);
    expect(errors, isEmpty);
    expect(find.text('1'), findsNWidgets(2));
    expect(find.text('2'), findsNothing);
    expect(find.text('3'), findsOneWidget);
  });

  testWidgets('Changing training objective changes the exercise without a fake chat', (tester) async {
    final errors = await montarPantalla(tester, const AICoachScreen(), tema: AppTheme.lightTheme);
    expect(errors, isEmpty);
    final choice = find.widgetWithText(ChoiceChip, 'Pase 86');
    await tester.ensureVisible(choice);
    await tester.tap(choice);
    await tester.pumpAndSettle();
    final exercise = find.text('Pase y perfil');
    await tester.ensureVisible(exercise);
    expect(exercise, findsOneWidget);
    expect(find.byType(TextField), findsNothing);
  });
  testWidgets('Missing training profile never invents attributes or a recommendation', (tester) async {
    final errors = await montarPantalla(tester, ProviderScope(
      overrides: [singlePlayerStreamProvider(uidYo).overrideWith((ref) => Stream.value(null))],
      child: const AICoachScreen(),
    ), tema: AppTheme.lightTheme);
    expect(errors, isEmpty);
    expect(find.byType(ChoiceChip), findsNothing);
    expect(find.text('Necesitamos tu ficha para sugerirte un objetivo.'), findsOneWidget);
    expect(find.text('Ver mi plantel'), findsOneWidget);
  });

  testWidgets('Profile menu keeps both new destinations reachable in a short viewport', (tester) async {
    final errors = await montarPantalla(tester, const Scaffold(
      body: Align(alignment: Alignment.bottomCenter,
        child: SizedBox(height: 340, child: PateaUserMenuSheet())),
    ), tema: AppTheme.lightTheme, escala: 1.3);
    expect(errors, isEmpty);
    await tester.ensureVisible(find.text('Mi entrenamiento'));
    expect(find.text('Ranking del plantel'), findsOneWidget);
    expect(find.text('Mi entrenamiento'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

}
