import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/models/group_model.dart';
import '../../../core/models/match_model.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/patea_colors.dart';
import '../../../core/theme/match_theme.dart'
    show fallbackTeamAColor, fallbackTeamBColor;
import '../../../core/widgets/match_countdown.dart';
import '../../../core/utils/dates.dart';
import '../../../core/utils/match_photography.dart';
import '../../../core/widgets/jersey_painter.dart';
import '../../../core/widgets/patea_avatar.dart';
import '../../matches/widgets/live_clock.dart';

/// Broadcast composition: the score belongs between the actual teams.
class DashboardMatchHero extends StatefulWidget {
  final MatchModel match;
  final bool isLive;
  const DashboardMatchHero({
    super.key,
    required this.match,
    required this.isLive,
  });
  @override
  State<DashboardMatchHero> createState() => _DashboardMatchHeroState();
}

class _DashboardMatchHeroState extends State<DashboardMatchHero> {
  Timer? _ticker;
  @override
  void initState() {
    super.initState();
    _syncClock();
  }

  @override
  void didUpdateWidget(covariant DashboardMatchHero oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncClock();
  }

  void _syncClock() {
    _ticker?.cancel();
    if (widget.isLive &&
        !widget.match.timerPaused &&
        widget.match.periodStartTs != null) {
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.match;
    final c = context.c;
    final clock = LiveClock.of(m);
    final phase = m.liveStatus == 'half_time'
        ? 'Entretiempo'
        : m.timerPaused
        ? 'En pausa'
        : clock.periodLabel(m);
    final goals = m.events.where((e) => e.type == 'goal').toList()
      ..sort((a, b) => b.minute.compareTo(a.minute));
    final hasTeams = m.teamA != null && m.teamB != null;
    final places = m.matchSize > 0
        ? '${m.playerUids.length}/${m.matchSize}'
        : '${m.playerUids.length}';
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: Stack(
        children: [
          Positioned.fill(
            child: Image.asset(
              MatchPhotography.forMatch(m.id),
              fit: BoxFit.cover,
              alignment: Alignment.center,
              errorBuilder: (_, _, _) => ColoredBox(color: c.cardSurface),
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    PateaColors.game.background.withValues(alpha: .93),
                    PateaColors.game.background.withValues(alpha: .50),
                    PateaColors.game.background.withValues(alpha: .96),
                  ],
                  stops: const [0, .48, 1],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: c.onPhoto.withValues(alpha: .10),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              widget.isLive
                                  ? Icons.sensors
                                  : Icons.calendar_today_outlined,
                              size: 14,
                              color: c.brandVolt,
                            ),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                widget.isLive ? 'En vivo' : 'Próximo partido',
                                style: AppTypography.body(
                                  size: 12,
                                  weight: FontWeight.w700,
                                  color: c.onPhoto,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        '${fmtDate(m.date)}${m.time == null ? '' : ' · ${m.time}'}',
                        textAlign: TextAlign.right,
                        style: AppTypography.body(
                          size: 12,
                          color: c.onPhotoMuted,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  m.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.headline(size: 20, color: c.onPhoto),
                ),
                if (!widget.isLive && _kickoff(m) != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: MatchCountdown(
                      kickoff: _kickoff(m)!,
                      size: 22,
                      color: c.brandVolt,
                    ),
                  ),
                const SizedBox(height: 24),
                if (hasTeams)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: _BroadcastTeam(
                          team: m.teamA!,
                          fallback: fallbackTeamAColor,
                          match: m,
                        ),
                      ),
                      SizedBox(
                        width: 112,
                        child: Column(
                          children: [
                            if (widget.isLive)
                              Semantics(
                                label:
                                    'Marcador ${m.teamA!.score} a ${m.teamB!.score}',
                                child: ExcludeSemantics(
                                  child: SizedBox(
                                    height: 66,
                                    child: FittedBox(
                                      fit: BoxFit.scaleDown,
                                      child: Text(
                                        '${m.teamA!.score} : ${m.teamB!.score}',
                                        style: AppTypography.sportNumber(
                                          size: 52,
                                          color: c.onPhoto,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            if (!widget.isLive)
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 17,
                                ),
                                child: Text(
                                  'VS',
                                  style: AppTypography.sportNumber(
                                    size: 30,
                                    color: c.onPhotoMuted,
                                  ),
                                ),
                              ),
                            const SizedBox(height: 6),
                            if (widget.isLive)
                              Text(
                                '${clock.minute.toString().padLeft(2, '0')}:${clock.second.toString().padLeft(2, '0')}',
                                style: AppTypography.code(
                                  size: 15,
                                  weight: FontWeight.w700,
                                  color: c.brandVolt,
                                ),
                              ),
                            const SizedBox(height: 5),
                            Text(
                              widget.isLive ? phase : 'Nos vemos en la cancha',
                              textAlign: TextAlign.center,
                              style: AppTypography.body(
                                size: 11,
                                color: c.onPhotoMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Expanded(
                        child: _BroadcastTeam(
                          team: m.teamB!,
                          fallback: fallbackTeamBColor,
                          match: m,
                        ),
                      ),
                    ],
                  )
                else
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    child: Column(
                      children: [
                        Icon(Icons.groups_outlined, size: 42, color: c.onPhoto),
                        const SizedBox(height: 10),
                        Text(
                          'La convocatoria está abierta',
                          style: AppTypography.headline(
                            size: 21,
                            color: c.onPhoto,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          'Los equipos se arman con los confirmados.',
                          style: AppTypography.body(
                            size: 13,
                            color: c.onPhotoMuted,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 20),
                if (widget.isLive && goals.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: c.onPhoto.withValues(alpha: .07),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.sports_soccer, size: 16, color: c.brandVolt),
                        const SizedBox(width: 9),
                        Expanded(
                          child: Text(
                            '${goals.first.minute}′ · ${goals.first.playerName.isEmpty ? 'Gol registrado' : goals.first.playerName}${goals.first.goalType == 'own_goal' ? ' (en contra)' : ''}',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.body(
                              size: 12,
                              color: c.onPhoto,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 14),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.location_on_outlined,
                      size: 16,
                      color: c.onPhotoMuted,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        m.location?.split(',').first ?? 'Cancha a definir',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.body(
                          size: 12,
                          color: c.onPhotoMuted,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Icon(
                      Icons.groups_outlined,
                      size: 16,
                      color: c.onPhotoMuted,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      places,
                      style: AppTypography.body(
                        size: 12,
                        weight: FontWeight.w700,
                        color: c.onPhoto,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => context.push(
                    widget.isLive
                        ? '/matches/${m.id}/live'
                        : '/matches/${m.id}',
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: c.brandVolt,
                    foregroundColor: PateaColors.game.onPrimary,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        widget.isLive
                            ? Icons.play_arrow_rounded
                            : Icons.groups_outlined,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          widget.isLive
                              ? 'Seguir el partido'
                              : 'Ver convocatoria',
                          style: AppTypography.body(
                            size: 14,
                            weight: FontWeight.w700,
                            color: PateaColors.game.onPrimary,
                          ),
                        ),
                      ),
                      const Icon(Icons.arrow_forward_rounded, size: 18),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BroadcastTeam extends StatelessWidget {
  final MatchTeam team;
  final MatchModel match;
  final Color fallback;
  const _BroadcastTeam({
    required this.team,
    required this.match,
    required this.fallback,
  });
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final jersey =
        team.jersey ??
        JerseyModel(
          primaryColor:
              team.color ??
              '#${fallback.toARGB32().toRadixString(16).substring(2)}',
        );
    final players = team.players.isNotEmpty
        ? team.players
        : match.players.where((p) => team.playerIds.contains(p.uid)).toList();
    return Column(
      children: [
        SizedBox(
          height: 82,
          child: Center(child: JerseyWidget(jersey: jersey, size: 72)),
        ),
        const SizedBox(height: 12),
        Text(
          team.name,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: AppTypography.body(
            size: 13,
            weight: FontWeight.w800,
            color: c.onPhoto,
          ),
        ),
        const SizedBox(height: 10),
        if (players.isNotEmpty)
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (final player in players.take(2))
                Padding(
                  padding: const EdgeInsets.only(right: 3),
                  child: PateaAvatar(
                    photoUrl: player.photoURL,
                    seed: player.uid,
                    size: 22,
                  ),
                ),
              if (players.length > 2)
                Text(
                  '+${players.length - 2}',
                  style: AppTypography.body(size: 10, color: c.onPhotoMuted),
                ),
            ],
          ),
      ],
    );
  }
}

DateTime? _kickoff(MatchModel match) {
  final date = DateTime.tryParse(match.date)?.toLocal();
  if (date == null || match.time == null) return null;
  final parts = match.time!.split(':');
  final hour = int.tryParse(parts.first);
  final minute = parts.length > 1 ? int.tryParse(parts[1]) : null;
  if (hour == null || minute == null) return null;
  return DateTime(date.year, date.month, date.day, hour, minute);
}
