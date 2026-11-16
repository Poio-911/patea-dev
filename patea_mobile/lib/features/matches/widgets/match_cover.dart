import '../../../core/utils/match_photography.dart';
import 'package:flutter/material.dart';

import '../../../core/models/match_model.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/match_theme.dart';
import '../../../core/utils/dates.dart';
import '../../../core/widgets/jersey_painter.dart';

/// Portada editorial compartida por todos los estados del encuentro.
class MatchCover extends StatelessWidget {
  final MatchModel match;
  final VoidCallback onOpenMaps;

  const MatchCover({super.key, required this.match, required this.onOpenMaps});

  @override
  Widget build(BuildContext context) {
    final hasVenue = match.location?.trim().isNotEmpty == true;
    final venue = match.locationDetail?.name.trim();
    final venueName = venue?.isNotEmpty == true
        ? venue!
        : hasVenue
        ? match.location!.split(',').first.trim()
        : 'Sede a confirmar';
    final status = switch (match.status) {
      'evaluated' => 'Evaluado',
      'completed' => 'Finalizado',
      'active' => 'En vivo',
      'planning' => 'En planificación',
      _ => 'Próximo partido',
    };
    final hasTeams = match.teamA != null && match.teamB != null;
    final showScore = match.hasFinalScore || match.status == 'active';
    const photoInk = Color(0xFFF4F7F6);
    const photoMuted = Color(0xFFC3CDCA);
    return Stack(
      children: [
        Positioned.fill(
          child: Image.asset(
            MatchPhotography.forMatch(match.id),
            fit: BoxFit.cover,
          ),
        ),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  const Color(0xD90B1416),
                  const Color(0xB30B1416),
                  const Color(0xFF0B1416),
                ],
                stops: const [0, .62, 1],
              ),
            ),
          ),
        ),
        SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(22, 64, 22, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 7,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Icon(
                      match.status == 'active'
                          ? Icons.radio_button_checked
                          : Icons.check_circle_outline,
                      size: 14,
                      color: const Color(0xFFD0FF37),
                    ),
                    Text(
                      '$status · ${getMatchTypeTheme(match.type).label}',
                      style: AppTypography.body(
                        size: 12,
                        color: const Color(0xFFD0FF37),
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  match.title,
                  style: AppTypography.headline(
                    size: 27,
                    weight: FontWeight.w700,
                    color: photoInk,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  '${match.date.isEmpty ? 'Fecha a definir' : fmtLongDate(match.date)}${match.time?.isNotEmpty == true ? ' · ${match.time} hs' : ''}',
                  style: AppTypography.body(size: 13, color: photoMuted),
                ),
                InkWell(
                  onTap: hasVenue ? onOpenMaps : null,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.place_outlined,
                          size: 16,
                          color: photoMuted,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            venueName,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.body(
                              size: 13,
                              color: photoInk,
                            ),
                          ),
                        ),
                        if (hasVenue)
                          const Icon(
                            Icons.arrow_outward,
                            size: 14,
                            color: photoMuted,
                          ),
                      ],
                    ),
                  ),
                ),
                if (hasTeams) ...[
                  const SizedBox(height: 17),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(child: _TeamIdentity(team: match.teamA!)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        child: Column(
                          children: [
                            Semantics(
                              label: showScore
                                  ? '${match.teamA!.score} a ${match.teamB!.score}'
                                  : 'Versus',
                              child: Text(
                                showScore
                                    ? '${match.teamA!.score} – ${match.teamB!.score}'
                                    : 'VS',
                                style: AppTypography.sportNumber(
                                  size: showScore ? 43 : 30,
                                  color: photoInk,
                                ),
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              showScore
                                  ? (match.status == 'active'
                                        ? 'EN VIVO'
                                        : 'RESULTADO FINAL')
                                  : 'POR JUGAR',
                              style: AppTypography.body(
                                size: 10,
                                color: photoMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Expanded(child: _TeamIdentity(team: match.teamB!)),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _TeamIdentity extends StatelessWidget {
  final MatchTeam team;
  const _TeamIdentity({required this.team});

  @override
  Widget build(BuildContext context) => Column(
    children: [
      if (team.jersey != null)
        JerseyWidget(jersey: team.jersey!, size: 44)
      else
        const Icon(Icons.checkroom, size: 38, color: Color(0xFFF4F7F6)),
      const SizedBox(height: 8),
      Text(
        team.name,
        textAlign: TextAlign.center,
        maxLines: 3,
        overflow: TextOverflow.ellipsis,
        style: AppTypography.body(
          size: 13,
          weight: FontWeight.w600,
          color: const Color(0xFFF4F7F6),
        ),
      ),
      const SizedBox(height: 4),
      Text(
        '${team.players.length} jugadores',
        style: AppTypography.body(size: 11, color: const Color(0xFFC3CDCA)),
      ),
    ],
  );
}
