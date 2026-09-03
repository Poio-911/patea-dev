import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../services/auth_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Hoja de Notificaciones (port de src/components/notification-bell.tsx)
class PateaNotificationsSheet extends ConsumerWidget {
  const PateaNotificationsSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentUser = ref.watch(authStateProvider).value;
    final uid = currentUser?.uid ?? '';

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xF20F1624),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(
          top: BorderSide(color: Colors.white.withValues(alpha: 0.15), width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.6),
            blurRadius: 32,
            offset: const Offset(0, -8),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Barra de agarre
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

            // Cabecera
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.notifications_active_rounded, color: AppColors.voltNeon, size: 22),
                    const SizedBox(width: 8),
                    Text(
                      'Notificaciones',
                      style: AppTypography.headline(
                        size: 17,
                        weight: FontWeight.w900,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                TextButton(
                  onPressed: () async {
                    if (uid.isNotEmpty) {
                      // Marcar leídas
                      final batch = FirebaseFirestore.instance.batch();
                      final unreadSnap = await FirebaseFirestore.instance
                          .collection('users')
                          .doc(uid)
                          .collection('notifications')
                          .where('isRead', isEqualTo: false)
                          .limit(20)
                          .get();
                      for (final doc in unreadSnap.docs) {
                        batch.update(doc.reference, {'isRead': true});
                      }
                      await batch.commit();
                    }
                  },
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

            // Lista de notificaciones en vivo
            SizedBox(
              height: 280,
              child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: uid.isNotEmpty
                    ? FirebaseFirestore.instance
                        .collection('users')
                        .doc(uid)
                        .collection('notifications')
                        .orderBy('createdAt', descending: true)
                        .limit(20)
                        .snapshots()
                    : const Stream.empty(),
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator(color: AppColors.voltNeon));
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
                    itemBuilder: (context, index) {
                      final data = docs[index].data();
                      final title = data['title'] ?? 'Aviso de Pateá';
                      final body = data['body'] ?? data['message'] ?? '';
                      final isRead = data['isRead'] == true;
                      final type = data['type'] as String?;

                      IconData itemIcon;
                      Color itemColor;
                      switch (type) {
                        case 'evaluation_pending':
                          itemIcon = Icons.rate_review_rounded;
                          itemColor = AppColors.voltNeon;
                          break;
                        case 'match_invite':
                        case 'match_invitation':
                          itemIcon = Icons.sports_soccer_rounded;
                          itemColor = const Color(0xFF3B82F6);
                          break;
                        default:
                          itemIcon = Icons.info_outline_rounded;
                          itemColor = AppColors.textSecondary;
                      }

                      return Container(
                        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                        decoration: BoxDecoration(
                          color: isRead ? Colors.transparent : AppColors.voltNeon.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: itemColor.withValues(alpha: 0.15),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(itemIcon, color: itemColor, size: 16),
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
                                  const SizedBox(height: 2),
                                  Text(
                                    body,
                                    style: AppTypography.body(
                                      size: 11,
                                      color: AppColors.textSecondary,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
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
                      );
                    },
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
