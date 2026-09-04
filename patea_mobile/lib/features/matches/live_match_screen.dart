import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/match_model.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/match_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/jersey_painter.dart';
import 'widgets/event_logger_sheet.dart';
import '../../core/services/match_presence_service.dart';
import 'widgets/live_clock.dart';
import 'widgets/live_pitch_view.dart';
import 'widgets/match_clips_view.dart';
import 'widgets/match_timeline.dart';
import 'widgets/live_stats_panel.dart';

/// Ids de equipo que la web les pone a los eventos de un partido suelto
/// (`team.id || \`team${idx + 1}\`` en event-logger.tsx). Sin esto los eventos
/// del móvil no se pueden atribuir a un lado en la web.
const String kTeamAId = 'team1';
const String kTeamBId = 'team2';

/// Minuto a minuto del partido.
///
/// Reemplaza a la pantalla anterior, que sólo sabía registrar goles y llevaba
/// el reloj a botonazos de "+5 min". Ahora es el port del
/// `LiveMatchDashboard` de la web: cronómetro real por período, registro de
/// goles con asistencia, tarjetas, cambios, faltas y córners, línea de tiempo
/// y estadísticas derivadas de los eventos.
class LiveMatchScreen extends ConsumerStatefulWidget {
  final String matchId;

  const LiveMatchScreen({super.key, required this.matchId});

  @override
  ConsumerState<LiveMatchScreen> createState() => _LiveMatchScreenState();
}

