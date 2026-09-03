import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/player_activity_models.dart';
import '../../../core/services/player_profile_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';

/// Port de `PlayerMatchDebriefView` (src/components/player-match-debrief-view.tsx).
///
/// `compact: true` reproduce el modo compacto que la web usa dentro del perfil:
/// los cuatro números de arriba, la tarjeta del último partido y un enlace al
/// historial completo. `compact: false` lista todos los partidos evaluados.
class PlayerMatchDebrief extends ConsumerWidget {
  final String playerId;
  final bool compact;

  const PlayerMatchDebrief({super.key, required this.playerId, this.compact = true});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activityAsync = ref.watch(playerActivityProvider(playerId));

    return activityAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 28),
        child: Center(child: CircularProgressIndicator(color: AppColors.voltNeon)),
      ),
      error: (err, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Text(
          'No se pudo cargar el historial.',
          style: AppTypography.body(size: 13, color: AppColors.textMuted),
        ),
      ),
      data: (matches) {
        if (matches.isEmpty) {
          // En modo compacto la web no muestra nada cuando no hay partidos.
          if (compact) return const SizedBox.shrink();
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 48),
            child: Column(
              children: [
                Icon(Icons.calendar_today, size: 38, color: AppColors.textMuted.withValues(alpha: 0.35)),
                const SizedBox(height: 12),
                Text(
                  'Aún no hay partidos evaluados.',
                  style: AppTypography.body(size: 13, color: AppColors.textMuted),
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
            _SummaryRow(summary: summary),
            const SizedBox(height: 18),
            for (final m in shown) ...[
              _MatchCard(feedback: m),
              const SizedBox(height: 14),
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
                      color: AppColors.voltNeon,
                    ),
                  ),
                  label: const Icon(Icons.chevron_right, size: 16, color: AppColors.voltNeon),
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
    return Row(
      children: [
        _Stat(
          label: 'Rating Prom.',
          value: summary.avgRating > 0 ? summary.avgRating.toStringAsFixed(1) : '─',
          icon: Icons.star_outline,
        ),
        _Stat(label: 'Goles', value: '${summary.totalGoals}', icon: Icons.sports_soccer),
        _Stat(label: 'Partidos', value: '${summary.matchCount}', icon: Icons.calendar_today),
        if (summary.totalOvrChange != 0)
          _Stat(
            label: 'Tend. OVR',
            value: '${trendUp ? '+' : ''}${summary.totalOvrChange.toStringAsFixed(1)}',
            icon: trendUp ? Icons.trending_up : Icons.trending_down,
            valueColor: trendUp ? AppColors.success : AppColors.destructive,
          ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? valueColor;

  const _Stat({required this.label, required this.value, required this.icon, this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 11, color: AppColors.textMuted),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.code(size: 9, color: AppColors.textMuted),
                ),
              ),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: AppTypography.sportNumber(
              size: 22,
              color: valueColor ?? AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _MatchCard extends StatelessWidget {
  final MatchFeedback feedback;

  const _MatchCard({required this.feedback});

  /// Meses a mano, igual que `matches_screen.dart`. La app no inicializa los
  /// datos de locale de `intl`, así que `DateFormat(..., 'es')` tiraría
  /// LocaleDataException en runtime.
  static const _months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];

  String get _dateLabel {
    final raw = feedback.date;
    if (raw == null || raw.isEmpty) return '';
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw;
    return '${parsed.day} de ${_months[parsed.month - 1]}';
  }

  @override
  Widget build(BuildContext context) {
    final deltas = feedback.attributeDeltas;
    final ovr = feedback.ovrUpdate;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      feedback.title,
                      style: AppTypography.headline(size: 15, weight: FontWeight.w700),
                    ),
                    if (_dateLabel.isNotEmpty || feedback.locationName != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        [_dateLabel, feedback.locationName].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
                        style: AppTypography.body(size: 11, color: AppColors.textMuted),
                      ),
                    ],
                  ],
                ),
              ),
              if (ovr != null && ovr.change != 0) _OvrBadge(ovr: ovr),
            ],
          ),
          const SizedBox(height: 14),

          Row(
            children: [
              _MiniStat(label: 'Goles', value: '${feedback.goals}'),
              _MiniStat(label: 'Asist.', value: '${feedback.assists}'),
              _MiniStat(
                label: 'Rating',
                value: feedback.avgRating > 0 ? feedback.avgRating.toStringAsFixed(1) : '─',
              ),
            ],
          ),

          if (deltas.isNotEmpty) ...[
            const SizedBox(height: 14),
            _AttributeDeltas(deltas: deltas),
          ],

          if (feedback.peerEvaluations.isNotEmpty) ...[
            const SizedBox(height: 14),
            Divider(color: AppColors.border.withValues(alpha: 0.4), height: 1),
            const SizedBox(height: 12),
            Text(
              'QUÉ DIJERON TUS COMPAÑEROS',
              style: AppTypography.code(size: 9, color: AppColors.textMuted),
            ),
            const SizedBox(height: 10),
            for (final ev in feedback.peerEvaluations) _PeerEvalTile(evaluation: ev),
          ],
        ],
      ),
    );
  }
}

