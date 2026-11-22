import '../../core/widgets/patea_tabs.dart';
import 'dart:async';
import '../../core/widgets/patea_snack.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/match_model.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/group_service.dart';
import '../../core/services/match_service.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/patea_states.dart';
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
  int _tab = 0;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    // El reloj no vive en Firestore: se deriva de `periodStartTs`. Este timer
    // sólo fuerza el repintado cada segundo; si el partido está pausado o
    // terminado, `LiveClock` devuelve siempre lo mismo y no se nota.
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final match = ref
          .read(singleMatchStreamProvider(widget.matchId))
          .asData
          ?.value;
      if (match?.status == 'active' && match?.timerPaused == false) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  MatchService get _service => ref.read(matchServiceProvider);

  Future<void> _guard(Future<void> Function() action) async {
    // Se captura antes del await: después el contexto puede no valer.
    if (_busy) return;
    final avisar = PateaSnack.of(context);
    setState(() => _busy = true);
    try {
      await action();
    } catch (e) {
      avisar.error('$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openEventLogger(
    MatchModel match,
    String type, [
    MatchPlayerEntry? player,
  ]) async {
    final clock = LiveClock.of(match);
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => EventLoggerSheet(
        match: match,
        eventType: type,
        currentMinute: clock.minute,
        initialPlayer: player,
      ),
    );
  }

  Future<void> _confirmFinish(MatchModel match) async {
    final a = match.teamA?.score ?? 0;
    final b = match.teamB?.score ?? 0;

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: context.c.popover,
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
        title: Text(
          '¿Finalizar el partido?',
          style: AppTypography.headline(size: 17, weight: FontWeight.w800),
        ),
        content: Text(
          'Queda $a a $b. Después de esto se abren las evaluaciones y ya no se '
          'pueden cargar más eventos.',
          style: AppTypography.body(color: context.c.textSecondary, size: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(
              'Cancelar',
              style: AppTypography.body(
                size: 13,
                color: context.c.textSecondary,
              ),
            ),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: context.c.destructive,
              foregroundColor: context.c.onPrimary,
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
    final uid = ref.watch(authStateProvider).asData?.value?.uid;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          matchAsync.asData?.value?.title ?? 'Minuto a minuto',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
      ),
      body: matchAsync.when(
        loading: () => const PateaLoading(),
        error: (e, _) => PateaError(
          error: e,
          message: 'No pudimos cargar el partido.',
          onRetry: () =>
              ref.invalidate(singleMatchStreamProvider(widget.matchId)),
        ),
        data: (match) {
          if (match == null) {
            return Center(
              child: Text(
                'Partido no encontrado',
                style: AppTypography.body(color: context.c.textSecondary),
              ),
            );
          }

          // Organizador, co-organizador, capitán o admin/moderador del grupo.
          final groupRole = match.groupId != null && match.groupId!.isNotEmpty
              ? ref.watch(myGroupRoleProvider(match.groupId!)).value
              : null;
          final isOrganizer = match.isManagedBy(uid, groupRole: groupRole);
          // Un partido terminado no se dirige: sin esto, un partido
          // finalizado que nunca pasó por el panel en vivo (liveStatus vacío)
          // mostraba "Iniciar partido" debajo del cartel de FINALIZADO.
          final isOver =
              match.status == 'completed' || match.status == 'evaluated';
          final canDirect = isOrganizer && !isOver;
          final clock = LiveClock.of(match);

          final pages = [
            MatchTimelineView(match: match),
            match.events.isEmpty
                ? Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      'Las estadísticas aparecen al registrar eventos.',
                      style: AppTypography.body(color: context.c.textSecondary),
                    ),
                  )
                : LiveStatsPanel(match: match),
            MatchClipsView(
              match: match,
              canUpload:
                  uid != null &&
                  (isOrganizer || match.playerUids.contains(uid)),
            ),
          ];
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 2, 14, 4),
                child: _Scoreboard(match: match, clock: clock),
              ),
              _WatchingLine(matchId: match.id),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: PateaTabs(
                  tabs: const [
                    PateaTab('Cancha'),
                    PateaTab('Minuto a minuto'),
                    PateaTab('Estadísticas'),
                    PateaTab('Clips'),
                  ],
                  active: _tab,
                  onChanged: (value) => setState(() => _tab = value),
                ),
              ),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) => ListView(
                    key: PageStorageKey('live-${widget.matchId}-$_tab'),
                    padding: EdgeInsets.fromLTRB(
                      _tab == 0 ? 6 : 16,
                      6,
                      _tab == 0 ? 6 : 16,
                      4,
                    ),
                    children: [
                      _tab == 0
                          ? LivePitchView(
                              match: match,
                              viewportHeight: constraints.maxHeight - 10,
                              onGoal: canDirect && clock.isRunning
                                  ? (player) =>
                                        _openEventLogger(match, 'goal', player)
                                  : null,
                            )
                          : pages[_tab - 1],
                    ],
                  ),
                ),
              ),
              if (canDirect)
                Container(
                  key: const ValueKey('live-control-dock'),
                  decoration: BoxDecoration(
                    color: context.c.card,
                    border: Border(
                      top: BorderSide(color: context.c.overlayLine),
                    ),
                  ),
                  child: SafeArea(
                    top: false,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      child: IgnorePointer(
                        ignoring: _busy,
                        child: Opacity(
                          opacity: _busy ? .5 : 1,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Flexible(
                                child: ConstrainedBox(
                                  constraints: BoxConstraints(
                                    maxWidth: clock.isRunning
                                        ? double.infinity
                                        : 210,
                                  ),
                                  child: _PeriodControls(
                                    match: match,
                                    clock: clock,
                                    onStart: () => _guard(
                                      () => _service.startMatch(match.id),
                                    ),
                                    onSetState: (status, base, paused) =>
                                        _guard(
                                          () => _service.updateLiveState(
                                            matchId: match.id,
                                            liveStatus: status,
                                            baseMinute: base,
                                            paused: paused,
                                          ),
                                        ),
                                    onFinish: () => _confirmFinish(match),
                                  ),
                                ),
                              ),
                              if (clock.isRunning) ...[
                                const SizedBox(width: 8),
                                Expanded(
                                  child: _QuickEvents(
                                    onPick: (type) =>
                                        _openEventLogger(match, type),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              if (isOver &&
                  uid != null &&
                  (isOrganizer || match.playerUids.contains(uid)))
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: OutlinedButton.icon(
                      onPressed: () => context.push('/evaluations/${match.id}'),
                      icon: const Icon(Icons.star_rate_rounded),
                      label: const Text('Evaluar a tus compañeros'),
                    ),
                  ),
                ),
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
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: _TeamColumn(team: match.teamA, fallback: 'Equipo A'),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '${match.teamA?.score ?? 0} – ${match.teamB?.score ?? 0}',
              style: AppTypography.sportNumber(
                size: 34,
                color: context.c.textPrimary,
              ),
            ),
            if (match.status == 'active')
              Text(
                '${clock.minute.toString().padLeft(2, '0')}:${clock.second.toString().padLeft(2, '0')}${match.timerPaused ? ' · Pausa' : ''}',
                style: AppTypography.code(
                  size: 14,
                  weight: FontWeight.w700,
                  color: context.c.primary,
                ),
              ),
            Text(
              clock.periodLabel(match),
              textAlign: TextAlign.center,
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
          ],
        ),
      ),
      Expanded(
        child: _TeamColumn(team: match.teamB, fallback: 'Equipo B'),
      ),
    ],
  );
}

