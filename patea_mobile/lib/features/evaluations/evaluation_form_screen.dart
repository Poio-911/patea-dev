import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../../core/widgets/patea_evaluation_mark.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/theme/app_radii.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_help_dialog.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/constants/performance_tags.dart';
import '../../core/services/evaluation_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/auth_service.dart';
import '../../core/models/evaluation_models.dart';
import '../../core/widgets/player_position_badge.dart';
import '../../core/widgets/patea_tabs.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/ovr_calculator.dart';
import 'widgets/evaluation_audio_player.dart';

const int _minEvaluationTags = 3;
const int _maxEvaluationTags = 5;

List<PerformanceTagItem> _randomTagPool(String position) {
  final tags = PerformanceTagsData.getTagsForPosition(position);
  final positive = tags.where((t) => t.impact == 'positive').toList()
    ..shuffle();
  final negative = tags.where((t) => t.impact == 'negative').toList()
    ..shuffle();
  final pool = [...positive.take(5), ...negative.take(5)];
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
  ConsumerState<EvaluationFormScreen> createState() =>
      _EvaluationFormScreenState();
}

class _EvaluationFormScreenState extends ConsumerState<EvaluationFormScreen> {
  bool _isLoading = true;
  bool _isSubmitting = false;
  bool _alreadySubmitted = false;
  String? _loadError;
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
    setState(() {
      _isLoading = true;
      _loadError = null;
    });
    final uid = ref.read(authServiceProvider).currentUser?.uid;
    if (uid == null) {
      setState(() {
        _isLoading = false;
        _loadError = 'Debés iniciar sesión para cargar tus evaluaciones.';
      });
      return;
    }
    try {
      final service = ref.read(evaluationServiceProvider);

      final alreadySubmitted = await service.hasSubmittedFor(
        widget.matchId,
        uid,
      );
      if (!mounted) return;
      if (alreadySubmitted) {
        setState(() {
          _alreadySubmitted = true;
          _isLoading = false;
        });
        return;
      }

      final assignments = await service.getPendingAssignmentsForMatch(
        widget.matchId,
        uid,
      );
      if (!mounted) return;
      final players = await service.getPlayersByIds(
        assignments.map((a) => a.subjectId).toList(),
      );
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
              currentOvr: p.ovr,
              currentAttributes: {
                'pac': p.pac,
                'sho': p.sho,
                'pas': p.pas,
                'dri': p.dri,
                'def': p.def,
                'phy': p.phy,
              },
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
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _loadError = 'No se pudieron cargar tus evaluaciones. Probá de nuevo.';
      });
    }
  }

  Future<void> _submit() async {
    if (_isSubmitting) return;
    for (final d in _drafts) {
      if (d.evaluationType == 'tags' &&
          (d.performanceTags.length < _minEvaluationTags ||
              d.performanceTags.length > _maxEvaluationTags)) {
        PateaSnack.info(
          context,
          'Elegí entre $_minEvaluationTags y $_maxEvaluationTags etiquetas para ${d.displayName}.',
        );
        return;
      }
      if (d.evaluationType == 'text') {
        if (d.isAudioReview) {
          if (!d.hasReadyAudio) {
            PateaSnack.info(
              context,
              'Grabá y esperá el análisis del audio para ${d.displayName}.',
            );
            return;
          }
        } else if (d.textDescription.trim().length < 10) {
          PateaSnack.info(
            context,
            'Escribí al menos 10 caracteres en la reseña de ${d.displayName}.',
          );
          return;
        }
      }
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Revisá tu devolución'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Tu partido: $_evaluatorGoals goles · $_evaluatorAssists asistencias',
              ),
              const SizedBox(height: 16),
              for (final draft in _drafts)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    '${draft.displayName}: ${_draftSummaryLabel(draft)}',
                  ),
                ),
              const SizedBox(height: 8),
              const Text(
                'Confirmá que las notas reflejan lo que viste en la cancha.',
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Seguir editando'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Enviar evaluaciones'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _isSubmitting = true);
    try {
      await ref
          .read(evaluationServiceProvider)
          .submitEvaluation(
            matchId: widget.matchId,
            evaluatorGoals: _evaluatorGoals,
            evaluatorAssists: _evaluatorAssists,
            mvpVote: _mvpVote,
            personalChronicle: _chronicleController.text.trim().isEmpty
                ? null
                : _chronicleController.text.trim(),
            evaluations: _drafts,
          );
      if (mounted) {
        PateaSnack.custom(
          context,
          '¡Evaluaciones enviadas! Se van a procesar en segundo plano.',
          leading: const PateaEvaluationMark(animate: true, size: 40),
          borderColor: context.c.primary,
        );
        ref.invalidate(evaluationInboxItemsProvider);
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        PateaSnack.error(context, 'No pudimos enviar tus evaluaciones. Tus cambios siguen acá. Volvé a intentar.');
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // El router envuelve esta ruta en `PateaBackground`. Sin esto, el
      // Scaffold pinta su color opaco encima y tapa la foto de cancha.
      backgroundColor: Colors.transparent,
      bottomNavigationBar:
          !_isLoading &&
              _loadError == null &&
              !_alreadySubmitted &&
              _drafts.isNotEmpty &&
              MediaQuery.viewInsetsOf(context).bottom == 0
          ? SafeArea(
              top: false,
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: FilledButton.icon(
                  onPressed: _isSubmitting ? null : _submit,
                  icon: _isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: PateaButtonProgress(),
                        )
                      : const Icon(Icons.check_rounded, size: 20),
                  label: Text(_isSubmitting ? 'Enviando…' : 'Revisar y enviar'),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
            )
          : null,
      appBar: AppBar(
        title: Text(
          'Evaluar partido',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            tooltip: 'Cómo se evalúa',
            icon: const Icon(Icons.help_outline_rounded, size: 20),
            onPressed: () => showContextualHelpSheet(
              context,
              topic: HelpTopic.evaluations,
            ),
          ),
        ],
      ),
      body: _isLoading
          ? const PateaLoading()
          : _loadError != null
          ? _MessageState(
              icon: Icons.error_outline,
              title: 'No se pudo cargar',
              description: _loadError!,
              onRetry: _load,
            )
          : _alreadySubmitted
          ? _MessageState(
              icon: Icons.hourglass_top_outlined,
              title: 'Evaluación en proceso',
              description:
                  'Tus evaluaciones para este partido ya fueron enviadas y están esperando ser procesadas.',
            )
          : _drafts.isEmpty
          ? const _MessageState(
              icon: Icons.check_circle_outline,
              title: 'Sin evaluaciones pendientes',
              description:
                  'No tenés jugadores asignados para evaluar en este partido, o ya completaste tu evaluación.',
            )
          : IgnorePointer(ignoring: _isSubmitting, child: _buildForm()),
    );
  }

  Widget _buildForm() {
    final match = ref.watch(singleMatchStreamProvider(widget.matchId)).value;
    final mvpCandidates = <String, String>{};
    for (final p in match?.players ?? const []) {
      mvpCandidates[p.uid] = p.displayName;
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Text(
          match?.title ?? 'Tu devolución del partido',
          style: AppTypography.headline(size: 25),
        ),
        if (match != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              '${fmtDate(match.date)} · ${_drafts.length} jugadores asignados',
              style: AppTypography.body(
                size: 13,
                color: context.c.textSecondary,
              ),
            ),
          ),
        const SizedBox(height: 10),
        Text(
          'Valorá lo que pasó en la cancha con nota, etiquetas o reseña (escrita o por voz). Todos los métodos pesan igual.',
          style: AppTypography.body(size: 14, color: context.c.textSecondary),
        ),
        const SizedBox(height: 24),
        PateaCard(
          color: context.c.card,
          radius: AppRadii.cardAll,
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Tu partido', style: AppTypography.headline(size: 19)),
              const SizedBox(height: 8),
              _CounterDial(
                label: 'Goles',
                value: _evaluatorGoals,
                onChanged: (v) => setState(() => _evaluatorGoals = v),
              ),
              Divider(height: 1, color: context.c.border),
              _CounterDial(
                label: 'Asistencias',
                value: _evaluatorAssists,
                onChanged: (v) => setState(() => _evaluatorAssists = v),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'Tus goles y asistencias suman un micro-bono parejo al cerrar el partido.',
                  style: AppTypography.body(
                    size: 12,
                    color: context.c.textSecondary,
                  ),
                ),
              ),
              if (mvpCandidates.isNotEmpty) ...[
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  initialValue: _mvpVote ?? '',
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Figura del partido',
                    helperText: 'Opcional · elegí a quien más se destacó',
                  ),
                  items: [
                    const DropdownMenuItem(value: '', child: Text('Sin voto')),
                    ...mvpCandidates.entries.map(
                      (e) => DropdownMenuItem(
                        value: e.key,
                        child: Text(e.value, overflow: TextOverflow.ellipsis),
                      ),
                    ),
                  ],
                  onChanged: (v) =>
                      setState(() => _mvpVote = v == '' ? null : v),
                ),
              ],
              const SizedBox(height: 12),
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                childrenPadding: const EdgeInsets.only(bottom: 12),
                title: Text(
                  '¿Cómo lo viviste?',
                  style: AppTypography.body(size: 14, weight: FontWeight.w600),
                ),
                subtitle: Text(
                  'Tu relato es opcional',
                  style: AppTypography.body(
                    size: 12,
                    color: context.c.textSecondary,
                  ),
                ),
                children: [
                  TextField(
                    controller: _chronicleController,
                    maxLines: 3,
                    maxLength: 1000,
                    decoration: const InputDecoration(
                      hintText: 'Contá cómo te sentiste en la cancha…',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 26),
        Text('Tus compañeros', style: AppTypography.headline(size: 22)),
        const SizedBox(height: 6),
        Text(
          'Evaluá a cada jugador por su actuación en este partido.',
          style: AppTypography.body(size: 13, color: context.c.textSecondary),
        ),
        const SizedBox(height: 16),
        for (final draft in _drafts)
          _PlayerEvaluationCard(
            matchId: widget.matchId,
            draft: draft,
            onChanged: () => setState(() {}),
          ),
        const SizedBox(height: 8),
        Text(
          'Antes de enviar vas a poder revisar tus notas.',
          style: AppTypography.body(size: 12, color: context.c.textSecondary),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _MessageState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final VoidCallback? onRetry;

  const _MessageState({
    required this.icon,
    required this.title,
    required this.description,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: context.c.textSecondary),
            const SizedBox(height: 12),
            Text(title, style: AppTypography.headline(size: 16)),
            const SizedBox(height: 6),
            Text(
              description,
              textAlign: TextAlign.center,
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              FilledButton(onPressed: onRetry, child: const Text('Reintentar')),
            ],
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
  const _CounterDial({
    required this.label,
    required this.value,
    required this.onChanged,
  });
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: AppTypography.body(size: 15, weight: FontWeight.w600),
          ),
        ),
        IconButton(
          tooltip: 'Restar $label',
          onPressed: value == 0 ? null : () => onChanged(value - 1),
          icon: const Icon(Icons.remove_rounded),
        ),
        SizedBox(
          width: 38,
          child: Text(
            '$value',
            textAlign: TextAlign.center,
            style: AppTypography.sportNumber(
              size: 27,
              color: context.c.textPrimary,
            ),
          ),
        ),
        IconButton(
          tooltip: 'Sumar $label',
          onPressed: value == 20 ? null : () => onChanged(value + 1),
          icon: const Icon(Icons.add_rounded),
        ),
      ],
    ),
  );
}

