import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../services/auth_service.dart';
import '../theme/app_radii.dart';
import '../theme/app_typography.dart';
import '../theme/patea_colors.dart';
import 'patea_states.dart';

const int _kNotificationsLimit = 20;

CollectionReference<Map<String, dynamic>> _notificationsRef(String uid) =>
    FirebaseFirestore.instance
        .collection('users')
        .doc(uid)
        .collection('notifications');

final unreadNotificationsCountProvider = StreamProvider<int>((ref) {
  final uid = ref.watch(authStateProvider).value?.uid;
  if (uid == null || uid.isEmpty) return Stream.value(0);

  return _notificationsRef(uid)
      .where('isRead', isEqualTo: false)
      .limit(_kNotificationsLimit)
      .snapshots()
      .map((snap) => snap.docs.length);
});

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

/// Hoja de Notificaciones revisada visualmente para ambos temas y texto a 1,3×.
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
    final c = context.c;
    final currentUser = ref.watch(authStateProvider).value;
    final uid = currentUser?.uid ?? '';
    final unread = ref.watch(unreadNotificationsCountProvider).value ?? 0;

    final listHeight = (MediaQuery.sizeOf(context).height * 0.48).clamp(
      240.0,
      440.0,
    );

    return Container(
      decoration: BoxDecoration(
        color: c.popover,
        borderRadius: AppRadii.surfaceTop,
        border: Border(top: BorderSide(color: c.overlayLine, width: 1)),
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
                  color: c.overlayStrong,
                  borderRadius: AppRadii.hairAll,
                ),
              ),
            ),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Notificaciones',
                    style: AppTypography.headline(
                      size: 18,
                      weight: FontWeight.w700,
                      color: c.textPrimary,
                    ),
                  ),
                ),
                if (unread > 0)
                  TextButton(
                    onPressed: uid.isEmpty ? null : () => _markAllRead(uid),
                    child: Text(
                      'Marcar leídas',
                      style: AppTypography.action(
                        size: 13,
                        color: c.primary,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
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
                  if (snapshot.connectionState == ConnectionState.waiting &&
                      !snapshot.hasData) {
                    return const PateaLoading();
                  }

                  if (snapshot.hasError) {
                    return PateaError(
                      error: snapshot.error,
                      message: 'No se pudieron cargar las notificaciones.',
                    );
                  }

                  final docs = snapshot.data?.docs ?? [];
                  if (docs.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.notifications_none_rounded,
                            size: 38,
                            color: c.textSecondary,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Estás al día',
                            style: AppTypography.headline(
                              size: 15,
                              weight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'No tenés notificaciones pendientes.',
                            textAlign: TextAlign.center,
                            style: AppTypography.body(
                              size: 13,
                              color: c.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    );
                  }

                  return ListView.separated(
                    itemCount: docs.length,
                    separatorBuilder: (_, _) =>
                        Divider(color: c.border, height: 1),
                    itemBuilder: (context, index) =>
                        _NotificationRow(doc: docs[index]),
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
    final c = context.c;
    final data = doc.data();
    final title = (data['title'] as String?) ?? 'Aviso de Pateá';
    final message = (data['message'] ?? data['body'] ?? '') as String;
    final isRead = data['isRead'] == true;
    final link = data['link'] as String?;
    final when = _timeAgo(data['createdAt']);

    Future<void> open() async {
      if (!isRead) {
        try {
          await doc.reference.update({'isRead': true});
        } catch (e) {
          assert(() {
            debugPrint('Error al marcar notificación como leída: $e');
            return true;
          }());
        }
      }
      if (!context.mounted) return;
      Navigator.pop(context);
      if (link != null && link.isNotEmpty) {
        const shellRoots = {
          '/',
          '/players',
          '/matches',
          '/competitions',
          '/social',
          '/explorar',
          '/evaluations',
        };
        if (shellRoots.contains(link)) {
          context.go(link);
        } else {
          context.push(link);
        }
      }
    }

    return InkWell(
      onTap: open,
      borderRadius: AppRadii.chipAll,
      child: Container(
        decoration: BoxDecoration(
          color: isRead
              ? Colors.transparent
              : c.primary.withValues(alpha: 0.08),
          borderRadius: AppRadii.chipAll,
        ),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: c.cardSurface,
                shape: BoxShape.circle,
                border: Border.all(color: c.border),
              ),
              child: Icon(
                _iconForType(data['type'] as String?),
                color: isRead ? c.textSecondary : c.primary,
                size: 17,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: AppTypography.headline(
                            size: 14,
                            weight: isRead ? FontWeight.w600 : FontWeight.w700,
                            color: c.textPrimary,
                          ),
                        ),
                      ),
                      if (when.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Text(
                          when,
                          style: AppTypography.body(
                            size: 12,
                            color: c.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (message.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      message,
                      style: AppTypography.body(
                        size: 13,
                        color: c.textSecondary,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            if (!isRead)
              Container(
                width: 7,
                height: 7,
                margin: const EdgeInsets.only(top: 6, left: 8),
                decoration: BoxDecoration(
                  color: c.primary,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
