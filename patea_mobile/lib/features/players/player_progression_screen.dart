import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/firestore_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/ovr_progression_chart.dart';

/// Port de `/players/[id]/progression` (src/app/players/[id]/progression/page.tsx
/// → PlayerProgressionView).
class PlayerProgressionScreen extends ConsumerWidget {
  final String playerId;

  const PlayerProgressionScreen({super.key, required this.playerId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playerAsync = ref.watch(singlePlayerStreamProvider(playerId));
    final historyAsync = ref.watch(ovrHistoryStreamProvider(playerId));

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'PROGRESIÓN DE OVR',
          style: AppTypography.headline(size: 16, weight: FontWeight.w700),
        ),
      ),
      body: playerAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.voltNeon)),
        error: (err, _) => Center(
          child: Text('Error: $err', style: AppTypography.body(color: AppColors.textMuted)),
        ),
        data: (player) {
          if (player == null) {
            return Center(
              child: Text(
                'Jugador no encontrado.',
                style: AppTypography.body(color: AppColors.textMuted),
              ),
            );
          }

          return ListView(
            padding: const EdgeInsets.fromLTRB(18, 4, 18, 40),
            children: [
              Text(player.name, style: AppTypography.headline(size: 24, weight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(
                'Tu evolución a lo largo de los partidos evaluados.',
                style: AppTypography.body(size: 13, color: AppColors.textMuted),
              ),
              const SizedBox(height: 22),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.border),
                ),
                child: historyAsync.when(
                  loading: () => const SizedBox(
                    height: 200,
                    child: Center(child: CircularProgressIndicator(color: AppColors.voltNeon)),
                  ),
                  error: (err, _) => Text(
                    'No se pudo cargar la progresión.',
                    style: AppTypography.body(size: 12, color: AppColors.textMuted),
                  ),
                  data: (history) => OvrProgressionChart(
                    player: player,
                    history: history,
                    height: 260,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