class _LiveMatchScreenState extends ConsumerState<LiveMatchScreen> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    // El reloj no vive en Firestore: se deriva de `periodStartTs`. Este timer
    // sólo fuerza el repintado cada segundo; si el partido está pausado o
    // terminado, `LiveClock` devuelve siempre lo mismo y no se nota.
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  MatchService get _service => ref.read(matchServiceProvider);

  Future<void> _guard(Future<void> Function() action) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(
          content: Text('$e'),
          backgroundColor: AppColors.destructive,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _openEventLogger(MatchModel match, String type) async {
    final clock = LiveClock.of(match);
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => EventLoggerSheet(
        match: match,
        eventType: type,
        currentMinute: clock.minute,
      ),
    );
  }

  Future<void> _confirmFinish(MatchModel match) async {
    final a = match.teamA?.score ?? 0;
    final b = match.teamB?.score ?? 0;

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.popover,
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
        title: Text('¿Finalizar el partido?',
            style: AppTypography.headline(size: 17, weight: FontWeight.w800)),
        content: Text(
          'Queda $a a $b. Después de esto se abren las evaluaciones y ya no se '
          'pueden cargar más eventos.',
          style: AppTypography.body(size: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancelar',
                style: AppTypography.body(size: 13, color: AppColors.textSecondary)),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.destructive,
              foregroundColor: Colors.white,
            ),
            child: const Text('Finalizar'),
          ),
        ],
      ),
    );

    if (ok == true) {
      await _guard(() => _service.finishMatch(match.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final matchAsync = ref.watch(singleMatchStreamProvider(widget.matchId));
    final uid = ref.watch(authStateProvider).value?.uid;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text('MINUTO A MINUTO',
            style: AppTypography.headline(size: 15, weight: FontWeight.w800, letterSpacing: 0.5)),
      ),
      body: matchAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.voltNeon)),
        error: (e, _) => Center(
          child: Text('No se pudo cargar el partido.\n$e',
              textAlign: TextAlign.center,
              style: AppTypography.body(color: AppColors.textMuted)),
        ),
        data: (match) {
          if (match == null) {
            return Center(
              child: Text('Partido no encontrado',
                  style: AppTypography.body(color: AppColors.textMuted)),
            );
          }

          final isOrganizer = uid != null && uid == match.ownerUid;
          // Un partido terminado no se dirige: sin esto, un partido
          // finalizado que nunca pasó por el panel en vivo (liveStatus vacío)
          // mostraba "Iniciar partido" debajo del cartel de FINALIZADO.
          final isOver = match.status == 'completed' || match.status == 'evaluated';
          final canDirect = isOrganizer && !isOver;
          final clock = LiveClock.of(match);

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
            children: [
              _Scoreboard(match: match, clock: clock),
              const SizedBox(height: 14),
              _WatchingLine(matchId: match.id),
              const SizedBox(height: 14),
              LivePitchView(match: match),
              const SizedBox(height: 18),

              if (canDirect) ...[
                _PeriodControls(
                  match: match,
                  clock: clock,
                  onStart: () => _guard(() => _service.startMatch(match.id)),
                  onSetState: (status, base, paused) => _guard(
                    () => _service.updateLiveState(
                      matchId: match.id,
                      liveStatus: status,
                      baseMinute: base,
                      paused: paused,
                    ),
                  ),
                  onFinish: () => _confirmFinish(match),
                ),
                if (clock.isRunning) ...[
                  const SizedBox(height: 18),
                  _QuickEvents(onPick: (type) => _openEventLogger(match, type)),
                ],
                const SizedBox(height: 18),
              ],

              if (match.status == 'completed' || match.status == 'evaluated') ...[
                FilledButton.icon(
                  onPressed: () => context.push('/evaluations/${match.id}'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.voltNeon,
                    foregroundColor: AppColors.background,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                  ),
                  icon: const Icon(Icons.star_rate_rounded, size: 20),
                  label: Text('Evaluar a tus compañeros',
                      style: AppTypography.headline(
                          size: 14, weight: FontWeight.w800, color: AppColors.background)),
                ),
                const SizedBox(height: 18),
              ],

              MatchClipsView(
                match: match,
                // La regla de Firestore sólo deja subir a los que están en el
                // partido; mostrar el botón a quien no puede sería mentirle.
                canUpload: uid != null &&
                    (isOrganizer || match.playerUids.contains(uid)),
              ),
              const SizedBox(height: 22),
              LiveStatsPanel(match: match),
              const SizedBox(height: 22),
              MatchTimelineView(match: match),
            ],
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------- marcador --

class _Scoreboard extends StatelessWidget {
  final MatchModel match;
  final LiveClock clock;

  const _Scoreboard({required this.match, required this.clock});

  @override
  Widget build(BuildContext context) {
    final live = match.status == 'active';

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadii.surfaceAll,
        border: Border.all(
          color: live
              ? AppColors.destructive.withValues(alpha: 0.55)
              : Colors.white.withValues(alpha: 0.08),
          width: live ? 1.5 : 1,
        ),
      ),
      child: Column(
        children: [
          _StatusLine(match: match, clock: clock),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(child: _TeamColumn(team: match.teamA, fallback: 'Equipo A')),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Text(
                  '${match.teamA?.score ?? 0} : ${match.teamB?.score ?? 0}',
                  style: AppTypography.sportNumber(size: 40, color: AppColors.textPrimary),
                ),
              ),
              Expanded(child: _TeamColumn(team: match.teamB, fallback: 'Equipo B')),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatusLine extends StatelessWidget {
  final MatchModel match;
  final LiveClock clock;

  const _StatusLine({required this.match, required this.clock});

  @override
  Widget build(BuildContext context) {
    final live = match.status == 'active';
    final color = live ? AppColors.destructive : AppColors.textMuted;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (live) ...[
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 7),
        ],
        Text(
          clock.periodLabel(match).toUpperCase(),
          style: AppTypography.headline(
              size: 11, weight: FontWeight.w800, color: color, letterSpacing: 1),
        ),
        if (live) ...[
          const SizedBox(width: 10),
          Container(width: 1, height: 12, color: Colors.white.withValues(alpha: 0.15)),
          const SizedBox(width: 10),
          Text(
            clock.display,
            style: AppTypography.code(size: 13, weight: FontWeight.w800),
          ),
          if (match.timerPaused) ...[
            const SizedBox(width: 6),
            Icon(Icons.pause_rounded, size: 13, color: AppColors.textMuted),
          ],
        ],
      ],
    );
  }
}

class _TeamColumn extends StatelessWidget {
  final MatchTeam? team;
  final String fallback;

  const _TeamColumn({required this.team, required this.fallback});

  @override
  Widget build(BuildContext context) {
    final jersey = team?.jersey;

    return Column(
      children: [
        if (jersey != null)
          JerseyWidget(jersey: jersey, size: 54)
        else
          Icon(Icons.shield_outlined,
              size: 40, color: AppColors.textMuted.withValues(alpha: 0.5)),
        const SizedBox(height: 8),
        Text(
          team?.name ?? fallback,
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.headline(size: 13, weight: FontWeight.w800),
        ),
      ],
    );
  }
}

// ------------------------------------------------------ control del tiempo --

class _PeriodControls extends StatelessWidget {
  final MatchModel match;
  final LiveClock clock;
  final VoidCallback onStart;
  final void Function(String status, int baseMinute, bool paused) onSetState;
  final VoidCallback onFinish;

  const _PeriodControls({
    required this.match,
    required this.clock,
    required this.onStart,
    required this.onSetState,
    required this.onFinish,
  });

