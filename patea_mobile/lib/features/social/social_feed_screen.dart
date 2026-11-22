import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/models/match_model.dart';
import '../../core/models/social_models.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/social_service.dart';
import '../../core/theme/app_insets.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_help_dialog.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';

class SocialFeedScreen extends ConsumerStatefulWidget {
  const SocialFeedScreen({super.key});

  @override
  ConsumerState<SocialFeedScreen> createState() => _SocialFeedScreenState();
}

class _SocialFeedScreenState extends ConsumerState<SocialFeedScreen> {
  int _tab = 0; // 0 = Mi Grupo, 1 = Siguiendo / Comunidad
  bool _onlyFollowingInTab1 = false;

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(authStateProvider).value?.uid;
    final followingSet =
        ref.watch(followingUidsStreamProvider).value ?? const <String>{};
    final groupFeedAsync = ref.watch(groupSocialFeedStreamProvider);
    final communityFeedAsync = ref.watch(communitySocialFeedStreamProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(
              16,
              MediaQuery.paddingOf(context).top + 12,
              16,
              10,
            ),
            child: Row(
              children: [
                Icon(
                  Icons.forum_outlined,
                  size: 26,
                  color: context.c.primary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Comunidad Pateá',
                    style: AppTypography.headline(
                      size: 24,
                      weight: FontWeight.w800,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Buscar jugadores para seguir',
                  onPressed: () => _DiscoverPlayersSheet.show(context),
                  icon: const Icon(Icons.person_add_alt_1_outlined),
                ),
                IconButton(
                  tooltip: 'Sobre la comunidad',
                  onPressed: () => showContextualHelpSheet(
                    context,
                    topic: HelpTopic.community,
                  ),
                  icon: const Icon(Icons.help_outline_rounded, size: 21),
                ),
                const SizedBox(width: 4),
                FilledButton.icon(
                  onPressed: () => CreateSocialPostSheet.show(context),
                  icon: const Icon(Icons.add_photo_alternate_outlined, size: 17),
                  label: const Text('Publicar'),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Tabs: Mi Grupo vs Siguiendo / Comunidad
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: _FeedTabButton(
                    label: 'Mi Grupo',
                    icon: Icons.groups_outlined,
                    selected: _tab == 0,
                    onTap: () => setState(() => _tab = 0),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _FeedTabButton(
                    label: followingSet.isEmpty
                        ? 'Siguiendo · Global'
                        : 'Siguiendo (${followingSet.length})',
                    icon: Icons.public_outlined,
                    selected: _tab == 1,
                    onTap: () => setState(() => _tab = 1),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          Expanded(
            child: _tab == 0
                ? _buildFeedList(
                    context: context,
                    feedAsync: groupFeedAsync,
                    uid: uid,
                    followingSet: followingSet,
                    isGroupTab: true,
                    onRefresh: () async =>
                        ref.invalidate(groupSocialFeedStreamProvider),
                  )
                : _buildFeedList(
                    context: context,
                    feedAsync: communityFeedAsync,
                    uid: uid,
                    followingSet: followingSet,
                    isGroupTab: false,
                    onRefresh: () async =>
                        ref.invalidate(communitySocialFeedStreamProvider),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeedList({
    required BuildContext context,
    required AsyncValue<List<SocialPostModel>> feedAsync,
    required String? uid,
    required Set<String> followingSet,
    required bool isGroupTab,
    required Future<void> Function() onRefresh,
  }) {
    return feedAsync.when(
      loading: () => const PateaLoading(),
      error: (err, _) => PateaError(
        error: err,
        message: 'No se pudo cargar el feed de la comunidad.',
        onRetry: onRefresh,
      ),
      data: (allPosts) {
        final posts = (!isGroupTab && _onlyFollowingInTab1)
            ? allPosts
                  .where(
                    (p) =>
                        followingSet.contains(p.userId) ||
                        (uid != null && p.userId == uid),
                  )
                  .toList()
            : allPosts;

        return RefreshIndicator(
          onRefresh: onRefresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(16, 6, 16, bottomInset(context)),
            children: [
              if (!isGroupTab) ...[
                PateaCard(
                  color: context.c.card,
                  radius: AppRadii.cardAll,
                  borderColor: context.c.border.withValues(alpha: 0.45),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.person_search_outlined,
                        size: 20,
                        color: context.c.primary,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Seguí jugadores de otros grupos',
                              style: AppTypography.body(
                                size: 13,
                                weight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              followingSet.isEmpty
                                  ? 'Descubrí cracks y mirá sus partidos y momentos.'
                                  : 'Seguís a ${followingSet.length} ${followingSet.length == 1 ? 'jugador' : 'jugadores'}.',
                              style: AppTypography.body(
                                size: 11,
                                color: context.c.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (followingSet.isNotEmpty)
                        FilterChip(
                          label: const Text('Solo seguidos'),
                          selected: _onlyFollowingInTab1,
                          onSelected: (v) =>
                              setState(() => _onlyFollowingInTab1 = v),
                        ),
                      const SizedBox(width: 6),
                      TextButton(
                        onPressed: () => _DiscoverPlayersSheet.show(context),
                        child: const Text('Buscar'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (posts.isEmpty)
                PateaCard(
                  color: context.c.card,
                  radius: AppRadii.cardAll,
                  borderColor: context.c.border,
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Icon(
                        Icons.photo_camera_outlined,
                        size: 36,
                        color: context.c.primary,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        isGroupTab
                            ? 'Estrená el muro de tu grupo'
                            : (_onlyFollowingInTab1
                                  ? 'Los jugadores que seguís todavía no publicaron'
                                  : 'Todavía no hay publicaciones'),
                        textAlign: TextAlign.center,
                        style: AppTypography.headline(
                          size: 16,
                          weight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Subí una foto del partido, armá una encuesta para el grupo o reaccioná a los resultados y MVPs.',
                        textAlign: TextAlign.center,
                        style: AppTypography.body(
                          size: 13,
                          color: context.c.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 14),
                      FilledButton.icon(
                        onPressed: () => CreateSocialPostSheet.show(context),
                        icon: const Icon(Icons.add_a_photo_outlined, size: 17),
                        label: const Text('Crear primera publicación'),
                      ),
                    ],
                  ),
                )
              else
                for (final post in posts) ...[
                  _SocialPostCard(
                    post: post,
                    currentUid: uid,
                    isFollowingAuthor: followingSet.contains(post.userId),
                  ),
                  const SizedBox(height: 14),
                ],
            ],
          ),
        );
      },
    );
  }
}

class _FeedTabButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _FeedTabButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: AppRadii.pillAll,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 12),
        decoration: BoxDecoration(
          color: selected
              ? context.c.primary.withValues(alpha: 0.16)
              : context.c.card,
          borderRadius: AppRadii.pillAll,
          border: Border.all(
            color: selected ? context.c.primary : context.c.border,
            width: selected ? 1.4 : 1,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 16,
              color: selected ? context.c.primary : context.c.textSecondary,
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.body(
                  size: 12,
                  weight: selected ? FontWeight.w700 : FontWeight.w600,
                  color: selected ? context.c.textPrimary : context.c.textSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _relativeTime(DateTime when) {
  if (when.millisecondsSinceEpoch == 0) return 'Reciente';
  final diff = DateTime.now().difference(when);
  if (diff.inMinutes < 1) return 'Recién';
  if (diff.inMinutes < 60) return 'Hace ${diff.inMinutes} min';
  if (diff.inHours < 24) return 'Hace ${diff.inHours} h';
  if (diff.inDays < 7) return 'Hace ${diff.inDays} d';
  return 'Hace ${(diff.inDays / 7).floor()} sem';
}

class _SocialPostCard extends ConsumerStatefulWidget {
  final SocialPostModel post;
  final String? currentUid;
  final bool isFollowingAuthor;

  const _SocialPostCard({
    required this.post,
    required this.currentUid,
    required this.isFollowingAuthor,
  });

  @override
  ConsumerState<_SocialPostCard> createState() => _SocialPostCardState();
}

class _SocialPostCardState extends ConsumerState<_SocialPostCard> {
  bool _togglingFollow = false;

  Future<void> _react(String reaction) async {
    try {
      await ref.read(socialServiceProvider).toggleReaction(
            activityId: widget.post.id,
            reaction: reaction,
          );
    } catch (e) {
      if (mounted) PateaSnack.error(context, '$e');
    }
  }

  Future<void> _vote(String optionId) async {
    try {
      await ref.read(socialServiceProvider).votePoll(
            activityId: widget.post.id,
            optionId: optionId,
          );
    } catch (e) {
      if (mounted) PateaSnack.error(context, '$e');
    }
  }

  Future<void> _toggleFollow() async {
    if (_togglingFollow || widget.post.userId.isEmpty) return;
    setState(() => _togglingFollow = true);
    try {
      final nowFollowing = await ref
          .read(socialServiceProvider)
          .toggleFollow(widget.post.userId);
      if (mounted) {
        PateaSnack.ok(
          context,
          nowFollowing
              ? 'Ahora seguís a ${widget.post.playerName}'
              : 'Dejaste de seguir a ${widget.post.playerName}',
        );
      }
    } catch (e) {
      if (mounted) PateaSnack.error(context, '$e');
    } finally {
      if (mounted) setState(() => _togglingFollow = false);
    }
  }

  Future<void> _deletePost() async {
    try {
      await ref.read(socialServiceProvider).deletePost(widget.post.id);
      if (mounted) PateaSnack.ok(context, 'Publicación eliminada');
    } catch (e) {
      if (mounted) PateaSnack.error(context, '$e');
    }
  }

  String _autoHeadline(SocialPostModel post) {
    if (post.text.trim().isNotEmpty) return post.text.trim();
    switch (post.type) {
      case 'match_played':
        return 'Terminó el partido ${post.matchTitle ?? ''}.';
      case 'match_evaluated':
        return post.mvpName != null
            ? '¡${post.mvpName} fue elegido MVP del partido!'
            : 'Se cerraron las evaluaciones del partido.';
      case 'ovr_updated':
      case 'ovr_increased':
        return post.newOvr != null
            ? 'Actualizó su nivel a OVR ${post.newOvr}.'
            : 'Actualizó su nivel tras la evaluación.';
      default:
        return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    final isMine =
        widget.currentUid != null && post.userId == widget.currentUid;
    final headline = _autoHeadline(post);

    return PateaCard(
      color: context.c.card,
      radius: AppRadii.cardAll,
      borderColor: context.c.border.withValues(alpha: 0.45),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header de autor estilo Instagram
          Row(
            children: [
              InkWell(
                borderRadius: AppRadii.pillAll,
                onTap: () => _PlayerSocialProfileSheet.show(
                  context,
                  uid: post.userId,
                  name: post.playerName,
                  photoUrl: post.playerPhotoUrl,
                  position: post.playerPosition,
                  ovr: post.playerOvr,
                ),
                child: Row(
                  children: [
                    PateaAvatar(
                      photoUrl: post.playerPhotoUrl,
                      seed: post.userId.isNotEmpty
                          ? post.userId
                          : post.playerName,
                      size: 40,
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              post.playerName,
                              style: AppTypography.headline(
                                size: 14,
                                weight: FontWeight.w700,
                              ),
                            ),
                            if (post.playerPosition.isNotEmpty ||
                                post.playerOvr > 0) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 1,
                                ),
                                decoration: BoxDecoration(
                                  color: context.c.cardSurface,
                                  borderRadius: AppRadii.pillAll,
                                ),
                                child: Text(
                                  [
                                    if (post.playerPosition.isNotEmpty)
                                      post.playerPosition,
                                    if (post.playerOvr > 0) '${post.playerOvr}',
                                  ].join(' · '),
                                  style: AppTypography.code(
                                    size: 10,
                                    weight: FontWeight.w700,
                                    color: context.c.primary,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        Text(
                          _relativeTime(post.createdAt),
                          style: AppTypography.body(
                            size: 11,
                            color: context.c.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const Spacer(),
              if (!isMine && post.userId.isNotEmpty)
                TextButton(
                  onPressed: _togglingFollow ? null : _toggleFollow,
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    minimumSize: Size.zero,
                  ),
                  child: Text(
                    widget.isFollowingAuthor ? 'Siguiendo' : 'Seguir',
                    style: AppTypography.body(
                      size: 12,
                      weight: FontWeight.w700,
                      color: widget.isFollowingAuthor
                          ? context.c.textSecondary
                          : context.c.primary,
                    ),
                  ),
                ),
              if (isMine)
                IconButton(
                  icon: Icon(
                    Icons.delete_outline,
                    size: 18,
                    color: context.c.textSecondary,
                  ),
                  tooltip: 'Eliminar publicación',
                  onPressed: _deletePost,
                ),
            ],
          ),

          if (headline.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              headline,
              style: AppTypography.body(
                size: 14,
                color: context.c.textPrimary,
              ),
            ),
          ],

          // Foto con doble tap para reaccionar
          if (post.imageUrl != null && post.imageUrl!.isNotEmpty) ...[
            const SizedBox(height: 10),
            GestureDetector(
              onDoubleTap: () => _react('🔥'),
              child: ClipRRect(
                borderRadius: AppRadii.cardAll,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 340),
                  child: Image.network(
                    post.imageUrl!,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Container(
                      height: 160,
                      color: context.c.cardSurface,
                      child: Center(
                        child: Icon(
                          Icons.broken_image_outlined,
                          color: context.c.textSecondary,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],

          // Tarjeta deportiva embebida (partido / marcador / MVP / salto de OVR)
          if (post.hasMatchCard || post.newOvr != null || post.mvpName != null) ...[
            const SizedBox(height: 10),
            _MatchHighlightCard(post: post),
          ],

          // Encuesta rápida interactiva
          if (post.poll != null) ...[
            const SizedBox(height: 10),
            _SocialPollCard(
              poll: post.poll!,
              currentUid: widget.currentUid,
              onVote: _vote,
            ),
          ],

          const SizedBox(height: 12),
          Divider(height: 1, color: context.c.border.withValues(alpha: 0.4)),
          const SizedBox(height: 10),

          // Barra de reacciones futboleras + Comentarios
          Wrap(
            spacing: 6,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              for (final emoji in kSocialReactions)
                _ReactionChip(
                  emoji: emoji,
                  count: post.reactionCount(emoji),
                  selected: post.hasReacted(emoji, widget.currentUid),
                  onTap: () => _react(emoji),
                ),
              InkWell(
                borderRadius: AppRadii.pillAll,
                onTap: () => _SocialCommentsSheet.show(context, post),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: context.c.cardSurface,
                    borderRadius: AppRadii.pillAll,
                    border: Border.all(color: context.c.border),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.chat_bubble_outline_rounded,
                        size: 14,
                        color: context.c.textSecondary,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        post.commentCount > 0
                            ? '${post.commentCount}'
                            : 'Comentar',
                        style: AppTypography.body(
                          size: 11,
                          weight: FontWeight.w600,
                          color: context.c.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ReactionChip extends StatelessWidget {
  final String emoji;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  const _ReactionChip({
    required this.emoji,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: AppRadii.pillAll,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(
          color: selected
              ? context.c.primary.withValues(alpha: 0.18)
              : context.c.cardSurface,
          borderRadius: AppRadii.pillAll,
          border: Border.all(
            color: selected ? context.c.primary : context.c.border,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 13)),
            if (count > 0) ...[
              const SizedBox(width: 4),
              Text(
                '$count',
                style: AppTypography.code(
                  size: 11,
                  weight: FontWeight.w700,
                  color: selected ? context.c.primary : context.c.textPrimary,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MatchHighlightCard extends StatelessWidget {
  final SocialPostModel post;

  const _MatchHighlightCard({required this.post});

  @override
  Widget build(BuildContext context) {
    final hasScore = post.teamAName != null && post.teamBName != null;
    final change = post.ovrChange ?? 0;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.c.cardSurface,
        borderRadius: AppRadii.chipAll,
        border: Border.all(color: context.c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (post.matchTitle != null && post.matchTitle!.isNotEmpty)
            Row(
              children: [
                Icon(Icons.sports_soccer, size: 16, color: context.c.primary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    post.matchTitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.body(
                      size: 13,
                      weight: FontWeight.w700,
                    ),
                  ),
                ),
                if (post.matchId != null && post.matchId!.isNotEmpty)
                  TextButton(
                    onPressed: () => context.push('/matches/${post.matchId}'),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      minimumSize: Size.zero,
                    ),
                    child: const Text('Ver partido'),
                  ),
              ],
            ),
          if (hasScore) ...[
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Expanded(
                  child: Text(
                    post.teamAName!,
                    textAlign: TextAlign.right,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.body(size: 13, weight: FontWeight.w700),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text(
                    '${post.teamAScore ?? 0} - ${post.teamBScore ?? 0}',
                    style: AppTypography.sportNumber(
                      size: 20,
                      color: context.c.primary,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    post.teamBName!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.body(size: 13, weight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ],
          if (post.mvpName != null && post.mvpName!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(Icons.emoji_events_outlined, size: 16, color: context.c.ratingAccent),
                const SizedBox(width: 6),
                Text(
                  'MVP: ${post.mvpName}',
                  style: AppTypography.body(
                    size: 12,
                    weight: FontWeight.w700,
                    color: context.c.ratingAccent,
                  ),
                ),
              ],
            ),
          ],
          if (post.newOvr != null) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(
                  change >= 0 ? Icons.trending_up : Icons.trending_down,
                  size: 16,
                  color: change >= 0 ? context.c.success : context.c.destructive,
                ),
                const SizedBox(width: 6),
                Text(
                  post.oldOvr != null
                      ? 'OVR ${post.oldOvr} → ${post.newOvr} (${change >= 0 ? '+$change' : '$change'})'
                      : 'OVR ${post.newOvr}',
                  style: AppTypography.code(
                    size: 12,
                    weight: FontWeight.w700,
                    color: change >= 0 ? context.c.success : context.c.destructive,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _SocialPollCard extends StatelessWidget {
  final SocialPollModel poll;
  final String? currentUid;
  final ValueChanged<String> onVote;

  const _SocialPollCard({
    required this.poll,
    required this.currentUid,
    required this.onVote,
  });

  @override
  Widget build(BuildContext context) {
    final myVote = poll.userVote(currentUid);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.c.cardSurface,
        borderRadius: AppRadii.chipAll,
        border: Border.all(color: context.c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.poll_outlined, size: 16, color: context.c.primary),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  poll.question,
                  style: AppTypography.body(size: 13, weight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          for (final opt in poll.options) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: InkWell(
                borderRadius: AppRadii.chipAll,
                onTap: () => onVote(opt.id),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: myVote == opt.id
                        ? context.c.primary.withValues(alpha: 0.16)
                        : context.c.card,
                    borderRadius: AppRadii.chipAll,
                    border: Border.all(
                      color: myVote == opt.id
                          ? context.c.primary
                          : context.c.border,
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          opt.text,
                          style: AppTypography.body(
                            size: 12,
                            weight: myVote == opt.id
                                ? FontWeight.w700
                                : FontWeight.w500,
                          ),
                        ),
                      ),
                      Text(
                        '${(poll.ratioFor(opt.id) * 100).round()}% (${poll.votesFor(opt.id)})',
                        style: AppTypography.code(
                          size: 11,
                          color: context.c.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
          Text(
            '${poll.totalVotes} ${poll.totalVotes == 1 ? 'voto' : 'votos'}',
            style: AppTypography.body(
              size: 11,
              color: context.c.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

/// Hoja para crear una publicación en Comunidad Pateá (desde el feed o desde el
/// detalle de un partido).
class CreateSocialPostSheet extends ConsumerStatefulWidget {
  final MatchModel? initialMatch;

  const CreateSocialPostSheet({super.key, this.initialMatch});

  static Future<void> show(BuildContext context, {MatchModel? initialMatch}) {
    return showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: context.c.card,
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceTop),
      builder: (_) => CreateSocialPostSheet(initialMatch: initialMatch),
    );
  }

  @override
  ConsumerState<CreateSocialPostSheet> createState() =>
      _CreateSocialPostSheetState();
}

class _CreateSocialPostSheetState extends ConsumerState<CreateSocialPostSheet> {
  final _textController = TextEditingController();
  final _pollQuestionController = TextEditingController();
  final _pollOpt1Controller = TextEditingController();
  final _pollOpt2Controller = TextEditingController();
  final _pollOpt3Controller = TextEditingController();
  File? _imageFile;
  String? _selectedMatchId;
  bool _withPoll = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _selectedMatchId = widget.initialMatch?.id;
  }

  @override
  void dispose() {
    _textController.dispose();
    _pollQuestionController.dispose();
    _pollOpt1Controller.dispose();
    _pollOpt2Controller.dispose();
    _pollOpt3Controller.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final xfile = await picker.pickImage(
      source: source,
      maxWidth: 1440,
      imageQuality: 85,
    );
    if (xfile == null || !mounted) return;
    setState(() => _imageFile = File(xfile.path));
  }

  Future<void> _submit() async {
    final text = _textController.text.trim();
    final hasPoll = _withPoll &&
        _pollQuestionController.text.trim().length >= 3 &&
        _pollOpt1Controller.text.trim().isNotEmpty &&
        _pollOpt2Controller.text.trim().isNotEmpty;

    if (text.isEmpty && _imageFile == null && !hasPoll && _selectedMatchId == null) {
      PateaSnack.error(
        context,
        'Escribí algo, subí una foto o agregá una encuesta.',
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      String? uploadedUrl;
      if (_imageFile != null) {
        uploadedUrl = await ref
            .read(socialServiceProvider)
            .uploadPostImage(_imageFile!);
      }

      final activeGroupId = ref.read(activeGroupIdProvider).value;
      await ref.read(socialServiceProvider).createPost(
            text: text,
            imageUrl: uploadedUrl,
            matchId: _selectedMatchId,
            groupId: widget.initialMatch?.groupId ?? activeGroupId,
            pollQuestion: hasPoll ? _pollQuestionController.text : null,
            pollOptions: hasPoll
                ? [
                    _pollOpt1Controller.text,
                    _pollOpt2Controller.text,
                    if (_pollOpt3Controller.text.trim().isNotEmpty)
                      _pollOpt3Controller.text,
                  ]
                : null,
          );

      if (mounted) {
        Navigator.pop(context);
        PateaSnack.ok(context, '¡Publicado en Comunidad Pateá!');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        PateaSnack.error(context, 'No se pudo publicar: $e');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final matches =
        ref.watch(activeGroupMatchesProvider).value ?? const <MatchModel>[];

    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 14,
          bottom: MediaQuery.viewInsetsOf(context).bottom + 14,
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.84,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: context.c.border,
                    borderRadius: AppRadii.hairAll,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Nueva publicación',
                      style: AppTypography.headline(
                        size: 17,
                        weight: FontWeight.w800,
                      ),
                    ),
                  ),
                  FilledButton.icon(
                    onPressed: _submitting ? null : _submit,
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 8,
                      ),
                    ),
                    icon: _submitting
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: PateaButtonProgress(),
                          )
                        : const Icon(Icons.send_rounded, size: 15),
                    label: const Text('Publicar'),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextField(
                        controller: _textController,
                        maxLines: 3,
                        maxLength: 1000,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(
                          labelText: '¿Qué pasó en la cancha?',
                          hintText:
                              'Comentá el partido, el tercer tiempo o etiquetá un momento...',
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          OutlinedButton.icon(
                            onPressed: _submitting
                                ? null
                                : () => _pickImage(ImageSource.gallery),
                            icon: const Icon(
                              Icons.photo_library_outlined,
                              size: 17,
                            ),
                            label: const Text('Galería'),
                          ),
                          const SizedBox(width: 8),
                          OutlinedButton.icon(
                            onPressed: _submitting
                                ? null
                                : () => _pickImage(ImageSource.camera),
                            icon: const Icon(
                              Icons.photo_camera_outlined,
                              size: 17,
                            ),
                            label: const Text('Cámara'),
                          ),
                          const Spacer(),
                          FilterChip(
                            label: const Text('Encuesta'),
                            avatar: const Icon(Icons.poll_outlined, size: 16),
                            selected: _withPoll,
                            onSelected: _submitting
                                ? null
                                : (v) => setState(() => _withPoll = v),
                          ),
                        ],
                      ),
                      if (_imageFile != null) ...[
                        const SizedBox(height: 10),
                        Stack(
                          children: [
                            ClipRRect(
                              borderRadius: AppRadii.cardAll,
                              child: Image.file(
                                _imageFile!,
                                height: 150,
                                width: double.infinity,
                                fit: BoxFit.cover,
                              ),
                            ),
                            Positioned(
                              top: 6,
                              right: 6,
                              child: IconButton(
                                onPressed: () =>
                                    setState(() => _imageFile = null),
                                icon: const Icon(Icons.close),
                                style: IconButton.styleFrom(
                                  backgroundColor: context.c.card.withValues(
                                    alpha: 0.8,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (matches.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String?>(
                          initialValue:
                              matches.any((m) => m.id == _selectedMatchId)
                              ? _selectedMatchId
                              : null,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Etiquetar partido (opcional)',
                            prefixIcon: Icon(
                              Icons.sports_soccer_outlined,
                              size: 18,
                            ),
                          ),
                          items: [
                            const DropdownMenuItem<String?>(
                              value: null,
                              child: Text('Sin partido etiquetado'),
                            ),
                            ...matches.take(15).map(
                              (m) => DropdownMenuItem<String?>(
                                value: m.id,
                                child: Text(
                                  '${m.title} · ${fmtDate(m.date)}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ),
                          ],
                          onChanged: _submitting
                              ? null
                              : (v) => setState(() => _selectedMatchId = v),
                        ),
                      ],
                      if (_withPoll) ...[
                        const SizedBox(height: 12),
                        TextField(
                          controller: _pollQuestionController,
                          decoration: const InputDecoration(
                            labelText: 'Pregunta de la encuesta',
                            hintText: 'Ej: ¿Quién fue la figura hoy?',
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _pollOpt1Controller,
                          decoration: const InputDecoration(
                            labelText: 'Opción 1',
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _pollOpt2Controller,
                          decoration: const InputDecoration(
                            labelText: 'Opción 2',
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _pollOpt3Controller,
                          decoration: const InputDecoration(
                            labelText: 'Opción 3 (opcional)',
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              FilledButton.icon(
                onPressed: _submitting ? null : _submit,
                icon: _submitting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: PateaButtonProgress(),
                      )
                    : const Icon(Icons.send_rounded, size: 17),
                label: const Text('Publicar en Comunidad'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Comentarios en tiempo real de una publicación.
class _SocialCommentsSheet extends ConsumerStatefulWidget {
  final SocialPostModel post;

  const _SocialCommentsSheet({required this.post});

  static Future<void> show(BuildContext context, SocialPostModel post) {
    return showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: context.c.card,
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceTop),
      builder: (_) => _SocialCommentsSheet(post: post),
    );
  }

  @override
  ConsumerState<_SocialCommentsSheet> createState() =>
      _SocialCommentsSheetState();
}

class _SocialCommentsSheetState extends ConsumerState<_SocialCommentsSheet> {
  final _controller = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await ref.read(socialServiceProvider).addComment(
            activityId: widget.post.id,
            text: text,
          );
      if (mounted) {
        _controller.clear();
        setState(() => _sending = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _sending = false);
        PateaSnack.error(context, '$e');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final commentsAsync = ref.watch(socialCommentsStreamProvider(widget.post.id));

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.65,
          child: Column(
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: context.c.border,
                  borderRadius: AppRadii.hairAll,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Comentarios',
                style: AppTypography.headline(size: 16),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: commentsAsync.when(
                  data: (comments) {
                    if (comments.isEmpty) {
                      return Center(
                        child: Text(
                          'Sé el primero en comentar.',
                          style: AppTypography.body(
                            size: 13,
                            color: context.c.textSecondary,
                          ),
                        ),
                      );
                    }
                    return ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: comments.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final c = comments[index];
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            PateaAvatar(
                              photoUrl: c.userPhotoUrl,
                              seed: c.userName,
                              size: 32,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        c.userName,
                                        style: AppTypography.body(
                                          size: 13,
                                          weight: FontWeight.w700,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        _relativeTime(c.createdAt),
                                        style: AppTypography.body(
                                          size: 11,
                                          color: context.c.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    c.text,
                                    style: AppTypography.body(size: 13),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        );
                      },
                    );
                  },
                  loading: () => const PateaLoading(),
                  error: (e, _) => PateaError(error: e, compact: true),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(
                          hintText: 'Escribí un comentario...',
                          isDense: true,
                        ),
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      onPressed: _sending ? null : _send,
                      icon: _sending
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: PateaButtonProgress(),
                            )
                          : Icon(Icons.send_rounded, color: context.c.primary),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Buscador para descubrir y seguir jugadores de otros grupos.
class _DiscoverPlayersSheet extends ConsumerStatefulWidget {
  const _DiscoverPlayersSheet();

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: context.c.card,
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceTop),
      builder: (_) => const _DiscoverPlayersSheet(),
    );
  }

  @override
  ConsumerState<_DiscoverPlayersSheet> createState() =>
      _DiscoverPlayersSheetState();
}

class _DiscoverPlayersSheetState extends ConsumerState<_DiscoverPlayersSheet> {
  final _searchController = TextEditingController();
  List<SocialDiscoverPlayer> _players = const [];
  bool _loading = true;
  String? _busyUid;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _search(String q) async {
    setState(() => _loading = true);
    try {
      final list = await ref
          .read(socialServiceProvider)
          .searchPlayers(query: q);
      if (mounted) {
        setState(() {
          _players = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final followingSet =
        ref.watch(followingUidsStreamProvider).value ?? const <String>{};

    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.78,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: context.c.border,
                    borderRadius: AppRadii.hairAll,
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Seguir jugadores',
                style: AppTypography.headline(size: 17, weight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(
                'Seguí a jugadores de tu grupo o de otros grupos para ver sus partidos y publicaciones.',
                style: AppTypography.body(
                  size: 12,
                  color: context.c.textSecondary,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _searchController,
                onChanged: _search,
                decoration: const InputDecoration(
                  hintText: 'Buscar por nombre o posición...',
                  prefixIcon: Icon(Icons.search),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: _loading
                    ? const PateaLoading()
                    : _players.isEmpty
                    ? Center(
                        child: Text(
                          'No encontramos jugadores con ese nombre.',
                          style: AppTypography.body(
                            size: 13,
                            color: context.c.textSecondary,
                          ),
                        ),
                      )
                    : ListView.separated(
                        itemCount: _players.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final p = _players[index];
                          final isFollowing =
                              followingSet.contains(p.uid) || p.isFollowing;
                          return PateaCard(
                            color: context.c.cardSurface,
                            radius: AppRadii.cardAll,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            child: Row(
                              children: [
                                PateaAvatar(
                                  photoUrl: p.photoUrl,
                                  seed: p.name,
                                  size: 40,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        p.name,
                                        style: AppTypography.body(
                                          size: 14,
                                          weight: FontWeight.w700,
                                        ),
                                      ),
                                      Text(
                                        '${p.position} · OVR ${p.ovr}',
                                        style: AppTypography.body(
                                          size: 12,
                                          color: context.c.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                OutlinedButton(
                                  onPressed: _busyUid == p.uid
                                      ? null
                                      : () async {
                                          setState(() => _busyUid = p.uid);
                                          try {
                                            await ref
                                                .read(socialServiceProvider)
                                                .toggleFollow(p.uid);
                                          } finally {
                                            if (mounted) {
                                              setState(() => _busyUid = null);
                                            }
                                          }
                                        },
                                  child: Text(
                                    isFollowing ? 'Siguiendo' : 'Seguir',
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Perfil social rápido de un jugador al tocarlo desde Comunidad Pateá.
class _PlayerSocialProfileSheet extends ConsumerWidget {
  final String uid;
  final String name;
  final String? photoUrl;
  final String position;
  final int ovr;

  const _PlayerSocialProfileSheet({
    required this.uid,
    required this.name,
    this.photoUrl,
    required this.position,
    required this.ovr,
  });

  static Future<void> show(
    BuildContext context, {
    required String uid,
    required String name,
    String? photoUrl,
    String position = '',
    int ovr = 0,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      backgroundColor: context.c.card,
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceTop),
      builder: (_) => _PlayerSocialProfileSheet(
        uid: uid,
        name: name,
        photoUrl: photoUrl,
        position: position,
        ovr: ovr,
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentUid = ref.watch(authStateProvider).value?.uid;
    final isMe = currentUid != null && currentUid == uid;
    final followingSet =
        ref.watch(followingUidsStreamProvider).value ?? const <String>{};
    final isFollowing = followingSet.contains(uid);
    final followersCount =
        ref.watch(followersCountStreamProvider(uid)).value ?? 0;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                PateaAvatar(photoUrl: photoUrl, seed: name, size: 64),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: AppTypography.headline(
                          size: 19,
                          weight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        [
                          if (position.isNotEmpty) position,
                          if (ovr > 0) 'OVR $ovr',
                          '$followersCount ${followersCount == 1 ? 'seguidor' : 'seguidores'}',
                        ].join(' · '),
                        style: AppTypography.body(
                          size: 12,
                          color: context.c.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            if (!isMe && uid.isNotEmpty)
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () async {
                        await ref.read(socialServiceProvider).toggleFollow(uid);
                      },
                      icon: Icon(
                        isFollowing ? Icons.check : Icons.person_add_alt_1,
                        size: 17,
                      ),
                      label: Text(isFollowing ? 'Siguiendo' : 'Seguir'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        final photoParam =
                            photoUrl != null && photoUrl!.isNotEmpty
                            ? '&photo=${Uri.encodeComponent(photoUrl!)}'
                            : '';
                        context.push(
                          '/messages/chat/$uid?name=${Uri.encodeComponent(name)}$photoParam',
                        );
                      },
                      icon: const Icon(
                        Icons.chat_bubble_outline_rounded,
                        size: 17,
                      ),
                      label: const Text('Mensaje'),
                    ),
                  ),
                ],
              ),
            if (uid.isNotEmpty) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.push('/players/$uid');
                },
                child: const Text('Ver ficha deportiva completa'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
