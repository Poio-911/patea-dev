import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/tournament_service.dart';
import '../../core/models/competition_model.dart';

class CupBracketScreen extends ConsumerWidget {
  final String cupId;

  const CupBracketScreen({super.key, required this.cupId});

  Future<void> _showRecordResultDialog(BuildContext context, WidgetRef ref, BracketMatchModel match) async {
    if (match.team1Id == null || match.team2Id == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Este partido aún no tiene ambos equipos definidos.'),
          backgroundColor: AppColors.warning,
        ),
      );
      return;
    }

    int score1 = match.scoreTeam1 ?? 0;
    int score2 = match.scoreTeam2 ?? 0;

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return AlertDialog(
              backgroundColor: AppColors.card,
              title: Text('CARGAR RESULTADO', style: AppTypography.headline(size: 16)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          match.team1Name ?? 'Equipo 1',
                          style: AppTypography.headline(size: 14),
                        ),
                      ),
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline),
                            onPressed: score1 > 0 ? () => setModalState(() => score1--) : null,
                          ),
                          Text('$score1', style: AppTypography.sportNumber(size: 18)),
                          IconButton(
                            icon: const Icon(Icons.add_circle_outline),
                            onPressed: () => setModalState(() => score1++),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const Divider(color: AppColors.border),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          match.team2Name ?? 'Equipo 2',
                          style: AppTypography.headline(size: 14),
                        ),
                      ),
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline),
                            onPressed: score2 > 0 ? () => setModalState(() => score2--) : null,
                          ),
                          Text('$score2', style: AppTypography.sportNumber(size: 18)),
                          IconButton(
                            icon: const Icon(Icons.add_circle_outline),
                            onPressed: () => setModalState(() => score2++),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancelar'),
                ),
                ElevatedButton(
                  onPressed: score1 == score2
                      ? null // No hay empates en eliminación directa
                      : () async {
                          final isTeam1Winner = score1 > score2;
                          final winnerId = isTeam1Winner ? match.team1Id! : match.team2Id!;
                          final winnerName = isTeam1Winner ? match.team1Name! : match.team2Name!;

                          await ref.read(tournamentServiceProvider).saveBracketMatchResult(
                            cupId: cupId,
                            matchId: match.id,
                            winnerId: winnerId,
                            winnerName: winnerName,
                            scoreTeam1: score1,
                            scoreTeam2: score2,
                          );

                          if (context.mounted) Navigator.pop(context);
                        },
                  child: const Text('GUARDAR Y AVANZAR'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cupStream = ref.watch(firestoreServiceProvider).getSingleCompetitionStream(
      id: cupId,
      collection: 'cups',
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'LLAVES ELIMINATORIAS',
          style: AppTypography.headline(size: 16, weight: FontWeight.w700),
        ),
      ),
      body: StreamBuilder<CompetitionModel?>(
        stream: cupStream,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final cup = snapshot.data;
          if (cup == null || cup.bracket.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.emoji_events_outlined, size: 56, color: AppColors.textMuted),
                  const SizedBox(height: 14),
                  Text(
                    'Bracket no generado aún',
                    style: AppTypography.headline(size: 16, weight: FontWeight.w700),
                  ),
                  Text(
                    'Iniciá la copa desde el panel para sortear las llaves',
                    style: AppTypography.body(size: 13, color: AppColors.textMuted),
                  ),
                ],
              ),
            );
          }

          // Renderizador interactivo con zoom & pan
          return InteractiveViewer(
            boundaryMargin: const EdgeInsets.all(100),
            minScale: 0.4,
            maxScale: 2.5,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.all(24),
              child: Row(
                children: _buildBracketColumns(context, ref, cup.bracket),
              ),
            ),
          );
        },
      ),
    );
  }

  List<Widget> _buildBracketColumns(BuildContext context, WidgetRef ref, List<BracketMatchModel> matches) {
    final rounds = <String, List<BracketMatchModel>>{};
    for (final m in matches) {
      rounds.putIfAbsent(m.round, () => []).add(m);
    }

    final roundOrder = ['round_of_32', 'round_of_16', 'round_of_8', 'semifinals', 'final'];
    final activeRounds = roundOrder.where((r) => rounds.containsKey(r)).toList();

    return activeRounds.map((round) {
      final roundMatches = rounds[round]!;
      return Container(
        width: 220,
        margin: const EdgeInsets.only(right: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(
                _getRoundLabel(round).toUpperCase(),
                style: AppTypography.headline(size: 13, color: AppColors.voltNeon),
              ),
            ),
            ...roundMatches.map(
              (m) => InkWell(
                onTap: () => _showRecordResultDialog(context, ref, m),
                borderRadius: BorderRadius.circular(12),
                child: _BracketMatchCard(match: m),
              ),
            ),
          ],
        ),
      );
    }).toList();
  }

  String _getRoundLabel(String round) {
    switch (round) {
      case 'round_of_32':
        return '32avos';
      case 'round_of_16':
        return 'Octavos';
      case 'round_of_8':
        return 'Cuartos';
      case 'semifinals':
        return 'Semifinal';
      case 'final':
        return 'Gran Final';
      default:
        return round;
    }
  }
}

class _BracketMatchCard extends StatelessWidget {
  final BracketMatchModel match;

  const _BracketMatchCard({required this.match});

  @override
  Widget build(BuildContext context) {
    final hasWinner = match.winnerId != null;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: hasWinner ? AppColors.goldBorder.withValues(alpha: 0.8) : AppColors.border,
          width: hasWinner ? 1.5 : 1.0,
        ),
        boxShadow: hasWinner
            ? [
                BoxShadow(
                  color: AppColors.goldBorder.withValues(alpha: 0.2),
                  blurRadius: 10,
                )
              ]
            : null,
      ),
      child: Column(
        children: [
          _TeamRow(
            name: match.team1Name ?? 'Por definir',
            score: match.scoreTeam1,
            isWinner: match.winnerId != null && match.winnerId == match.team1Id,
          ),
          const Divider(height: 12, color: AppColors.border),
          _TeamRow(
            name: match.team2Name ?? 'Por definir',
            score: match.scoreTeam2,
            isWinner: match.winnerId != null && match.winnerId == match.team2Id,
          ),
        ],
      ),
    );
  }
}

class _TeamRow extends StatelessWidget {
  final String name;
  final int? score;
  final bool isWinner;

  const _TeamRow({
    required this.name,
    this.score,
    required this.isWinner,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            name,
            style: AppTypography.headline(
              size: 13,
              weight: isWinner ? FontWeight.w800 : FontWeight.w500,
              color: isWinner ? AppColors.goldBorder : AppColors.textPrimary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (score != null)
          Text(
            '$score',
            style: AppTypography.sportNumber(
              size: 14,
              color: isWinner ? AppColors.goldBorder : AppColors.textPrimary,
            ),
          ),
      ],
    );
  }
}
