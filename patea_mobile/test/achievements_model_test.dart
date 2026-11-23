import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/achievement_model.dart';

void main() {
  test('lee la respuesta del servidor', () {
    final result = AchievementsResult.fromMap({
      'newlyUnlocked': ['first_goal'],
      'achievements': [
        {
          'id': 'first_goal',
          'name': 'Primer Gol',
          'description': 'Marcaste tu primer gol',
          'icon': 'target',
          'category': 'performance',
          'required': 1,
          'current': 1,
          'unlockedAt': '2026-11-23T10:00:00.000Z',
        },
        {
          'id': 'ten_goals',
          'name': 'Goleador',
          'description': 'Marcaste 10 goles en total',
          'icon': 'flame',
          'category': 'performance',
          'required': 10,
          'current': 4,
          'unlockedAt': null,
        },
      ],
    });
    expect(result.achievements, hasLength(2));
    expect(result.unlockedCount, 1);
    expect(result.newlyUnlocked, {'first_goal'});
    final pending = result.achievements[1];
    expect(pending.unlocked, isFalse);
    expect(pending.progress, closeTo(0.4, 1e-9));
    expect(pending.category, AchievementCategory.performance);
  });

  test('una categoría desconocida no rompe y el avance no pasa de 1', () {
    final a = Achievement.fromMap({
      'id': 'x',
      'category': 'rara',
      'required': 2,
      'current': 9,
    });
    expect(a.category, AchievementCategory.milestones);
    expect(a.progress, 1);
    expect(AchievementsResult.fromMap(const {}).achievements, isEmpty);
  });
}
