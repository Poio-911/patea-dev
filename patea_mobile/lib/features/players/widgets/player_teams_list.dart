import 'package:flutter/material.dart';
import '../../../core/theme/app_radii.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/services/player_profile_service.dart';
import '../../../core/theme/patea_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/jersey_painter.dart';

/// Port de `PlayerTeamsList` (src/components/player-teams-list.tsx).
///
/// Fila horizontal con la camiseta de cada equipo del jugador y su número
/// en una insignia. Igual que en la web, si no pertenece a ningún equipo el
/// bloque no se muestra en absoluto — no hay estado vacío.
class PlayerTeamsList extends ConsumerWidget {
  final String playerId;
  final String? groupId;

  const PlayerTeamsList({super.key, required this.playerId, this.groupId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final teamsAsync = ref.watch(playerTeamsProvider((playerId: playerId, groupId: groupId)));

    return teamsAsync.maybeWhen(
      data: (teams) {
        if (teams.isEmpty) return const SizedBox.shrink();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.checkroom, size: 18, color: context.c.primary),
                const SizedBox(width: 8),
                Text(
                  'EQUIPOS ACTUALES',
                  style: AppTypography.headline(size: 14, weight: FontWeight.w700),
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 104,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: teams.length,
                separatorBuilder: (_, _) => const SizedBox(width: 14),
                itemBuilder: (context, i) {
                  final team = teams[i];
                  final number = team.members
                      .firstWhere(
                        (m) => m.playerId == playerId,
                        orElse: () => team.members.first,
                      )
                      .number;

                  return SizedBox(
                    width: 88,
                    child: InkWell(
                      onTap: () => context.push('/groups/teams/${team.id}'),
                      borderRadius: AppRadii.cardAll,
                      child: Column(
                        children: [
                          Stack(
                            clipBehavior: Clip.none,
                            children: [
                              JerseyWidget(jersey: team.jersey, size: 56),
                              Positioned(
                                bottom: -4,
                                right: -4,
                                child: Container(
                                  width: 24,
                                  height: 24,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: context.c.cardSurface,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: context.c.background, width: 2),
                                  ),
                                  child: Text(
                                    number > 0 ? '$number' : '#',
                                    style: AppTypography.code(
                                      size: 10,
                                      color: context.c.textPrimary,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text(
                            team.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: AppTypography.body(
                              size: 11,
                              weight: FontWeight.w600,
                              color: context.c.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}
