import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import '../services/auth_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_radii.dart';
import '../theme/app_typography.dart';

/// Cuántas notificaciones se leen de una. Mismo número que usa la web
/// (`notification-bell.tsx`, `limit(20)`), y el mismo que marca "leídas".
const int _kNotificationsLimit = 20;

CollectionReference<Map<String, dynamic>> _notificationsRef(String uid) =>
    FirebaseFirestore.instance.collection('users').doc(uid).collection('notifications');

/// No leídas del usuario actual. Lo consume el punto de la campana en
/// [PateaTopHeader]: la web lo tiene desde siempre y en el móvil la campana
/// nunca mostró estado, así que no había forma de enterarse de nada sin abrir
/// la hoja a mano.
final unreadNotificationsCountProvider = StreamProvider<int>((ref) {
  final uid = ref.watch(authStateProvider).value?.uid;
  if (uid == null || uid.isEmpty) return Stream.value(0);

  return _notificationsRef(uid)
      .where('isRead', isEqualTo: false)
      .limit(_kNotificationsLimit)
      .snapshots()
      .map((snap) => snap.docs.length);
});

/// Ícono por tipo de notificación.
///
/// La web mapea los 15 tipos de `NotificationType` en `notification-bell.tsx`;
/// acá había tres y los otros doce caían en un ícono genérico de info.
IconData _iconForType(String? type) {
  switch (type) {
    case 'match_invite':
      return Icons.sports_soccer_rounded;
    case 'new_joiner':
      return Icons.person_add_alt_1_rounded;
    case 'evaluation_pending':
      return Icons.rate_review_rounded;
    case 'match_update':
      return Icons.info_outline_rounded;
    case 'challenge_received':
      return Icons.sports_kabaddi_rounded;
    case 'challenge_accepted':
      return Icons.check_circle_outline_rounded;
    case 'challenge_rejected':
      return Icons.cancel_outlined;
    case 'league_application':
    case 'cup_application':
      return Icons.description_outlined;
    case 'new_follower':
      return Icons.group_add_outlined;
    case 'match_invitation':
      return Icons.event_available_rounded;
    case 'match_reminder':
      return Icons.alarm_rounded;
    case 'ovr_milestone':
      return Icons.trending_up_rounded;
    case 'achievement_unlocked':
      return Icons.emoji_events_rounded;
    case 'identity_reveal_requested':
      return Icons.shield_outlined;
    default:
      return Icons.info_outline_rounded;
  }
}

/// "hace 5 min", "hace 3 h", "hace 2 d".
///
/// La web usa `formatDistanceToNow` de date-fns con locale español. Traer una
/// dependencia entera para esto no se justifica; `createdAt` se guarda como
/// ISO 8601 desde las Cloud Functions.
String _timeAgo(dynamic createdAt) {
  DateTime? when;
  if (createdAt is Timestamp) {
    when = createdAt.toDate();
  } else if (createdAt is String) {
    when = DateTime.tryParse(createdAt);
  }
  if (when == null) return '';

  final diff = DateTime.now().difference(when);
  if (diff.inMinutes < 1) return 'recién';
  if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} min';
  if (diff.inHours < 24) return 'hace ${diff.inHours} h';
  if (diff.inDays < 7) return 'hace ${diff.inDays} d';
  return 'hace ${(diff.inDays / 7).floor()} sem';
}

/// Hoja de Notificaciones (port de `src/components/notification-bell.tsx`).
class PateaNotificationsSheet extends ConsumerWidget {
  const PateaNotificationsSheet({super.key});

