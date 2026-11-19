import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/team_challenge_model.dart';
import '../../core/services/team_challenge_service.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';

/// Desafíos que recibieron los equipos que administro. Aceptar crea el partido
/// entre grupos y abre su detalle; rechazar avisa al otro equipo.
class TeamChallengesScreen extends ConsumerStatefulWidget {
  const TeamChallengesScreen({super.key});

  @override
  ConsumerState<TeamChallengesScreen> createState() =>
      _TeamChallengesScreenState();
}

class _TeamChallengesScreenState extends ConsumerState<TeamChallengesScreen> {
  /// Ids que se están respondiendo ahora: bloquea el doble toque.
  final Set<String> _busy = {};

  Future<void> _respond(
    TeamChallenge challenge, {
    required bool accepted,
  }) async {
    if (_busy.contains(challenge.id)) return;
    setState(() => _busy.add(challenge.id));
    try {
      final matchId = await ref
          .read(teamChallengeServiceProvider)
          .respondTeamChallenge(
            toTeamId: challenge.toTeamId,
            invitationId: challenge.id,
            accepted: accepted,
          );
      ref.invalidate(myTeamChallengesProvider);
      if (!mounted) return;
      if (accepted && matchId != null && matchId.isNotEmpty) {
        PateaSnack.ok(context, '¡Desafío aceptado! Ya está el partido.');
        context.push('/matches/$matchId');
      } else {
        PateaSnack.info(context, 'Desafío rechazado.');
      }
    } catch (e) {
      if (mounted) {
        PateaSnack.error(
          context,
          challengeErrorMessage(
            e,
            fallback: 'No se pudo responder. Intentá de nuevo.',
          ),
        );
        // Si ya estaba respondido (otro admin), la lista se actualiza.
        ref.invalidate(myTeamChallengesProvider);
      }
    } finally {
      if (mounted) setState(() => _busy.remove(challenge.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(myTeamChallengesProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'Desafíos recibidos',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
      ),
      body: async.when(
        loading: () => const PateaLoading(),
        error: (e, _) => PateaError(
          error: e,
          message: challengeErrorMessage(
            e,
            fallback: 'No se pudieron cargar los desafíos.',
          ),
          onRetry: () => ref.invalidate(myTeamChallengesProvider),
        ),
        data: (challenges) {
          if (challenges.isEmpty) {
            return PateaEmpty(
              icon: Icons.inbox_outlined,
              title: 'No tenés desafíos pendientes',
              hint: 'Cuando otro equipo te desafíe, lo vas a ver acá.',
              action: OutlinedButton.icon(
                onPressed: () => context.push('/challenge'),
                icon: const Icon(Icons.search, size: 18),
                label: const Text('Buscar rival'),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(myTeamChallengesProvider);
              await ref.read(myTeamChallengesProvider.future);
            },
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
              itemCount: challenges.length,
              itemBuilder: (context, i) => _ChallengeCard(
                challenge: challenges[i],
                busy: _busy.contains(challenges[i].id),
                onAccept: () => _respond(challenges[i], accepted: true),
                onDecline: () => _respond(challenges[i], accepted: false),
              ),
            ),
          );
        },
      ),
    );
  }
}

String _two(int n) => n.toString().padLeft(2, '0');

/// "12/12/2026" desde "2026-12-12"; si no se puede leer, el texto como vino.
String formatChallengeDate(String iso) {
  final d = DateTime.tryParse(iso);
  return d == null ? iso : '${_two(d.day)}/${_two(d.month)}/${d.year}';
}

class _ChallengeCard extends StatelessWidget {
  final TeamChallenge challenge;
  final bool busy;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  const _ChallengeCard({
    required this.challenge,
    required this.busy,
    required this.onAccept,
    required this.onDecline,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final proposal = [
      if (challenge.hasProposal)
        '${formatChallengeDate(challenge.proposedDate)} · ${challenge.proposedTime} hs',
      if (challenge.proposedLocationName.isNotEmpty)
        challenge.proposedLocationName,
    ].join(' · ');

    return PateaCard(
      radius: AppRadii.cardAll,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      borderColor: c.overlayLine,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              JerseyWidget(jersey: challenge.fromTeamJersey, size: 48),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      challenge.fromTeamName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.headline(
                        size: 16,
                        weight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      [
                        if (challenge.fromGroupName.isNotEmpty)
                          challenge.fromGroupName,
                        'quiere jugar contra ${challenge.toTeamName}',
                      ].join(' · '),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(
                        size: 12,
                        color: c.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (challenge.message.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              '“${challenge.message}”',
              style: AppTypography.body(size: 13, color: c.textPrimary),
            ),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.event_outlined, size: 15, color: c.textSecondary),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  proposal.isEmpty
                      ? 'Fecha y cancha a definir entre los capitanes'
                      : proposal,
                  style: AppTypography.body(size: 12, color: c.textSecondary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: busy ? null : onDecline,
                  child: const Text('Rechazar'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: busy ? null : onAccept,
                  child: busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: PateaButtonProgress(),
                        )
                      : const Text('Aceptar'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
