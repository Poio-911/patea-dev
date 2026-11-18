import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models/player_model.dart';
import '../../core/services/firestore_service.dart';
import '../../core/theme/app_insets.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/ovr_progression_chart.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_states.dart';

/// Vista dedicada de `/players/[id]/progression`.
class PlayerProgressionScreen extends ConsumerWidget {
  final String playerId;

  const PlayerProgressionScreen({super.key, required this.playerId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final playerAsync = ref.watch(singlePlayerStreamProvider(playerId));
    final historyAsync = ref.watch(ovrHistoryStreamProvider(playerId));

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'Progresión de OVR',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
      ),
      body: playerAsync.when(
        loading: () => const PateaLoading(),
        error: (err, _) => PateaError(
          error: err,
          message: 'No pudimos cargar la progresión del jugador.',
          onRetry: () => ref.invalidate(singlePlayerStreamProvider(playerId)),
        ),
        data: (player) {
          if (player == null) {
            return Center(
              child: Text(
                'Jugador no encontrado.',
                style: AppTypography.body(color: c.textSecondary),
              ),
            );
          }

          return historyAsync.when(
            loading: () => const PateaLoading(),
            error: (err, _) => PateaError(
              error: err,
              message: 'No se pudo cargar la progresión.',
              onRetry: () => ref.invalidate(ovrHistoryStreamProvider(playerId)),
            ),
            data: (history) => ListView(
              padding: EdgeInsets.fromLTRB(18, 4, 18, bottomInset(context, extra: 24)),
              children: [
                Text(
                  player.name,
                  style: AppTypography.headline(
                    size: 24,
                    weight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Evolución a lo largo de los partidos evaluados.',
                  style: AppTypography.body(
                    size: 13,
                    color: c.textSecondary,
                  ),
                ),
                const SizedBox(height: 20),
                PateaCard(
                  color: c.card,
                  radius: AppRadii.cardAll,
                  borderColor: c.border,
                  padding: const EdgeInsets.all(16),
                  child: OvrProgressionChart(
                    player: player,
                    history: history,
                    height: 230,
                  ),
                ),
                if (history.isNotEmpty) ...[
                  const SizedBox(height: 22),
                  Text(
                    'Registro por fecha',
                    style: AppTypography.headline(
                      size: 15,
                      weight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 10),
                  PateaCard(
                    color: c.card,
                    radius: AppRadii.cardAll,
                    borderColor: c.border,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 6,
                    ),
                    child: Column(
                      children: [
                        for (var i = history.length - 1; i >= 0; i--) ...[
                          if (i < history.length - 1)
                            Divider(height: 1, color: c.border),
                          _HistoryEntryRow(entry: history[i]),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _HistoryEntryRow extends StatelessWidget {
  final OvrHistoryEntry entry;

  const _HistoryEntryRow({required this.entry});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final delta = entry.newOVR - entry.oldOVR;
    final deltaColor = delta > 0
        ? c.success
        : delta < 0
            ? c.destructive
            : c.textSecondary;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text.rich(
                  TextSpan(
                    style: AppTypography.headline(
                      size: 14,
                      weight: FontWeight.w700,
                    ),
                    children: [
                      TextSpan(text: '${entry.oldOVR} '),
                      WidgetSpan(
                        alignment: PlaceholderAlignment.middle,
                        child: Icon(
                          Icons.arrow_forward_rounded,
                          size: 14,
                          color: c.textPrimary,
                        ),
                      ),
                      TextSpan(text: ' ${entry.newOVR} OVR'),
                    ],
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  fmtLongDateOf(entry.date),
                  style: AppTypography.body(size: 12, color: c.textSecondary),
                ),
              ],
            ),
          ),
          Text(
            delta > 0 ? '+$delta' : '$delta',
            style: AppTypography.code(
              size: 13,
              weight: FontWeight.w700,
              color: deltaColor,
            ),
          ),
        ],
      ),
    );
  }
}
