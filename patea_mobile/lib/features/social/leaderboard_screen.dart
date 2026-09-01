import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/firestore_service.dart';
import '../../core/widgets/player_position_badge.dart';

class LeaderboardScreen extends ConsumerWidget {
  const LeaderboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playersAsync = ref.watch(playersStreamProvider(null));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'RANKINGS & TABLAS',
          style: AppTypography.headline(size: 18, weight: FontWeight.w800),
        ),
      ),
      body: playersAsync.when(
        data: (players) {
          final sorted = List.of(players)..sort((a, b) => b.ovr.compareTo(a.ovr));

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: sorted.length,
            separatorBuilder: (_, index) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final player = sorted[index];
              final isPodium = index < 3;
              final podiumColor = index == 0
                  ? AppColors.goldBorder
                  : index == 1
                      ? AppColors.silverBorder
                      : AppColors.bronzeBorder;

              return Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isPodium ? podiumColor.withValues(alpha: 0.6) : AppColors.border,
                    width: isPodium ? 1.5 : 1.0,
                  ),
                ),
                child: Row(
                  children: [
                    SizedBox(
                      width: 32,
                      child: Text(
                        '#${index + 1}',
                        style: AppTypography.sportNumber(
                          size: 18,
                          color: isPodium ? podiumColor : AppColors.textMuted,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    PlayerPositionBadge(position: player.position, fontSize: 10),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            player.name,
                            style: AppTypography.headline(size: 15, weight: FontWeight.w700),
                          ),
                          Text(
                            '${player.stats.goals} Goles • ${player.stats.matchesPlayed} PJ',
                            style: AppTypography.code(size: 11, color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      '${player.ovr}',
                      style: AppTypography.sportNumber(
                        size: 24,
                        color: AppColors.getOvrBorderColor(player.ovr),
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Error: $err')),
      ),
    );
  }
}
