import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/player_model.dart';
import '../../core/theme/app_insets.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/firestore_service.dart';
import '../../core/widgets/patea_activity_cover.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_states.dart';
import '../../core/widgets/patea_tabs.dart';
import '../../core/widgets/player_position_badge.dart';

enum RankingMetric {
  ovr('OVR'),
  goals('Goles'),
  assists('Asistencias');

  final String label;
  const RankingMetric(this.label);
  int value(PlayerModel p) => switch (this) {
    ovr => p.ovr,
    goals => p.stats.goals,
    assists => p.stats.assists,
  };
}

/// Shared places for ties; name/id provide deterministic display order only.
List<PlayerModel> rankPlayers(
  List<PlayerModel> players,
  RankingMetric metric,
) => List.of(players)
  ..sort((a, b) {
    final score = metric.value(b).compareTo(metric.value(a));
    if (score != 0) return score;
    final name = a.name.toLowerCase().compareTo(b.name.toLowerCase());
    return name != 0 ? name : a.id.compareTo(b.id);
  });

class LeaderboardScreen extends ConsumerStatefulWidget {
  const LeaderboardScreen({super.key});
  @override
  ConsumerState<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends ConsumerState<LeaderboardScreen> {
  RankingMetric _metric = RankingMetric.ovr;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: Colors.transparent,
    appBar: AppBar(
      backgroundColor: Colors.transparent,
      title: Text(
        'Rankings y tablas',
        style: AppTypography.headline(size: 20, weight: FontWeight.w700),
      ),
    ),
    body: ref
        .watch(activeGroupPlayersProvider)
        .when(
          loading: () => const Center(child: PateaLoading()),
          error: (error, _) => PateaError(error: error),
          data: (players) {
            final sorted = rankPlayers(players, _metric);
            final places = <int>[];
            for (var i = 0; i < sorted.length; i++) {
              places.add(
                i > 0 &&
                        _metric.value(sorted[i]) == _metric.value(sorted[i - 1])
                    ? places[i - 1]
                    : i + 1,
              );
            }
            final hasValues =
                sorted.isNotEmpty && _metric.value(sorted.first) > 0;
            return ListView.builder(
              padding: EdgeInsets.fromLTRB(16, 8, 16, bottomInset(context, extra: 24)),
              itemCount: sorted.length + 1,
              itemBuilder: (context, index) {
                if (index == 0) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      PateaActivityCover(
                        image: 'assets/brand/patea_ranking.webp',
                        title: 'La tabla del plantel',
                        details:
                            '${players.length} jugadores · Estadísticas registradas en Pateá',
                      ),
                      const SizedBox(height: 18),
                      PateaTabs(
                        tabs: [
                          for (final metric in RankingMetric.values)
                            PateaTab(metric.label),
                        ],
                        active: _metric.index,
                        onChanged: (i) =>
                            setState(() => _metric = RankingMetric.values[i]),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        child: Text(
                          sorted.isEmpty
                              ? 'El ranking aparece cuando agregás jugadores al plantel.'
                              : !hasValues
                              ? 'Todavía no hay ${_metric.label.toLowerCase()} registrados. Los empates comparten puesto.'
                              : 'Ordenado por ${_metric.label}. Los empates comparten puesto.',
                          style: AppTypography.body(
                            size: 12,
                            color: context.c.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  );
                }
                final player = sorted[index - 1];
                final place = places[index - 1];
                final podium = place <= 3 && _metric.value(player) > 0;
                final borderAccent = place == 1
                    ? context.c.goldBorder
                    : place == 2
                    ? context.c.silverBorder
                    : context.c.bronzeBorder;
                final inkAccent = place == 1
                    ? context.c.goldText
                    : place == 2
                    ? context.c.silverText
                    : context.c.bronzeText;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Semantics(
                    button: true,
                    child: InkWell(
                      borderRadius: AppRadii.cardAll,
                      onTap: () => context.push('/players/${player.id}'),
                      child: PateaCard(
                        borderColor: podium
                            ? borderAccent.withValues(alpha: .6)
                            : context.c.border,
                        borderWidth: podium ? 1.5 : 1,
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 34,
                              child: Text(
                                '$place',
                                style: AppTypography.sportNumber(
                                  size: 22,
                                  color: podium
                                      ? inkAccent
                                      : context.c.textSecondary,
                                ),
                              ),
                            ),
                            PateaAvatar(
                              photoUrl: player.photoUrl,
                              seed: player.id,
                              size: 42,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    player.name,
                                    style: AppTypography.headline(
                                      size: 15,
                                      weight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 5),
                                  Wrap(
                                    spacing: 7,
                                    runSpacing: 4,
                                    crossAxisAlignment:
                                        WrapCrossAlignment.center,
                                    children: [
                                      PlayerPositionBadge(
                                        position: player.position,
                                        fontSize: 12,
                                        dense: true,
                                      ),
                                      Text(
                                        '${player.stats.matchesPlayed} partidos',
                                        style: AppTypography.body(
                                          size: 12,
                                          color: context.c.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              children: [
                                Text(
                                  '${_metric.value(player)}',
                                  style: AppTypography.sportNumber(
                                    size: 28,
                                    color: _metric == RankingMetric.ovr
                                        ? context.c.ovrTextColor(player.ovr)
                                        : context.c.primary,
                                  ),
                                ),
                                Text(
                                  _metric.label,
                                  style: AppTypography.body(
                                    size: 12,
                                    color: context.c.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            );
          },
        ),
  );
}