EvaluationImpactPreview? _computeDraftImpact(PlayerEvaluationDraft draft) {
  if (draft.evaluationType == 'points') {
    return OvrCalculator.previewFromPoints(
      currentAttributes: draft.currentAttributes,
      currentOvr: draft.currentOvr,
      position: draft.position,
      rating: draft.rating,
    );
  }
  if (draft.evaluationType == 'tags') {
    if (draft.performanceTags.isEmpty) return null;
    return OvrCalculator.previewFromTags(
      currentAttributes: draft.currentAttributes,
      currentOvr: draft.currentOvr,
      tags: draft.performanceTags,
    );
  }
  final ai = draft.aiPreview;
  if (ai == null) return null;
  return OvrCalculator.previewFromAI(
    currentAttributes: draft.currentAttributes,
    currentOvr: draft.currentOvr,
    aiChanges: ai.attributeChanges,
  );
}

String _ovrTransitionLabel(EvaluationImpactPreview preview) {
  if (preview.ovrDelta > 0) {
    return 'OVR ${preview.oldOvr} → ${preview.newOvr} (+${preview.ovrDelta})';
  }
  if (preview.ovrDelta < 0) {
    return 'OVR ${preview.oldOvr} → ${preview.newOvr} (${preview.ovrDelta})';
  }
  return 'OVR ${preview.oldOvr} · Sin cambio';
}

