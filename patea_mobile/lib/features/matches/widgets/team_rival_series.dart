import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/team_challenge_service.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/patea_colors.dart';

class TeamRivalSeries extends ConsumerWidget {
  final String matchId;
  const TeamRivalSeries({super.key, required this.matchId});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(teamRivalSeriesProvider(matchId)).asData?.value;
    final series = data?['series'] as Map?;
    final issue = data?['rosterSyncIssue'] as String?;
    if (series == null && issue == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (issue != null)
            Text(
              'Revisá los planteles: $issue',
              style: AppTypography.body(size: 13, color: context.c.destructive),
            ),
          if (series != null) ...[
            Text(
              'Serie contra ${series['name']}',
              style: AppTypography.body(size: 14, weight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              '${series['wins']}G  ${series['draws']}E  ${series['losses']}P · Rival guardado',
              style: AppTypography.body(
                size: 13,
                color: context.c.textSecondary,
              ),
            ),
            TextButton(
              onPressed: () =>
                  context.push('/groups/teams/${series['ownTeamId']}/rivals'),
              child: const Text('Ver la historia entre equipos'),
            ),
          ],
        ],
      ),
    );
  }
}
