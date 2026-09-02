import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/constants/performance_tags.dart';
import '../../core/services/evaluation_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/auth_service.dart';
import '../../core/models/evaluation_models.dart';
import '../../core/widgets/player_position_badge.dart';

List<PerformanceTagItem> _randomTagPool(String position) {
  final tags = PerformanceTagsData.getTagsForPosition(position);
  final positive = tags.where((t) => t.impact == 'positive').toList()..shuffle();
  final negative = tags.where((t) => t.impact == 'negative').toList()..shuffle();
  final pool = [...positive.take(6), ...negative.take(4)];
  pool.shuffle();
  return pool;
}

/// Port de src/app/evaluations/[matchId]/page.tsx — la evaluación real de UN
/// partido asignado (no confundir con `perform-evaluation-view.tsx`, un
/// componente más viejo y ya no enlazado desde ninguna página real).
///
/// Deliberadamente NO portado en esta pasada: el tipo de evaluación 'text'
/// con análisis de IA (`analyzeEvaluationTextAction`, necesita envolver el
/// flow Genkit `analyzeTextPerformance` en una Cloud Function nueva) y la
/// validación de proporción de tags negativos con diálogo de confirmación
/// ("¿enviar solo positivas?") — acá simplemente se exige un mínimo de 3
/// tags, sin la validación proporcional. El trigger que procesa la
/// submission (`processEvaluationSubmission`, ya desplegado) soporta los
/// tres tipos sin cambios, así que agregar 'text' más adelante no rompe nada
/// de lo que ya está acá.
class EvaluationFormScreen extends ConsumerStatefulWidget {
  final String matchId;

  const EvaluationFormScreen({super.key, required this.matchId});

  @override
  ConsumerState<EvaluationFormScreen> createState() => _EvaluationFormScreenState();
}

class _EvaluationFormScreenState extends ConsumerState<EvaluationFormScreen> {
  bool _isLoading = true;
  bool _isSubmitting = false;
  bool _alreadySubmitted = false;
  List<PlayerEvaluationDraft> _drafts = [];
  int _evaluatorGoals = 0;
  int _evaluatorAssists = 0;
  String? _mvpVote;
  final _chronicleController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _chronicleController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final uid = ref.read(authServiceProvider).currentUser?.uid;
    if (uid == null) return;
    final service = ref.read(evaluationServiceProvider);

    final alreadySubmitted = await service.hasSubmittedFor(widget.matchId, uid);
    if (alreadySubmitted) {
      setState(() {
        _alreadySubmitted = true;
        _isLoading = false;
      });
      return;
    }

    final assignments = await service.getPendingAssignmentsForMatch(widget.matchId, uid);
    final players = await service.getPlayersByIds(assignments.map((a) => a.subjectId).toList());
    final playersById = {for (final p in players) p.id: p};

    final drafts = assignments
        .map((a) {
          final p = playersById[a.subjectId];
          if (p == null) return null;
          return PlayerEvaluationDraft(
            assignmentId: a.id,
            subjectId: a.subjectId,
            displayName: p.name,
            photoURL: p.photoUrl ?? '',
            position: p.position,
            tagPool: _randomTagPool(p.position),
          );
        })
        .whereType<PlayerEvaluationDraft>()
        .toList();

