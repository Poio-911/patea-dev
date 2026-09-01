import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/firestore_service.dart';
import '../../core/models/match_model.dart';

class MatchesScreen extends ConsumerWidget {
  const MatchesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matchesAsync = ref.watch(matchesStreamProvider(null));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'PARTIDOS',
          style: AppTypography.headline(size: 20, weight: FontWeight.w800),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.voltNeon,
        foregroundColor: Colors.black,
        onPressed: () => context.push('/matches/create'),
        child: const Icon(Icons.add),
      ),
      body: matchesAsync.when(
        data: (matches) {
          if (matches.isEmpty) {
            return Center(
              child: Text(
                'No hay partidos programados',
                style: AppTypography.body(color: AppColors.textMuted),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: matches.length,
            separatorBuilder: (_, index) => const SizedBox(height: 14),
            itemBuilder: (context, index) {
              final match = matches[index];
              return _MatchCard(match: match);
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Error: $err')),
      ),
    );
  }
}

class _MatchCard extends StatelessWidget {
  final MatchModel match;

  const _MatchCard({required this.match});

  @override
  Widget build(BuildContext context) {
    final isLive = match.status == 'active';
    final isCompleted = match.status == 'completed' || match.status == 'evaluated';

    return InkWell(
      onTap: () => context.push('/matches/${match.id}'),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isLive ? AppColors.destructive : AppColors.border,
            width: isLive ? 1.5 : 1.0,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isLive
                        ? AppColors.destructive.withValues(alpha: 0.2)
                        : isCompleted
                            ? AppColors.success.withValues(alpha: 0.15)
                            : AppColors.voltNeon.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    isLive ? 'EN VIVO' : isCompleted ? 'FINALIZADO' : 'PRÓXIMO',
                    style: AppTypography.headline(
                      size: 10,
                      color: isLive ? AppColors.destructive : isCompleted ? AppColors.success : AppColors.voltNeon,
                    ),
                  ),
                ),
                Text(
                  match.date,
                  style: AppTypography.code(size: 11, color: AppColors.textMuted),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Enfrentamiento / Marcador
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                Expanded(
                  child: Text(
                    match.teamA?.name ?? 'Equipo A',
                    style: AppTypography.headline(size: 15, weight: FontWeight.w700),
                    textAlign: TextAlign.center,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.cardSurface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Text(
                    '${match.teamA?.score ?? 0} - ${match.teamB?.score ?? 0}',
                    style: AppTypography.sportNumber(size: 20, color: isLive ? AppColors.destructive : AppColors.textPrimary),
                  ),
                ),
                Expanded(
                  child: Text(
                    match.teamB?.name ?? 'Equipo B',
                    style: AppTypography.headline(size: 15, weight: FontWeight.w700),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
