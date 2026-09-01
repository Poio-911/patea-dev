import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/firestore_service.dart';
import '../../core/widgets/attributes_radar_chart.dart';
import '../../core/widgets/player_position_badge.dart';

class PlayerDetailScreen extends ConsumerWidget {
  final String playerId;

  const PlayerDetailScreen({super.key, required this.playerId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playerAsync = ref.watch(singlePlayerStreamProvider(playerId));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'DETALLE DEL JUGADOR',
          style: AppTypography.headline(size: 16, weight: FontWeight.w700),
        ),
      ),
      body: playerAsync.when(
        data: (player) {
          if (player == null) {
            return const Center(child: Text('Jugador no encontrado'));
          }

          final borderColor = AppColors.getOvrBorderColor(player.ovr);

          return SingleChildScrollView(
            padding: const EdgeInsets.all(18.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Header con OVR y Foto
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: borderColor.withValues(alpha: 0.5)),
                  ),
                  child: Row(
                    children: [
                      Hero(
                        tag: 'player_photo_${player.id}',
                        child: CircleAvatar(
                          radius: 38,
                          backgroundColor: AppColors.cardSurface,
                          child: Text(
                            player.name.isNotEmpty ? player.name[0].toUpperCase() : 'J',
                            style: AppTypography.headline(size: 32),
                          ),
                        ),
                      ),
                      const SizedBox(width: 18),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              player.name,
                              style: AppTypography.headline(size: 20, weight: FontWeight.w800),
                            ),
                            const SizedBox(height: 6),
                            PlayerPositionBadge(position: player.position, showFullName: true),
                          ],
                        ),
                      ),
                      Column(
                        children: [
                          Text(
                            '${player.ovr}',
                            style: AppTypography.sportNumber(size: 36, color: borderColor),
                          ),
                          Text('OVR', style: AppTypography.code(size: 10)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Radar Chart
                Text(
                  'POLÍGONO DE RENDIMIENTO',
                  style: AppTypography.headline(size: 14, weight: FontWeight.w700),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: AttributesRadarChart(player: player),
                ),
                const SizedBox(height: 24),

                // Estadísticas Acumuladas
                Text(
                  'ESTADÍSTICAS',
                  style: AppTypography.headline(size: 14, weight: FontWeight.w700),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _StatCard(title: 'Partidos', value: '${player.stats.matchesPlayed}'),
                    const SizedBox(width: 10),
                    _StatCard(title: 'Goles', value: '${player.stats.goals}'),
                    const SizedBox(width: 10),
                    _StatCard(title: 'Asistencias', value: '${player.stats.assists}'),
                    const SizedBox(width: 10),
                    _StatCard(title: 'Rating', value: player.stats.averageRating.toStringAsFixed(1)),
                  ],
                ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Error: $err')),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;

  const _StatCard({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: AppTypography.sportNumber(size: 18, color: AppColors.voltNeon),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: AppTypography.code(size: 10, color: AppColors.textMuted),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
