import 'package:flutter/foundation.dart';

enum AchievementCategory {
  performance('Rendimiento'),
  milestones('Hitos'),
  competition('Competición'),
  social('Social');

  final String label;
  const AchievementCategory(this.label);

  static AchievementCategory parse(String? raw) => values.firstWhere(
    (c) => c.name == raw,
    orElse: () => AchievementCategory.milestones,
  );
}

/// Un logro con el avance de quien mira la pantalla. Lo arma el servidor
/// (`syncAchievements`); la app solo lo muestra.
@immutable
class Achievement {
  final String id;
  final String name;
  final String description;
  final String icon;
  final AchievementCategory category;
  final int required;
  final int current;
  final DateTime? unlockedAt;

  const Achievement({
    required this.id,
    required this.name,
    required this.description,
    required this.icon,
    required this.category,
    required this.required,
    required this.current,
    required this.unlockedAt,
  });

  bool get unlocked => unlockedAt != null;

  /// 0..1 para la barra de avance.
  double get progress => required <= 0 ? 1 : (current / required).clamp(0, 1);

  factory Achievement.fromMap(Map<String, dynamic> map) => Achievement(
    id: map['id'] as String? ?? '',
    name: map['name'] as String? ?? '',
    description: map['description'] as String? ?? '',
    icon: map['icon'] as String? ?? '',
    category: AchievementCategory.parse(map['category'] as String?),
    required: (map['required'] as num?)?.toInt() ?? 1,
    current: (map['current'] as num?)?.toInt() ?? 0,
    unlockedAt: DateTime.tryParse(map['unlockedAt'] as String? ?? ''),
  );
}

@immutable
class AchievementsResult {
  final List<Achievement> achievements;

  /// Ids desbloqueados justo en esta consulta, para celebrarlos.
  final Set<String> newlyUnlocked;

  const AchievementsResult(this.achievements, this.newlyUnlocked);

  int get unlockedCount => achievements.where((a) => a.unlocked).length;

  factory AchievementsResult.fromMap(Map<String, dynamic> map) =>
      AchievementsResult(
        [
          for (final a in (map['achievements'] as List? ?? const []))
            Achievement.fromMap(Map<String, dynamic>.from(a as Map)),
        ],
        {for (final id in (map['newlyUnlocked'] as List? ?? const [])) '$id'},
      );
}