class _TeamColumn extends StatelessWidget {
  final MatchTeam? team;
  final String fallback;
  const _TeamColumn({required this.team, required this.fallback});
  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      if (team?.jersey != null)
        JerseyWidget(jersey: team!.jersey!, size: 23)
      else
        Icon(Icons.shield_outlined, size: 22, color: context.c.textSecondary),
      const SizedBox(height: 3),
      Text(
        team?.name ?? fallback,
        textAlign: TextAlign.center,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: AppTypography.body(size: 12, weight: FontWeight.w700),
      ),
    ],
  );
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
      children.add(
        _ControlButton(
          icon: Icons.play_arrow_rounded,
          label: 'Iniciar partido',
          primary: true,
          onTap: onStart,
        ),
      );
    } else if (status == 'first_half' || status == 'second_half') {
      children.add(
        _ControlButton(
          icon: match.timerPaused
              ? Icons.play_arrow_rounded
              : Icons.pause_rounded,
          label: match.timerPaused ? 'Reanudar' : 'Pausar',
          // Al pausar se congela el minuto que se ve; al reanudar se vuelve a
          // anclar el reloj desde ese mismo minuto.
          onTap: () => onSetState(status, clock.minute, !match.timerPaused),
        ),
      );
      if (status == 'first_half') {
        children.add(
          _ControlButton(
            icon: Icons.free_breakfast_outlined,
            label: 'Descanso',
            onTap: () => onSetState('half_time', clock.minute, true),
          ),
        );
      } else {
        children.add(
          _ControlButton(
            icon: Icons.sports_score_rounded,
            label: 'Finalizar',
            danger: true,
            onTap: onFinish,
          ),
        );
      }
    } else if (status == 'half_time') {
      children.add(
        _ControlButton(
          icon: Icons.play_arrow_rounded,
          label: 'Segundo tiempo',
          primary: true,
          // Mismo criterio que la web (`Math.max(45, currentMinute)`): el
          // complemento arranca en el 45 aunque el primer tiempo haya sido más
          // corto.
          onTap: () => onSetState(
            'second_half',
            clock.minute > 45 ? clock.minute : 45,
            false,
          ),
        ),
      );
    }

    if (children.isEmpty) return const SizedBox.shrink();

    return Row(
      children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) const SizedBox(width: 4),
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
        ? context.c.destructive
        : primary
        ? context.c.onPrimary
        : context.c.textPrimary;
    return Tooltip(
      message: label,
      child: Material(
        color: primary ? context.c.primary : Colors.transparent,
        borderRadius: AppRadii.cardAll,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadii.cardAll,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 5),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 20, color: fg),
                const SizedBox(height: 2),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  style: AppTypography.body(
                    size: 12,
                    weight: FontWeight.w600,
                    color: fg,
                  ),
                ),
              ],
            ),
          ),
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
    return Row(
      children: [
        Expanded(
          child: FilledButton.icon(
            onPressed: () => onPick('goal'),
            icon: const Icon(Icons.sports_soccer_rounded, size: 20),
            label: const Text('Gol'),
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: const Size(0, 48),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: PopupMenuButton<String>(
            tooltip: 'Más eventos',
            onSelected: onPick,
            itemBuilder: (_) => [
              for (final item in _items.skip(1))
                PopupMenuItem(
                  value: item.$1,
                  child: Row(
                    children: [
                      Icon(item.$2, size: 20, color: context.c.textPrimary),
                      const SizedBox(width: 12),
                      Text(item.$3),
                    ],
                  ),
                ),
            ],
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.more_horiz_rounded,
                    size: 21,
                    color: context.c.textPrimary,
                  ),
                  Text(
                    'Eventos',
                    style: AppTypography.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: context.c.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ),
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
    final presence =
        ref.watch(matchPresenceProvider(matchId)).asData?.value ??
        MatchPresence.none;
    if (presence.others < 1) return const SizedBox.shrink();

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            color: context.c.primary,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 7),
        Text(
          presence.watching == 1
              ? '1 siguiendo el partido'
              : '${presence.watching} siguiendo el partido',
          style: AppTypography.body(size: 12, color: context.c.textSecondary),
        ),
      ],
    );
  }
}
