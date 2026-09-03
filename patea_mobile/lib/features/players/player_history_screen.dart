import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/firestore_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import 'widgets/player_match_debrief.dart';

/// Port de `/players/[id]/historial` (src/app/players/[id]/historial/page.tsx),
/// que es el mismo `PlayerMatchDebriefView` sin el modo compacto.
class PlayerHistoryScreen extends ConsumerWidget {
  final String playerId;

  const PlayerHistoryScreen({super.key, required this.playerId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playerAsync = ref.watch(singlePlayerStreamProvider(playerId));

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'HISTORIAL DE PARTIDOS',
          style: AppTypography.headline(size: 16, weight: FontWeight.w700),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 4, 18, 40),
        children: [
          Text(
            playerAsync.value?.name ?? 'Historial',
            style: AppTypography.headline(size: 24, weight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            'Todos los partidos evaluados, con lo que dijeron tus compañeros.',
            style: AppTypography.body(size: 13, color: AppColors.textMuted),
          ),
          const SizedBox(height: 22),
          PlayerMatchDebrief(playerId: playerId, compact: false),
        ],
      ),
    );
  }
}
