import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models/achievement_model.dart';
import '../../core/services/achievements_service.dart';
import '../../core/theme/app_insets.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_states.dart';

/// Logros de la persona: lo conseguido y cuánto falta para lo demás.
class AchievementsScreen extends ConsumerWidget {
  const AchievementsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(achievementsProvider);
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'Logros',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
      ),
      body: async.when(
        loading: () => const PateaLoading(),
        error: (e, _) => PateaError(
          error: e,
          message: 'No pudimos cargar tus logros.',
          onRetry: () => ref.invalidate(achievementsProvider),
        ),
        data: (result) => RefreshIndicator(
          onRefresh: () => ref.refresh(achievementsProvider.future),
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              18,
              4,
              18,
              bottomInset(context, extra: 24),
            ),
            children: [
              _Summary(result: result),
              for (final category in AchievementCategory.values)
                ..._section(category, result),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _section(
    AchievementCategory category,
    AchievementsResult result,
  ) {
    final items = result.achievements
        .where((a) => a.category == category)
        .toList();
    if (items.isEmpty) return const [];
    // Primero lo conseguido, después lo más cercano a conseguir.
    items.sort((a, b) {
      if (a.unlocked != b.unlocked) return a.unlocked ? -1 : 1;
      return b.progress.compareTo(a.progress);
    });
    return [
      Padding(
        padding: const EdgeInsets.only(top: 24, bottom: 10),
        child: Text(
          category.label,
          style: AppTypography.headline(size: 16, weight: FontWeight.w700),
        ),
      ),
      for (final a in items)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _AchievementTile(
            achievement: a,
            isNew: result.newlyUnlocked.contains(a.id),
          ),
        ),
    ];
  }
}

class _Summary extends StatelessWidget {
  final AchievementsResult result;
  const _Summary({required this.result});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final total = result.achievements.length;
    final done = result.unlockedCount;
    return PateaCard(
      padding: const EdgeInsets.all(18),
      borderColor: c.border.withValues(alpha: 0.55),
      child: Row(
        children: [
          Icon(Icons.emoji_events_rounded, size: 40, color: c.primary),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$done de $total',
                  style: AppTypography.headline(
                    size: 26,
                    weight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  done == total && total > 0
                      ? '¡Los conseguiste todos!'
                      : 'logros conseguidos',
                  style: AppTypography.body(size: 13, color: c.textSecondary),
                ),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: AppRadii.hairAll,
                  child: LinearProgressIndicator(
                    value: total == 0 ? 0 : done / total,
                    minHeight: 6,
                    backgroundColor: c.border.withValues(alpha: 0.4),
                    color: c.primary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AchievementTile extends StatelessWidget {
  final Achievement achievement;
  final bool isNew;
  const _AchievementTile({required this.achievement, required this.isNew});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final a = achievement;
    final accent = a.unlocked ? c.primary : c.textSecondary;
    return PateaCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      borderColor: (a.unlocked ? c.primary : c.border).withValues(
        alpha: a.unlocked ? 0.5 : 0.45,
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: accent.withValues(alpha: a.unlocked ? 0.16 : 0.1),
            ),
            child: Icon(
              a.unlocked ? _iconFor(a.icon) : Icons.lock_outline_rounded,
              color: accent,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        a.name,
                        style: AppTypography.headline(
                          size: 15,
                          weight: FontWeight.w700,
                          color: a.unlocked ? null : c.textSecondary,
                        ),
                      ),
                    ),
                    if (isNew) ...[
                      const SizedBox(width: 8),
                      _NewChip(color: c.primary),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  a.description,
                  style: AppTypography.body(size: 12.5, color: c.textSecondary),
                ),
                if (!a.unlocked) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: AppRadii.hairAll,
                          child: LinearProgressIndicator(
                            value: a.progress,
                            minHeight: 5,
                            backgroundColor: c.border.withValues(alpha: 0.4),
                            color: c.primary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        '${a.current}/${a.required}',
                        style: AppTypography.body(
                          size: 12,
                          weight: FontWeight.w600,
                          color: c.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (a.unlocked) ...[
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Icon(Icons.check_circle_rounded, color: c.success, size: 20),
                const SizedBox(height: 2),
                Text(
                  _shortDate(a.unlockedAt!),
                  style: AppTypography.body(size: 11, color: c.textSecondary),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _NewChip extends StatelessWidget {
  final Color color;
  const _NewChip({required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.18),
      borderRadius: AppRadii.hairAll,
    ),
    child: Text(
      'NUEVO',
      style: AppTypography.body(size: 10, weight: FontWeight.w800, color: color),
    ),
  );
}

String _shortDate(DateTime d) {
  final local = d.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  return '$day/$month/${local.year % 100}';
}

IconData _iconFor(String icon) => switch (icon) {
  'target' => Icons.my_location_rounded,
  'trophy' => Icons.emoji_events_rounded,
  'flame' => Icons.local_fire_department_rounded,
  'crown' => Icons.workspace_premium_rounded,
  'play' => Icons.play_circle_outline_rounded,
  'calendar' => Icons.calendar_month_rounded,
  'award' => Icons.military_tech_rounded,
  'medal' => Icons.military_tech_outlined,
  'star' => Icons.star_rounded,
  'trending-up' => Icons.trending_up_rounded,
  'zap' => Icons.bolt_rounded,
  'gem' => Icons.diamond_outlined,
  'user-plus' => Icons.person_add_alt_1_rounded,
  'users' => Icons.groups_rounded,
  'clipboard-list' => Icons.assignment_outlined,
  _ => Icons.emoji_events_outlined,
};