    if (mounted) {
      setState(() {
        _drafts = drafts;
        _isLoading = false;
      });
    }
  }

  Future<void> _submit() async {
    for (final d in _drafts) {
      if (d.evaluationType == 'tags' && d.performanceTags.length < 3) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Elegí al menos 3 etiquetas para ${d.displayName}.'),
          backgroundColor: AppColors.warning,
        ));
        return;
      }
    }

    setState(() => _isSubmitting = true);
    try {
      await ref.read(evaluationServiceProvider).submitEvaluation(
            matchId: widget.matchId,
            evaluatorGoals: _evaluatorGoals,
            evaluatorAssists: _evaluatorAssists,
            mvpVote: _mvpVote,
            personalChronicle: _chronicleController.text.trim().isEmpty ? null : _chronicleController.text.trim(),
            evaluations: _drafts,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('¡Evaluaciones enviadas! Se van a procesar en segundo plano.'),
          backgroundColor: AppColors.success,
        ));
        ref.invalidate(evaluationInboxItemsProvider);
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive));
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('EVALUAR PARTIDO', style: AppTypography.headline(size: 16, weight: FontWeight.w800))),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _alreadySubmitted
              ? _MessageState(
                  icon: Icons.hourglass_top_outlined,
                  title: 'Evaluación en proceso',
                  description: 'Tus evaluaciones para este partido ya fueron enviadas y están esperando ser procesadas.',
                )
              : _drafts.isEmpty
                  ? const _MessageState(
                      icon: Icons.check_circle_outline,
                      title: 'Sin evaluaciones pendientes',
                      description: 'No tenés jugadores asignados para evaluar en este partido, o ya completaste tu evaluación.',
                    )
                  : _buildForm(),
    );
  }

  Widget _buildForm() {
    final match = ref.watch(singleMatchStreamProvider(widget.matchId)).value;
    final mvpCandidates = <String, String>{};
    for (final p in match?.players ?? const []) {
      mvpCandidates[p.uid] = p.displayName;
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.voltNeon.withValues(alpha: 0.25))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('TU RENDIMIENTO', style: AppTypography.headline(size: 13, color: AppColors.voltNeon)),
              const SizedBox(height: 4),
              Text('Registrá tus estadísticas personales del partido.', style: AppTypography.body(size: 11, color: AppColors.textMuted)),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: _CounterDial(label: 'GOLES', value: _evaluatorGoals, onChanged: (v) => setState(() => _evaluatorGoals = v))),
                  const SizedBox(width: 12),
                  Expanded(child: _CounterDial(label: 'ASISTENCIAS', value: _evaluatorAssists, onChanged: (v) => setState(() => _evaluatorAssists = v))),
                ],
              ),
              if (mvpCandidates.isNotEmpty) ...[
                const SizedBox(height: 20),
                Text('VOTO MVP', style: AppTypography.headline(size: 12, weight: FontWeight.w800)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: mvpCandidates.entries.map((e) {
                    final selected = _mvpVote == e.key;
                    return ChoiceChip(
                      label: Text(e.value),
                      selected: selected,
                      onSelected: (_) => setState(() => _mvpVote = selected ? null : e.key),
                      selectedColor: AppColors.voltNeon.withValues(alpha: 0.25),
                    );
                  }).toList(),
                ),
              ],
              const SizedBox(height: 16),
              TextField(
                controller: _chronicleController,
                maxLines: 3,
                maxLength: 1000,
                decoration: const InputDecoration(hintText: '¿Cómo te sentiste en la cancha? (opcional)'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text('JUGADORES A EVALUAR', style: AppTypography.headline(size: 14, weight: FontWeight.w800)),
        const SizedBox(height: 12),
        ..._drafts.map((d) => _PlayerEvaluationCard(draft: d, onChanged: () => setState(() {}))),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _isSubmitting ? null : _submit,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black, padding: const EdgeInsets.symmetric(vertical: 14)),
            icon: _isSubmitting
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                : const Icon(Icons.save_outlined),
            label: Text(_isSubmitting ? 'Enviando...' : 'ENVIAR EVALUACIONES'),
          ),
        ),
      ],
    );
  }
}

class _MessageState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;

  const _MessageState({required this.icon, required this.title, required this.description});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: AppColors.textMuted),
            const SizedBox(height: 12),
            Text(title, style: AppTypography.headline(size: 16)),
            const SizedBox(height: 6),
            Text(description, textAlign: TextAlign.center, style: AppTypography.body(size: 12, color: AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}

class _CounterDial extends StatelessWidget {
  final String label;
  final int value;
  final ValueChanged<int> onChanged;

  const _CounterDial({required this.label, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(color: AppColors.cardSurface, borderRadius: BorderRadius.circular(14)),
      child: Column(
        children: [
          Text(label, style: AppTypography.code(size: 9, weight: FontWeight.w800, color: AppColors.textMuted)),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(onPressed: () => onChanged((value - 1).clamp(0, 20)), icon: const Icon(Icons.remove_circle_outline)),
              SizedBox(width: 40, child: Text('$value', textAlign: TextAlign.center, style: AppTypography.sportNumber(size: 24, color: AppColors.voltNeon))),
              IconButton(onPressed: () => onChanged((value + 1).clamp(0, 20)), icon: const Icon(Icons.add_circle_outline)),
            ],
          ),
        ],
      ),
    );
  }
}

