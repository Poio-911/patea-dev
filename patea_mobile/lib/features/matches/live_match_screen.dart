import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/match_service.dart';
import '../../core/models/match_model.dart';

class LiveMatchScreen extends ConsumerStatefulWidget {
  final String matchId;

  const LiveMatchScreen({super.key, required this.matchId});

  @override
  ConsumerState<LiveMatchScreen> createState() => _LiveMatchScreenState();
}

class _LiveMatchScreenState extends ConsumerState<LiveMatchScreen> {
  Future<void> _showAddGoalDialog(MatchModel match) async {
    final playersAsync = await ref.read(firestoreServiceProvider).getPlayersStream().first;
    String? selectedPlayerId;
    String? selectedPlayerName;
    bool isTeamA = true;
    int minute = match.currentMinute ?? 1;

    if (!mounted) return;

    await showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'REGISTRAR GOL ⚽',
                    style: AppTypography.headline(size: 18, weight: FontWeight.w800),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: ChoiceChip(
                          label: Text(match.teamA?.name ?? 'Equipo A'),
                          selected: isTeamA,
                          onSelected: (val) => setModalState(() => isTeamA = true),
                          selectedColor: AppColors.voltNeon.withValues(alpha: 0.2),
                          checkmarkColor: AppColors.voltNeon,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ChoiceChip(
                          label: Text(match.teamB?.name ?? 'Equipo B'),
                          selected: !isTeamA,
                          onSelected: (val) => setModalState(() => isTeamA = false),
                          selectedColor: AppColors.voltNeon.withValues(alpha: 0.2),
                          checkmarkColor: AppColors.voltNeon,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    dropdownColor: AppColors.card,
                    hint: const Text('Seleccioná el autor del gol'),
                    items: playersAsync.map((p) {
                      return DropdownMenuItem(value: p.id, child: Text(p.name));
                    }).toList(),
                    onChanged: (val) {
                      setModalState(() {
                        selectedPlayerId = val;
                        selectedPlayerName = playersAsync.firstWhere((p) => p.id == val).name;
                      });
                    },
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: selectedPlayerId == null
                        ? null
                        : () async {
                            final currentScoreA = match.teamA?.score ?? 0;
                            final currentScoreB = match.teamB?.score ?? 0;
                            final newScoreA = isTeamA ? currentScoreA + 1 : currentScoreA;
                            final newScoreB = !isTeamA ? currentScoreB + 1 : currentScoreB;

                            final event = MatchEvent(
                              type: 'goal',
                              playerId: selectedPlayerId!,
                              playerName: selectedPlayerName!,
                              minute: minute,
                              detail: null,
                            );

                            await ref.read(matchServiceProvider).recordLiveEvent(
                              matchId: match.id,
                              event: event,
                              teamAScore: newScoreA,
                              teamBScore: newScoreB,
                            );

                            if (context.mounted) Navigator.pop(context);
                          },
                    child: const Text('GUARDAR GOL'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _showFinishMatchDialog(MatchModel match) async {
    final scoreA = match.teamA?.score ?? 0;
    final scoreB = match.teamB?.score ?? 0;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text('¿Finalizar Partido?', style: AppTypography.headline(size: 18)),
        content: Text(
          'El marcador final será $scoreA - $scoreB. Se habilitarán las evaluaciones de los jugadores.',
          style: AppTypography.body(),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.destructive),
            child: const Text('FINALIZAR'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await ref.read(matchServiceProvider).finishMatch(match.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final matchAsync = ref.watch(singleMatchStreamProvider(widget.matchId));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'MINUTO A MINUTO',
          style: AppTypography.headline(size: 16, weight: FontWeight.w700),
        ),
      ),
      body: matchAsync.when(
        data: (match) {
          if (match == null) {
            return const Center(child: Text('Partido no encontrado'));
          }

          final isUpcoming = match.status == 'upcoming';
          final isLive = match.status == 'active';
          final isCompleted = match.status == 'completed' || match.status == 'evaluated';

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Marcador Central
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isLive ? AppColors.destructive : AppColors.border,
                      width: isLive ? 2.0 : 1.0,
                    ),
                  ),
                  child: Column(
                    children: [
                      Text(
                        isLive
                            ? '🔴 EN VIVO • MINUTO ${match.currentMinute ?? 1}\''
                            : isUpcoming
                                ? 'PARTIDO PROGRAMADO'
                                : 'FINALIZADO',
                        style: AppTypography.headline(
                          size: 12,
                          color: isLive
                              ? AppColors.destructive
                              : isUpcoming
                                  ? AppColors.voltNeon
                                  : AppColors.success,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              match.teamA?.name ?? 'Equipo A',
                              style: AppTypography.headline(size: 17, weight: FontWeight.w800),
                              textAlign: TextAlign.center,
                            ),
                          ),
                          Text(
                            '${match.teamA?.score ?? 0}  :  ${match.teamB?.score ?? 0}',
                            style: AppTypography.sportNumber(size: 38, color: AppColors.voltNeon),
                          ),
                          Expanded(
                            child: Text(
                              match.teamB?.name ?? 'Equipo B',
                              style: AppTypography.headline(size: 17, weight: FontWeight.w800),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Panel de Control del Organizador
                if (isUpcoming) ...[
                  ElevatedButton.icon(
                    onPressed: () async {
                      await ref.read(matchServiceProvider).startMatch(match.id);
                    },
                    icon: const Icon(Icons.play_circle_filled, size: 20),
                    label: const Text('INICIAR PARTIDO'),
                  ),
                ] else if (isLive) ...[
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _showAddGoalDialog(match),
                          icon: const Icon(Icons.sports_soccer, size: 18),
                          label: const Text('+ GOL'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () async {
                            final curMin = match.currentMinute ?? 1;
                            await ref.read(matchServiceProvider).updateLiveMinute(
                              match.id,
                              curMin + 5,
                              match.liveStatus ?? 'first_half',
                            );
                          },
                          icon: const Icon(Icons.timer, size: 18),
                          label: const Text('+5 MIN'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: () => _showFinishMatchDialog(match),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.destructive,
                      side: const BorderSide(color: AppColors.destructive),
                    ),
                    icon: const Icon(Icons.stop_circle_outlined, size: 18),
                    label: const Text('FINALIZAR PARTIDO'),
                  ),
                ] else if (isCompleted) ...[
                  ElevatedButton.icon(
                    onPressed: () => context.push('/evaluations/${match.id}'),
                    icon: const Icon(Icons.star_rate_rounded),
                    label: const Text('EVALUAR JUGADORES (PEER REVIEW)'),
                  ),
                ],

                const SizedBox(height: 24),

                // Lista de Eventos en Vivo
                Text(
                  'EVENTOS DEL PARTIDO',
                  style: AppTypography.headline(size: 14, weight: FontWeight.w700),
                ),
                const SizedBox(height: 12),

                if (match.events.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Center(
                      child: Text(
                        'Aún no hay eventos registrados en este partido',
                        style: AppTypography.body(color: AppColors.textMuted),
                      ),
                    ),
                  )
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: match.events.length,
                    separatorBuilder: (_, index) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final event = match.events[index];
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: AppColors.card,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            Text(
                              '${event.minute}\'',
                              style: AppTypography.sportNumber(size: 16, color: AppColors.voltNeon),
                            ),
                            const SizedBox(width: 14),
                            Icon(
                              event.type == 'goal'
                                  ? Icons.sports_soccer
                                  : event.type == 'card'
                                      ? Icons.style
                                      : Icons.change_circle_outlined,
                              size: 18,
                              color: event.type == 'card' ? Colors.amber : AppColors.textPrimary,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                event.playerName,
                                style: AppTypography.headline(size: 14, weight: FontWeight.w600),
                              ),
                            ),
                            if (event.detail != null)
                              Text(
                                event.detail!,
                                style: AppTypography.code(size: 11, color: AppColors.textMuted),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Error: $err')),
      ),
    );
  }
}
