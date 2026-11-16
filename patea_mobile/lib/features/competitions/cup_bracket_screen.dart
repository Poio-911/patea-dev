import 'competition_management.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models/competition_model.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/tournament_service.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_snack.dart';

class CupBracketScreen extends ConsumerWidget {
  final String cupId;

  const CupBracketScreen({super.key, required this.cupId});

  Future<void> _showRecordResultDialog(
    BuildContext context,
    WidgetRef ref,
    BracketMatchModel match,
  ) async {
    if (match.team1Id == null || match.team2Id == null) {
      PateaSnack.info(
        context,
        'Este partido aún no tiene ambos equipos definidos.',
      );
      return;
    }

    bool saving = false;
    int score1 = match.scoreTeam1 ?? 0;
    int score2 = match.scoreTeam2 ?? 0;

    await showDialog<void>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final c = context.c;
            return AlertDialog(
              backgroundColor: c.card,
              title: Text(
                'CARGAR RESULTADO',
                style: AppTypography.headline(
                  size: 16,
                  weight: FontWeight.w700,
                ),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _ScoreStepperRow(
                      teamName: match.team1Name ?? 'Equipo 1',
                      score: score1,
                      enabled: !saving,
                      onDecrement: score1 > 0
                          ? () => setModalState(() => score1--)
                          : null,
                      onIncrement: () => setModalState(() => score1++),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Divider(height: 1, color: c.border),
                    ),
                    _ScoreStepperRow(
                      teamName: match.team2Name ?? 'Equipo 2',
                      score: score2,
                      enabled: !saving,
                      onDecrement: score2 > 0
                          ? () => setModalState(() => score2--)
                          : null,
                      onIncrement: () => setModalState(() => score2++),
                    ),
                    if (score1 == score2) ...[
                      const SizedBox(height: 12),
                      Text(
                        'En eliminación directa debe haber un ganador.',
                        style: AppTypography.body(
                          size: 12,
                          color: c.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: saving ? null : () => Navigator.pop(context),
                  child: const Text('Cancelar'),
                ),
                FilledButton.icon(
                  onPressed: saving || score1 == score2
                      ? null
                      : () async {
                          final isTeam1Winner = score1 > score2;
                          final winnerId = isTeam1Winner
                              ? match.team1Id!
                              : match.team2Id!;
                          final winnerName = isTeam1Winner
                              ? (match.team1Name ?? 'Equipo 1')
                              : (match.team2Name ?? 'Equipo 2');
                          setModalState(() => saving = true);
                          try {
                            await ref
                                .read(tournamentServiceProvider)
                                .saveBracketMatchResult(
                                  cupId: cupId,
                                  matchId: match.id,
                                  winnerId: winnerId,
                                  winnerName: winnerName,
                                  scoreTeam1: score1,
                                  scoreTeam2: score2,
                                );

                            if (context.mounted) Navigator.pop(context);
                          } catch (error) {
                            if (context.mounted) {
                              setModalState(() => saving = false);
                              PateaSnack.error(context, error.toString());
                            }
                          }
                        },
                  icon: saving
                      ? const PateaButtonProgress()
                      : const Icon(Icons.check_rounded, size: 18),
                  label: Text(
                    saving ? 'Guardando…' : 'Guardar y avanzar',
                    style: AppTypography.action(size: 14),
                  ),
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
    final c = context.c;
    final uid = ref.watch(currentUidProvider);
    final cupStream = ref
        .watch(firestoreServiceProvider)
        .getSingleCompetitionStream(id: cupId, collection: 'cups');

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'Llaves eliminatorias',
          style: AppTypography.headline(size: 17, weight: FontWeight.w700),
        ),
      ),
      body: StreamBuilder<CompetitionModel?>(
        stream: cupStream,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator(color: c.primary));
          }

          if (snapshot.hasError) {
            return Center(
              child: Text('No se pudo cargar la copa: ${snapshot.error}'),
            );
          }
          final cup = snapshot.data;
          if (cup == null) {
            return const Center(child: Text('La copa ya no existe.'));
          }
          if (cup.bracket.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.emoji_events_outlined,
                      size: 48,
                      color: c.textSecondary,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Llaves pendientes de sorteo',
                      textAlign: TextAlign.center,
                      style: AppTypography.headline(
                        size: 16,
                        weight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Iniciá la copa desde competiciones para armar el cuadro.',
                      textAlign: TextAlign.center,
                      style: AppTypography.body(
                        size: 13,
                        color: c.textSecondary,
                      ),
                    ),
                    if (uid == cup.ownerUid) ...[
                      const SizedBox(height: 20),
                      _StartCupButton(cup: cup),
                      TextButton.icon(
                        icon: const Icon(Icons.delete_outline),
                        label: const Text('Eliminar copa'),
                        onPressed: () async {
                          try {
                            final deleted = await confirmDeleteCompetition(
                              context,
                              ref,
                              cup,
                            );
                            if (deleted && context.mounted) {
                              Navigator.pop(context);
                            }
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('No se pudo eliminar: $e'),
                                ),
                              );
                            }
                          }
                        },
                      ),
                    ],
                  ],
                ),
              ),
            );
          }

          return InteractiveViewer(
            boundaryMargin: const EdgeInsets.all(100),
            minScale: 0.4,
            maxScale: 2.5,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.all(20),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: _buildBracketColumns(
                  context,
                  ref,
                  cup.bracket,
                  canEdit: uid != null && uid == cup.ownerUid,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  List<Widget> _buildBracketColumns(
    BuildContext context,
    WidgetRef ref,
    List<BracketMatchModel> matches, {
    required bool canEdit,
  }) {
    final rounds = <String, List<BracketMatchModel>>{};
    for (final m in matches) {
      rounds.putIfAbsent(m.round, () => []).add(m);
    }

    const roundOrder = [
      'round_of_32',
      'round_of_16',
      'round_of_8',
      'semifinals',
      'final',
    ];
    final activeRounds = roundOrder.where(rounds.containsKey).toList();

    return activeRounds.map((round) {
      final roundMatches = rounds[round]!;
      return Container(
        width: 236,
        margin: const EdgeInsets.only(right: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                _getRoundLabel(round),
                style: AppTypography.headline(
                  size: 14,
                  weight: FontWeight.w700,
                  color: context.c.textSecondary,
                ),
              ),
            ),
            for (final m in roundMatches)
              InkWell(
                onTap: canEdit && m.winnerId == null
                    ? () => _showRecordResultDialog(context, ref, m)
                    : null,
                borderRadius: AppRadii.cardAll,
                child: _BracketMatchCard(
                  match: m,
                  editable: canEdit && m.winnerId == null,
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
        return '32avos de final';
      case 'round_of_16':
        return 'Octavos de final';
      case 'round_of_8':
        return 'Cuartos de final';
      case 'semifinals':
        return 'Semifinales';
      case 'final':
        return 'Final';
      default:
        return round;
    }
  }
}

class _ScoreStepperRow extends StatelessWidget {
  final String teamName;
  final int score;
  final bool enabled;
  final VoidCallback? onDecrement;
  final VoidCallback? onIncrement;

  const _ScoreStepperRow({
    required this.teamName,
    required this.score,
    required this.enabled,
    this.onDecrement,
    this.onIncrement,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          teamName,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.headline(size: 14, weight: FontWeight.w600),
        ),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            IconButton(
              icon: const Icon(Icons.remove_circle_outline),
              onPressed: enabled ? onDecrement : null,
            ),
            SizedBox(
              width: 36,
              child: Text(
                '$score',
                textAlign: TextAlign.center,
                style: AppTypography.sportNumber(size: 22),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.add_circle_outline),
              onPressed: enabled ? onIncrement : null,
            ),
          ],
        ),
      ],
    );
  }
}

