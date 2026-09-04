import 'package:flutter/material.dart';

import '../../../core/models/match_model.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../live_match_screen.dart' show kTeamAId;
import 'match_timeline.dart' show OpposedBar;

/// Estadísticas del partido, derivadas de los eventos. Port parcial de
/// `live-stats.tsx`.
///
/// Parcial a propósito: la web además muestra posesión, tiros y precisión de
/// pases leyendo `match.statistics`, un campo que **no lo escribe nadie** —
/// ni las server actions ni las Cloud Functions. En la práctica cae siempre al
/// valor por defecto y muestra 50/50 de posesión en todos los partidos. No se
/// portó eso: son números inventados. Si algún día se cargan de verdad, acá
/// hay lugar.
class LiveStatsPanel extends StatelessWidget {
  final MatchModel match;

  const LiveStatsPanel({super.key, required this.match});

  bool _isTeamA(MatchEvent e) {
    if (e.teamId != null) return e.teamId == kTeamAId;
    final a = match.teamA;
    if (a == null) return true;
    if (a.playerIds.contains(e.playerId)) return true;
    return a.players.any((p) => p.uid == e.playerId);
  }

  ({int a, int b}) _count(bool Function(MatchEvent) test) {
    var a = 0;
    var b = 0;
    for (final e in match.events) {
      if (!test(e)) continue;
      if (_isTeamA(e)) {
        a++;
      } else {
        b++;
      }
    }
    return (a: a, b: b);
  }

  @override
  Widget build(BuildContext context) {
    if (match.events.isEmpty) return const SizedBox.shrink();

    final goals = _count((e) => e.type == 'goal');
    final yellow = _count((e) => e.type == 'card' && e.cardType != 'red');
    final red = _count((e) => e.type == 'card' && e.cardType == 'red');
    final fouls = _count((e) => e.type == 'foul');
    final corners = _count((e) => e.type == 'corner');
    final subs = _count((e) => e.type == 'substitution');

    final rows = <Widget>[
      OpposedBar(label: 'Goles', a: goals.a, b: goals.b),
      if (yellow.a + yellow.b > 0)
        OpposedBar(label: 'Amarillas', a: yellow.a, b: yellow.b, color: AppColors.warning),
      if (red.a + red.b > 0)
        OpposedBar(label: 'Rojas', a: red.a, b: red.b, color: AppColors.destructive),
      if (fouls.a + fouls.b > 0) OpposedBar(label: 'Faltas', a: fouls.a, b: fouls.b),
      if (corners.a + corners.b > 0) OpposedBar(label: 'Córners', a: corners.a, b: corners.b),
      if (subs.a + subs.b > 0) OpposedBar(label: 'Cambios', a: subs.a, b: subs.b),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('ESTADÍSTICAS',
            style: AppTypography.headline(
                size: 11, weight: FontWeight.w800,
                color: AppColors.textMuted, letterSpacing: 1.2)),
        const SizedBox(height: 14),
        ...rows,
      ],
    );
  }
}