  @override
  Widget build(BuildContext context) {
    final status = match.liveStatus ?? 'not_started';
    final children = <Widget>[];

    if (match.status == 'upcoming' || status == 'not_started') {
      children.add(_ControlButton(
        icon: Icons.play_arrow_rounded,
        label: 'Iniciar partido',
        primary: true,
        onTap: onStart,
      ));
    } else if (status == 'first_half' || status == 'second_half') {
      children.add(_ControlButton(
        icon: match.timerPaused ? Icons.play_arrow_rounded : Icons.pause_rounded,
        label: match.timerPaused ? 'Reanudar' : 'Pausar',
        // Al pausar se congela el minuto que se ve; al reanudar se vuelve a
        // anclar el reloj desde ese mismo minuto.
        onTap: () => onSetState(status, clock.minute, !match.timerPaused),
      ));
      if (status == 'first_half') {
        children.add(_ControlButton(
          icon: Icons.free_breakfast_outlined,
          label: 'Entretiempo',
          onTap: () => onSetState('half_time', clock.minute, true),
        ));
      } else {
        children.add(_ControlButton(
          icon: Icons.sports_score_rounded,
          label: 'Finalizar',
          danger: true,
          onTap: onFinish,
        ));
      }
    } else if (status == 'half_time') {
      children.add(_ControlButton(
        icon: Icons.play_arrow_rounded,
        label: 'Segundo tiempo',
        primary: true,
        // Mismo criterio que la web (`Math.max(45, currentMinute)`): el
        // complemento arranca en el 45 aunque el primer tiempo haya sido más
        // corto.
        onTap: () => onSetState('second_half', clock.minute > 45 ? clock.minute : 45, false),
      ));
    }

    if (children.isEmpty) return const SizedBox.shrink();

    return Row(
      children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) const SizedBox(width: 10),
          Expanded(child: children[i]),
        ],
      ],
    );
  }
}

class _ControlButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool primary;
  final bool danger;
  final VoidCallback onTap;

  const _ControlButton({
    required this.icon,
    required this.label,
    this.primary = false,
    this.danger = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final fg = danger
        ? AppColors.destructive
        : primary
            ? AppColors.background
            : AppColors.textPrimary;
    final bg = primary ? AppColors.voltNeon : Colors.transparent;
    final border = primary
        ? AppColors.voltNeon
        : danger
            ? AppColors.destructive.withValues(alpha: 0.5)
            : Colors.white.withValues(alpha: 0.15);

    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.cardAll,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 13),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: AppRadii.cardAll,
          border: Border.all(color: border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: fg),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.headline(size: 13, weight: FontWeight.w800, color: fg),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ------------------------------------------------------- eventos rápidos ----

class _QuickEvents extends StatelessWidget {
  final void Function(String type) onPick;

  const _QuickEvents({required this.onPick});

  static const _items = [
    ('goal', Icons.sports_soccer_rounded, 'Gol'),
    ('card', Icons.style_rounded, 'Tarjeta'),
    ('substitution', Icons.swap_horiz_rounded, 'Cambio'),
    ('foul', Icons.report_gmailerrorred_rounded, 'Falta'),
    ('corner', Icons.flag_rounded, 'Córner'),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('REGISTRAR',
            style: AppTypography.headline(
                size: 11, weight: FontWeight.w800,
                color: AppColors.textMuted, letterSpacing: 1.2)),
        const SizedBox(height: 10),
        Row(
          children: [
            for (var i = 0; i < _items.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              Expanded(
                child: InkWell(
                  onTap: () => onPick(_items[i].$1),
                  borderRadius: AppRadii.cardAll,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      borderRadius: AppRadii.cardAll,
                      border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                    ),
                    child: Column(
                      children: [
                        Icon(_items[i].$2, size: 20, color: AppColors.textPrimary),
                        const SizedBox(height: 6),
                        Text(_items[i].$3,
                            style: AppTypography.body(size: 10, color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

/// Cuánta gente está siguiendo el partido ahora.
///
/// Sólo aparece si hay alguien además de vos: "1 mirando" cuando ese 1 sos
/// vos no le dice nada a nadie.
class _WatchingLine extends ConsumerWidget {
  final String matchId;

  const _WatchingLine({required this.matchId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final presence = ref.watch(matchPresenceProvider(matchId)).value ?? MatchPresence.none;
    if (presence.others < 1) return const SizedBox.shrink();

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: const BoxDecoration(color: AppColors.voltNeon, shape: BoxShape.circle),
        ),
        const SizedBox(width: 7),
        Text(
          presence.watching == 1
              ? '1 siguiendo el partido'
              : '${presence.watching} siguiendo el partido',
          style: AppTypography.body(size: 11.5, color: AppColors.textMuted),
        ),
      ],
    );
  }
}