class _PlayerEvaluationCard extends StatelessWidget {
  final String matchId;
  final PlayerEvaluationDraft draft;
  final VoidCallback onChanged;
  const _PlayerEvaluationCard({
    required this.matchId,
    required this.draft,
    required this.onChanged,
  });
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return PateaCard(
      color: c.card,
      radius: AppRadii.cardAll,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              PateaAvatar(
                photoUrl: draft.photoURL,
                seed: draft.subjectId,
                size: 54,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      draft.displayName,
                      style: AppTypography.body(
                        size: 17,
                        weight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    PlayerPositionBadge(
                      position: draft.position,
                      showFullName: true,
                      dense: true,
                      fontSize: 12,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'OVR',
                    style: AppTypography.code(
                      size: 10,
                      weight: FontWeight.w700,
                      color: c.textSecondary,
                    ),
                  ),
                  Text(
                    '${draft.currentOvr}',
                    style: AppTypography.sportNumber(
                      size: 24,
                      color: c.ovrTextColor(draft.currentOvr),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),
          PateaTabs(
            tabs: const [
              PateaTab('Nota'),
              PateaTab('Etiquetas'),
              PateaTab('Reseña'),
            ],
            active: draft.evaluationType == 'points'
                ? 0
                : draft.evaluationType == 'tags'
                    ? 1
                    : 2,
            onChanged: (i) {
              draft.evaluationType = i == 0
                  ? 'points'
                  : i == 1
                      ? 'tags'
                      : 'text';
              onChanged();
            },
          ),
          const SizedBox(height: 18),
          if (draft.evaluationType == 'points')
            _PointsEditor(draft: draft, onChanged: onChanged)
          else if (draft.evaluationType == 'tags')
            _TagsEditor(draft: draft, onChanged: onChanged)
          else
            _ResenaEditor(
              matchId: matchId,
              draft: draft,
              onChanged: onChanged,
            ),
          const SizedBox(height: 16),
          _EvaluationImpactStrip(draft: draft),
        ],
      ),
    );
  }
}

