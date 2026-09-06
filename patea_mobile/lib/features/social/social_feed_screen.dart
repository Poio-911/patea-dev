import 'package:flutter/material.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/theme/app_radii.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/services/firestore_service.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';

class SocialFeedScreen extends ConsumerWidget {
  const SocialFeedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feedAsync = ref.watch(feedActivitiesStreamProvider);

    return Scaffold(
      // El router envuelve esta ruta en `PateaBackground`. Sin esto, el
      // Scaffold pinta su color opaco encima y tapa la foto de cancha.
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'COMUNIDAD PATEÁ',
          style: AppTypography.headline(size: 18, weight: FontWeight.w800),
        ),
      ),
      body: Builder(
        builder: (context) {
          if (feedAsync.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          final docs = feedAsync.value ?? const <Map<String, dynamic>>[];
          if (docs.isEmpty) {
            return Center(
              child: Text(
                'No hay publicaciones en el feed todavía.',
                style: AppTypography.body(color: context.c.textSecondary),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: docs.length,
            separatorBuilder: (_, index) => const SizedBox(height: 14),
            itemBuilder: (context, index) {
              final data = docs[index];
              final type = data['type'] ?? 'ovr_updated';
              final playerName = data['playerName'] ?? 'Jugador';
              final change = data['change'] ?? 0;
              final newOvr = data['newOvr'] ?? 70;

              return PateaCard(
                       color: context.c.card,
                       radius: AppRadii.cardAll,
                       borderColor: context.c.border,
                       padding: const EdgeInsets.all(16),
                       child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          backgroundColor: context.c.brandVolt.withValues(alpha: 0.2),
                          child: Icon(Icons.star, color: context.c.primary, size: 20),
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
                                style: AppTypography.code(size: 11, color: context.c.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: change >= 0
                                ? context.c.success.withValues(alpha: 0.15)
                                : context.c.destructive.withValues(alpha: 0.15),
                            borderRadius: AppRadii.chipAll,
                          ),
                          child: Text(
                            change >= 0 ? '+$change OVR' : '$change OVR',
                            style: AppTypography.sportNumber(
                              size: 12,
                              color: change >= 0 ? context.c.success : context.c.destructive,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '¡$playerName ha alcanzado un nuevo OVR de $newOvr tras su última actuación en la cancha!',
                      style: AppTypography.body(color: context.c.textPrimary),
                    ),
                    const SizedBox(height: 14),
                    Divider(color: context.c.border),
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
      borderRadius: AppRadii.chipAll,
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
                color: count > 0 ? context.c.primary : context.c.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