class _OvrBadge extends StatelessWidget {
  final OvrUpdate ovr;

  const _OvrBadge({required this.ovr});

  @override
  Widget build(BuildContext context) {
    final up = ovr.change > 0;
    final color = up ? AppColors.success : AppColors.destructive;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Icon(up ? Icons.trending_up : Icons.trending_down, size: 13, color: color),
          const SizedBox(width: 5),
          Text(
            '${ovr.previousOvr} → ${ovr.newOvr}',
            style: AppTypography.code(size: 11, color: color),
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;

  const _MiniStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(value, style: AppTypography.sportNumber(size: 17, color: AppColors.voltNeon)),
          const SizedBox(height: 2),
          Text(label.toUpperCase(), style: AppTypography.code(size: 9, color: AppColors.textMuted)),
        ],
      ),
    );
  }
}

/// Tabla de cambios por atributo. Suma los efectos de las etiquetas y los
/// cambios calculados por IA — las dos fuentes, no una sola.
class _AttributeDeltas extends StatelessWidget {
  final Map<String, int> deltas;

  static const _labels = {
    'pac': 'RIT',
    'sho': 'TIR',
    'pas': 'PAS',
    'dri': 'REG',
    'def': 'DEF',
    'phy': 'FIS',
  };

  const _AttributeDeltas({required this.deltas});

  @override
  Widget build(BuildContext context) {
    final entries = deltas.entries.where((e) => e.value != 0).toList()
      ..sort((a, b) => b.value.abs().compareTo(a.value.abs()));
    if (entries.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: entries.map((e) {
        final up = e.value > 0;
        final color = up ? AppColors.success : AppColors.destructive;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Text(
            '${_labels[e.key] ?? e.key.toUpperCase()} ${up ? '+' : ''}${e.value}',
            style: AppTypography.code(size: 10, color: color),
          ),
        );
      }).toList(),
    );
  }
}

/// Una evaluación de un par. El display cambia según el tipo, igual que
/// `PeerEvalList` en la web: puntos muestra la nota, etiquetas muestra los
/// chips con sus efectos, texto muestra el resumen de la IA, y las automáticas
/// se muestran sin avatar ni nombre.
class _PeerEvalTile extends StatelessWidget {
  final PeerEvaluation evaluation;

  const _PeerEvalTile({required this.evaluation});

  @override
  Widget build(BuildContext context) {
    final anon = evaluation.isAnonymous || evaluation.evaluatorId == 'anonymous';
    final isAuto = evaluation.type == EvalType.auto;

    final String name;
    if (isAuto) {
      name = 'Evaluación automática';
    } else if (anon) {
      name = 'Compañero anónimo';
    } else {
      name = evaluation.evaluatorDisplayName ?? 'Compañero';
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isAuto)
            Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.cardSurface,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
              ),
              child: anon
                  ? Icon(Icons.visibility_off_outlined, size: 13, color: AppColors.textMuted)
                  : Text(
                      name.isNotEmpty ? name[0].toUpperCase() : '?',
                      style: AppTypography.code(size: 11, color: AppColors.textSecondary),
                    ),
            )
          else
            Icon(Icons.smart_toy_outlined, size: 20, color: AppColors.textMuted),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.body(
                          size: 12,
                          weight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                    if (evaluation.rating != null)
                      Text(
                        evaluation.rating!.toStringAsFixed(evaluation.rating! % 1 == 0 ? 0 : 1),
                        style: AppTypography.sportNumber(size: 15, color: AppColors.voltNeon),
                      ),
                  ],
                ),
                if (evaluation.performanceTags.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: evaluation.performanceTags.map((t) {
                      final positive = t.impact == 'positive';
                      final color = positive ? AppColors.success : AppColors.destructive;
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(7),
                          border: Border.all(color: color.withValues(alpha: 0.28)),
                        ),
                        child: Text(
                          t.name,
                          style: AppTypography.body(size: 10, weight: FontWeight.w600, color: color),
                        ),
                      );
                    }).toList(),
                  ),
                ],
                if ((evaluation.aiSummary ?? evaluation.textDescription) != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    (evaluation.aiSummary ?? evaluation.textDescription)!,
                    style: AppTypography.body(size: 11, color: AppColors.textMuted, height: 1.45),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
