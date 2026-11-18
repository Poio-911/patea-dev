import 'dart:math' as math;
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/widgets/player_avatar_fallback.dart';
import 'package:go_router/go_router.dart';
import '../../../core/widgets/jersey_painter.dart';
import 'package:flutter/material.dart';
import '../../../core/widgets/patea_avatar.dart';

import '../../../core/models/match_model.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/patea_colors.dart';
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
  final ValueChanged<MatchPlayerEntry>? onGoal;
  final double? viewportHeight;

  const LivePitchView({
    super.key,
    required this.match,
    this.onGoal,
    this.viewportHeight,
  });

  /// Goles por jugador, sacados de los eventos del partido.
  Map<String, int> get _goals {
    final goals = <String, int>{};
    for (final e in match.events) {
      if (e.type != 'goal' || e.goalType == 'own_goal') continue;
      if (e.playerId.isEmpty) continue;
      goals[e.playerId] = (goals[e.playerId] ?? 0) + 1;
    }
    return goals;
  }

  @override
  Widget build(BuildContext context) {
    List<MatchPlayerEntry> roster(MatchTeam team) => team.players.isNotEmpty
        ? team.players
        : match.players.where((p) => team.playerIds.contains(p.uid)).toList();
    final a = match.teamA;
    final b = match.teamB;
    if (a == null || b == null) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Text(
          'Los jugadores aparecen cuando estén armados los equipos.',
          style: AppTypography.body(color: context.c.textSecondary),
        ),
      );
    }
    final goals = _goals;
    final aPlayers = roster(a), bPlayers = roster(b);
    int rowsFor(List<MatchPlayerEntry> players) {
      final groups = <String, int>{};
      for (final p in players) {
        final key = ['POR', 'DEF', 'DEL'].contains(p.position.toUpperCase())
            ? p.position.toUpperCase()
            : 'MED';
        groups[key] = (groups[key] ?? 0) + 1;
      }
      return groups.values.fold(0, (sum, count) => sum + (count + 2) ~/ 3);
    }

    final rowCount = math.max(
      1,
      math.max(rowsFor(aPlayers), rowsFor(bPlayers)),
    );
    final textHeight = MediaQuery.textScalerOf(context).scale(12);
    final minimumHeight = rowCount * 2 * (36 + textHeight * 1.1 + 4) + 44;
    final height = math.max(
      viewportHeight ?? MediaQuery.sizeOf(context).width * 1.65,
      minimumHeight,
    );
    final portrait = ((height / 2 - 28) / rowCount - textHeight * 1.2 - 5)
        .clamp(30.0, 64.0);
    return SizedBox(
      height: height,
      child: ClipRRect(
        borderRadius: AppRadii.cardAll,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                context.c.livePitchSurface,
                Color.alphaBlend(
                  context.c.photoFallback.withValues(alpha: .4),
                  context.c.livePitchSurface,
                ),
              ],
            ),
          ),
          child: CustomPaint(
            painter: _PitchPainter(
              linea: context.c.onPhotoLine,
              punto: context.c.onPhotoLine,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Column(
                children: [
                  Expanded(
                    child: _Half(
                      team: b,
                      players: bPlayers,
                      goals: goals,
                      attackingDown: true,
                      portraitHeight: portrait,
                      onGoal: onGoal,
                    ),
                  ),
                  Expanded(
                    child: _Half(
                      team: a,
                      players: aPlayers,
                      goals: goals,
                      attackingDown: false,
                      portraitHeight: portrait,
                      onGoal: onGoal,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Una mitad de cancha con su equipo en formación.
class _Half extends StatelessWidget {
  final MatchTeam team;
  final double portraitHeight;
  final List<MatchPlayerEntry> players;
  final ValueChanged<MatchPlayerEntry>? onGoal;
  final Map<String, int> goals;

  /// True para el equipo de arriba, que ataca hacia abajo.
  final bool attackingDown;

  const _Half({
    required this.team,
    required this.portraitHeight,
    required this.players,
    required this.goals,
    required this.attackingDown,
    this.onGoal,
  });

  /// Reparte el plantel en líneas: arquero, defensa, medio, ataque.
  ///
  /// El orden va del propio arco hacia adelante, y después se invierte para
  /// el equipo de arriba.
  List<List<MatchPlayerEntry>> get _lines {
    final por = <MatchPlayerEntry>[];
    final def = <MatchPlayerEntry>[];
    final med = <MatchPlayerEntry>[];
    final del = <MatchPlayerEntry>[];

    for (final p in players) {
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

    final rows = <List<MatchPlayerEntry>>[];
    for (final line in lines) {
      for (var i = 0; i < line.length; i += 3) {
        rows.add(line.sublist(i, (i + 3).clamp(0, line.length)));
      }
    }
    final color = _teamColor(
      attackingDown ? context.c.accent : context.c.brandVolt,
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 5, 12, 5),
      child: Column(
        children: [
          Row(
            children: [
              if (team.jersey != null)
                JerseyWidget(jersey: team.jersey!, size: 15)
              else
                Icon(Icons.shield_outlined, color: color, size: 14),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  team.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body(
                    size: 12,
                    weight: FontWeight.w700,
                    color: context.c.onPhotoMuted,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          for (final line in rows)
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) => Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    for (final p in line)
                      Flexible(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 3),
                          child: _PlayerDot(
                            player: p,
                            goals: goals[p.uid] ?? 0,
                            color: color,
                            onGoal: onGoal,
                            portraitHeight: portraitHeight,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// El color de la camiseta del equipo. [fallback] lo pasa quien llama
  /// porque depende del tema, y un getter no ve el `BuildContext`.
  Color _teamColor(Color fallback) {
    final raw = team.jersey?.primaryColor ?? team.color;
    if (raw == null || raw.isEmpty) return fallback;
    final hex = raw.replaceFirst('#', '');
    final value = int.tryParse(hex.length == 6 ? 'FF$hex' : hex, radix: 16);
    return value == null ? fallback : Color(value);
  }
}

class _PlayerDot extends StatelessWidget {
  final MatchPlayerEntry player;
  final int goals;
  final Color color;
  final double portraitHeight;
  final ValueChanged<MatchPlayerEntry>? onGoal;
  const _PlayerDot({
    required this.player,
    required this.goals,
    required this.color,
    required this.portraitHeight,
    this.onGoal,
  });

  void _open(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.c.popover,
      builder: (sheetContext) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  PateaAvatar(
                    photoUrl: player.photoURL,
                    seed: player.uid,
                    size: 72,
                    borderColor: color,
                    borderWidth: 3,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          player.displayName,
                          style: AppTypography.headline(
                            size: 23,
                            weight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '${player.position} · OVR ${player.ovr}',
                          style: AppTypography.body(
                            size: 14,
                            color: context.c.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Text(
                '$goals ${goals == 1 ? 'gol registrado' : 'goles registrados'}',
                style: AppTypography.body(size: 14),
              ),
              if (onGoal != null) ...[
                const SizedBox(height: 18),
                FilledButton.icon(
                  onPressed: () {
                    Navigator.pop(sheetContext);
                    onGoal!(player);
                  },
                  icon: const Icon(Icons.sports_soccer_rounded),
                  label: const Text('Registrar gol'),
                ),
              ],
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () {
                  Navigator.pop(sheetContext);
                  context.push('/players/${player.uid}');
                },
                child: const Text('Ver perfil completo'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String get _name {
    final parts = player.displayName.trim().split(RegExp(r'\s+'));
    if (parts.length <= 1 || player.displayName.length <= 14) {
      return player.displayName;
    }
    return '${parts.first} ${parts.last[0]}.';
  }

  @override
  Widget build(BuildContext context) {
    final portraitWidth = portraitHeight * .92;
    final shadow = Shadow(
      color: context.c.photoFallback,
      blurRadius: 4,
      offset: const Offset(0, 1),
    );
    final fallback = PlayerAvatarFallback(seed: player.uid);
    return Semantics(
      key: ValueKey('pitch-player-${player.uid}'),
      button: true,
      excludeSemantics: true,
      onTap: () => _open(context),
      label:
          '${player.displayName}, ${player.position}, OVR ${player.ovr}, $goals goles',
      child: InkWell(
        onTap: () => _open(context),
        borderRadius: AppRadii.chipAll,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 120),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: portraitWidth + 28,
                    height: portraitHeight,
                    child: Center(
                      child: CustomPaint(
                        foregroundPainter: _PortraitBorder(color: color),
                        child: ClipPath(
                          clipper: _PortraitClip(),
                          child: SizedBox(
                            width: portraitWidth,
                            height: portraitHeight,
                            child: (player.photoURL?.isNotEmpty ?? false)
                                ? CachedNetworkImage(
                                    imageUrl: player.photoURL!,
                                    fit: BoxFit.cover,
                                    memCacheWidth: 256,
                                    placeholder: (_, _) => fallback,
                                    errorWidget: (_, _, _) => fallback,
                                  )
                                : fallback,
                          ),
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: -4,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: context.c.photoFallback.withValues(alpha: 0.90),
                        borderRadius: AppRadii.chipAll,
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 1,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              player.position,
                              style: AppTypography.body(
                                size: 12,
                                weight: FontWeight.w700,
                                color: context.c.onPhotoMuted,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${player.ovr}',
                              style: AppTypography.sportNumber(
                                size: 13,
                                color: context.c.brandVolt,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  if (goals > 0)
                    Positioned(
                      right: 2,
                      top: -2,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: context.c.brandVolt,
                          borderRadius: AppRadii.chipAll,
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 4,
                            vertical: 1,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.sports_soccer_rounded,
                                size: 12,
                                color: context.c.photoFallback,
                              ),
                              const SizedBox(width: 2),
                              Text(
                                '$goals',
                                style: AppTypography.body(
                                  size: 12,
                                  weight: FontWeight.w700,
                                  color: context.c.photoFallback,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 3),
              Text(
                _name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: AppTypography.body(
                  size: 12,
                  height: 1.1,
                  weight: FontWeight.w700,
                  color: context.c.onPhoto,
                ).copyWith(shadows: [shadow]),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Path _portraitPath(Size size) => Path()
  ..moveTo(0, 8)
  ..quadraticBezierTo(0, 0, 8, 0)
  ..lineTo(size.width - 8, 0)
  ..quadraticBezierTo(size.width, 0, size.width, 8)
  ..lineTo(size.width, size.height * .78)
  ..lineTo(size.width * .5, size.height)
  ..lineTo(0, size.height * .78)
  ..close();

class _PortraitClip extends CustomClipper<Path> {
  @override
  Path getClip(Size size) => _portraitPath(size);
  @override
  bool shouldReclip(_PortraitClip oldClipper) => false;
}

class _PortraitBorder extends CustomPainter {
  final Color color;
  const _PortraitBorder({required this.color});
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawPath(
      _portraitPath(size),
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5,
    );
  }

  @override
  bool shouldRepaint(_PortraitBorder oldDelegate) => oldDelegate.color != color;
}

/// Cancha táctica con bandas suaves, áreas y redes dibujadas en Flutter.
class _PitchPainter extends CustomPainter {
  /// Un `CustomPainter` no ve el `BuildContext`: los colores se le pasan al
  /// construirlo. Es el patrón que van a necesitar los cuatro painters de la
  /// app cuando exista el tema claro.
  final Color linea;
  final Color punto;

  const _PitchPainter({required this.linea, required this.punto});

  @override
  void paint(Canvas canvas, Size size) {
    final stripe = Paint()..color = linea.withValues(alpha: .035);
    for (var i = 0; i < 12; i += 2) {
      canvas.drawRect(
        Rect.fromLTWH(0, size.height * i / 12, size.width, size.height / 12),
        stripe,
      );
    }
    final line = Paint()
      ..color = linea
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;

    final w = size.width;
    final h = size.height;
    final inset = w * 0.04;

    canvas.drawRect(Rect.fromLTRB(inset, inset, w - inset, h - inset), line);

    // Mitad de cancha y círculo central.
    canvas.drawLine(Offset(inset, h / 2), Offset(w - inset, h / 2), line);
    canvas.drawCircle(Offset(w / 2, h / 2), w * 0.15, line);
    canvas.drawCircle(Offset(w / 2, h / 2), 2.5, Paint()..color = punto);

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
      final goal = Rect.fromLTWH(
        w * .38,
        top ? inset * .4 : h - inset,
        w * .24,
        inset * .6,
      );
      canvas.drawRect(goal, line);
      for (var i = 1; i < 5; i++) {
        final x = goal.left + goal.width * i / 5;
        canvas.drawLine(Offset(x, goal.top), Offset(x, goal.bottom), line);
      }
      canvas.drawCircle(
        Offset(w / 2, top ? h * .19 : h * .81),
        2,
        Paint()..color = punto,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _PitchPainter oldDelegate) =>
      oldDelegate.linea != linea || oldDelegate.punto != punto;
}
