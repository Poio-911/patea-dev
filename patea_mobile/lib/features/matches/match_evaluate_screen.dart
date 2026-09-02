import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/evaluation_service.dart';
import '../../core/models/player_model.dart';

/// Port simplificado de src/app/matches/[id]/evaluate/page.tsx — panel del
/// organizador con el progreso de evaluadores y el botón "Finalizar
/// Evaluación" que dispara el cómputo real de OVR/atributos
/// (`finalizeMatchEvaluation`, port de `finalizeMatchEvaluationAction`).
///
/// Deliberadamente NO portado: el polling automático cada 15s de
/// `processPendingEvaluationSubmissionsAction` (es solo un fallback — el
/// trigger `processEvaluationSubmission` ya procesa cada submission al
/// instante), confetti, y el redirect a Liga/Copa tras finalizar (Sección 6).
class MatchEvaluateScreen extends ConsumerStatefulWidget {
  final String matchId;

  const MatchEvaluateScreen({super.key, required this.matchId});

  @override
  ConsumerState<MatchEvaluateScreen> createState() => _MatchEvaluateScreenState();
}

class _MatchEvaluateScreenState extends ConsumerState<MatchEvaluateScreen> {
  bool _isFinalizing = false;

  Future<void> _finalize() async {
    setState(() => _isFinalizing = true);
    try {
      final updated = await ref.read(evaluationServiceProvider).finalizeMatchEvaluation(widget.matchId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('¡Evaluación finalizada! $updated jugador(es) actualizados.'),
          backgroundColor: AppColors.success,
        ));
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive));
      }
    } finally {
      if (mounted) setState(() => _isFinalizing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(authServiceProvider).currentUser?.uid;
    final matchAsync = ref.watch(singleMatchStreamProvider(widget.matchId));
    final assignmentsAsync = ref.watch(matchAssignmentsStreamProvider(widget.matchId));

    return Scaffold(
      appBar: AppBar(title: Text('EVALUACIÓN DEL PARTIDO', style: AppTypography.headline(size: 16, weight: FontWeight.w800))),
      body: matchAsync.when(
        data: (match) {
          if (match == null) {
            return Center(child: Text('Partido no encontrado.', style: AppTypography.body(color: AppColors.textMuted)));
          }
          if (uid != match.ownerUid) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text('Solo el organizador puede ver esta página.', style: AppTypography.body(color: AppColors.textMuted)),
              ),
            );
          }
          if (match.status == 'evaluated') {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.check_circle, color: AppColors.success, size: 44),
                    const SizedBox(height: 12),
                    Text('Evaluación Completa', style: AppTypography.headline(size: 16)),
                    const SizedBox(height: 6),
                    Text('Este partido ya fue evaluado y los OVRs se actualizaron.', textAlign: TextAlign.center, style: AppTypography.body(size: 12, color: AppColors.textMuted)),
                  ],
                ),
              ),
            );
          }

          return assignmentsAsync.when(
            data: (assignments) {
              final completedAssignments = assignments.where((a) => a.status == 'completed').toList();
              return FutureBuilder<List<PlayerModel>>(
                future: ref.read(evaluationServiceProvider).getPlayersByIds(match.playerUids),
                builder: (context, snap) {
                  final players = snap.data ?? [];
                  final realPlayers = players.where((p) => p.id == p.ownerUid).toList();
                  final completedEvaluatorIds = completedAssignments
                      .map((a) => a.evaluatorId)
                      .where((id) => realPlayers.any((p) => p.id == id))
                      .toSet();

                  final total = realPlayers.length;
                  final completed = completedEvaluatorIds.length;
                  final progress = total > 0 ? completed / total : 0.0;

                  return ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      Text(match.title, style: AppTypography.headline(size: 18)),
                      const SizedBox(height: 20),
                      Center(
                        child: SizedBox(
                          width: 160,
                          height: 160,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              SizedBox(
                                width: 160,
                                height: 160,
                                child: CircularProgressIndicator(
                                  value: progress,
                                  strokeWidth: 10,
                                  backgroundColor: AppColors.cardSurface,
                                  color: progress >= 1 ? AppColors.success : AppColors.voltNeon,
                                ),
                              ),
                              Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text('$completed/$total', style: AppTypography.headline(size: 28, weight: FontWeight.w900)),
                                  Text('EVALUARON', style: AppTypography.code(size: 10, weight: FontWeight.w700, color: AppColors.textMuted)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(children: [
                              Icon(Icons.info_outline, size: 16, color: AppColors.textMuted),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Al finalizar, se calculan los cambios de OVR y atributos con las evaluaciones recibidas hasta ahora. Los jugadores que todavía no evaluaron reciben el promedio del partido.',
                                  style: AppTypography.body(size: 11, color: AppColors.textMuted),
                                ),
                              ),
                            ]),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: (completedAssignments.isEmpty || _isFinalizing) ? null : _finalize,
                          style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black, padding: const EdgeInsets.symmetric(vertical: 14)),
                          icon: _isFinalizing
                              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                              : const Icon(Icons.emoji_events_outlined),
                          label: Text(_isFinalizing ? 'Finalizando...' : 'FINALIZAR EVALUACIÓN'),
                        ),
                      ),
                      if (completedAssignments.isEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text('Necesitás al menos una evaluación completada para finalizar.', textAlign: TextAlign.center, style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                        ),
                    ],
                  );
                },
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Error: $e', style: AppTypography.body(color: AppColors.textMuted))),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e', style: AppTypography.body(color: AppColors.textMuted))),
      ),
    );
  }
}
