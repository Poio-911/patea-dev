import '../../core/widgets/patea_evaluation_mark.dart';
import '../../core/widgets/patea_button_progress.dart';
import 'package:flutter/material.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/theme/app_radii.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_avatar.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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

List<PerformanceTagItem> _randomTagPool(String position) {
  final tags = PerformanceTagsData.getTagsForPosition(position);
  final positive = tags.where((t) => t.impact == 'positive').toList()
    ..shuffle();
  final negative = tags.where((t) => t.impact == 'negative').toList()
    ..shuffle();
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
      if (d.evaluationType == 'tags' && d.performanceTags.length < 3) {
        PateaSnack.info(
          context,
          'Elegí al menos 3 etiquetas para ${d.displayName}.',
        );
        return;
      }
      if (d.evaluationType == 'text' && d.textDescription.trim().length < 10) {
        PateaSnack.info(
          context,
          'Escribí al menos 10 caracteres en la reseña de ${d.displayName}.',
        );
        return;
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: context.c.cardSurface,
            content: Row(
              children: [
                const PateaEvaluationMark(animate: true, size: 40),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    '¡Evaluaciones enviadas! Se van a procesar en segundo plano.',
                    style: AppTypography.body(
                      size: 14,
                      color: context.c.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),
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
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
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
          'Valorá lo que pasó en la cancha. Podés usar una nota o describir el rendimiento con etiquetas.',
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
          _PlayerEvaluationCard(draft: draft, onChanged: () => setState(() {})),
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

class _PlayerEvaluationCard extends StatelessWidget {
  final PlayerEvaluationDraft draft;
  final VoidCallback onChanged;
  const _PlayerEvaluationCard({required this.draft, required this.onChanged});
  @override
  Widget build(BuildContext context) => PateaCard(
    color: context.c.card,
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
          _ResenaEditor(draft: draft, onChanged: onChanged),
      ],
    ),
  );
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
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            '1 · Le costó',
            style: AppTypography.body(size: 11, color: context.c.textSecondary),
          ),
          Text(
            '10 · Determinante',
            style: AppTypography.body(size: 11, color: context.c.textSecondary),
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
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        draft.performanceTags.length < 3
            ? 'Elegí al menos 3 acciones que describan su partido.'
            : '${draft.performanceTags.length} acciones seleccionadas',
        style: AppTypography.body(size: 13, color: context.c.textSecondary),
      ),
      const SizedBox(height: 12),
      for (final positive in [true, false]) ...[
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Text(
            positive ? 'Lo que aportó' : 'Lo que puede mejorar',
            style: AppTypography.body(size: 14, weight: FontWeight.w700),
          ),
        ),
        for (final tag in draft.tagPool.where(
          (t) => (t.impact == 'positive') == positive,
        ))
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            activeColor: context.c.primary,
            value: draft.performanceTags.any((t) => t.id == tag.id),
            title: Text(
              tag.name,
              style: AppTypography.body(size: 14, weight: FontWeight.w600),
            ),
            subtitle: Text(
              tag.description,
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
            onChanged: (_) {
              final selected = draft.performanceTags.any((t) => t.id == tag.id);
              if (selected) {
                draft.performanceTags.removeWhere((t) => t.id == tag.id);
              } else {
                draft.performanceTags.add(tag);
              }
              onChanged();
            },
          ),
      ],
    ],
  );
}

String _draftSummaryLabel(PlayerEvaluationDraft draft) {
  if (draft.evaluationType == 'points') return '${draft.rating.round()}/10';
  if (draft.evaluationType == 'tags') {
    return '${draft.performanceTags.length} etiquetas';
  }
  final count = draft.aiPreview?.attributeChanges.length;
  return count != null && count > 0
      ? 'Reseña ($count impactos)'
      : 'Reseña escrita';
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
  final PlayerEvaluationDraft draft;
  final VoidCallback onChanged;

  const _ResenaEditor({required this.draft, required this.onChanged});

  @override
  ConsumerState<_ResenaEditor> createState() => _ResenaEditorState();
}

class _ResenaEditorState extends ConsumerState<_ResenaEditor> {
  late final TextEditingController _controller;
  bool _analyzing = false;
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
    _controller.dispose();
    super.dispose();
  }

  Future<void> _previewImpact() async {
    final text = _controller.text.trim();
    if (text.length < 10) {
      setState(() => _error = 'Escribí al menos 10 caracteres para ver el impacto.');
      return;
    }
    setState(() {
      _analyzing = true;
      _error = null;
    });
    try {
      final preview = await ref.read(evaluationServiceProvider).analyzeTextPerformance(
            text: text,
            playerPosition: widget.draft.position,
            playerName: widget.draft.displayName,
          );
      if (!mounted) return;
      setState(() {
        widget.draft.aiPreview = preview;
        _analyzing = false;
      });
      widget.onChanged();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _analyzing = false;
        _error = 'No pudimos calcular el impacto ahora. Igual podés enviar tu reseña.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final preview = widget.draft.aiPreview;
    final len = widget.draft.textDescription.trim().length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Contá con tus palabras cómo jugó hoy.',
          style: AppTypography.body(size: 13, color: c.textSecondary),
        ),
        const SizedBox(height: 12),
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
              onPressed: _analyzing || len < 10 ? null : _previewImpact,
              icon: _analyzing
                  ? const PateaButtonProgress()
                  : const Icon(Icons.auto_graph_rounded, size: 16),
              label: Text(_analyzing ? 'Leyendo…' : 'Ver impacto'),
            ),
          ],
        ),
        if (_error != null) ...[
          const SizedBox(height: 10),
          Text(
            _error!,
            style: AppTypography.body(
              size: 12,
              color: Theme.of(context).colorScheme.error,
            ),
          ),
        ],
        if (preview != null) ...[
          const SizedBox(height: 14),
          PateaCard(
            color: c.cardSurface,
            radius: AppRadii.cardAll,
            borderColor: c.border,
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Lectura del partido',
                  style: AppTypography.body(size: 13, weight: FontWeight.w700),
                ),
                if (preview.summary.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    preview.summary,
                    style: AppTypography.body(size: 12, color: c.textSecondary),
                  ),
                ],
                if (preview.attributeChanges.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      for (final ch in preview.attributeChanges)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: (ch.change >= 0
                                    ? c.primary
                                    : Theme.of(context).colorScheme.error)
                                .withValues(alpha: 0.14),
                            borderRadius: AppRadii.chipAll,
                          ),
                          child: Text(
                            '${ch.change >= 0 ? '+' : ''}${ch.change} ${_attrLabels[ch.attribute] ?? ch.attribute.toUpperCase()}',
                            style: AppTypography.code(
                              size: 11,
                              weight: FontWeight.w700,
                              color: ch.change >= 0
                                  ? c.primary
                                  : Theme.of(context).colorScheme.error,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}
