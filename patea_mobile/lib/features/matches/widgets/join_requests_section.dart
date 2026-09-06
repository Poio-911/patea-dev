import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../core/widgets/patea_card.dart';
import '../../../core/widgets/patea_snack.dart';
import '../../../core/widgets/patea_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/services/firestore_service.dart';
import '../../../core/services/match_service.dart';
import '../../../core/theme/patea_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_typography.dart';

/// Quién quiere entrar al partido.
///
/// Port de `JoinRequestsSection` (src/components/match-details/). Sólo la ve
/// el organizador, y sólo cuando hay algo que decidir: sin solicitudes no
/// ocupa espacio.
///
/// Se lee directo de Firestore porque `matches/{id}/joinRequests` cae bajo el
/// comodín de subcolecciones de firestore.rules, que da lectura a cualquiera
/// autenticado. Las respuestas sí pasan por Cloud Function: el documento del
/// partido tiene `allow update: if false`.
class JoinRequestsSection extends ConsumerStatefulWidget {
  final String matchId;

  const JoinRequestsSection({super.key, required this.matchId});

  @override
  ConsumerState<JoinRequestsSection> createState() => _JoinRequestsSectionState();
}

class _JoinRequestsSectionState extends ConsumerState<JoinRequestsSection> {
  String? _responding;

  Future<void> _respond(JoinRequest req, bool accepted) async {
    setState(() => _responding = req.uid);
    try {
      await ref.read(matchServiceProvider).respondJoinRequest(widget.matchId, req.uid, accepted);
      if (!mounted) return;
      PateaSnack.info(context, accepted
            ? '${req.displayName} entró al partido.'
            : 'Se rechazó a ${req.displayName}.');
    } catch (e) {
      if (!mounted) return;
      PateaSnack.error(context, '$e');
    } finally {
      if (mounted) setState(() => _responding = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final requests = ref.watch(matchJoinRequestsProvider(widget.matchId)).value ?? const <JoinRequest>[];
    if (requests.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text('QUIEREN ENTRAR',
                style: AppTypography.headline(
                    size: 11,
                    weight: FontWeight.w800,
                    color: context.c.textSecondary,
                    letterSpacing: 1.2)),
            const SizedBox(width: 8),
            PateaCard(
              color: context.c.primary,
              radius: AppRadii.pillAll,
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              child: Text('${requests.length}',
                  style: AppTypography.code(
                      size: 11, weight: FontWeight.w800, color: context.c.background)),
            ),
          ],
        ),
        const SizedBox(height: 12),
        for (final req in requests)
          _RequestRow(
            request: req,
            busy: _responding == req.uid,
            // Mientras se resuelve una, las demás quedan quietas: aceptar dos
            // a la vez puede pasarse del cupo.
            enabled: _responding == null,
            onAccept: () => _respond(req, true),
            onReject: () => _respond(req, false),
          ),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _RequestRow extends StatelessWidget {
  final JoinRequest request;
  final bool busy;
  final bool enabled;
  final VoidCallback onAccept;
  final VoidCallback onReject;

  const _RequestRow({
    required this.request,
    required this.busy,
    required this.enabled,
    required this.onAccept,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => context.push('/players/${request.uid}'),
            child: PateaAvatar(
              photoUrl: request.photoURL,
              seed: request.displayName,
              size: 42,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(request.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.headline(size: 14, weight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(
                  '${request.position}  ·  OVR ${request.ovr}',
                  style: AppTypography.body(size: 11, color: context.c.textSecondary),
                ),
              ],
            ),
          ),
          if (busy)
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 14),
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: context.c.primary),
              ),
            )
          else ...[
            _RespondButton(
              icon: Icons.close_rounded,
              color: context.c.textSecondary,
              onTap: enabled ? onReject : null,
            ),
            const SizedBox(width: 8),
            _RespondButton(
              icon: Icons.check_rounded,
              color: context.c.success,
              onTap: enabled ? onAccept : null,
            ),
          ],
        ],
      ),
    );
  }
}

class _RespondButton extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  const _RespondButton({required this.icon, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.chipAll,
      child: PateaCard(
               radius: AppRadii.chipAll,
               borderColor: color.withValues(alpha: 0.4),
               width: 36,
               height: 36,
               child: Icon(icon, size: 18, color: onTap == null ? context.c.textSecondary : color),
             ),
    );
  }
}

/// Una solicitud pendiente, con el perfil adentro: el organizador decide sin
/// tener que ir a buscar al jugador a otro lado.
class JoinRequest {
  final String uid;
  final String displayName;
  final String photoURL;
  final int ovr;
  final String position;
  final String requestedAt;

  const JoinRequest({
    required this.uid,
    required this.displayName,
    required this.photoURL,
    required this.ovr,
    required this.position,
    required this.requestedAt,
  });
}

final matchJoinRequestsProvider =
    StreamProvider.family<List<JoinRequest>, String>((ref, matchId) {
  // Sin sesión no se abre nada: un listener que sale sin token queda muerto
  // para siempre. Ver firestoreServiceProvider.
  if (ref.watch(currentUidProvider) == null) return const Stream.empty();

  return FirebaseFirestore.instance
      .collection('matches')
      .doc(matchId)
      .collection('joinRequests')
      .snapshots()
      .map((snap) {
    final requests = snap.docs.map((doc) {
      final data = doc.data();
      return JoinRequest(
        uid: (data['uid'] as String?) ?? doc.id,
        displayName: (data['displayName'] as String?) ?? 'Jugador',
        photoURL: (data['photoURL'] as String?) ?? (data['photoUrl'] as String?) ?? '',
        ovr: (data['ovr'] as num?)?.toInt() ?? 0,
        position: (data['position'] as String?) ?? '',
        requestedAt: (data['requestedAt'] as String?) ?? '',
      );
    }).toList();
    // El que pidió primero se atiende primero.
    requests.sort((a, b) => a.requestedAt.compareTo(b.requestedAt));
    return requests;
  });
});