class _EvaluationImpactStrip extends StatelessWidget {
  final PlayerEvaluationDraft draft;

  const _EvaluationImpactStrip({required this.draft});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final preview = _computeDraftImpact(draft);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Divider(height: 1, color: c.overlayLine),
        const SizedBox(height: 14),
        if (preview == null) ...[
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 6,
            children: [
              Text(
                'Impacto estimado',
                style: AppTypography.body(
                  size: 12.5,
                  weight: FontWeight.w700,
                  color: c.textSecondary,
                ),
              ),
              Text(
                'OVR ${draft.currentOvr}',
                style: AppTypography.code(
                  size: 12,
                  weight: FontWeight.w700,
                  color: c.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            draft.evaluationType == 'tags'
                ? 'Elegí entre $_minEvaluationTags y $_maxEvaluationTags etiquetas para ver cómo se mueven los atributos y el OVR.'
                : draft.isAudioReview
                    ? 'Al detener la grabación calculamos el impacto estimado en atributos y OVR.'
                    : 'Tocá «Ver impacto» para previsualizar cómo mueve los atributos y el OVR.',
            style: AppTypography.body(
              size: 12,
              color: c.textSecondary,
              height: 1.35,
            ),
          ),
        ] else ...[
          _buildPreviewBody(context, preview),
        ],
      ],
    );
  }

  Widget _buildPreviewBody(
    BuildContext context,
    EvaluationImpactPreview preview,
  ) {
    final c = context.c;
    final Color ovrTone = preview.ovrDelta > 0
        ? c.success
        : preview.ovrDelta < 0
            ? c.destructive
            : c.textSecondary;
    final deltas = preview.nonZeroDeltas;
    final aiSummary = draft.evaluationType == 'text'
        ? (draft.aiPreview?.summary.trim() ?? '')
        : '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          runSpacing: 6,
          children: [
            Text(
              'Impacto estimado',
              style: AppTypography.body(
                size: 12.5,
                weight: FontWeight.w700,
                color: c.textSecondary,
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: preview.ovrDelta == 0
                    ? c.cardSurface
                    : ovrTone.withValues(alpha: 0.14),
                borderRadius: AppRadii.chipAll,
              ),
              child: Text(
                _ovrTransitionLabel(preview),
                style: AppTypography.code(
                  size: 12,
                  weight: FontWeight.w700,
                  color: ovrTone,
                ),
              ),
            ),
          ],
        ),
        if (aiSummary.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            aiSummary,
            style: AppTypography.body(
              size: 12.5,
              color: c.textSecondary,
              height: 1.35,
            ),
          ),
        ],
        const SizedBox(height: 10),
        if (deltas.isNotEmpty)
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final entry in deltas)
                _AttributeDeltaChip(
                  label: _attrLabels[entry.key] ?? entry.key.toUpperCase(),
                  delta: entry.value,
                ),
            ],
          )
        else
          Text(
            draft.evaluationType == 'points' && draft.rating.round() == 5
                ? 'Nota neutra · no modifica atributos ni OVR.'
                : 'Sin cambios netos en atributos.',
            style: AppTypography.body(size: 12, color: c.textSecondary),
          ),
        if (draft.evaluationType == 'tags' &&
            draft.performanceTags.length < _minEvaluationTags) ...[
          const SizedBox(height: 6),
          Text(
            'Te faltan ${_minEvaluationTags - draft.performanceTags.length} etiqueta(s) más para poder enviar.',
            style: AppTypography.body(
              size: 11.5,
              weight: FontWeight.w600,
              color: c.warningText,
            ),
          ),
        ],
        const SizedBox(height: 8),
        Text(
          'Tu aporte estimado · al cerrar el partido se promedia con el resto del grupo.',
          style: AppTypography.body(
            size: 11.5,
            color: c.textSecondary,
            height: 1.3,
          ),
        ),
      ],
    );
  }
}

