import '../../../core/widgets/patea_avatar.dart';
import '../../../core/widgets/patea_button_progress.dart';
import '../../../core/widgets/patea_snack.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/player_activity_models.dart';
import '../../../core/services/evaluation_service.dart';
import '../../../core/services/firestore_service.dart';
import '../../../core/services/player_profile_service.dart';
import '../../../core/theme/patea_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/dates.dart';
import '../../../core/widgets/patea_states.dart';
import '../../evaluations/widgets/evaluation_audio_player.dart';

/// Port de `PlayerMatchDebriefView` (src/components/player-match-debrief-view.tsx).
///
/// El perfil presenta el último partido sin repetir los totales de carrera.
/// El historial completo agrega el resumen de todos los partidos evaluados.
class PlayerMatchDebrief extends ConsumerWidget {
  final String playerId;
  final bool compact;

  const PlayerMatchDebrief({
    super.key,
    required this.playerId,
    this.compact = true,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activityAsync = ref.watch(playerActivityProvider(playerId));
    final isOwnProfile = ref.watch(currentUidProvider) == playerId;

    return activityAsync.when(
      loading: () => const PateaLoading(height: 96),
      error: (err, _) => PateaError(
        error: err,
        message: 'No se pudo cargar el historial.',
        compact: true,
        onRetry: () => ref.invalidate(playerActivityProvider(playerId)),
      ),
      data: (matches) {
        if (matches.isEmpty) {
          // En modo compacto la web no muestra nada cuando no hay partidos.
          if (compact) return const SizedBox.shrink();
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 48),
            child: Column(
              children: [
                Icon(
                  Icons.calendar_today,
                  size: 38,
                  color: context.c.textSecondary.withValues(alpha: 0.35),
                ),
                const SizedBox(height: 12),
                Text(
                  'Aún no hay partidos evaluados.',
                  style: AppTypography.body(
                    size: 13,
                    color: context.c.textSecondary,
                  ),
                ),
              ],
            ),
          );
        }

        final summary = PlayerActivitySummary.from(matches);
        final shown = compact ? matches.take(1).toList() : matches;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (!compact) ...[
              _SummaryRow(summary: summary),
              const SizedBox(height: 24),
            ],
            for (var index = 0; index < shown.length; index++) ...[
              if (index > 0) Divider(height: 40, color: context.c.border),
              _MatchCard(
                feedback: shown[index],
                playerId: playerId,
                isOwnProfile: isOwnProfile,
              ),
            ],
            if (compact && matches.length > 1)
              Center(
                child: TextButton.icon(
                  onPressed: () => context.push('/players/$playerId/historial'),
                  icon: Text(
                    'Ver historial completo',
                    style: AppTypography.body(
                      size: 13,
                      weight: FontWeight.w600,
                      color: context.c.primary,
                    ),
                  ),
                  label: Icon(
                    Icons.chevron_right,
                    size: 16,
                    color: context.c.primary,
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Los cuatro números de arriba. "Tendencia OVR" sólo aparece si hubo cambio,
/// igual que en la web.
class _SummaryRow extends StatelessWidget {
  final PlayerActivitySummary summary;

  const _SummaryRow({required this.summary});

  @override
  Widget build(BuildContext context) {
    final trendUp = summary.totalOvrChange > 0;
    return LayoutBuilder(
      builder: (context, constraints) => Wrap(
        spacing: 20,
        runSpacing: 18,
        children: [
          SizedBox(
            width: (constraints.maxWidth - 20) / 2,
            child: _Stat(
              label: 'Nota media',
              value: summary.avgRating > 0
                  ? summary.avgRating.toStringAsFixed(1)
                  : '—',
            ),
          ),
          SizedBox(
            width: (constraints.maxWidth - 20) / 2,
            child: _Stat(label: 'Goles', value: '${summary.totalGoals}'),
          ),
          SizedBox(
            width: (constraints.maxWidth - 20) / 2,
            child: _Stat(
              label: 'Partidos evaluados',
              value: '${summary.matchCount}',
            ),
          ),
          if (summary.totalOvrChange != 0)
            SizedBox(
              width: (constraints.maxWidth - 20) / 2,
              child: _Stat(
                label: 'Cambio OVR',
                value:
                    '${trendUp ? '+' : ''}${summary.totalOvrChange.toStringAsFixed(1)}',
                valueColor: trendUp ? context.c.success : context.c.destructive,
              ),
            ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label, value;
  final Color? valueColor;
  const _Stat({required this.label, required this.value, this.valueColor});
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: AppTypography.body(size: 12, color: context.c.textSecondary),
      ),
      const SizedBox(height: 4),
      Text(
        value,
        style: AppTypography.sportNumber(
          size: 26,
          color: valueColor ?? context.c.textPrimary,
        ),
      ),
    ],
  );
}

/// One match reads as an open report, shared by own and public profiles.

class _MatchCard extends StatelessWidget {
  final MatchFeedback feedback;
  final String playerId;
  final bool isOwnProfile;
  const _MatchCard({
    required this.feedback,
    required this.playerId,
    required this.isOwnProfile,
  });
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final changes =
        feedback.attributeDeltas.entries.where((e) => e.value != 0).toList()
          ..sort((a, b) => b.value.abs().compareTo(a.value.abs()));
    final ovr = feedback.ovrUpdate;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            feedback.title,
            style: AppTypography.headline(size: 20, weight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            [
              fmtDayAndMonth(feedback.date),
              feedback.locationName,
            ].whereType<String>().where((s) => s.trim().isNotEmpty).join(' · '),
            style: AppTypography.body(size: 13, color: c.textSecondary),
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
            decoration: BoxDecoration(
              color: c.cardSurface.withValues(
                alpha: c.isDarkSurface ? .55 : .65,
              ),
              borderRadius: AppRadii.cardAll,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _MatchStat(label: 'Goles', value: '${feedback.goals}'),
                _MatchStat(label: 'Asistencias', value: '${feedback.assists}'),
                _MatchStat(
                  label: 'Nota media',
                  value: feedback.avgRating > 0
                      ? feedback.avgRating.toStringAsFixed(1)
                      : '—',
                ),
              ],
            ),
          ),
          if (ovr != null && ovr.change != 0)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Row(
                children: [
                  Icon(
                    ovr.change > 0
                        ? Icons.trending_up_rounded
                        : Icons.trending_down_rounded,
                    size: 18,
                    color: ovr.change > 0 ? c.success : c.destructive,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Semantics(
                      label: 'OVR ${ovr.previousOvr} a ${ovr.newOvr}',
                      excludeSemantics: true,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'OVR ${ovr.previousOvr}',
                            style: AppTypography.body(
                              size: 14,
                              weight: FontWeight.w600,
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: Icon(
                              Icons.arrow_forward_rounded,
                              size: 15,
                              color: c.textSecondary,
                            ),
                          ),
                          Text(
                            '${ovr.newOvr}',
                            style: AppTypography.body(
                              size: 14,
                              weight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Text(
                    '${ovr.change > 0 ? '+' : ''}${ovr.change.toInt()}',
                    style: AppTypography.sportNumber(
                      size: 22,
                      color: ovr.change > 0 ? c.success : c.destructive,
                    ),
                  ),
                ],
              ),
            ),
          if (changes.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text(
              'Evolución en este partido',
              style: AppTypography.body(size: 14, weight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            _AttributeChanges(changes: changes),
          ],
          if (feedback.peerEvaluations.isNotEmpty) ...[
            const SizedBox(height: 24),
            Text('Devoluciones', style: AppTypography.headline(size: 19)),
            const SizedBox(height: 4),
            Text(
              'Lo que vieron tus compañeros en la cancha.',
              style: AppTypography.body(size: 12, color: c.textSecondary),
            ),
            for (var i = 0; i < feedback.peerEvaluations.length; i++) ...[
              if (i > 0)
                Divider(height: 1, color: c.border.withValues(alpha: .45)),
              _PeerEvalTile(
                evaluation: feedback.peerEvaluations[i],
                playerId: playerId,
                isOwnProfile: isOwnProfile,
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _MatchStat extends StatelessWidget {
  final String label, value;
  const _MatchStat({required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(
          value,
          style: AppTypography.sportNumber(
            size: 29,
            color: context.c.textPrimary,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          textAlign: TextAlign.center,
          style: AppTypography.body(size: 12, color: context.c.textSecondary),
        ),
      ],
    ),
  );
}

class _AttributeChanges extends StatelessWidget {
  final List<MapEntry<String, int>> changes;
  const _AttributeChanges({required this.changes});
  static const labels = {
    'pac': 'Ritmo',
    'sho': 'Tiro',
    'pas': 'Pase',
    'dri': 'Regate',
    'def': 'Defensa',
    'phy': 'Físico',
  };
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) => Wrap(
      spacing: 20,
      runSpacing: 12,
      children: [
        for (final change in changes)
          SizedBox(
            width: (constraints.maxWidth - 20) / 2,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    labels[change.key] ?? change.key.toUpperCase(),
                    style: AppTypography.body(
                      size: 13,
                      color: context.c.textSecondary,
                    ),
                  ),
                ),
                Text(
                  '${change.value > 0 ? '+' : ''}${change.value}',
                  style: AppTypography.body(
                    size: 15,
                    weight: FontWeight.w700,
                    color: change.value > 0
                        ? context.c.success
                        : context.c.destructive,
                  ),
                ),
              ],
            ),
          ),
      ],
    ),
  );
}

class _PeerEvalTile extends ConsumerStatefulWidget {
  final PeerEvaluation evaluation;
  final String playerId;
  final bool isOwnProfile;

  const _PeerEvalTile({
    required this.evaluation,
    required this.playerId,
    required this.isOwnProfile,
  });

  @override
  ConsumerState<_PeerEvalTile> createState() => _PeerEvalTileState();
}

class _PeerEvalTileState extends ConsumerState<_PeerEvalTile> {
  bool _requestingReveal = false;
  bool _localRequested = false;
  bool _showTranscript = false;

  Future<void> _requestReveal() async {
    if (_requestingReveal) return;
    setState(() => _requestingReveal = true);
    try {
      await ref
          .read(evaluationServiceProvider)
          .requestIdentityReveal(widget.evaluation.id);
      if (!mounted) return;
      setState(() {
        _requestingReveal = false;
        _localRequested = true;
      });
      ref.invalidate(playerActivityProvider(widget.playerId));
      PateaSnack.ok(context, 'Solicitud enviada al compañero.');
    } catch (_) {
      if (!mounted) return;
      setState(() => _requestingReveal = false);
      PateaSnack.error(
        context,
        'No pudimos enviar la solicitud. Intentá de nuevo.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final evaluation = widget.evaluation;
    final anon =
        evaluation.isAnonymous || evaluation.evaluatorId == 'anonymous';
    final automatic = evaluation.type == EvalType.auto;
    final name = automatic
        ? 'Evaluación automática'
        : anon
        ? 'Compañero anónimo'
        : evaluation.evaluatorDisplayName ?? 'Compañero';
    final summary = (evaluation.aiSummary?.trim().isNotEmpty ?? false)
        ? evaluation.aiSummary!.trim()
        : (anon && evaluation.hasAudio
              ? null
              : evaluation.textDescription?.trim());
    final rawText = evaluation.textDescription?.trim() ?? '';
    final canToggleRawText =
        !anon &&
        rawText.isNotEmpty &&
        (evaluation.hasAudio || (summary != null && summary != rawText));
    final requestStatus = _localRequested
        ? 'pending'
        : evaluation.identityRequestStatus;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              if (anon || automatic)
                Icon(
                  automatic
                      ? Icons.auto_awesome_outlined
                      : Icons.visibility_off_outlined,
                  size: 18,
                  color: c.textSecondary,
                )
              else
                PateaAvatar(
                  photoUrl: evaluation.evaluatorPhotoUrl,
                  seed: evaluation.evaluatorId,
                  size: 30,
                ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body(
                    size: 13,
                    weight: FontWeight.w600,
                    color: c.textSecondary,
                  ),
                ),
              ),
              if (evaluation.rating != null) ...[
                const SizedBox(width: 12),
                Text(
                  evaluation.rating!.toStringAsFixed(
                    evaluation.rating! % 1 == 0 ? 0 : 1,
                  ),
                  style: AppTypography.sportNumber(
                    size: 24,
                    color: c.textPrimary,
                  ),
                ),
                const SizedBox(width: 3),
                Text(
                  '/10',
                  style: AppTypography.body(size: 12, color: c.textSecondary),
                ),
              ],
            ],
          ),
          if (evaluation.performanceTags.isNotEmpty) ...[
            const SizedBox(height: 12),
            for (final tag in evaluation.performanceTags)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Icon(
                        tag.impact == 'positive'
                            ? Icons.check_rounded
                            : Icons.trending_down_rounded,
                        size: 16,
                        color: tag.impact == 'positive'
                            ? c.success
                            : c.destructive,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        tag.name,
                        style: AppTypography.body(
                          size: 14,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
          if (summary != null && summary.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(
                summary,
                style: AppTypography.body(
                  size: 14,
                  color: c.textSecondary,
                  height: 1.5,
                ),
              ),
            ),
          if (!anon && evaluation.hasAudio) ...[
            const SizedBox(height: 12),
            EvaluationAudioPlayer(
              evaluationId: evaluation.id,
              durationSec: evaluation.audioDurationSec,
            ),
          ],
          if (canToggleRawText) ...[
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () =>
                    setState(() => _showTranscript = !_showTranscript),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 4,
                  ),
                  visualDensity: VisualDensity.compact,
                ),
                icon: Icon(
                  _showTranscript
                      ? Icons.expand_less_rounded
                      : Icons.notes_rounded,
                  size: 16,
                ),
                label: Text(
                  _showTranscript ? 'Ocultar texto' : 'Ver texto',
                  style: AppTypography.action(size: 13, color: c.primary),
                ),
              ),
            ),
            if (_showTranscript)
              Container(
                margin: const EdgeInsets.only(top: 4),
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                decoration: BoxDecoration(
                  border: Border(
                    left: BorderSide(
                      color: c.primary.withValues(alpha: 0.65),
                      width: 2,
                    ),
                  ),
                ),
                child: Text(
                  '«$rawText»',
                  style: AppTypography.body(
                    size: 13.5,
                    color: c.textPrimary,
                    height: 1.45,
                  ),
                ),
              ),
          ],
          if (anon && evaluation.hasAudio) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(
                  Icons.mic_off_outlined,
                  size: 15,
                  color: c.textSecondary,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    evaluation.audioDurationSec != null &&
                            evaluation.audioDurationSec! > 0
                        ? 'Nota de voz (${formatAudioDuration(evaluation.audioDurationSec!)}) protegida por anonimato'
                        : 'Nota de voz protegida por anonimato',
                    style: AppTypography.body(
                      size: 12,
                      color: c.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ],
          if (widget.isOwnProfile && anon && !automatic && evaluation.id.isNotEmpty) ...[
            const SizedBox(height: 8),
            if (requestStatus == 'pending')
              Row(
                children: [
                  Icon(
                    Icons.hourglass_top_rounded,
                    size: 14,
                    color: c.textSecondary,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Solicitud de identidad enviada',
                    style: AppTypography.body(size: 12, color: c.textSecondary),
                  ),
                ],
              )
            else if (requestStatus == 'rejected')
              Text(
                'El compañero prefirió mantener el anonimato',
                style: AppTypography.body(size: 12, color: c.textSecondary),
              )
            else
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: _requestingReveal ? null : _requestReveal,
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 4,
                    ),
                    visualDensity: VisualDensity.compact,
                  ),
                  icon: _requestingReveal
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: PateaButtonProgress(),
                        )
                      : Icon(
                          Icons.visibility_outlined,
                          size: 16,
                          color: c.primary,
                        ),
                  label: Text(
                    evaluation.hasAudio
                        ? 'Pedir saber quién fue y escuchar audio'
                        : 'Pedir saber quién fue',
                    style: AppTypography.action(size: 13, color: c.primary),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}
