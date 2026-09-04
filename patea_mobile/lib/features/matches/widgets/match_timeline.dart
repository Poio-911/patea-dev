import 'package:flutter/material.dart';

import '../../../core/models/match_model.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../live_match_screen.dart' show kTeamAId;

/// Minuto a minuto del partido. Port de `match-timeline.tsx`.
///
/// La lista anterior era una fila por evento, todas iguales y sin decir de qué
/// lado había pasado. Acá hay un riel al medio con el minuto, y cada evento
/// cae del lado de su equipo — que es como se lee un partido de un vistazo.
class MatchTimelineView extends StatelessWidget {
  final MatchModel match;

  const MatchTimelineView({super.key, required this.match});

  @override
  Widget build(BuildContext context) {
    final events = [...match.events]..sort((a, b) => a.minute.compareTo(b.minute));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('MINUTO A MINUTO',
            style: AppTypography.headline(
                size: 11, weight: FontWeight.w800,
                color: AppColors.textMuted, letterSpacing: 1.2)),
        const SizedBox(height: 14),
        if (events.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: Text('Todavía no pasó nada.',
                  style: AppTypography.body(size: 13, color: AppColors.textMuted)),
            ),
          )
        else
          for (final e in events) _TimelineRow(event: e, match: match),
      ],
    );
  }
}

class _TimelineRow extends StatelessWidget {
  final MatchEvent event;
  final MatchModel match;

  const _TimelineRow({required this.event, required this.match});

  /// De qué lado va. Los eventos viejos no guardaban `teamId`, así que se cae
  /// en el plantel: si el jugador está en el equipo A, va a la izquierda.
  bool get _isTeamA {
    if (event.teamId != null) return event.teamId == kTeamAId;
    final a = match.teamA;
    if (a == null) return true;
    if (a.playerIds.contains(event.playerId)) return true;
    return a.players.any((p) => p.uid == event.playerId);
  }

  ({IconData icon, Color color}) get _mark {
    switch (event.type) {
      case 'goal':
        return (icon: Icons.sports_soccer_rounded, color: AppColors.voltNeon);
      case 'card':
        return (
          icon: Icons.style_rounded,
          color: event.cardType == 'red' ? AppColors.destructive : AppColors.warning
        );
      case 'substitution':
        return (icon: Icons.swap_horiz_rounded, color: AppColors.textSecondary);
      case 'corner':
        return (icon: Icons.flag_rounded, color: AppColors.textSecondary);
      case 'foul':
        return (icon: Icons.report_gmailerrorred_rounded, color: AppColors.textSecondary);
      default:
        return (icon: Icons.circle, color: AppColors.textMuted);
    }
  }

  String get _headline {
    if (event.type == 'substitution') {
      return event.playerInName ?? event.playerName;
    }
    return event.playerName;
  }

  String? get _detail {
    switch (event.type) {
      case 'goal':
        final parts = <String>[];
        if (event.goalType == 'penalty') parts.add('de penal');
        if (event.goalType == 'free_kick') parts.add('de tiro libre');
        if (event.goalType == 'header') parts.add('de cabeza');
        if (event.goalType == 'volley') parts.add('de volea');
        if (event.goalType == 'own_goal') parts.add('en contra');
        if (event.assistName != null) parts.add('asistió ${event.assistName}');
        return parts.isEmpty ? null : parts.join(' · ');
      case 'card':
        return event.cardType == 'red' ? 'Roja' : 'Amarilla';
      case 'substitution':
        return event.playerOutName != null ? 'sale ${event.playerOutName}' : null;
      case 'foul':
        return 'Falta de ${event.playerName}';
      case 'corner':
        return 'Córner';
      default:
        return event.description ?? event.detail;
    }
  }

  @override
  Widget build(BuildContext context) {
    final mark = _mark;
    final left = _isTeamA;

    final content = Column(
      crossAxisAlignment: left ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        Text(
          _headline,
          textAlign: left ? TextAlign.right : TextAlign.left,
          style: AppTypography.headline(size: 13, weight: FontWeight.w700),
        ),
        if (_detail != null) ...[
          const SizedBox(height: 2),
          Text(
            _detail!,
            textAlign: left ? TextAlign.right : TextAlign.left,
            style: AppTypography.body(size: 11, color: AppColors.textMuted),
          ),
        ],
      ],
    );

    final badge = Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        color: mark.color.withValues(alpha: 0.12),
        shape: BoxShape.circle,
        border: Border.all(color: mark.color.withValues(alpha: 0.45)),
      ),
      child: Icon(mark.icon, size: 16, color: mark.color),
    );

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: 12, bottom: 18),
              child: left
                  ? Align(alignment: Alignment.centerRight, child: content)
                  : const SizedBox.shrink(),
            ),
          ),
          // El riel: la línea vertical con el minuto y el ícono del evento.
          SizedBox(
            width: 56,
            child: Column(
              children: [
                Text("${event.minute}'",
                    style: AppTypography.code(
                        size: 11, weight: FontWeight.w800, color: AppColors.textSecondary)),
                const SizedBox(height: 4),
                badge,
                Expanded(
                  child: Container(width: 1, color: Colors.white.withValues(alpha: 0.10)),
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(left: 12, bottom: 18),
              child: left
                  ? const SizedBox.shrink()
                  : Align(alignment: Alignment.centerLeft, child: content),
            ),
          ),
        ],
      ),
    );
  }
}

/// Barras enfrentadas para comparar una estadística entre los dos equipos.
class OpposedBar extends StatelessWidget {
  final String label;
  final int a;
  final int b;
  final Color color;

  const OpposedBar({
    super.key,
    required this.label,
    required this.a,
    required this.b,
    this.color = AppColors.voltNeon,
  });

  @override
  Widget build(BuildContext context) {
    final total = a + b;
    // Sin datos, las dos mitades quedan parejas y apagadas.
    final fracA = total == 0 ? 0.5 : a / total;

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        children: [
          Row(
            children: [
              SizedBox(
                width: 28,
                child: Text('$a',
                    style: AppTypography.code(size: 13, weight: FontWeight.w800)),
              ),
              Expanded(
                child: Text(label,
                    textAlign: TextAlign.center,
                    style: AppTypography.body(size: 11, color: AppColors.textSecondary)),
              ),
              SizedBox(
                width: 28,
                child: Text('$b',
                    textAlign: TextAlign.right,
                    style: AppTypography.code(size: 13, weight: FontWeight.w800)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: SizedBox(
              height: 5,
              child: Row(
                children: [
                  Expanded(
                    flex: (fracA * 1000).round().clamp(1, 999),
                    child: Container(
                      color: total == 0
                          ? Colors.white.withValues(alpha: 0.08)
                          : color.withValues(alpha: 0.85),
                    ),
                  ),
                  const SizedBox(width: 2),
                  Expanded(
                    flex: ((1 - fracA) * 1000).round().clamp(1, 999),
                    child: Container(color: Colors.white.withValues(alpha: 0.18)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