class _AttributeDeltaChip extends StatelessWidget {
  final String label;
  final int delta;

  const _AttributeDeltaChip({required this.label, required this.delta});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final positive = delta > 0;
    final tone = positive ? c.success : c.destructive;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.13),
        borderRadius: AppRadii.chipAll,
      ),
      child: Text(
        '${positive ? '+' : ''}$delta $label',
        style: AppTypography.code(
          size: 11.5,
          weight: FontWeight.w700,
          color: tone,
        ),
      ),
    );
  }
}

String _ratingDescription(double value) => value >= 9
    ? 'Determinante'
    : value >= 7
    ? 'Buen partido'
    : value >= 5
    ? 'Regular'
    : value >= 3
    ? 'Por debajo de su nivel'
    : 'Le costó el partido';

class _PointsEditor extends StatelessWidget {
  final PlayerEvaluationDraft draft;
  final VoidCallback onChanged;
  const _PointsEditor({required this.draft, required this.onChanged});
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            '${draft.rating.round()}',
            style: AppTypography.sportNumber(
              size: 48,
              color: context.c.textPrimary,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            '/ 10',
            style: AppTypography.body(size: 14, color: context.c.textSecondary),
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Text(
              _ratingDescription(draft.rating),
              style: AppTypography.body(size: 14, weight: FontWeight.w600),
            ),
          ),
        ],
      ),
      Slider(
        value: draft.rating,
        min: 1,
        max: 10,
        divisions: 9,
        activeColor: context.c.primary,
        semanticFormatterCallback: (v) =>
            '${v.round()} de 10. ${_ratingDescription(v)}',
        onChanged: (v) {
          draft.rating = v;
          onChanged();
        },
      ),
      Row(
        children: [
          Expanded(
            child: Text(
              '1 · Le costó',
              style: AppTypography.body(
                size: 11.5,
                color: context.c.textSecondary,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Text(
            '5 · Neutro',
            textAlign: TextAlign.center,
            style: AppTypography.body(
              size: 11.5,
              color: context.c.textSecondary,
            ),
          ),
          Expanded(
            child: Text(
              '10 · Figura',
              textAlign: TextAlign.end,
              style: AppTypography.body(
                size: 11.5,
                color: context.c.textSecondary,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    ],
  );
}

class _TagsEditor extends StatelessWidget {
  final PlayerEvaluationDraft draft;
  final VoidCallback onChanged;
  const _TagsEditor({required this.draft, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final count = draft.performanceTags.length;
    final atMax = count >= _maxEvaluationTags;
    final isReady = count >= _minEvaluationTags;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          runSpacing: 6,
          children: [
            Text(
              !isReady
                  ? 'Elegí entre $_minEvaluationTags y $_maxEvaluationTags acciones.'
                  : atMax
                      ? 'Máximo alcanzado · tocá una para cambiarla.'
                      : 'Listo · podés sumar hasta $_maxEvaluationTags acciones.',
              style: AppTypography.body(size: 13, color: c.textSecondary),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
              decoration: BoxDecoration(
                color: isReady
                    ? c.success.withValues(alpha: 0.14)
                    : c.cardSurface,
                borderRadius: AppRadii.chipAll,
              ),
              child: Text(
                '$count / $_maxEvaluationTags',
                style: AppTypography.code(
                  size: 12,
                  weight: FontWeight.w700,
                  color: isReady ? c.success : c.textSecondary,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        for (final positive in [true, false]) ...[
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              positive ? 'Lo que aportó' : 'Lo que puede mejorar',
              style: AppTypography.body(size: 14, weight: FontWeight.w700),
            ),
          ),
          for (final tag in draft.tagPool.where(
            (t) => (t.impact == 'positive') == positive,
          ))
            Builder(
              builder: (context) {
                final selected = draft.performanceTags.any(
                  (t) => t.id == tag.id,
                );
                final canToggle = selected || !atMax;
                final tone = positive ? c.success : c.destructive;
                return CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  activeColor: c.primary,
                  value: selected,
                  title: Text(
                    tag.name,
                    style: AppTypography.body(
                      size: 14,
                      weight: FontWeight.w600,
                      color: canToggle ? c.textPrimary : c.textSecondary,
                    ),
                  ),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          tag.description,
                          style: AppTypography.body(
                            size: 12,
                            color: c.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: [
                            for (final eff in tag.effects.entries)
                              Text(
                                '${eff.value > 0 ? '+' : '-'}${_attrLabels[eff.key] ?? eff.key.toUpperCase()}',
                                style: AppTypography.code(
                                  size: 11,
                                  weight: FontWeight.w700,
                                  color: canToggle
                                      ? tone
                                      : c.textSecondary.withValues(alpha: 0.7),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  onChanged: canToggle
                      ? (_) {
                          if (selected) {
                            draft.performanceTags.removeWhere(
                              (t) => t.id == tag.id,
                            );
                          } else if (draft.performanceTags.length <
                              _maxEvaluationTags) {
                            draft.performanceTags.add(tag);
                          }
                          onChanged();
                        }
                      : null,
                );
              },
            ),
        ],
      ],
    );
  }
}

String _draftSummaryLabel(PlayerEvaluationDraft draft) {
  final preview = _computeDraftImpact(draft);
  final ovrSuffix = preview != null ? ' · ${_ovrTransitionLabel(preview)}' : '';

  if (draft.evaluationType == 'points') {
    return '${draft.rating.round()}/10$ovrSuffix';
  }
  if (draft.evaluationType == 'tags') {
    return '${draft.performanceTags.length} etiquetas$ovrSuffix';
  }
  if (draft.isAudioReview) {
    return 'Nota de voz (${formatAudioDuration(draft.audioDurationSec)})$ovrSuffix';
  }
  return 'Reseña escrita$ovrSuffix';
}

const Map<String, String> _attrLabels = {
  'pac': 'RIT',
  'sho': 'TIR',
  'pas': 'PAS',
  'dri': 'REG',
  'def': 'DEF',
  'phy': 'FIS',
};

class _ResenaEditor extends ConsumerStatefulWidget {
  final String matchId;
  final PlayerEvaluationDraft draft;
  final VoidCallback onChanged;

  const _ResenaEditor({
    required this.matchId,
    required this.draft,
    required this.onChanged,
  });

  @override
  ConsumerState<_ResenaEditor> createState() => _ResenaEditorState();
}

class _ResenaEditorState extends ConsumerState<_ResenaEditor> {
  static const int _minAudioSeconds = 3;
  static const int _maxAudioSeconds = 60;

  late final TextEditingController _controller;
  AudioRecorder? _recorder;
  StreamSubscription<Amplitude>? _ampSub;
  Timer? _recordTimer;

  bool _recording = false;
  int _elapsedSec = 0;
  final List<double> _waveLevels = List<double>.filled(16, 0.14);

  bool _analyzing = false;
  String? _statusMessage;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.draft.textDescription);
  }

  @override
  void didUpdateWidget(covariant _ResenaEditor oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.draft.assignmentId != widget.draft.assignmentId &&
        _controller.text != widget.draft.textDescription) {
      _controller.text = widget.draft.textDescription;
    }
  }

  @override
  void dispose() {
    _recordTimer?.cancel();
    _ampSub?.cancel();
    _recorder?.dispose();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _previewWrittenImpact() async {
    final text = _controller.text.trim();
    if (text.length < 10) {
      setState(() => _error = 'Escribí al menos 10 caracteres para ver el impacto.');
      return;
    }
    setState(() {
      _analyzing = true;
      _statusMessage = 'Leyendo tu reseña…';
      _error = null;
    });
    try {
      final preview = await ref.read(evaluationServiceProvider).analyzeTextPerformance(
            text: text,
            playerPosition: widget.draft.position,
            playerName: widget.draft.displayName,
            matchId: widget.matchId,
            assignmentId: widget.draft.assignmentId,
          );
      if (!mounted) return;
      setState(() {
        widget.draft.aiPreview = preview;
        _analyzing = false;
        _statusMessage = null;
      });
      widget.onChanged();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _analyzing = false;
        _statusMessage = null;
        _error = 'No pudimos calcular el impacto ahora. Igual podés enviar tu reseña.';
      });
    }
  }

  Future<void> _startRecording() async {
    if (_recording || _analyzing) return;
    setState(() => _error = null);
    try {
      final recorder = _recorder ??= AudioRecorder();
      final permitted = await recorder.hasPermission();
      if (!permitted) {
        if (mounted) {
          setState(
            () => _error = 'Necesitamos permiso de micrófono para grabar tu nota de voz.',
          );
        }
        return;
      }

      final tempDir = await getTemporaryDirectory();
      final outPath =
          '${tempDir.path}${Platform.pathSeparator}patea_eval_${widget.draft.assignmentId}.m4a';
      final existing = File(outPath);
      if (await existing.exists()) {
        await existing.delete();
      }

      await recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 64000,
          sampleRate: 44100,
          numChannels: 1,
        ),
        path: outPath,
      );

      _elapsedSec = 0;
      _ampSub?.cancel();
      _ampSub = recorder
          .onAmplitudeChanged(const Duration(milliseconds: 120))
          .listen((amp) {
            if (!mounted) return;
            final norm = ((amp.current + 50) / 50).clamp(0.10, 1.0);
            setState(() {
              _waveLevels.removeAt(0);
              _waveLevels.add(norm);
            });
          });

      _recordTimer?.cancel();
      _recordTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted) {
          timer.cancel();
          return;
        }
        setState(() => _elapsedSec += 1);
        if (_elapsedSec >= _maxAudioSeconds) {
          _stopRecordingAndAnalyze();
        }
      });

      if (mounted) {
        setState(() {
          _recording = true;
          widget.draft.aiPreview = null;
          widget.draft.uploadedAudioPath = null;
        });
        widget.onChanged();
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _recording = false;
          _error = 'No pudimos iniciar el micrófono. Probá de nuevo.';
        });
      }
    }
  }

  Future<void> _stopRecordingAndAnalyze() async {
    if (!_recording) return;
    _recordTimer?.cancel();
    _ampSub?.cancel();
    final elapsed = _elapsedSec;
    String? recordedPath;
    try {
      recordedPath = await _recorder?.stop();
    } catch (_) {
      recordedPath = null;
    }

    if (!mounted) return;
    setState(() => _recording = false);

    if (recordedPath == null || elapsed < _minAudioSeconds) {
      if (recordedPath != null) {
        final f = File(recordedPath);
        if (f.existsSync()) f.deleteSync();
      }
      setState(() {
        _error = 'Grabá al menos $_minAudioSeconds segundos para contar cómo jugó.';
      });
      return;
    }

    widget.draft.localAudioPath = recordedPath;
    widget.draft.audioDurationSec = elapsed;
    widget.draft.uploadedAudioPath = null;
    widget.draft.aiPreview = null;
    widget.onChanged();

    await _uploadAndAnalyzeAudio();
  }

  Future<void> _uploadAndAnalyzeAudio() async {
    final localPath = widget.draft.localAudioPath;
    if (localPath == null || _analyzing) return;
    final file = File(localPath);
    if (!await file.exists()) {
      setState(() => _error = 'No encontramos el audio grabado. Probá grabando de nuevo.');
      return;
    }

    setState(() {
      _analyzing = true;
      _statusMessage = 'Subiendo y calculando impacto…';
      _error = null;
    });

    try {
      final service = ref.read(evaluationServiceProvider);
      final storagePath = await service.uploadEvaluationAudio(
        matchId: widget.matchId,
        assignmentId: widget.draft.assignmentId,
        file: file,
      );
      if (!mounted) return;
      widget.draft.uploadedAudioPath = storagePath;

      final preview = await service.analyzeAudioPerformance(
        matchId: widget.matchId,
        assignmentId: widget.draft.assignmentId,
        audioPath: storagePath,
        audioDurationSec: widget.draft.audioDurationSec,
      );
      if (!mounted) return;
      setState(() {
        widget.draft.aiPreview = preview;
        _analyzing = false;
        _statusMessage = null;
      });
      widget.onChanged();
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString().contains('comentario claro')
          ? 'No pudimos escuchar un comentario claro en el audio. Probá grabando de nuevo.'
          : 'No pudimos analizar el audio ahora. Podés reintentar o regrabar.';
      setState(() {
        _analyzing = false;
        _statusMessage = null;
        _error = msg;
      });
      widget.onChanged();
    }
  }

  Future<void> _clearAudio() async {
    if (_recording) {
      _recordTimer?.cancel();
      _ampSub?.cancel();
      try {
        await _recorder?.stop();
      } catch (_) {}
    }
    final local = widget.draft.localAudioPath;
    if (local != null) {
      final f = File(local);
      if (f.existsSync()) {
        try {
          f.deleteSync();
        } catch (_) {}
      }
    }
    if (!mounted) return;
    setState(() {
      _recording = false;
      _elapsedSec = 0;
      _error = null;
      widget.draft.localAudioPath = null;
      widget.draft.uploadedAudioPath = null;
      widget.draft.audioDurationSec = 0;
      widget.draft.aiPreview = null;
    });
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isAudio = widget.draft.reviewMode == 'audio';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentedButton<String>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment<String>(
              value: 'write',
              icon: Icon(Icons.edit_note_rounded, size: 17),
              label: Text('Escribir', maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
            ButtonSegment<String>(
              value: 'audio',
              icon: Icon(Icons.mic_rounded, size: 17),
              label: Text('Audio', maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
          ],
          selected: {widget.draft.reviewMode},
          onSelectionChanged: _recording || _analyzing
              ? null
              : (s) {
                  setState(() {
                    widget.draft.reviewMode = s.first;
                    widget.draft.aiPreview = null;
                    _error = null;
                  });
                  widget.onChanged();
                },
        ),
        const SizedBox(height: 14),
        if (!isAudio)
          _buildWrittenSection(context)
        else
          _buildAudioSection(context),
        if (_error != null) ...[
          const SizedBox(height: 10),
          Text(
            _error!,
            style: AppTypography.body(size: 12, color: c.destructive),
          ),
        ],
      ],
    );
  }

  Widget _buildWrittenSection(BuildContext context) {
    final c = context.c;
    final len = widget.draft.textDescription.trim().length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Contá con tus palabras cómo jugó hoy.',
          style: AppTypography.body(size: 13, color: c.textSecondary),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _controller,
          minLines: 3,
          maxLines: 5,
          maxLength: 500,
          onChanged: (value) {
            widget.draft.textDescription = value;
            if (widget.draft.aiPreview != null) {
              widget.draft.aiPreview = null;
            }
            if (_error != null) _error = null;
            widget.onChanged();
          },
          decoration: const InputDecoration(
            hintText:
                'Ej: Metió dos pases gol, corrió todo el segundo tiempo y cerró bien abajo…',
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: Text(
                len < 10 ? 'Mínimo 10 caracteres ($len/10)' : 'Listo para enviar',
                style: AppTypography.body(
                  size: 12,
                  color: len < 10 ? c.textSecondary : c.primary,
                ),
              ),
            ),
            OutlinedButton.icon(
              onPressed: _analyzing || len < 10 ? null : _previewWrittenImpact,
              icon: _analyzing
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: PateaButtonProgress(),
                    )
                  : const Icon(Icons.auto_graph_rounded, size: 16),
              label: Text(_analyzing ? 'Leyendo…' : 'Ver impacto'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildAudioSection(BuildContext context) {
    final c = context.c;
    final hasLocalAudio = widget.draft.localAudioPath != null;

    if (_recording) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: c.destructive,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Grabando… ${formatAudioDuration(_elapsedSec)} / ${formatAudioDuration(_maxAudioSeconds)}',
                style: AppTypography.code(
                  size: 13,
                  weight: FontWeight.w700,
                  color: c.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 38,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                for (final lvl in _waveLevels)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 110),
                    width: 4,
                    height: (lvl * 34).clamp(5.0, 34.0),
                    decoration: BoxDecoration(
                      color: c.primary,
                      borderRadius: AppRadii.pillAll,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: _stopRecordingAndAnalyze,
            style: FilledButton.styleFrom(
              backgroundColor: c.destructive,
              foregroundColor: Theme.of(context).colorScheme.onError,
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
            icon: const Icon(Icons.stop_rounded, size: 20),
            label: const Text('Detener y calcular impacto'),
          ),
        ],
      );
    }

    if (hasLocalAudio) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EvaluationAudioPlayer(
            localFilePath: widget.draft.localAudioPath,
            durationSec: widget.draft.audioDurationSec,
            trailing: IconButton(
              tooltip: 'Borrar audio',
              onPressed: _analyzing ? null : _clearAudio,
              icon: Icon(
                Icons.delete_outline_rounded,
                size: 20,
                color: c.textSecondary,
              ),
            ),
          ),
          const SizedBox(height: 10),
          if (_analyzing)
            Row(
              children: [
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: PateaButtonProgress(),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _statusMessage ?? 'Analizando tu nota de voz…',
                    style: AppTypography.body(size: 12.5, color: c.textSecondary),
                  ),
                ),
              ],
            )
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: _startRecording,
                  icon: const Icon(Icons.mic_rounded, size: 17),
                  label: const Text('Grabar de nuevo'),
                ),
                if (!widget.draft.hasReadyAudio || widget.draft.aiPreview == null)
                  FilledButton.icon(
                    onPressed: _uploadAndAnalyzeAudio,
                    icon: const Icon(Icons.auto_graph_rounded, size: 17),
                    label: const Text('Reintentar análisis'),
                  ),
              ],
            ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Contá con tu voz cómo jugó hoy (3 a 60 s). Tu voz queda protegida mientras la evaluación sea anónima.',
          style: AppTypography.body(size: 13, color: c.textSecondary, height: 1.4),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _analyzing ? null : _startRecording,
          style: FilledButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 13),
          ),
          icon: const Icon(Icons.mic_rounded, size: 20),
          label: const Text('Grabar nota de voz'),
        ),
      ],
    );
  }
}