class _BracketMatchCard extends StatelessWidget {
  final BracketMatchModel match;
  final bool editable;

  const _BracketMatchCard({required this.match, required this.editable});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final hasWinner = match.winnerId != null;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.card,
        borderRadius: AppRadii.cardAll,
        border: Border.all(
          color: hasWinner
              ? c.ratingAccent.withValues(alpha: 0.65)
              : editable
              ? c.primary.withValues(alpha: 0.45)
              : c.border,
          width: hasWinner ? 1.5 : 1.0,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _TeamRow(
            name: match.team1Name ?? 'Por definir',
            score: match.scoreTeam1,
            isWinner: match.winnerId != null && match.winnerId == match.team1Id,
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Divider(height: 1, color: c.border),
          ),
          _TeamRow(
            name: match.team2Name ?? 'Por definir',
            score: match.scoreTeam2,
            isWinner: match.winnerId != null && match.winnerId == match.team2Id,
          ),
          if (editable && match.team1Id != null && match.team2Id != null) ...[
            const SizedBox(height: 8),
            Text(
              'Tocar para cargar resultado',
              style: AppTypography.body(size: 11, color: c.primary),
            ),
          ],
        ],
      ),
    );
  }
}

class _TeamRow extends StatelessWidget {
  final String name;
  final int? score;
  final bool isWinner;

  const _TeamRow({required this.name, this.score, required this.isWinner});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final color = isWinner ? c.ratingAccent : c.textPrimary;
    return Row(
      children: [
        Expanded(
          child: Text(
            name,
            style: AppTypography.headline(
              size: 13,
              weight: isWinner ? FontWeight.w700 : FontWeight.w500,
              color: color,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (score != null) ...[
          const SizedBox(width: 8),
          Text(
            '$score',
            style: AppTypography.sportNumber(size: 16, color: color),
          ),
        ],
      ],
    );
  }
}

class _StartCupButton extends ConsumerStatefulWidget {
  final CompetitionModel cup;
  const _StartCupButton({required this.cup});
  @override
  ConsumerState<_StartCupButton> createState() => _StartCupButtonState();
}

class _StartCupButtonState extends ConsumerState<_StartCupButton> {
  bool _busy = false;
  @override
  Widget build(BuildContext context) => FilledButton.icon(
    onPressed: _busy
        ? null
        : () async {
            setState(() => _busy = true);
            try {
              final group = widget.cup.groupId;
              if (group == null) {
                throw StateError('La copa no tiene un grupo asociado.');
              }
              final teams = await ref.read(
                groupTeamsStreamProvider(group).future,
              );
              final selected = [
                for (final id in widget.cup.teamIds)
                  teams.firstWhere((t) => t.id == id),
              ];
              await ref
                  .read(tournamentServiceProvider)
                  .startCupTournament(
                    cupId: widget.cup.id,
                    teams: [
                      for (final t in selected) {'id': t.id, 'name': t.name},
                    ],
                  );
            } catch (e) {
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('No se pudo iniciar la copa: $e')),
                );
              }
            } finally {
              if (mounted) setState(() => _busy = false);
            }
          },
    icon: _busy
        ? const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : const Icon(Icons.shuffle),
    label: Text(_busy ? 'Sorteando…' : 'Iniciar copa y sortear llaves'),
  );
}
