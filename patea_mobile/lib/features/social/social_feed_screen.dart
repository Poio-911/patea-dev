import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';

class SocialFeedScreen extends StatelessWidget {
  const SocialFeedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final stream = FirebaseFirestore.instance
        .collection('feedActivities')
        .orderBy('createdAt', descending: true)
        .limit(25)
        .snapshots();

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'COMUNIDAD PATEÁ',
          style: AppTypography.headline(size: 18, weight: FontWeight.w800),
        ),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: stream,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final docs = snapshot.data?.docs ?? [];
          if (docs.isEmpty) {
            return Center(
              child: Text(
                'No hay publicaciones en el feed todavía.',
                style: AppTypography.body(color: AppColors.textMuted),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: docs.length,
            separatorBuilder: (_, index) => const SizedBox(height: 14),
            itemBuilder: (context, index) {
              final data = docs[index].data() as Map<String, dynamic>;
              final type = data['type'] ?? 'ovr_updated';
              final playerName = data['playerName'] ?? 'Jugador';
              final change = data['change'] ?? 0;
              final newOvr = data['newOvr'] ?? 70;

              return Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          backgroundColor: AppColors.voltNeon.withValues(alpha: 0.2),
                          child: const Icon(Icons.star, color: AppColors.voltNeon, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                playerName,
                                style: AppTypography.headline(size: 15, weight: FontWeight.w700),
                              ),
                              Text(
                                type == 'ovr_updated' ? 'Actualización de OVR' : 'Actividad deportiva',
                                style: AppTypography.code(size: 11, color: AppColors.textMuted),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: change >= 0
                                ? AppColors.success.withValues(alpha: 0.15)
                                : AppColors.destructive.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            change >= 0 ? '+$change OVR' : '$change OVR',
                            style: AppTypography.sportNumber(
                              size: 12,
                              color: change >= 0 ? AppColors.success : AppColors.destructive,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '¡$playerName ha alcanzado un nuevo OVR de $newOvr tras su última actuación en la cancha!',
                      style: AppTypography.body(color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 14),
                    const Divider(color: AppColors.border),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _ReactionButton(icon: '🔥', label: 'Fuego'),
                        _ReactionButton(icon: '👏', label: 'Aplausos'),
                        _ReactionButton(icon: '⚽', label: 'Crack'),
                      ],
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _ReactionButton extends StatefulWidget {
  final String icon;
  final String label;

  const _ReactionButton({required this.icon, required this.label});

  @override
  State<_ReactionButton> createState() => _ReactionButtonState();
}

class _ReactionButtonState extends State<_ReactionButton> {
  int count = 0;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => setState(() => count++),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Row(
          children: [
            Text(widget.icon, style: const TextStyle(fontSize: 16)),
            const SizedBox(width: 6),
            Text(
              count > 0 ? '$count' : widget.label,
              style: AppTypography.code(
                size: 11,
                color: count > 0 ? AppColors.voltNeon : AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