  Future<void> _markAllRead(String uid) async {
    final unread = await _notificationsRef(uid)
        .where('isRead', isEqualTo: false)
        .limit(_kNotificationsLimit)
        .get();
    if (unread.docs.isEmpty) return;

    final batch = FirebaseFirestore.instance.batch();
    for (final doc in unread.docs) {
      batch.update(doc.reference, {'isRead': true});
    }
    await batch.commit();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentUser = ref.watch(authStateProvider).value;
    final uid = currentUser?.uid ?? '';
    final unread = ref.watch(unreadNotificationsCountProvider).value ?? 0;

    // La web le da una ventana de 384px (`h-96`). Acá estaba fija en 280, que
    // en un teléfono alto desperdicia media pantalla.
    final listHeight = (MediaQuery.sizeOf(context).height * 0.45).clamp(240.0, 420.0);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.popover,
        borderRadius: AppRadii.surfaceTop,
        border: Border(
          top: BorderSide(color: Colors.white.withValues(alpha: 0.15), width: 1),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Notificaciones',
                  style: AppTypography.headline(
                    size: 17,
                    weight: FontWeight.w900,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (unread > 0)
                  TextButton(
                    onPressed: uid.isEmpty ? null : () => _markAllRead(uid),
                    child: Text(
                      'Marcar leídas',
                      style: AppTypography.body(
                        size: 12,
                        weight: FontWeight.w700,
                        color: AppColors.voltNeon,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),

            SizedBox(
              height: listHeight,
              child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: uid.isNotEmpty
                    ? _notificationsRef(uid)
                        .orderBy('createdAt', descending: true)
                        .limit(_kNotificationsLimit)
                        .snapshots()
                    : const Stream.empty(),
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(
                      child: CircularProgressIndicator(color: AppColors.voltNeon),
                    );
                  }

                  final docs = snapshot.data?.docs ?? [];
                  if (docs.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.notifications_off_outlined,
                            size: 40,
                            color: Colors.white.withValues(alpha: 0.2),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'No tenés notificaciones pendientes',
                            style: AppTypography.body(
                              size: 13,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    );
                  }

                  return ListView.separated(
                    itemCount: docs.length,
                    separatorBuilder: (context, index) => Divider(
                      color: Colors.white.withValues(alpha: 0.06),
                      height: 1,
                    ),
                    itemBuilder: (context, index) => _NotificationRow(doc: docs[index]),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotificationRow extends StatelessWidget {
  final QueryDocumentSnapshot<Map<String, dynamic>> doc;

  const _NotificationRow({required this.doc});

  @override
  Widget build(BuildContext context) {
    final data = doc.data();
    final title = (data['title'] as String?) ?? 'Aviso de Pateá';
    final message = (data['message'] ?? data['body'] ?? '') as String;
    final isRead = data['isRead'] == true;
    final link = data['link'] as String?;
    final when = _timeAgo(data['createdAt']);

    // Cada notificación trae a dónde ir (`link`, lo escriben las Cloud
    // Functions: /matches/:id, /evaluations/:matchId, /players/:id — las tres
    // existen en el router del móvil). La web envuelve cada fila en un
    // `<Link>`; acá las filas eran `Container` sin `onTap`, así que te
    // enterabas de que te habían invitado a un partido y no podías ir.
    Future<void> open() async {
      if (!isRead) {
        // Si no, el punto de la campana no se apaga nunca sin usar
        // "marcar leídas".
        await doc.reference.update({'isRead': true});
      }
      if (!context.mounted) return;
      Navigator.pop(context);
      if (link != null && link.isNotEmpty) context.push(link);
    }

    return InkWell(
      onTap: open,
      borderRadius: AppRadii.cardAll,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: isRead ? Colors.transparent : AppColors.voltNeon.withValues(alpha: 0.10),
          borderRadius: AppRadii.cardAll,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // La web pinta todos los íconos igual (`bg-card/70`, borde,
            // `text-foreground`) — el tipo lo dice el dibujo, no el color.
            // Acá había un volt para evaluaciones y un azul `#3B82F6` suelto
            // para partidos, que no sale de ninguna paleta del proyecto.
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: AppColors.card,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
              ),
              child: Icon(
                _iconForType(data['type'] as String?),
                color: AppColors.textPrimary,
                size: 16,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTypography.headline(
                      size: 13,
                      weight: isRead ? FontWeight.w600 : FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  if (message.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      message,
                      style: AppTypography.body(size: 11, color: AppColors.textSecondary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (when.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      when,
                      style: AppTypography.body(size: 10, color: AppColors.textMuted),
                    ),
                  ],
                ],
              ),
            ),
            if (!isRead)
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 4, left: 6),
                decoration: const BoxDecoration(
                  color: AppColors.voltNeon,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