class _PlayerEvaluationCard extends StatelessWidget {
  final PlayerEvaluationDraft draft;
  final VoidCallback onChanged;

  const _PlayerEvaluationCard({required this.draft, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border.withValues(alpha: 0.4))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: AppColors.cardSurface,
                backgroundImage: draft.photoURL.isNotEmpty ? NetworkImage(draft.photoURL) : null,
                child: draft.photoURL.isEmpty ? Text(draft.displayName.isNotEmpty ? draft.displayName[0].toUpperCase() : '?', style: AppTypography.headline(size: 16)) : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(draft.displayName, style: AppTypography.headline(size: 15)),
                    PlayerPositionBadge(position: draft.position, fontSize: 10),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _TypeToggle(
                  label: 'Puntos',
                  selected: draft.evaluationType == 'points',
                  onTap: () {
                    draft.evaluationType = 'points';
                    onChanged();
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _TypeToggle(
                  label: 'Etiquetas',
                  selected: draft.evaluationType == 'tags',
                  onTap: () {
                    draft.evaluationType = 'tags';
                    onChanged();
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (draft.evaluationType == 'points') _PointsEditor(draft: draft, onChanged: onChanged) else _TagsEditor(draft: draft, onChanged: onChanged),
        ],
      ),
    );
  }
}

class _TypeToggle extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _TypeToggle({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.voltNeon.withValues(alpha: 0.15) : AppColors.cardSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? AppColors.voltNeon : Colors.transparent),
        ),
        child: Text(label, style: AppTypography.body(size: 12, weight: FontWeight.w700, color: selected ? AppColors.voltNeon : AppColors.textMuted)),
      ),
    );
  }
}

class _PointsEditor extends StatelessWidget {
  final PlayerEvaluationDraft draft;
  final VoidCallback onChanged;

  const _PointsEditor({required this.draft, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final val = draft.rating;
    final isBad = val < 5;
    final isGood = val >= 7;
    final color = isBad ? AppColors.destructive : (isGood ? AppColors.success : AppColors.warning);

    return Column(
      children: [
        Text(val.round().toString(), style: AppTypography.sportNumber(size: 44, color: color)),
        Slider(
          value: val,
          min: 1,
          max: 10,
          divisions: 9,
          activeColor: color,
          onChanged: (v) {
            draft.rating = v;
            onChanged();
          },
        ),
      ],
    );
  }
}

class _TagsEditor extends StatelessWidget {
  final PlayerEvaluationDraft draft;
  final VoidCallback onChanged;

  const _TagsEditor({required this.draft, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Elegí al menos 3 (${draft.performanceTags.length} elegidas)', style: AppTypography.body(size: 11, color: AppColors.textMuted)),
        const SizedBox(height: 8),
        ...draft.tagPool.map((tag) {
          final isChecked = draft.performanceTags.any((t) => t.id == tag.id);
          final isPositive = tag.impact == 'positive';
          return Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: InkWell(
              onTap: () {
                if (isChecked) {
                  draft.performanceTags.removeWhere((t) => t.id == tag.id);
                } else {
                  draft.performanceTags.add(tag);
                }
                onChanged();
              },
              borderRadius: BorderRadius.circular(10),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: isChecked ? (isPositive ? AppColors.success.withValues(alpha: 0.1) : AppColors.destructive.withValues(alpha: 0.1)) : AppColors.cardSurface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: isChecked ? (isPositive ? AppColors.success : AppColors.destructive) : Colors.transparent),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(isChecked ? Icons.check_box : Icons.check_box_outline_blank, size: 18, color: isChecked ? (isPositive ? AppColors.success : AppColors.destructive) : AppColors.textMuted),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(tag.name, style: AppTypography.body(size: 12, weight: FontWeight.w700)),
                          Text(tag.description, style: AppTypography.body(size: 10, color: AppColors.textMuted)),
                          const SizedBox(height: 4),
                          Wrap(
                            spacing: 6,
                            children: tag.effects.entries.map((e) {
                              final positive = e.value > 0;
                              return Text(
                                '${positive ? '+' : ''}${e.value} ${e.key.toUpperCase()}',
                                style: AppTypography.code(size: 9, weight: FontWeight.w700, color: positive ? AppColors.success : AppColors.destructive),
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    );
  }
}
