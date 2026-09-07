import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'patea_card.dart';
import 'patea_avatar.dart';
import 'player_position_badge.dart';
import '../theme/patea_colors.dart';
import '../theme/app_radii.dart';
import '../theme/app_typography.dart';

/// Tarjeta moderna estilo FIFA / Gaming para la selección de jugadores en
/// convocatorias, armado de partidos y reclutamiento.
class PlayerSelectCard extends StatelessWidget {
  final String name;
  final String? photoUrl;
  final String position;
  final int ovr;
  final bool selected;
  final VoidCallback onTap;
  final String? subtitle;
  final Map<String, int>? stats;
  final bool dense;
  final bool disabled;

  const PlayerSelectCard({
    super.key,
    required this.name,
    this.photoUrl,
    required this.position,
    required this.ovr,
    required this.selected,
    required this.onTap,
    this.subtitle,
    this.stats,
    this.dense = false,
    this.disabled = false,
  });

  Color _tierColor(BuildContext context) {
    if (ovr >= 85) return context.c.eliteBorder;
    if (ovr >= 75) return context.c.goldBorder;
    if (ovr >= 60) return context.c.silverBorder;
    return context.c.bronzeBorder;
  }

  @override
  Widget build(BuildContext context) {
    final tierCol = _tierColor(context);
    final posCol = context.c.positionColor(position);

    final isDark = context.c.isDarkSurface;
    final primaryCol = context.c.primary;
    final onPrimaryCol = context.c.onPrimary;

    final cardBg = selected
        ? primaryCol.withValues(alpha: isDark ? 0.12 : 0.08)
        : context.c.card;

    final borderColor = selected
        ? primaryCol
        : context.c.border.withValues(alpha: isDark ? 0.35 : 0.6);

    return Opacity(
      opacity: disabled && !selected ? 0.45 : 1.0,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        margin: EdgeInsets.only(bottom: dense ? 6 : 8),
        child: InkWell(
          onTap: disabled && !selected
              ? null
              : () {
                  HapticFeedback.selectionClick();
                  onTap();
                },
          borderRadius: AppRadii.cardAll,
          child: PateaCard(
            color: cardBg,
            radius: AppRadii.cardAll,
            borderColor: borderColor,
            borderWidth: selected ? 1.5 : 1.0,
            padding: EdgeInsets.symmetric(
              horizontal: dense ? 10 : 12,
              vertical: dense ? 8 : 10,
            ),
            child: Row(
              children: [
                // 1. Badge de OVR
                Container(
                  width: dense ? 36 : 42,
                  height: dense ? 36 : 42,
                  decoration: BoxDecoration(
                    color: tierCol.withValues(alpha: 0.12),
                    borderRadius: AppRadii.surfaceAll,
                    border: Border.all(color: tierCol.withValues(alpha: 0.6), width: 1.2),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    ovr > 0 ? '$ovr' : '—',
                    style: AppTypography.sportNumber(
                      size: dense ? 16 : 19,
                      color: tierCol,
                    ),
                  ),
                ),
                SizedBox(width: dense ? 10 : 12),

                // 2. Avatar con anillo
                Container(
                  padding: const EdgeInsets.all(1.5),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: selected
                          ? primaryCol
                          : posCol.withValues(alpha: 0.5),
                      width: 1.5,
                    ),
                  ),
                  child: PateaAvatar(
                    photoUrl: photoUrl,
                    seed: name,
                    size: dense ? 34 : 40,
                  ),
                ),
                SizedBox(width: dense ? 10 : 12),

                // 3. Info del Jugador
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.headline(
                                size: dense ? 13 : 14,
                                weight: FontWeight.w700,
                                color: selected
                                    ? context.c.textPrimary
                                    : context.c.textPrimary.withValues(alpha: 0.95),
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          PlayerPositionBadge(
                            position: position,
                            fontSize: 9.5,
                            dense: true,
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      if (subtitle != null && subtitle!.isNotEmpty)
                        Text(
                          subtitle!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.body(size: 11, color: context.c.textSecondary),
                        )
                      else if (stats != null && stats!.isNotEmpty)
                        _StatsPreviewRow(stats: stats!, position: position)
                      else
                        Row(
                          children: [
                            Text(
                              _positionLabel(position),
                              style: AppTypography.body(size: 11, color: context.c.textSecondary),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),

                // 4. Indicador de Selección
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: dense ? 24 : 28,
                  height: dense ? 24 : 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: selected ? primaryCol : Colors.transparent,
                    border: Border.all(
                      color: selected
                          ? primaryCol
                          : context.c.textSecondary.withValues(alpha: 0.4),
                      width: selected ? 2 : 1.5,
                    ),
                    boxShadow: selected
                        ? [
                            BoxShadow(
                              color: primaryCol.withValues(alpha: isDark ? 0.35 : 0.25),
                              blurRadius: 8,
                              spreadRadius: 1,
                            ),
                          ]
                        : null,
                  ),
                  child: selected
                      ? Icon(
                          Icons.check,
                          size: dense ? 16 : 18,
                          color: onPrimaryCol,
                        )
                      : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static String _positionLabel(String pos) {
    switch (pos.toUpperCase()) {
      case 'POR':
        return 'Arquero';
      case 'DEF':
        return 'Defensor';
      case 'MED':
        return 'Mediocampista';
      case 'DEL':
        return 'Delantero';
      default:
        return pos;
    }
  }
}

class _StatsPreviewRow extends StatelessWidget {
  final Map<String, int> stats;
  final String position;

  const _StatsPreviewRow({required this.stats, required this.position});

  @override
  Widget build(BuildContext context) {
    final isGk = position.toUpperCase() == 'POR';
    final keys = isGk
        ? ['ref', 'est', 'par']
        : ['pac', 'sho', 'pas'];

    final labels = isGk
        ? {'ref': 'REF', 'est': 'EST', 'par': 'PAR'}
        : {'pac': 'RIT', 'sho': 'TIR', 'pas': 'PAS'};

    return Row(
      children: keys.map((k) {
        final val = stats[k] ?? 50;
        final lbl = labels[k] ?? k.toUpperCase();
        return Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '$lbl ',
                  style: AppTypography.code(size: 9.5, color: context.c.textSecondary, weight: FontWeight.w600),
                ),
                TextSpan(
                  text: '$val',
                  style: AppTypography.code(size: 10, color: context.c.textPrimary, weight: FontWeight.w800),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}
