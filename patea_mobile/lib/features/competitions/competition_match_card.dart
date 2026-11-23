import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/group_model.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/dates.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/patea_card.dart';
import 'competition_insights.dart';

class CompetitionMatchCard extends StatelessWidget {
  final Map<String, dynamic> match;
  final VoidCallback? schedule, result;
  final bool busy;
  final bool compact;
  const CompetitionMatchCard({
    super.key,
    required this.match,
    this.schedule,
    this.result,
    this.busy = false,
    this.compact = false,
  });
  static final _compactActionStyle = TextButton.styleFrom(
    padding: const EdgeInsets.symmetric(horizontal: 7),
    minimumSize: const Size(0, 40),
    visualDensity: VisualDensity.compact,
  );

  @override
  Widget build(BuildContext context) {
    final teams = match['teams'] as List? ?? [],
        score = competitionScore(match),
        live = match['status'] == 'active',
        done = confirmedMatch(match);
    Map side(int i) => teams.length > i ? teams[i] as Map : {};
    final date = match['date']?.toString() ?? '';
    final time = match['time']?.toString().trim() ?? '';
    final rawPlace = match['location'];
    final place =
        (rawPlace is Map ? rawPlace['name'] : rawPlace)?.toString().trim() ??
        '';
    final when = [
      if (date.isNotEmpty) fmtDate(date),
      if (time.isNotEmpty) '$time hs',
      if (place.isNotEmpty && place.toLowerCase() != 'a definir') place,
    ].join(' · ');
    final pair = match['participantTeamIds'] as List? ?? [];
    final penalty = pair.indexOf(match['penaltyWinnerId']);
    return PateaCard(
      color: context.c.card,
      borderColor: context.c.border,
      padding: EdgeInsets.all(compact ? 12 : 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              Text(
                matchState(match['status'] as String?),
                style: AppTypography.body(
                  size: 13,
                  weight: FontWeight.w600,
                  color: live ? context.c.primary : context.c.textSecondary,
                ),
              ),
              if (when.isNotEmpty)
                Text(
                  when,
                  style: AppTypography.body(
                    size: 12,
                    color: context.c.textSecondary,
                  ),
                ),
            ],
          ),
          SizedBox(height: compact ? 8 : 12),
          for (var i = 0; i < 2; i++) ...[
            if (i == 1) Divider(height: 10, color: context.c.overlayLine),
            CompetitionScoreLine(
              name: (side(i)['name'] ?? 'Equipo por definir').toString(),
              jersey: side(i)['jersey'] is Map
                  ? JerseyModel.fromMap(
                      Map<String, dynamic>.from(side(i)['jersey']),
                    )
                  : null,
              score: (done || live) && score != null
                  ? score[i == 0 ? 'team1' : 'team2']
                  : null,
              emphasized:
                  done &&
                  (penalty >= 0
                      ? penalty == i
                      : score != null &&
                            (i == 0
                                ? score['team1']! > score['team2']!
                                : score['team2']! > score['team1']!)),
            ),
          ],
          if (penalty >= 0 && penalty < 2)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(
                '${side(penalty)['name'] ?? 'Equipo'} ganó por penales',
                textAlign: TextAlign.center,
                style: AppTypography.body(size: 13, color: context.c.primary),
              ),
            ),
          if (compact)
            Divider(height: 12, color: context.c.overlayLine)
          else
            const SizedBox(height: 8),
          Wrap(
            spacing: compact ? 2 : 8,
            runSpacing: compact ? 0 : 4,
            children: [
              TextButton.icon(
                style: compact ? _compactActionStyle : null,
                onPressed: () => context.push('/matches/${match['id']}'),
                icon: const Icon(Icons.open_in_new, size: 18),
                label: const Text('Abrir partido'),
              ),
              if (schedule != null)
                TextButton.icon(
                  style: compact ? _compactActionStyle : null,
                  onPressed: busy ? null : schedule,
                  icon: const Icon(Icons.edit_calendar_outlined, size: 18),
                  label: const Text('Programar'),
                ),
              if (result != null)
                TextButton.icon(
                  style: compact ? _compactActionStyle : null,
                  onPressed: busy ? null : result,
                  icon: const Icon(Icons.sports_score, size: 18),
                  label: Text(done ? 'Resolver penales' : 'Cargar resultado'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// A team and its score share a row so names keep the available width.
class CompetitionScoreLine extends StatelessWidget {
  const CompetitionScoreLine({
    super.key,
    required this.name,
    this.jersey,
    this.score,
    this.emphasized = false,
  });

  final String name;
  final JerseyModel? jersey;
  final int? score;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final colors = context.c;
    return Row(
      children: [
        if (jersey case final kit?) ...[
          JerseyWidget(jersey: kit, teamName: name, size: 30),
          const SizedBox(width: 8),
        ],
        Expanded(
          child: Text(
            name,
            style: AppTypography.headline(
              size: 16,
              weight: emphasized ? FontWeight.w800 : FontWeight.w700,
            ),
          ),
        ),
        if (score case final result?) ...[
          const SizedBox(width: 12),
          Text(
            '$result',
            style: AppTypography.sportNumber(
              size: 24,
              color: emphasized ? colors.primary : colors.textPrimary,
            ),
          ),
        ],
      ],
    );
  }
}
