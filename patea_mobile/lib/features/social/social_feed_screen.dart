import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart' show Timestamp;
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
import '../../core/theme/match_theme.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/match_photography.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_help_dialog.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';
import '../../core/widgets/patea_tabs.dart';

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
    final user = ref.watch(authStateProvider).value;
    final uid = user?.uid;
    final currentPlayer = (uid != null && uid.isNotEmpty)
        ? ref.watch(singlePlayerStreamProvider(uid)).value
        : null;
    final followingSet =
        ref.watch(followingUidsStreamProvider).value ?? const <String>{};
    final groupFeedAsync = ref.watch(groupSocialFeedStreamProvider);
    final communityFeedAsync = ref.watch(communitySocialFeedStreamProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Volver',
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              context.pop();
            } else {
              context.go('/');
            }
          },
        ),
        title: Text(
          'Comunidad Pateá',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            tooltip: 'Buscar jugadores para seguir',
            onPressed: () => _DiscoverPlayersSheet.show(context),
            icon: const Icon(Icons.person_search_outlined, size: 22),
          ),
          IconButton(
            tooltip: 'Sobre la comunidad',
            onPressed: () =>
                showContextualHelpSheet(context, topic: HelpTopic.community),
            icon: const Icon(Icons.help_outline_rounded, size: 21),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Pestañas nativas de Pateá con espacio aireado
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: PateaTabs(
              tabs: [
                const PateaTab('Mi Grupo'),
                PateaTab('Siguiendo · Global', count: followingSet.length),
              ],
              active: _tab,
              onChanged: (index) => setState(() => _tab = index),
            ),
          ),
          const SizedBox(height: 10),

          Expanded(
            child: _tab == 0
                ? _buildFeedList(
                    context: context,
                    feedAsync: groupFeedAsync,
                    uid: uid,
                    myName:
                        currentPlayer?.name ?? user?.displayName ?? 'Jugador',
                    myPhotoUrl: currentPlayer?.photoUrl ?? user?.photoURL,
                    followingSet: followingSet,
                    isGroupTab: true,
                    onRefresh: () async =>
                        ref.invalidate(groupSocialFeedStreamProvider),
                  )
                : _buildFeedList(
                    context: context,
                    feedAsync: communityFeedAsync,
                    uid: uid,
                    myName:
                        currentPlayer?.name ?? user?.displayName ?? 'Jugador',
                    myPhotoUrl: currentPlayer?.photoUrl ?? user?.photoURL,
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
    required String myName,
    required String? myPhotoUrl,
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

        // Novedades del grupo (cambios de OVR, partidos armados y terminados):
        // las escribe el servidor y se mezclan con las publicaciones por fecha.
        final news = isGroupTab
            ? (ref.watch(feedActivitiesStreamProvider).value ??
                  const <Map<String, dynamic>>[])
            : const <Map<String, dynamic>>[];
        final items = <({DateTime at, Widget widget})>[
          for (final post in posts)
            (
              at: post.createdAt,
              widget: Padding(
                padding: const EdgeInsets.only(bottom: 14),
                // Cada publicación va en su propia tarjeta: se ve dónde empieza
                // y dónde termina, en claro y en oscuro.
                child: PateaCard(
                  color: context.c.card,
                  radius: AppRadii.cardAll,
                  borderColor: context.c.border.withValues(alpha: 0.55),
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                  child: _SocialPostCard(
                    key: ValueKey(post.id),
                    post: post,
                    currentUid: uid,
                    isFollowingAuthor: followingSet.contains(post.userId),
                  ),
                ),
              ),
            ),
          for (final data in news)
            (
              at: _feedActivityDate(data),
              widget: Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: _buildFeedTile(data),
              ),
            ),
        ]..sort((a, b) => b.at.compareTo(a.at));

        return RefreshIndicator(
          onRefresh: onRefresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(16, 4, 16, bottomInset(context)),
            children: [
              // Barra amplia y cómoda para crear una publicación
              InkWell(
                borderRadius: AppRadii.cardAll,
                onTap: () => CreateSocialPostSheet.show(context),
                child: PateaCard(
                  color: context.c.card,
                  radius: AppRadii.cardAll,
                  borderColor: context.c.border.withValues(alpha: 0.45),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  child: Row(
                    children: [
                      PateaAvatar(
                        photoUrl: myPhotoUrl,
                        seed: uid ?? myName,
                        size: 38,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          '¿Qué pasó en la cancha?',
                          style: AppTypography.body(
                            size: 14,
                            color: context.c.textSecondary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      FilledButton(
                        onPressed: () => CreateSocialPostSheet.show(context),
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 9,
                          ),
                          minimumSize: Size.zero,
                        ),
                        child: const Text('Publicar'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              if (!isGroupTab) ...[
                PateaCard(
                  color: context.c.card,
                  radius: AppRadii.cardAll,
                  borderColor: context.c.border.withValues(alpha: 0.45),
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
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
                                    size: 14,
                                    weight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  followingSet.isEmpty
                                      ? 'Descubrí jugadores y mirá sus partidos y momentos.'
                                      : 'Seguís a ${followingSet.length} ${followingSet.length == 1 ? 'jugador' : 'jugadores'}.',
                                  style: AppTypography.body(
                                    size: 12,
                                    color: context.c.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          OutlinedButton(
                            onPressed: () =>
                                _DiscoverPlayersSheet.show(context),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              minimumSize: Size.zero,
                            ),
                            child: const Text('Buscar'),
                          ),
                        ],
                      ),
                      if (followingSet.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            ChoiceChip(
                              label: const Text('Todos'),
                              selected: !_onlyFollowingInTab1,
                              onSelected: (_) =>
                                  setState(() => _onlyFollowingInTab1 = false),
                            ),
                            const SizedBox(width: 8),
                            ChoiceChip(
                              label: Text(
                                'Solo seguidos (${followingSet.length})',
                              ),
                              selected: _onlyFollowingInTab1,
                              onSelected: (_) =>
                                  setState(() => _onlyFollowingInTab1 = true),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (items.isEmpty)
                PateaCard(
                  color: context.c.card,
                  radius: AppRadii.cardAll,
                  borderColor: context.c.border,
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Icon(
                        Icons.sports_soccer_outlined,
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
                    ],
                  ),
                )
              else
                for (final item in items) item.widget,
            ],
          ),
        );
      },
    );
  }
}

DateTime _feedActivityDate(Map<String, dynamic> data) {
  final raw = data['createdAt'];
  if (raw is Timestamp) return raw.toDate();
  if (raw is String) {
    return DateTime.tryParse(raw) ?? DateTime.fromMillisecondsSinceEpoch(0);
  }
  return DateTime.fromMillisecondsSinceEpoch(0);
}

Widget _buildFeedTile(Map<String, dynamic> data) {
  final type = data['type'] as String? ?? '';
  final matchId = data['matchId'] as String?;
  if ((type == 'match_finished' || type == 'match_scheduled') &&
      matchId != null &&
      matchId.isNotEmpty) {
    return _FeedMatchTile(matchId: matchId, data: data);
  }
  return _FeedActivityTile(data: data);
}

/// Novedad de partido del grupo con acceso a su ficha.
class _FeedMatchTile extends ConsumerWidget {
  final String matchId;
  final Map<String, dynamic> data;

  const _FeedMatchTile({required this.matchId, required this.data});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final match = ref.watch(singleMatchStreamProvider(matchId)).value;
    if (match == null) return _FeedActivityTile(data: data);

    final colors = context.c;
    final theme = getMatchTypeTheme(match.type);
    final teamA = match.teamA;
    final teamB = match.teamB;
    final showScores = switch (match.status) {
      'active' || 'completed' || 'evaluated' => true,
      _ => false,
    };
    final status = switch (match.status) {
      'planning' => 'A confirmar',
      'upcoming' => 'Próximo partido',
      'active' => 'En vivo',
      'completed' => 'Resultado final',
      'evaluated' => 'Partido evaluado',
      _ => theme.label,
    };
    final day = fmtDayNumber(match.date);
    final month = fmtMonthShort(match.date);
    final explicitTime = match.time?.trim();
    final kickoff = match.date.contains('T')
        ? DateTime.tryParse(match.date)?.toLocal()
        : null;
    final time = explicitTime != null && explicitTime.isNotEmpty
        ? explicitTime
        : (kickoff == null ? null : fmtTime(kickoff));
    final location = match.location?.trim();
    final showDateTile = !showScores && day.isNotEmpty;
    final dateLabel = showDateTile
        ? (time == null ? 'Horario a confirmar' : '$time hs')
        : [
            fmtDate(match.date),
            if (time != null) '$time hs',
          ].where((part) => part.isNotEmpty).join(' · ');

    return Material(
      color: colors.card,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadii.cardAll,
        side: BorderSide(color: colors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/matches/$matchId'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Stack(
              children: [
                Positioned.fill(
                  child: Image.asset(
                    MatchPhotography.forMatch(match.id),
                    fit: BoxFit.cover,
                    alignment: Alignment.center,
                    excludeFromSemantics: true,
                  ),
                ),
                const Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0xB30B1017), Color(0xE60B1017)],
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Icon(
                            match.status == 'active'
                                ? Icons.sensors
                                : Icons.sports_soccer_outlined,
                            size: 15,
                            color: colors.brandVolt,
                          ),
                          Text(
                            status,
                            style: AppTypography.body(
                              size: 12,
                              weight: FontWeight.w800,
                              color: colors.brandVolt,
                            ),
                          ),
                          if (status != theme.label)
                            Text(
                              theme.label,
                              style: AppTypography.body(
                                size: 12,
                                color: colors.onPhotoMuted,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        match.title,
                        style: AppTypography.headline(
                          size: 22,
                          weight: FontWeight.w800,
                          color: colors.onPhoto,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (showScores && teamA != null && teamB != null) ...[
                    _FeedScoreLine(team: teamA),
                    Divider(height: 10, color: colors.overlayLine),
                    _FeedScoreLine(team: teamB),
                    const SizedBox(height: 12),
                  ],
                  if (dateLabel.isNotEmpty || (location?.isNotEmpty ?? false))
                    Row(
                      children: [
                        if (showDateTile) ...[
                          Semantics(
                            label: fmtDayAndMonth(match.date),
                            excludeSemantics: true,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: colors.cardSurface,
                                borderRadius: AppRadii.chipAll,
                              ),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 5,
                                ),
                                child: Column(
                                  children: [
                                    Text(
                                      day,
                                      style: AppTypography.sportNumber(
                                        size: 22,
                                        color: colors.primary,
                                      ),
                                    ),
                                    Text(
                                      month,
                                      style: AppTypography.body(
                                        size: 10,
                                        weight: FontWeight.w700,
                                        color: colors.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                        ],
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (dateLabel.isNotEmpty)
                                Text(
                                  dateLabel,
                                  style: AppTypography.body(
                                    size: 13,
                                    weight: FontWeight.w700,
                                  ),
                                ),
                              if (location != null && location.isNotEmpty)
                                Text(
                                  location,
                                  style: AppTypography.body(
                                    size: 12,
                                    color: colors.textSecondary,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  if (!showScores && teamA != null && teamB != null) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 10,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        _FeedTeamName(team: teamA),
                        Text(
                          'vs.',
                          style: AppTypography.body(
                            size: 12,
                            color: colors.textSecondary,
                          ),
                        ),
                        _FeedTeamName(team: teamB),
                      ],
                    ),
                  ],
                  Divider(height: 18, color: colors.overlayLine),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          _relativeTime(_feedActivityDate(data)),
                          style: AppTypography.body(
                            size: 12,
                            color: colors.textSecondary,
                          ),
                        ),
                      ),
                      Text(
                        'Ver partido',
                        style: AppTypography.body(
                          size: 12,
                          weight: FontWeight.w700,
                          color: colors.primary,
                        ),
                      ),
                      Icon(
                        Icons.chevron_right,
                        size: 17,
                        color: colors.primary,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeedTeamName extends StatelessWidget {
  final MatchTeam team;

  const _FeedTeamName({required this.team});

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      if (team.jersey case final jersey?) ...[
        JerseyWidget(jersey: jersey, size: 22),
        const SizedBox(width: 6),
      ],
      Flexible(
        child: Text(
          team.name,
          style: AppTypography.body(size: 13, weight: FontWeight.w700),
        ),
      ),
    ],
  );
}

class _FeedScoreLine extends StatelessWidget {
  final MatchTeam team;

  const _FeedScoreLine({required this.team});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(child: _FeedTeamName(team: team)),
      const SizedBox(width: 12),
      Text(
        '${team.score}',
        style: AppTypography.sportNumber(size: 25, color: context.c.primary),
      ),
    ],
  );
}

/// Novedad generada por el servidor (`feedActivities`): sin reacciones ni
/// comentarios, sólo lo que pasó en el grupo.
class _FeedActivityTile extends StatelessWidget {
  final Map<String, dynamic> data;

  const _FeedActivityTile({required this.data});

  @override
  Widget build(BuildContext context) {
    final colors = context.c;
    final type = data['type'] as String? ?? '';
    final message = (data['message'] as String?)?.trim() ?? '';
    final name = data['playerName'] as String? ?? '';
    final photo = data['playerPhotoUrl'] as String?;
    final isPlayerEvent = type == 'ovr_updated';
    final icon = type == 'match_finished'
        ? Icons.sports_score_outlined
        : Icons.event_available_outlined;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (isPlayerEvent)
          PateaAvatar(
            photoUrl: (photo != null && photo.isNotEmpty) ? photo : null,
            seed: (data['playerId'] as String?) ?? name,
            size: 38,
          )
        else
          SizedBox(
            width: 38,
            height: 38,
            child: Icon(icon, size: 24, color: colors.primary),
          ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (isPlayerEvent && name.isNotEmpty)
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.headline(
                    size: 15,
                    weight: FontWeight.w700,
                  ),
                ),
              if (message.isNotEmpty)
                Text(message, style: AppTypography.body(size: 14)),
              const SizedBox(height: 2),
              Text(
                _relativeTime(_feedActivityDate(data)),
                style: AppTypography.body(
                  size: 12,
                  color: colors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
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
    super.key,
    required this.post,
    required this.currentUid,
    required this.isFollowingAuthor,
  });

  @override
  ConsumerState<_SocialPostCard> createState() => _SocialPostCardState();
}

class _SocialPostCardState extends ConsumerState<_SocialPostCard> {
  bool _togglingFollow = false;

  bool _captionExpanded = false;
  final _pendingReactions = <String>{};
  final _localReactions = <String, bool>{};

  bool _hasReacted(String reaction) =>
      _localReactions[reaction] ??
      widget.post.hasReacted(reaction, widget.currentUid);

  @override
  void didUpdateWidget(covariant _SocialPostCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentUid != widget.currentUid) {
      _localReactions.clear();
    } else {
      _localReactions.removeWhere(
        (reaction, added) =>
            widget.post.hasReacted(reaction, widget.currentUid) == added,
      );
    }
  }

  Future<void> _react(String reaction, {bool addOnly = false}) async {
    final uid = widget.currentUid;
    if (uid == null ||
        (addOnly && _hasReacted(reaction)) ||
        !_pendingReactions.add(reaction)) {
      return;
    }
    try {
      final added = await ref
          .read(socialServiceProvider)
          .toggleReaction(activityId: widget.post.id, reaction: reaction);
      if (!mounted || widget.currentUid != uid) return;
      setState(() {
        if (widget.post.hasReacted(reaction, uid) == added) {
          _localReactions.remove(reaction);
        } else {
          _localReactions[reaction] = added;
        }
      });
    } catch (e) {
      if (mounted) PateaSnack.error(context, 'No pudimos guardar tu reacción.');
    } finally {
      _pendingReactions.remove(reaction);
    }
  }

  Future<void> _vote(String optionId) async {
    try {
      await ref
          .read(socialServiceProvider)
          .votePoll(activityId: widget.post.id, optionId: optionId);
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

  static const _primaryReaction = '🔥';
  static const _reactionLabels = {
    '⚽': 'Gol',
    '🔥': 'Fuego',
    '👏': 'Aplausos',
    '💪': 'Fuerza',
    '😂': 'Risa',
  };

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    final colors = context.c;
    final uid = widget.currentUid;
    final isMine = uid != null && post.userId == uid;
    final headline = _autoHeadline(post);
    final imageUrl = post.imageUrl;
    final hasPhoto = imageUrl != null && imageUrl.isNotEmpty;
    final reacting = _hasReacted(_primaryReaction);
    final activeCounts = {
      for (final reaction in kSocialReactions)
        reaction:
            post.reactionCount(reaction) +
            (_hasReacted(reaction) ? 1 : 0) -
            (post.hasReacted(reaction, uid) ? 1 : 0),
    }..removeWhere((_, count) => count <= 0);

    void openComments() => _SocialCommentsSheet.show(context, post);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: InkWell(
                borderRadius: AppRadii.chipAll,
                onTap: post.userId.isEmpty
                    ? null
                    : () => _PlayerSocialProfileSheet.show(
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
                      seed: post.userId.isEmpty ? post.playerName : post.userId,
                      size: 38,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            post.playerName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.headline(
                              size: 15,
                              weight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            _relativeTime(post.createdAt),
                            style: AppTypography.body(
                              size: 12,
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (uid != null && (isMine || post.userId.isNotEmpty))
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_horiz),
                tooltip: 'Opciones de la publicación',
                onSelected: (action) async {
                  if (action == 'follow') {
                    await _toggleFollow();
                    return;
                  }
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (dialogContext) => AlertDialog(
                      title: const Text('¿Eliminar publicación?'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(dialogContext, false),
                          child: const Text('Cancelar'),
                        ),
                        TextButton(
                          onPressed: () => Navigator.pop(dialogContext, true),
                          child: const Text('Eliminar'),
                        ),
                      ],
                    ),
                  );
                  if (mounted && confirmed == true) await _deletePost();
                },
                itemBuilder: (_) => [
                  if (isMine)
                    const PopupMenuItem(
                      value: 'delete',
                      child: Text('Eliminar publicación'),
                    )
                  else
                    PopupMenuItem(
                      value: 'follow',
                      enabled: !_togglingFollow,
                      child: Text(
                        widget.isFollowingAuthor ? 'Dejar de seguir' : 'Seguir',
                      ),
                    ),
                ],
              ),
          ],
        ),
        if (!hasPhoto && headline.isNotEmpty) ...[
          const SizedBox(height: 10),
          _caption(headline),
        ],
        if (hasPhoto) ...[
          const SizedBox(height: 10),
          GestureDetector(
            onDoubleTap: uid == null
                ? null
                : () => _react(_primaryReaction, addOnly: true),
            child: LayoutBuilder(
              builder: (context, constraints) => Image.network(
                imageUrl,
                width: constraints.maxWidth,
                fit: BoxFit.cover,
                semanticLabel: 'Foto de la publicación',
                frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
                  if (wasSynchronouslyLoaded || frame != null) return child;
                  return ColoredBox(
                    color: colors.cardSurface,
                    child: SizedBox(
                      height: constraints.maxWidth * 0.75,
                      child: child,
                    ),
                  );
                },
                errorBuilder: (_, _, _) => ColoredBox(
                  color: colors.cardSurface,
                  child: SizedBox(
                    height: constraints.maxWidth * 0.75,
                    child: Center(
                      child: Icon(
                        Icons.broken_image_outlined,
                        color: colors.textSecondary,
                        semanticLabel: 'No se pudo cargar la foto',
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
        if (post.hasMatchCard ||
            post.newOvr != null ||
            post.mvpName != null) ...[
          const SizedBox(height: 10),
          _MatchHighlightCard(post: post),
        ],
        if (post.poll case final poll?) ...[
          const SizedBox(height: 10),
          _SocialPollCard(poll: poll, currentUid: uid, onVote: _vote),
        ],
        Row(
          children: [
            MenuAnchor(
              menuChildren: [
                for (final reaction in kSocialReactions)
                  MenuItemButton(
                    onPressed: () => _react(reaction),
                    leadingIcon: Icon(
                      _hasReacted(reaction) ? Icons.check : null,
                      size: 18,
                    ),
                    child: Text('$reaction  ${_reactionLabels[reaction]}'),
                  ),
              ],
              builder: (context, controller, _) {
                final action = reacting
                    ? 'Quitar reacción Fuego'
                    : 'Reaccionar con Fuego';
                return Tooltip(
                  message: action,
                  triggerMode: TooltipTriggerMode.manual,
                  child: Semantics(
                    button: true,
                    selected: reacting,
                    enabled: uid != null,
                    label: action,
                    hint: 'Mantené presionado para elegir otra reacción',
                    child: InkWell(
                      borderRadius: AppRadii.pillAll,
                      onTap: uid == null
                          ? null
                          : () => _react(_primaryReaction),
                      onLongPress: uid == null ? null : controller.open,
                      child: SizedBox.square(
                        dimension: 48,
                        child: Icon(
                          reacting
                              ? Icons.local_fire_department
                              : Icons.local_fire_department_outlined,
                          color: reacting ? colors.primary : colors.textPrimary,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
            IconButton(
              tooltip: 'Comentarios',
              onPressed: openComments,
              icon: const Icon(Icons.chat_bubble_outline_rounded),
            ),
          ],
        ),
        if (activeCounts.isNotEmpty)
          Wrap(
            spacing: 10,
            runSpacing: 4,
            children: [
              for (final entry in activeCounts.entries)
                Semantics(
                  label: '${_reactionLabels[entry.key]}: ${entry.value}',
                  selected: _hasReacted(entry.key),
                  excludeSemantics: true,
                  child: Text(
                    '${entry.key} ${entry.value}',
                    style: AppTypography.body(
                      size: 12,
                      weight: FontWeight.w700,
                      color: _hasReacted(entry.key)
                          ? colors.primary
                          : colors.textSecondary,
                    ),
                  ),
                ),
            ],
          )
        else if (post.reactions.isEmpty && post.likes.isNotEmpty)
          Text(
            '${post.likes.length} Me gusta',
            style: AppTypography.body(size: 12, color: colors.textSecondary),
          ),
        if (hasPhoto && headline.isNotEmpty) ...[
          const SizedBox(height: 6),
          _caption(headline),
        ],
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton(
            onPressed: openComments,
            style: TextButton.styleFrom(
              foregroundColor: colors.textSecondary,
              padding: EdgeInsets.zero,
            ),
            child: Text(switch (post.commentCount) {
              0 => 'Comentá primero',
              1 => 'Ver 1 comentario',
              final count => 'Ver los $count comentarios',
            }),
          ),
        ),
      ],
    );
  }

  Widget _caption(String text) => LayoutBuilder(
    builder: (context, constraints) {
      final style = AppTypography.body(size: 14, color: context.c.textPrimary);
      final painter = TextPainter(
        text: TextSpan(text: text, style: style),
        textDirection: Directionality.of(context),
        textScaler: MediaQuery.textScalerOf(context),
        maxLines: 3,
      )..layout(maxWidth: constraints.maxWidth);
      final canExpand = painter.didExceedMaxLines;
      painter.dispose();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            text,
            style: style,
            maxLines: _captionExpanded ? null : 3,
            overflow: _captionExpanded
                ? TextOverflow.visible
                : TextOverflow.ellipsis,
          ),
          if (canExpand)
            TextButton(
              onPressed: () =>
                  setState(() => _captionExpanded = !_captionExpanded),
              style: TextButton.styleFrom(padding: EdgeInsets.zero),
              child: Text(_captionExpanded ? 'Ver menos' : 'Ver más'),
            ),
        ],
      );
    },
  );
}

class _MatchHighlightCard extends StatelessWidget {
  final SocialPostModel post;

  const _MatchHighlightCard({required this.post});

  @override
  Widget build(BuildContext context) {
    final hasScore = post.teamAScore != null && post.teamBScore != null;
    final change = post.ovrChange ?? 0;
    final title = post.matchTitle?.trim();
    final matchId = post.matchId;
    final teams = [
      post.teamAName,
      post.teamBName,
    ].whereType<String>().join(' vs ');
    final canOpen = matchId != null && matchId.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (post.hasMatchCard)
          Material(
            color: context.c.cardSurface,
            borderRadius: AppRadii.chipAll,
            child: InkWell(
              borderRadius: AppRadii.chipAll,
              onTap: canOpen ? () => context.push('/matches/$matchId') : null,
              child: Tooltip(
                message: canOpen ? 'Ver partido' : '',
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 8,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.sports_soccer_outlined,
                        size: 16,
                        color: context.c.primary,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          title != null && title.isNotEmpty
                              ? title
                              : (teams.isEmpty ? 'Partido' : teams),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.body(
                            size: 13,
                            weight: FontWeight.w700,
                          ),
                        ),
                      ),
                      if (hasScore) ...[
                        const SizedBox(width: 8),
                        Text(
                          '${post.teamAScore}–${post.teamBScore}',
                          style: AppTypography.sportNumber(
                            size: 16,
                            color: context.c.primary,
                          ),
                        ),
                      ],
                      if (canOpen)
                        Icon(
                          Icons.chevron_right,
                          size: 18,
                          color: context.c.textSecondary,
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        if (post.mvpName != null && post.mvpName!.isNotEmpty) ...[
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(
                Icons.emoji_events_outlined,
                size: 16,
                color: context.c.ratingAccent,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'MVP · ${post.mvpName}',
                  style: AppTypography.body(
                    size: 12,
                    weight: FontWeight.w700,
                    color: context.c.ratingAccent,
                  ),
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
                  color: change >= 0
                      ? context.c.success
                      : context.c.destructive,
                ),
              ),
            ],
          ),
        ],
      ],
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
          for (final option in poll.options)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: OutlinedButton(
                onPressed: currentUid == null ? null : () => onVote(option.id),
                style: OutlinedButton.styleFrom(
                  foregroundColor: context.c.textPrimary,
                  side: BorderSide(
                    color: myVote == option.id
                        ? context.c.primary
                        : context.c.border,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text(option.text)),
                        if (myVote != null) ...[
                          const SizedBox(width: 8),
                          Text('${(poll.ratioFor(option.id) * 100).round()}%'),
                        ],
                      ],
                    ),
                    if (myVote != null) ...[
                      const SizedBox(height: 6),
                      ExcludeSemantics(
                        child: LinearProgressIndicator(
                          value: poll.ratioFor(option.id),
                          minHeight: 4,
                          borderRadius: AppRadii.pillAll,
                          backgroundColor: context.c.border,
                          color: myVote == option.id
                              ? context.c.primary
                              : context.c.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          Text(
            '${poll.totalVotes} ${poll.totalVotes == 1 ? 'voto' : 'votos'}',
            style: AppTypography.body(size: 11, color: context.c.textSecondary),
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
    final hasPoll =
        _withPoll &&
        _pollQuestionController.text.trim().length >= 3 &&
        _pollOpt1Controller.text.trim().isNotEmpty &&
        _pollOpt2Controller.text.trim().isNotEmpty;

    if (text.isEmpty &&
        _imageFile == null &&
        !hasPoll &&
        _selectedMatchId == null) {
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
      await ref
          .read(socialServiceProvider)
          .createPost(
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
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    tooltip: 'Cerrar',
                    onPressed: _submitting
                        ? null
                        : () => Navigator.pop(context),
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
                            ...matches
                                .take(15)
                                .map(
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
              FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: PateaButtonProgress(),
                      )
                    : const Text('Publicar'),
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
    if (text.length > 500) {
      PateaSnack.error(context, 'El comentario admite hasta 500 caracteres.');
      return;
    }
    setState(() => _sending = true);
    try {
      await ref
          .read(socialServiceProvider)
          .addComment(activityId: widget.post.id, text: text);
      if (mounted) {
        _controller.clear();
        setState(() => _sending = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _sending = false);
        PateaSnack.error(
          context,
          'No pudimos enviar el comentario. Volvé a intentar.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final commentsAsync = ref.watch(
      socialCommentsStreamProvider(widget.post.id),
    );

    final colors = context.c;
    final uid = ref.watch(authServiceProvider).currentUser?.uid;

    return SafeArea(
      top: false,
      child: AnimatedPadding(
        duration: const Duration(milliseconds: 160),
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.72,
          minChildSize: 0.48,
          maxChildSize: 0.95,
          builder: (context, scrollController) => Column(
            children: [
              const SizedBox(height: 10),
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.border,
                  borderRadius: AppRadii.pillAll,
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    const SizedBox(width: 48),
                    Expanded(
                      child: Text(
                        'Comentarios',
                        textAlign: TextAlign.center,
                        style: AppTypography.headline(size: 16),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Cerrar comentarios',
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close, size: 20),
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: colors.overlayLine),
              Expanded(
                child: CustomScrollView(
                  controller: scrollController,
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  slivers: commentsAsync.when(
                    data: (comments) => [
                      if (comments.isEmpty)
                        SliverFillRemaining(
                          hasScrollBody: false,
                          child: Center(
                            child: Text(
                              'Sé el primero en comentar.',
                              style: AppTypography.body(
                                size: 13,
                                color: colors.textSecondary,
                              ),
                            ),
                          ),
                        )
                      else
                        SliverPadding(
                          padding: const EdgeInsets.all(16),
                          sliver: SliverList.separated(
                            itemCount: comments.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 14),
                            itemBuilder: (context, index) {
                              final comment = comments[index];
                              return Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  PateaAvatar(
                                    photoUrl: comment.userPhotoUrl,
                                    seed: comment.userId.isEmpty
                                        ? comment.userName
                                        : comment.userId,
                                    size: 32,
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Wrap(
                                          spacing: 8,
                                          runSpacing: 2,
                                          crossAxisAlignment:
                                              WrapCrossAlignment.center,
                                          children: [
                                            Text(
                                              comment.userName,
                                              style: AppTypography.body(
                                                size: 13,
                                                weight: FontWeight.w700,
                                              ),
                                            ),
                                            Text(
                                              _relativeTime(comment.createdAt),
                                              style: AppTypography.body(
                                                size: 11,
                                                color: colors.textSecondary,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 3),
                                        Text(
                                          comment.text,
                                          style: AppTypography.body(size: 14),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                        ),
                    ],
                    loading: () => const [
                      SliverFillRemaining(child: PateaLoading()),
                    ],
                    error: (error, _) => [
                      SliverFillRemaining(
                        child: PateaError(error: error, compact: true),
                      ),
                    ],
                  ),
                ),
              ),
              if (uid != null) ...[
                Divider(height: 1, color: colors.overlayLine),
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
                  child: TextField(
                    controller: _controller,
                    readOnly: _sending,
                    minLines: 1,
                    maxLines: 3,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      hintText: 'Escribí un comentario…',
                      isDense: true,
                      suffixIcon: ValueListenableBuilder(
                        valueListenable: _controller,
                        builder: (context, value, _) {
                          if (_sending) {
                            return const Center(
                              widthFactor: 2,
                              child: SizedBox.square(
                                dimension: 16,
                                child: PateaButtonProgress(),
                              ),
                            );
                          }
                          if (value.text.trim().isEmpty) {
                            return const SizedBox();
                          }
                          return IconButton(
                            tooltip: 'Enviar comentario',
                            onPressed: _send,
                            icon: Icon(
                              Icons.send_rounded,
                              color: colors.primary,
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ),
              ],
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
                style: AppTypography.headline(
                  size: 17,
                  weight: FontWeight.w800,
                ),
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
