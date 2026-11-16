import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/match_model.dart';
import '../../../core/services/match_result_service.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/patea_colors.dart';
import '../../../core/utils/dates.dart';
import '../../../core/utils/match_photography.dart';
import '../../../core/widgets/patea_activity_cover.dart';
import '../../../core/widgets/patea_avatar.dart';

/// The latest match the user actually played; no generated or invented stats.
class LatestMatchReview extends ConsumerWidget {
  final MatchModel match;
  const LatestMatchReview({super.key, required this.match});

  MatchPlayerEntry? playerOf(String? id) {
    if (id == null) return null;
    for (final player in [
      ...match.players,
      ...?match.teamA?.players,
      ...?match.teamB?.players,
    ]) {
      if (player.uid == id) return player;
    }
    return null;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final result = ref.watch(matchResultStatsProvider(match.id));
    final stats = result.asData?.value;
    final figure = playerOf(match.bestPlayerId ?? stats?.mvpId);
    final scorers = stats?.scorers.take(3).toList() ?? [];
    void openMatch() => context.push('/matches/${match.id}');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'La última fecha',
          style: AppTypography.headline(size: 21, weight: FontWeight.w700),
        ),
        const SizedBox(height: 13),
        InkWell(
          onTap: openMatch,
          borderRadius: BorderRadius.circular(18),
          child: PateaActivityCover(
            image: MatchPhotography.forMatch(match.id),
            title: match.title,
            details: fmtDate(match.date),
          ),
        ),
        const SizedBox(height: 16),
        if (match.teamA != null && match.teamB != null)
          Row(
            children: [
              Expanded(
                child: Text(
                  match.teamA!.name,
                  style: AppTypography.body(size: 14, weight: FontWeight.w600),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 13),
                child: Text(
                  match.hasFinalScore
                      ? '${match.teamA!.score} – ${match.teamB!.score}'
                      : 'VS',
                  style: AppTypography.sportNumber(
                    size: 31,
                    color: context.c.primary,
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  match.teamB!.name,
                  textAlign: TextAlign.right,
                  style: AppTypography.body(size: 14, weight: FontWeight.w600),
                ),
              ),
            ],
          ),
        if (!match.hasFinalScore)
          Padding(
            padding: const EdgeInsets.only(top: 7),
            child: Text(
              'Resultado pendiente de confirmación',
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
          ),
        if (figure != null) ...[
          const SizedBox(height: 17),
          InkWell(
            onTap: () => context.push('/players/${figure.uid}'),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  PateaAvatar(
                    photoUrl: figure.photoURL,
                    seed: figure.uid,
                    size: 48,
                    borderColor: context.c.ratingAccent,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Figura del partido',
                          style: AppTypography.body(
                            size: 12,
                            color: context.c.ratingAccent,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          figure.displayName,
                          style: AppTypography.headline(
                            size: 17,
                            weight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (stats?.mvpId == figure.uid && (stats?.mvpVotes ?? 0) > 0)
                    Text(
                      '${stats!.mvpVotes} votos',
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.textSecondary,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
        if (scorers.isNotEmpty) ...[
          const SizedBox(height: 17),
          Text(
            'Goleadores',
            style: AppTypography.headline(size: 15, weight: FontWeight.w600),
          ),
          for (final tally in scorers)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 9),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      playerOf(tally.playerId)?.displayName ?? 'Jugador',
                      style: AppTypography.body(size: 14),
                    ),
                  ),
                  Icon(
                    Icons.sports_soccer_outlined,
                    size: 15,
                    color: context.c.textSecondary,
                  ),
                  const SizedBox(width: 7),
                  Text(
                    '${tally.goals}',
                    style: AppTypography.body(
                      size: 14,
                      weight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
        ] else if (result.isLoading)
          Padding(
            padding: const EdgeInsets.only(top: 14),
            child: Text(
              'Cargando el resumen de evaluaciones…',
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
          )
        else if (result.hasError)
          Padding(
            padding: const EdgeInsets.only(top: 14),
            child: Text(
              'El resumen de evaluaciones no está disponible ahora.',
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
          ),
        if (match.chronicle != null) ...[
          const SizedBox(height: 17),
          Text(
            match.chronicle!.headline,
            style: AppTypography.headline(size: 18, weight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            match.chronicle!.story,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.body(
              size: 14,
              height: 1.5,
              color: context.c.textSecondary,
            ),
          ),
        ],
        const SizedBox(height: 10),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: openMatch,
            icon: const Icon(Icons.arrow_forward, size: 17),
            label: Text(
              match.chronicle == null
                  ? 'Ver partido y planilla'
                  : 'Ver partido y crónica',
            ),
          ),
        ),
      ],
    );
  }
}
