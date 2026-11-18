import '../../core/widgets/patea_button_progress.dart';
import 'package:flutter/material.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/theme/app_radii.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/patea_colors.dart';
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
  Future<List<PlayerModel>>? _playersFuture;
  String? _playersMatchId;
  List<String> _playersKey = const [];

  Future<List<PlayerModel>> _ensurePlayersFuture(
    String matchId,
    List<String> uids,
  ) {
    final sameKey =
        _playersFuture != null &&
        _playersMatchId == matchId &&
        _playersKey.length == uids.length &&
        List.generate(uids.length, (i) => _playersKey[i] == uids[i])
            .every((e) => e);
    if (!sameKey) {
      _playersMatchId = matchId;
      _playersKey = List.of(uids);
      _playersFuture =
          ref.read(evaluationServiceProvider).getPlayersByIds(uids);
    }
    return _playersFuture!;
  }

  Future<void> _finalize() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Finalizar evaluación'),
        content: const Text(
          'Esta acción calcula los nuevos OVRs y cierra definitivamente las evaluaciones pendientes de este partido.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Finalizar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _isFinalizing = true);
    try {
      final updated = await ref.read(evaluationServiceProvider).finalizeMatchEvaluation(widget.matchId);
      if (mounted) {
        PateaSnack.ok(context, '¡Evaluación finalizada! $updated jugador(es) actualizados.');
        context.pop();
      }
    } catch (e) {
      assert(() {
        debugPrint('finalizeMatchEvaluation error: $e');
        return true;
      }());
      if (mounted) {
        PateaSnack.error(
          context,
          'No se pudo finalizar la evaluación. Intentá de nuevo.',
        );
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
      // El router envuelve esta ruta en `PateaBackground`. Sin esto, el
      // Scaffold pinta su color opaco encima y tapa la foto de cancha.
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: Text(
          'Evaluación del partido',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
      ),
      body: matchAsync.when(
        data: (match) {
          if (match == null) {
            return Center(child: Text('Partido no encontrado.', style: AppTypography.body(color: context.c.textSecondary)));
          }
          if (uid != match.ownerUid) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text('Solo el organizador puede ver esta página.', style: AppTypography.body(color: context.c.textSecondary)),
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
                    Icon(Icons.check_circle, color: context.c.success, size: 44),
                    const SizedBox(height: 12),
                    Text('Evaluación Completa', style: AppTypography.headline(size: 16)),
                    const SizedBox(height: 6),
                    Text('Este partido ya fue evaluado y los OVRs se actualizaron.', textAlign: TextAlign.center, style: AppTypography.body(size: 12, color: context.c.textSecondary)),
                  ],
                ),
              ),
            );
          }

          return assignmentsAsync.when(
            data: (assignments) {
              final completedAssignments = assignments.where((a) => a.status == 'completed').toList();
              return FutureBuilder<List<PlayerModel>>(
                future: _ensurePlayersFuture(match.id, match.playerUids),
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
                                  backgroundColor: context.c.cardSurface,
                                  color: progress >= 1 ? context.c.success : context.c.primary,
                                ),
                              ),
                              Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text('$completed/$total', style: AppTypography.headline(size: 28, weight: FontWeight.w900)),
                                  Text('Evaluaron', style: AppTypography.code(size: 12, weight: FontWeight.w700, color: context.c.textSecondary)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),
                      PateaCard(
                        color: context.c.card,
                        radius: AppRadii.cardAll,
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(children: [
                              Icon(Icons.info_outline, size: 16, color: context.c.textSecondary),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Al finalizar, se calculan los cambios de OVR y atributos con las evaluaciones recibidas hasta ahora. Los jugadores que todavía no evaluaron reciben el promedio del partido.',
                                  style: AppTypography.body(size: 12, color: context.c.textSecondary),
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
                          style: ElevatedButton.styleFrom(backgroundColor: context.c.primary, foregroundColor: context.c.onPrimary, padding: const EdgeInsets.symmetric(vertical: 14)),
                          icon: _isFinalizing
                              ? const SizedBox(width: 16, height: 16, child: PateaButtonProgress())
                              : const Icon(Icons.emoji_events_outlined),
                          label: Text(_isFinalizing ? 'Finalizando…' : 'Finalizar evaluación'),
                        ),
                      ),
                      if (completedAssignments.isEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text('Necesitás al menos una evaluación completada para finalizar.', textAlign: TextAlign.center, style: AppTypography.body(size: 12, color: context.c.textSecondary)),
                        ),
                    ],
                  );
                },
              );
            },
            loading: () => const PateaLoading(),
            error: (e, _) => PateaError(error: e),
          );
        },
        loading: () => const PateaLoading(),
        error: (e, _) => PateaError(error: e),
      ),
    );
  }
}
