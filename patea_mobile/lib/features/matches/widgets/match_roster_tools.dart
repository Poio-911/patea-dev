import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/match_model.dart';
import '../../../core/services/firestore_service.dart';
import '../../../core/services/match_service.dart';
import '../../../core/theme/patea_colors.dart';
import '../../../core/theme/app_typography.dart';

/// ¿Tengo una invitación pendiente a este partido? (`matches/{id}/invitations`
/// con `playerId == yo`). La mandó el organizador con "Falta uno".
final myMatchInvitationProvider = StreamProvider.family<bool, String>((
  ref,
  matchId,
) {
  final uid = ref.watch(currentUidProvider);
  if (uid == null) return const Stream<bool>.empty();
  return FirebaseFirestore.instance
      .collection('matches')
      .doc(matchId)
      .collection('invitations')
      .where('playerId', isEqualTo: uid)
      .where('status', isEqualTo: 'pending')
      .snapshots()
      .map((snap) => snap.docs.isNotEmpty);
});

/// Banner "Te invitaron": aceptar entra al partido sin otra aprobación.
class MatchInvitationBanner extends ConsumerStatefulWidget {
  final MatchModel match;

  const MatchInvitationBanner({super.key, required this.match});

  @override
  ConsumerState<MatchInvitationBanner> createState() =>
      _MatchInvitationBannerState();
}

class _MatchInvitationBannerState extends ConsumerState<MatchInvitationBanner> {
  bool _busy = false;

  Future<void> _respond(bool accepted) async {
    setState(() => _busy = true);
    try {
      await ref
          .read(matchServiceProvider)
          .respondMatchInvitation(widget.match.id, accepted);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final invited =
        ref.watch(myMatchInvitationProvider(widget.match.id)).asData?.value ??
        false;
    if (!invited || widget.match.hasFixedRoster) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.c.cardSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.c.primary.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Te invitaron a este partido',
            style: AppTypography.headline(size: 15),
          ),
          const SizedBox(height: 4),
          Text(
            'Si aceptás, quedás anotado sin que nadie tenga que aprobarte.',
            style: AppTypography.body(size: 12, color: context.c.textSecondary),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: _busy ? null : () => _respond(true),
                  child: const Text('Aceptar'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  onPressed: _busy ? null : () => _respond(false),
                  child: const Text('Rechazar'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Aviso a quien gestiona: se anotó o salió alguien y los equipos ya armados
/// no lo reflejan. Ofrece rearmarlos.
class TeamsOutOfSyncBanner extends StatelessWidget {
  final VoidCallback onRebuild;
  final bool busy;

  const TeamsOutOfSyncBanner({
    super.key,
    required this.onRebuild,
    this.busy = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.c.cardSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.c.destructive.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Icon(Icons.sync_problem_rounded, color: context.c.destructive),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'La lista de jugadores cambió: los equipos ya no están actualizados.',
              style: AppTypography.body(size: 12),
            ),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: busy ? null : onRebuild,
            child: const Text('Rearmar'),
          ),
        ],
      ),
    );
  }
}

/// Gestionar jugadores: el organizador (o el responsable de un equipo) saca a
/// alguien de la lista, y en un partido entre equipos puede deshacerlo.
class ManageRosterSection extends ConsumerStatefulWidget {
  final MatchModel match;

  const ManageRosterSection({super.key, required this.match});

  @override
  ConsumerState<ManageRosterSection> createState() =>
      _ManageRosterSectionState();
}

class _ManageRosterSectionState extends ConsumerState<ManageRosterSection> {
  bool _busy = false;

  Future<void> _remove(MatchPlayerEntry p, {bool restore = false}) async {
    if (!restore) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('¿Sacar a ${p.displayName}?'),
          content: Text(
            widget.match.hasFixedRoster
                ? 'Queda afuera sólo de este partido; el plantel del equipo no cambia. Se le avisa.'
                : 'Sale de la lista y de los equipos. Se le avisa.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Volver'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Sacar'),
            ),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() => _busy = true);
    try {
      await ref
          .read(matchServiceProvider)
          .removeMatchPlayer(widget.match.id, p.uid, restore: restore);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final match = widget.match;
    final uid = ref.watch(currentUidProvider);
    final removable = match.players
        .where((p) => p.uid.isNotEmpty && p.uid != match.ownerUid)
        .toList();
    if (removable.isEmpty && match.removedPlayers.isEmpty) {
      return const SizedBox.shrink();
    }
    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      title: Text('Gestionar jugadores', style: AppTypography.action(size: 14)),
      children: [
        for (final p in removable)
          ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            title: Text(p.displayName),
            subtitle: match.unavailablePlayerUids.contains(p.uid)
                ? const Text('Avisó que no puede ir')
                : null,
            trailing: TextButton(
              onPressed: _busy ? null : () => _remove(p),
              child: const Text('Sacar'),
            ),
          ),
        for (final p in match.removedPlayers)
          ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            title: Text(p.displayName),
            subtitle: const Text('Sacado de este partido'),
            trailing: TextButton(
              onPressed: _busy || uid == null
                  ? null
                  : () => _remove(p, restore: true),
              child: const Text('Volver a sumar'),
            ),
          ),
      ],
    );
  }
}
