import 'package:flutter/material.dart';

import '../../../core/models/match_model.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';

/// Los dos equipos parados en la cancha.
///
/// Hecho de cero para el teléfono, no portado del `MatchVisualizer` de la web.
///
/// **No hay posiciones reales**: la app no trackea a nadie. Lo único que se
/// sabe de cada jugador es su puesto (POR/DEF/MED/DEL), así que esto dibuja
/// la *formación*, no dónde está parado cada uno. Se lee de un vistazo quién
/// juega dónde y quién hizo los goles, que es lo que uno quiere saber cuando
/// sigue un partido desde afuera.
///
/// La cancha es vertical porque el teléfono lo es: el equipo local ataca
/// hacia arriba y el visitante hacia abajo, como se ve una cancha desde la
/// tribuna de fondo.
class LivePitchView extends StatelessWidget {
  final MatchModel match;

  const LivePitchView({super.key, required this.match});

  /// Goles por jugador, sacados de los eventos del partido.
  Map<String, int> get _goals {
    final goals = <String, int>{};
    for (final e in match.events) {
      if (e.type != 'goal') continue;
      if (e.playerId.isEmpty) continue;
      goals[e.playerId] = (goals[e.playerId] ?? 0) + 1;
    }
    return goals;
  }

  @override
  Widget build(BuildContext context) {
    final teamA = match.teamA;
    final teamB = match.teamB;
    // Sin equipos armados no hay formación que dibujar: una cancha con todos
    // amontonados miente más de lo que muestra.
    if (teamA == null || teamB == null) return const SizedBox.shrink();
    if (teamA.players.isEmpty && teamB.players.isEmpty) return const SizedBox.shrink();

    final goals = _goals;

    return AspectRatio(
      aspectRatio: 0.72,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: const Color(0xFF14301F),
        ),
        clipBehavior: Clip.antiAlias,
        child: CustomPaint(
          painter: _PitchPainter(),
          child: Column(
            children: [
              // Visitante arriba, atacando hacia abajo: sus delanteros quedan
              // contra el mediocampo, no contra su propio arco.
              Expanded(child: _Half(team: teamB, goals: goals, attackingDown: true)),
              Expanded(child: _Half(team: teamA, goals: goals, attackingDown: false)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Una mitad de cancha con su equipo en formación.
class _Half extends StatelessWidget {
  final MatchTeam team;
  final Map<String, int> goals;

  /// True para el equipo de arriba, que ataca hacia abajo.
  final bool attackingDown;

  const _Half({required this.team, required this.goals, required this.attackingDown});

  /// Reparte el plantel en líneas: arquero, defensa, medio, ataque.
  ///
  /// El orden va del propio arco hacia adelante, y después se invierte para
  /// el equipo de arriba.
  List<List<MatchPlayerEntry>> get _lines {
    final por = <MatchPlayerEntry>[];
    final def = <MatchPlayerEntry>[];
    final med = <MatchPlayerEntry>[];
    final del = <MatchPlayerEntry>[];

    for (final p in team.players) {
      switch (p.position.toUpperCase()) {
        case 'POR':
          por.add(p);
        case 'DEF':
          def.add(p);
        case 'DEL':
          del.add(p);
        default:
          // Cualquier cosa que no reconozcamos va al medio, que es donde
          // menos desentona.
          med.add(p);
      }
    }

    final lines = [por, def, med, del].where((l) => l.isNotEmpty).toList();
    return attackingDown ? lines : lines.reversed.toList();
  }

  @override
  Widget build(BuildContext context) {
    final lines = _lines;
    if (lines.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          for (final line in lines)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                for (final p in line)
                  Flexible(
                    child: _PlayerDot(
                      player: p,
                      goals: goals[p.uid] ?? 0,
                      color: _teamColor,
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }

  Color get _teamColor {
    final raw = team.jersey?.primaryColor ?? team.color;
    if (raw == null || raw.isEmpty) return AppColors.voltNeon;
    final hex = raw.replaceFirst('#', '');
    final value = int.tryParse(hex.length == 6 ? 'FF$hex' : hex, radix: 16);
    return value == null ? AppColors.voltNeon : Color(value);
  }
}

class _PlayerDot extends StatelessWidget {
  final MatchPlayerEntry player;
  final int goals;
  final Color color;

  const _PlayerDot({required this.player, required this.goals, required this.color});

  /// El nombre de pila: en una cancha entran pocas letras.
  ///
  /// Se usa la PRIMERA palabra, no la última. Acá la gente se carga como
  /// "José P." o "Alvaro M.", con el apellido abreviado, así que quedarse con
  /// la última deja al jugador llamándose "P." — o "5", en "Tester Real 5".
  String get _shortName {
    final parts = player.displayName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '';
    return parts.first;
  }

  Widget get _initial => Text(
        _shortName.isEmpty ? '?' : _shortName.substring(0, 1).toUpperCase(),
        style: AppTypography.headline(size: 13, weight: FontWeight.w800),
      );

  @override
  Widget build(BuildContext context) {
    final photo = player.photoURL ?? '';

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: color, width: 2),
              ),
              // Con `CircleAvatar(backgroundImage:)` una foto que no carga
              // deja el círculo vacío y sin letra. Acá la inicial es el piso
              // y la foto se dibuja encima sólo si carga de verdad.
              child: ClipOval(
                child: Container(
                  width: 34,
                  height: 34,
                  color: const Color(0xFF0C1017),
                  alignment: Alignment.center,
                  child: photo.isEmpty
                      ? _initial
                      : Image.network(
                          photo,
                          width: 34,
                          height: 34,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stack) => _initial,
                        ),
                ),
              ),
            ),
            if (goals > 0)
              Positioned(
                right: -4,
                top: -4,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: AppColors.voltNeon,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    goals == 1 ? '⚽' : '⚽$goals',
                    style: const TextStyle(fontSize: 9, height: 1.3),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 3),
        Text(
          _shortName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: AppTypography.headline(
              size: 9.5, weight: FontWeight.w700, color: Colors.white.withValues(alpha: 0.92)),
        ),
      ],
    );
  }
}

/// Las líneas de la cancha. Sin césped rayado ni sombras: es el fondo de una
/// lista de jugadores, no una foto.
class _PitchPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final line = Paint()
      ..color = Colors.white.withValues(alpha: 0.13)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;

    final w = size.width;
    final h = size.height;
    final inset = w * 0.04;

    canvas.drawRect(
      Rect.fromLTRB(inset, inset, w - inset, h - inset),
      line,
    );

    // Mitad de cancha y círculo central.
    canvas.drawLine(Offset(inset, h / 2), Offset(w - inset, h / 2), line);
    canvas.drawCircle(Offset(w / 2, h / 2), w * 0.15, line);
    canvas.drawCircle(
      Offset(w / 2, h / 2),
      2.5,
      Paint()..color = Colors.white.withValues(alpha: 0.18),
    );

    // Áreas grandes, arriba y abajo.
    final areaWidth = w * 0.52;
    final areaHeight = h * 0.13;
    for (final top in [true, false]) {
      final rect = Rect.fromLTWH(
        (w - areaWidth) / 2,
        top ? inset : h - inset - areaHeight,
        areaWidth,
        areaHeight,
      );
      canvas.drawRect(rect, line);
    }
  }

  @override
  bool shouldRepaint(covariant _PitchPainter oldDelegate) => false;
}
