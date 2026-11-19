import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/services/firestore_service.dart';
import '../../core/theme/app_insets.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_help_dialog.dart';
import '../../core/widgets/patea_page_header.dart';
import '../../core/widgets/patea_section_scene.dart';
import '../../core/widgets/patea_states.dart';

class SocialFeedScreen extends ConsumerWidget {
  const SocialFeedScreen({super.key});

  String _relativeTime(dynamic timestamp) {
    DateTime? when;
    if (timestamp is Timestamp) {
      when = timestamp.toDate();
    } else if (timestamp is String) {
      when = DateTime.tryParse(timestamp);
    }
    if (when == null) return 'Actividad reciente';
    final diff = DateTime.now().difference(when);
    if (diff.inMinutes < 1) return 'Recién';
    if (diff.inMinutes < 60) return 'Hace ${diff.inMinutes} min';
    if (diff.inHours < 24) return 'Hace ${diff.inHours} h';
    if (diff.inDays < 7) return 'Hace ${diff.inDays} d';
    return 'Hace ${(diff.inDays / 7).floor()} sem';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final feedAsync = ref.watch(feedActivitiesStreamProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(
              16,
              MediaQuery.paddingOf(context).top + 12,
              16,
              12,
            ),
            child: PateaPageHeader(
              icon: Icons.forum_outlined,
              title: 'Comunidad Pateá',
              showCountRow: false,
              helpTooltip: 'Sobre la comunidad',
              onHelpTap: () => showContextualHelpSheet(
                context,
                topic: HelpTopic.community,
              ),
            ),
          ),
          Expanded(
            child: feedAsync.when(
        loading: () => const PateaLoading(),
        error: (err, _) => PateaError(
          error: err,
          message: 'No se pudo cargar la actividad de la comunidad.',
          onRetry: () => ref.invalidate(feedActivitiesStreamProvider),
        ),
        data: (docs) {
          return ListView(
            padding: EdgeInsets.fromLTRB(16, 4, 16, bottomInset(context)),
            children: [
              const PateaSectionScene(
                image: 'assets/brand/patea_ranking.webp',
                title: 'Lo que pasa en la cancha',
                description:
                    'Cambios de nivel, partidos cerrados y novedades de tus compañeros.',
              ),
              const SizedBox(height: 16),
              if (docs.isEmpty)
                PateaCard(
                  color: c.card,
                  radius: AppRadii.cardAll,
                  borderColor: c.border,
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      Icon(
                        Icons.forum_outlined,
                        size: 32,
                        color: c.textSecondary,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Todavía no hay novedades registradas',
                        textAlign: TextAlign.center,
                        style: AppTypography.headline(
                          size: 15,
                          weight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Cuando se cierren evaluaciones o cambie el OVR del plantel, van a aparecer acá.',
                        textAlign: TextAlign.center,
                        style: AppTypography.body(
                          size: 13,
                          color: c.textSecondary,
                        ),
                      ),
                    ],
                  ),
                )
              else
                PateaCard(
                  color: c.card,
                  radius: AppRadii.cardAll,
                  borderColor: c.border,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 6,
                  ),
                  child: Column(
                    children: [
                      for (var i = 0; i < docs.length; i++) ...[
                        if (i > 0) Divider(height: 1, color: c.border),
                        _FeedItemRow(
                          data: docs[i],
                          whenLabel: _relativeTime(
                            docs[i]['timestamp'] ?? docs[i]['createdAt'],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
            ],
          );
        },
      ),
          ),
        ],
      ),
    );
  }
}

class _FeedItemRow extends StatelessWidget {
  final Map<String, dynamic> data;
  final String whenLabel;

  const _FeedItemRow({required this.data, required this.whenLabel});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final type = (data['type'] as String?) ?? 'ovr_updated';
    final playerId = (data['playerId'] ?? data['userId']) as String?;
    final playerName = (data['playerName'] as String?) ?? 'Jugador';
    final photoUrl = (data['playerPhotoUrl'] ?? data['photoUrl']) as String?;
    final change = (data['change'] as num?)?.round() ?? 0;
    final newOvr = (data['newOvr'] as num?)?.round();
    final oldOvr = newOvr != null ? newOvr - change : null;
    final customMessage = (data['message'] ?? data['description']) as String?;

    final bodyText = customMessage != null && customMessage.trim().isNotEmpty
        ? customMessage.trim()
        : type == 'ovr_updated' && newOvr != null
        ? 'Actualizó su nivel a OVR $newOvr tras la última evaluación.'
        : 'Registró actividad deportiva en el grupo.';

    return InkWell(
      onTap: playerId != null && playerId.isNotEmpty
          ? () => context.push('/players/$playerId')
          : null,
      borderRadius: AppRadii.chipAll,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            PateaAvatar(
              photoUrl: photoUrl,
              seed: playerId != null && playerId.isNotEmpty
                  ? playerId
                  : playerName,
              size: 42,
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
                          playerName,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.headline(
                            size: 15,
                            weight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        whenLabel,
                        style: AppTypography.body(
                          size: 12,
                          color: c.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    bodyText,
                    style: AppTypography.body(size: 13, color: c.textPrimary),
                  ),
                  if (type == 'ovr_updated' && newOvr != null) ...[
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        if (oldOvr != null && change != 0)
                          Text.rich(
                            TextSpan(
                              style: AppTypography.code(
                                size: 12,
                                weight: FontWeight.w700,
                                color: c.ratingAccent,
                              ),
                              children: [
                                TextSpan(text: '$oldOvr '),
                                WidgetSpan(
                                  alignment: PlaceholderAlignment.middle,
                                  child: Icon(
                                    Icons.arrow_forward_rounded,
                                    size: 13,
                                    color: c.ratingAccent,
                                  ),
                                ),
                                TextSpan(text: ' $newOvr OVR'),
                              ],
                            ),
                          )
                        else
                          Text(
                            'OVR $newOvr',
                            style: AppTypography.code(
                              size: 12,
                              weight: FontWeight.w700,
                              color: c.ratingAccent,
                            ),
                          ),
                        if (change != 0)
                          Text(
                            change > 0 ? '+$change' : '$change',
                            style: AppTypography.code(
                              size: 12,
                              weight: FontWeight.w700,
                              color: change > 0 ? c.success : c.destructive,
                            ),
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
