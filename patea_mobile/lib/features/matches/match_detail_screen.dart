import 'widgets/team_rival_series.dart';
import '../../core/models/group_permissions.dart';
import '../../core/services/group_service.dart';
import '../../core/services/team_challenge_service.dart';
import 'match_chat_screen.dart';
import '../../core/widgets/patea_button_progress.dart';
import 'dart:async';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_states.dart';
import '../../core/theme/app_radii.dart';
import '../../core/widgets/patea_avatar.dart';
import 'dart:ui' show ImageFilter;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/models/match_model.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/location_service.dart';
import '../../core/services/match_service.dart';
import '../../core/services/push_permission.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_insets.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/player_card_preview.dart';
import 'widgets/edit_teams_sheet.dart';
import 'widgets/join_requests_section.dart';
import 'widgets/match_roster_tools.dart';
import 'widgets/match_clips_view.dart';
import 'widgets/match_planning_view.dart';
import 'widgets/match_story_view.dart';
import 'widgets/match_cover.dart';
import 'widgets/match_timeline.dart';
import 'widgets/recruit_players_sheet.dart';

/// Pantalla de Detalle de Partido: experiencia deportiva estilo broadcast de TV
/// y fútbol callejero.
class MatchDetailScreen extends ConsumerStatefulWidget {
  final String matchId;

  const MatchDetailScreen({super.key, required this.matchId});

  @override
  ConsumerState<MatchDetailScreen> createState() => _MatchDetailScreenState();
}

class _MatchDetailScreenState extends ConsumerState<MatchDetailScreen> {
  bool _isJoining = false;
  bool _isFinishing = false;
  bool _isShuffling = false;
  late final ScrollController _scrollController;
  bool _showCollapsedTitle = false;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController()..addListener(_onScroll);
  }

  void _onScroll() {
    final show = _scrollController.hasClients && _scrollController.offset > 110;
    if (show != _showCollapsedTitle) {
      setState(() => _showCollapsedTitle = show);
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _handleJoinLeave(
    MatchModel match,
    String uid,
    bool isUserInMatch,
  ) async {
    setState(() => _isJoining = true);
    try {
      if (isUserInMatch && match.hasFixedRoster) {
        // Plantel fijo: nadie se baja, pero puede avisar que no va (o que sí).
        final unavailable = !match.unavailablePlayerUids.contains(uid);
        await ref
            .read(matchServiceProvider)
            .reportMatchUnavailable(match.id, unavailable: unavailable);
        if (mounted) {
          _showSnack(
            unavailable
                ? 'Avisamos a los capitanes que no podés ir.'
                : 'Listo, volvés a figurar como disponible.',
          );
        }
      } else if (isUserInMatch) {
        await ref.read(matchServiceProvider).leaveMatch(match.id, uid);
      } else if (match.type == 'manual' && match.ownerUid != uid) {
        final already = await ref
            .read(matchServiceProvider)
            .requestJoinMatch(match.id);
        if (mounted) {
          _showSnack(
            already
                ? 'Ya habías pedido entrar a este partido.'
                : 'Solicitud enviada. El organizador te va a responder.',
          );
        }
      } else {
        await ref.read(matchServiceProvider).joinMatch(match.id, uid);
        if (mounted) {
          await PushPermission.askOnce(
            context,
            reason:
                'Te anotaste a "${match.title}". Podemos avisarte cuando se acerque el partido, '
                'cuando cambien la cancha o la hora, y cuando te inviten a otro.',
          );
        }
      }
    } catch (e) {
      if (mounted) _showError('$e');
    } finally {
      if (mounted) setState(() => _isJoining = false);
    }
  }

  Future<void> _handleFinish(MatchModel match) async {
    setState(() => _isFinishing = true);
    try {
      final service = ref.read(matchServiceProvider);
      // El servidor sólo finaliza un partido que estuvo en vivo. Si el
      // organizador lo jugó sin dirigirlo, "Finalizar" lo inicia primero (con
      // las mismas validaciones de equipos) y lo cierra: el flujo de siempre,
      // pero pasando por el estado en vivo.
      if (match.status == 'upcoming') {
        await service.startMatch(match.id);
      }
      await service.finishMatch(match.id);
      ref.invalidate(teamRivalsProvider);
      ref.invalidate(teamRivalSeriesProvider(match.id));
      if (mounted)
        _showSnack('Partido finalizado. Ya se habilitaron las evaluaciones.');
    } catch (e) {
      if (mounted) _showError('$e');
    } finally {
      if (mounted) setState(() => _isFinishing = false);
    }
  }

  Future<void> _handleShuffle(MatchModel match) async {
    if (_isShuffling) return;
    setState(() => _isShuffling = true);
    try {
      final changed = await ref
          .read(matchServiceProvider)
          .shuffleTeams(match.id);
      if (mounted)
        _showSnack(
          changed
              ? 'Equipos equilibrados por nivel y posiciones.'
              : 'Los equipos ya están equilibrados.',
        );
    } catch (e) {
      if (mounted) _showError('$e');
    } finally {
      if (mounted) setState(() => _isShuffling = false);
    }
  }

  Future<void> _handleDelete(MatchModel match) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: context.c.card,
        title: Text(
          '¿Borrar este partido?',
          style: AppTypography.headline(size: 16),
        ),
        content: Text(
          'Esta acción es permanente y no se puede deshacer. Los jugadores inscriptos recibirán una notificación de cancelación.',
          style: AppTypography.body(color: context.c.textSecondary, size: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: context.c.destructive,
            ),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      await ref.read(matchServiceProvider).deleteMatch(match.id);
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) _showError('$e');
    }
  }

  Future<void> _handleCancel(MatchModel match) async {
    final reason = TextEditingController();
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: context.c.card,
        title: Text(
          '¿Cancelar este partido?',
          style: AppTypography.headline(size: 16),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Queda en el historial como cancelado y los anotados reciben un aviso.',
              style: AppTypography.body(
                color: context.c.textSecondary,
                size: 13,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reason,
              maxLength: 200,
              decoration: const InputDecoration(labelText: 'Motivo (opcional)'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Volver'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: context.c.destructive,
            ),
            child: const Text('Cancelar partido'),
          ),
        ],
      ),
    );
    final text = reason.text;
    reason.dispose();
    if (confirm != true) return;
    try {
      await ref.read(matchServiceProvider).cancelMatch(match.id, reason: text);
      if (mounted) _showSnack('Partido cancelado.');
    } catch (e) {
      if (mounted) _showError('$e');
    }
  }

  Future<void> _showRescheduleDialog(MatchModel match) async {
    DateTime selectedDate =
        DateTime.tryParse(match.date)?.toLocal() ??
        DateTime.now().add(const Duration(days: 1));
    TimeOfDay selectedTime = () {
      final parts = (match.time ?? '21:00').split(':');
      return TimeOfDay(
        hour: int.tryParse(parts[0]) ?? 21,
        minute: parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0,
      );
    }();
    bool submitting = false;

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: context.c.card,
          title: Text(
            'Reprogramar partido',
            style: AppTypography.headline(size: 16),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.calendar_today),
                title: Text(
                  '${selectedDate.day}/${selectedDate.month}/${selectedDate.year}',
                ),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: selectedDate,
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  if (picked != null)
                    setDialogState(() => selectedDate = picked);
                },
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.access_time),
                title: Text(selectedTime.format(context)),
                onTap: () async {
                  final picked = await showTimePicker(
                    context: context,
                    initialTime: selectedTime,
                  );
                  if (picked != null)
                    setDialogState(() => selectedTime = picked);
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: submitting ? null : () => Navigator.pop(context),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      setDialogState(() => submitting = true);
                      final dateIso = DateTime(
                        selectedDate.year,
                        selectedDate.month,
                        selectedDate.day,
                      ).toIso8601String();
                      final timeStr =
                          '${selectedTime.hour.toString().padLeft(2, '0')}:${selectedTime.minute.toString().padLeft(2, '0')}';
                      try {
                        await ref
                            .read(matchServiceProvider)
                            .updateMatchDate(match.id, dateIso, timeStr);
                        if (context.mounted) Navigator.pop(context);
                      } catch (e) {
                        if (context.mounted) _showError('$e');
                        setDialogState(() => submitting = false);
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: context.c.primary,
                foregroundColor: context.c.onPrimary,
              ),
              child: submitting
                  ? SizedBox(
                      width: 16,
                      height: 16,
                      child: const PateaButtonProgress(),
                    )
                  : const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showChangeVenueDialog(MatchModel match) async {
    final controller = TextEditingController(text: match.location ?? '');
    List<LocationSuggestion> suggestions = [];
    LocationSuggestion? selected;
    Timer? debounce;
    bool submitting = false;
    final locationService = LocationService();

    final route = DialogRoute<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: context.c.card,
          title: Text(
            'Cambiar cancha',
            style: AppTypography.headline(size: 16),
          ),
          content: SizedBox(
            width: double.maxFinite,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: controller,
                  decoration: const InputDecoration(
                    hintText: 'Buscá la nueva cancha...',
                  ),
                  onChanged: (v) {
                    selected = null;
                    debounce?.cancel();
                    debounce = Timer(
                      const Duration(milliseconds: 300),
                      () async {
                        if (v.trim().length < 3) {
                          setDialogState(() => suggestions = []);
                          return;
                        }
                        final results = await locationService.suggest(v);
                        setDialogState(() => suggestions = results);
                      },
                    );
                  },
                ),
                if (suggestions.isNotEmpty)
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 200),
                    child: ListView(
                      shrinkWrap: true,
                      children: suggestions
                          .map(
                            (s) => ListTile(
                              dense: true,
                              title: Text(
                                s.label,
                                style: AppTypography.body(
                                  color: context.c.textSecondary,
                                  size: 12,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              onTap: () => setDialogState(() {
                                selected = s;
                                controller.text = s.label;
                                suggestions = [];
                              }),
                            ),
                          )
                          .toList(),
                    ),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: submitting ? null : () => Navigator.pop(context),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              onPressed: submitting || selected == null
                  ? null
                  : () async {
                      setDialogState(() => submitting = true);
                      try {
                        await ref
                            .read(matchServiceProvider)
                            .updateMatchLocation(
                              matchId: match.id,
                              locationName: selected!.label,
                              locationAddress: selected!.label,
                              locationLat: selected!.lat,
                              locationLng: selected!.lng,
                              locationPlaceId: selected!.placeId,
                            );
                        if (context.mounted) Navigator.pop(context);
                      } catch (e) {
                        if (context.mounted) _showError('$e');
                        setDialogState(() => submitting = false);
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: context.c.primary,
                foregroundColor: context.c.onPrimary,
              ),
              child: submitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: PateaButtonProgress(),
                    )
                  : const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
    await Navigator.of(context, rootNavigator: true).push(route);
    await route.completed;
    debounce?.cancel();
    controller.dispose();
  }

  void _showSnack(String text) {
    PateaSnack.ok(context, text);
  }

  void _showError(String text) {
    PateaSnack.error(context, text);
  }

  Future<void> _openMaps(MatchModel match) async {
    final loc = match.locationDetail;
    final query = Uri.encodeComponent(
      loc?.address.isNotEmpty == true ? loc!.address : (match.location ?? ''),
    );
    final placeId = loc?.placeId ?? '';
    final url =
        'https://www.google.com/maps/search/?api=1&query=$query${placeId.isNotEmpty ? '&query_place_id=$placeId' : ''}';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri))
      await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final matchAsync = ref.watch(singleMatchStreamProvider(widget.matchId));
    final uid = ref.watch(authStateProvider).valueOrNull?.uid;

    return matchAsync.when(
      data: (match) {
        if (match == null) {
          return Scaffold(
            backgroundColor: Colors.transparent,
            appBar: AppBar(backgroundColor: Colors.transparent),
            body: Center(
              child: Text(
                'Partido no encontrado.',
                style: AppTypography.body(color: context.c.textSecondary),
              ),
            ),
          );
        }

        final isOwner = uid != null && match.ownerUid == uid;
        // Organizador o capitán (partidos entre grupos). Borrar y repartir
        // equipos sigue siendo sólo del organizador.
        final isManager = match.isManagedBy(uid);
        // Miembro de uno de los grupos que participan (aunque no juegue): puede
        // subir clips, igual que lo dejan las reglas de Firestore y Storage.
        final activeGroupId = ref.watch(activeGroupIdProvider).asData?.value;
        final isLinkedGroupMember =
            activeGroupId != null &&
            (match.groupId == activeGroupId ||
                match.participantGroupIds.contains(activeGroupId));
        final isUserInMatch = uid != null && match.playerUids.contains(uid);
        final isPending = uid != null && match.pendingPlayerUids.contains(uid);
        final isMatchFull = match.players.length >= match.matchSize;
        final hasTeams = match.teamA != null && match.teamB != null;
        final isCompetition = [
          'league',
          'cup',
          'league_final',
        ].contains(match.type);

        return Scaffold(
          backgroundColor: Colors.transparent,
          extendBodyBehindAppBar: true,
          appBar: AppBar(
            backgroundColor: _showCollapsedTitle
                ? context.c.background.withValues(alpha: 0.96)
                : Colors.transparent,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            shape: _showCollapsedTitle
                ? Border(
                    bottom: BorderSide(
                      color: context.c.border.withValues(alpha: 0.35),
                    ),
                  )
                : null,
            centerTitle: false,
            title: AnimatedOpacity(
              opacity: _showCollapsedTitle ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 180),
              child: Text(
                match.title,
                style: AppTypography.headline(
                  size: 18,
                  color: context.c.textPrimary,
                  letterSpacing: 0.8,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            leading: BackButton(
              color: _showCollapsedTitle
                  ? context.c.textPrimary
                  : context.c.onPhoto,
            ),
            actions: [
              IconButton(
                icon: Icon(
                  Icons.share_outlined,
                  size: 20,
                  color: _showCollapsedTitle
                      ? context.c.textPrimary
                      : context.c.onPhoto,
                ),
                tooltip: 'Compartir partido',
                onPressed: () {
                  SharePlus.instance.share(
                    ShareParams(
                      text:
                          '¡Se juega ${match.title}! Miralo o sumate en Pateá: https://patea.app/match/${match.id}',
                    ),
                  );
                },
              ),
              if (isOwner)
                PopupMenuButton<String>(
                  icon: Icon(
                    Icons.more_vert_rounded,
                    color: _showCollapsedTitle
                        ? context.c.textPrimary
                        : context.c.onPhoto,
                  ),
                  color: context.c.card,
                  shape: RoundedRectangleBorder(
                    borderRadius: AppRadii.cardAll,
                    side: BorderSide(
                      color: context.c.border.withValues(alpha: 0.4),
                    ),
                  ),
                  onSelected: (action) {
                    switch (action) {
                      case 'reschedule':
                        _showRescheduleDialog(match);
                        break;
                      case 'venue':
                        _showChangeVenueDialog(match);
                        break;
                      case 'delete':
                        _handleDelete(match);
                        break;
                    }
                  },
                  itemBuilder: (context) {
                    final isFinished =
                        match.status == 'completed' ||
                        match.status == 'evaluated';
                    return [
                      if (!isFinished) ...[
                        PopupMenuItem(
                          value: 'reschedule',
                          child: Row(
                            children: [
                              const Icon(
                                Icons.calendar_month_outlined,
                                size: 18,
                              ),
                              const SizedBox(width: 10),
                              Text(
                                'Reprogramar partido',
                                style: AppTypography.body(
                                  color: context.c.textSecondary,
                                  size: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                        PopupMenuItem(
                          value: 'venue',
                          child: Row(
                            children: [
                              const Icon(Icons.map_outlined, size: 18),
                              const SizedBox(width: 10),
                              Text(
                                'Cambiar cancha',
                                style: AppTypography.body(
                                  color: context.c.textSecondary,
                                  size: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const PopupMenuDivider(),
                      ],
                      PopupMenuItem(
                        value: 'delete',
                        child: Row(
                          children: [
                            Icon(
                              Icons.delete_outline,
                              size: 18,
                              color: context.c.destructive,
                            ),
                            const SizedBox(width: 10),
                            Text(
                              'Eliminar partido',
                              style: AppTypography.body(
                                size: 13,
                                color: context.c.destructive,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ];
                  },
                ),
            ],
          ),
          bottomNavigationBar: _StickyActionBar(
            match: match,
            uid: uid,
            isOwner: isOwner,
            isManager: isManager,
            isUserInMatch: isUserInMatch,
            isPending: isPending,
            isMatchFull: isMatchFull,
            isJoining: _isJoining,
            isFinishing: _isFinishing,
            onJoinLeave: (uid == null || isCompetition)
                ? null
                : () => _handleJoinLeave(match, uid, isUserInMatch),
            onFinish: () => _handleFinish(match),
          ),
          body: ListView(
            controller: _scrollController,
            padding: EdgeInsets.only(bottom: bottomInset(context) + 80),
            children: [
              MatchCover(match: match, onOpenMaps: () => _openMaps(match)),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (match.type == 'intergroup_friendly')
                      TeamRivalSeries(matchId: match.id),
                    if (match.type == 'intergroup_friendly' &&
                        (match.challengeStatus == 'pending' ||
                            match.challengeStatus == 'declined')) ...[
                      const SizedBox(height: 12),
                      _IntergroupChallengeBanner(match: match, uid: uid),
                    ],
                    // En un partido entre equipos no se corrige moviendo
                    // jugadores: los planteles son los de cada equipo.
                    if (isOwner && hasTeams && !match.isTeamMatch) ...[
                      const SizedBox(height: 10),
                      DuplicatePlayersAlert(match: match),
                    ],
                    if ((match.status == 'planning' &&
                            (match.date.isEmpty ||
                                match.challengeStatus != 'pending')) ||
                        match.isVotingOpen) ...[
                      const SizedBox(height: 14),
                      MatchPlanningView(match: match, uid: uid),
                    ],
                    if (isOwner &&
                        match.type == 'manual' &&
                        match.status == 'upcoming') ...[
                      const SizedBox(height: 14),
                      JoinRequestsSection(matchId: match.id),
                    ],
                    if (match.isCancelled) ...[
                      const SizedBox(height: 14),
                      PateaCard(
                        color: context.c.cardSurface,
                        radius: AppRadii.cardAll,
                        borderColor: context.c.destructive.withValues(
                          alpha: 0.4,
                        ),
                        padding: const EdgeInsets.all(14),
                        child: Text(
                          match.cancelReason == null ||
                                  match.cancelReason!.isEmpty
                              ? 'Este partido fue cancelado.'
                              : 'Este partido fue cancelado. Motivo: ${match.cancelReason}',
                          style: AppTypography.body(size: 13),
                        ),
                      ),
                    ],
                    if (!isUserInMatch &&
                        uid != null &&
                        (match.status == 'planning' ||
                            match.status == 'upcoming')) ...[
                      const SizedBox(height: 14),
                      MatchInvitationBanner(match: match),
                    ],
                    if (isManager &&
                        match.teamsOutOfSync &&
                        (match.status == 'planning' ||
                            match.status == 'upcoming')) ...[
                      const SizedBox(height: 14),
                      TeamsOutOfSyncBanner(
                        busy: _isShuffling,
                        onRebuild: () => _handleShuffle(match),
                      ),
                    ],
                    if (isManager &&
                        !isCompetition &&
                        (match.status == 'planning' ||
                            match.status == 'upcoming')) ...[
                      const SizedBox(height: 6),
                      ManageRosterSection(match: match),
                    ],
                    if (match.status == 'evaluated' ||
                        match.status == 'completed' ||
                        match.chronicle != null) ...[
                      MatchStoryView(match: match, part: MatchStoryPart.figure),
                      const SizedBox(height: 18),
                    ],
                    hasTeams
                        ? _TeamsRoster(match: match)
                        : _PlayersConfirmedRoster(match: match),
                    if (match.status == 'evaluated' ||
                        match.status == 'completed' ||
                        match.chronicle != null) ...[
                      const SizedBox(height: 20),
                      MatchStoryView(
                        match: match,
                        part: MatchStoryPart.planilla,
                      ),
                      const SizedBox(height: 20),
                      MatchStoryView(
                        match: match,
                        part: MatchStoryPart.chronicle,
                      ),
                    ],
                    if (match.events.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      MatchTimelineView(match: match),
                    ],
                    if (match.status != 'upcoming') ...[
                      const SizedBox(height: 20),
                      MatchClipsView(
                        match: match,
                        // Los dos equipos suben: jugadores de ambos y los
                        // capitanes (que pueden no jugar).
                        canUpload:
                            isUserInMatch || isManager || isLinkedGroupMember,
                      ),
                    ],
                    const SizedBox(height: 20),
                    _ChatPreviewCard(
                      matchId: match.id,
                      canChat: isManager || isUserInMatch,
                      onOpenChat: () => _openMatchChat(context, match),
                    ),
                    if (isManager) ...[
                      const SizedBox(height: 16),
                      _OrganizerPanel(
                        match: match,
                        isOwner: isOwner,
                        hasTeams: hasTeams,
                        isCompetition: isCompetition,
                        isShuffling: _isShuffling,
                        canFinalize:
                            isManager &&
                            match.status == 'upcoming' &&
                            match.players.length >= 2,
                        isFinishing: _isFinishing,
                        onShuffle: () => _handleShuffle(match),
                        onReschedule: () => _showRescheduleDialog(match),
                        onChangeVenue: () => _showChangeVenueDialog(match),
                        onDelete: () => _handleDelete(match),
                        onCancel: match.canCancel
                            ? () => _handleCancel(match)
                            : null,
                        onFinish: () => _handleFinish(match),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        );
      },
      loading: () => const Scaffold(
        backgroundColor: Colors.transparent,
        body: PateaLoading(),
      ),
      error: (e, _) => Scaffold(
        backgroundColor: Colors.transparent,
        body: PateaError(
          error: e,
          message: 'No pudimos cargar este partido.',
          onRetry: () =>
              ref.invalidate(singleMatchStreamProvider(widget.matchId)),
        ),
      ),
    );
  }
}

/// Roster para partidos con equipos armados.
class _TeamsRoster extends StatelessWidget {
  final MatchModel match;

  const _TeamsRoster({required this.match});

  @override
  Widget build(BuildContext context) {
    final teams = [match.teamA!, match.teamB!];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Equipos',
              style: AppTypography.headline(size: 17, weight: FontWeight.w900),
            ),
            const SizedBox(width: 8),
            Text(
              match.players.length == 1
                  ? '1 jugador'
                  : '${match.players.length} jugadores',
              style: AppTypography.body(
                size: 12,
                weight: FontWeight.w600,
                color: context.c.textSecondary,
              ),
            ),
          ],
        ),
        for (final team in teams) ...[
          const SizedBox(height: 20),
          _TeamBlock(team: team, match: match),
        ],
      ],
    );
  }
}

class _TeamBlock extends ConsumerWidget {
  final MatchTeam team;
  final MatchModel match;

  const _TeamBlock({required this.team, required this.match});

  String? _photoOf(MatchPlayerEntry p) {
    if (p.photoURL != null && p.photoURL!.isNotEmpty) return p.photoURL;
    for (final mp in match.players) {
      if (mp.uid == p.uid && mp.photoURL != null && mp.photoURL!.isNotEmpty) {
        return mp.photoURL;
      }
    }
    return null;
  }

  double? _calcAvgOvr(List<MatchPlayerEntry> players) {
    final rated = players.where((p) => p.ovr > 0).toList();
    if (rated.isEmpty) return null;
    return rated.fold<double>(0, (acc, p) => acc + p.ovr) / rated.length;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final players = [...team.players]..sort((a, b) => b.ovr.compareTo(a.ovr));
    final avgOvr = _calcAvgOvr(players);
    final columns = MediaQuery.textScalerOf(context).scale(14) > 21 ? 1 : 2;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            if (team.jersey != null)
              JerseyWidget(jersey: team.jersey!, size: 44)
            else
              Icon(Icons.checkroom, size: 38, color: context.c.textSecondary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          team.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.headline(
                            size: 18,
                            weight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 6,
                    runSpacing: 2,
                    children: [
                      Text(
                        '${team.players.length} jugadores',
                        style: AppTypography.body(
                          size: 12,
                          weight: FontWeight.w600,
                          color: context.c.textSecondary,
                        ),
                      ),
                      if (avgOvr != null) ...[
                        Text(
                          'OVR promedio ${avgOvr.toStringAsFixed(1)}',
                          style: AppTypography.body(
                            size: 12,
                            color: context.c.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // Mosaico 2 columnas
        for (var i = 0; i < players.length; i += columns)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _MosaicPlayer(
                    player: players[i],
                    photo: _photoOf(players[i]),
                    match: match,
                    onTap: () => _showPlayerCardModal(
                      context,
                      ref,
                      players[i],
                      photo: _photoOf(players[i]),
                    ),
                  ),
                ),
                if (columns == 2) const SizedBox(width: 8),
                if (columns == 2)
                  Expanded(
                    child: i + 1 < players.length
                        ? _MosaicPlayer(
                            player: players[i + 1],
                            photo: _photoOf(players[i + 1]),
                            match: match,
                            onTap: () => _showPlayerCardModal(
                              context,
                              ref,
                              players[i + 1],
                              photo: _photoOf(players[i + 1]),
                            ),
                          )
                        : const SizedBox.shrink(),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _MosaicPlayer extends StatelessWidget {
  final MatchPlayerEntry player;
  final String? photo;
  final MatchModel match;
  final VoidCallback onTap;

  const _MosaicPlayer({
    required this.player,
    required this.photo,
    required this.match,
    required this.onTap,
  });

  String _formatPosition(String pos) {
    switch (pos.toUpperCase().trim()) {
      case 'POR':
      case 'ARQUERO':
      case 'PORTERO':
        return 'Arquero';
      case 'DEF':
      case 'DEFENSOR':
      case 'DEFENSA':
        return 'Defensor';
      case 'MED':
      case 'VOLANTE':
      case 'MEDIO':
      case 'MEDIOCAMPISTA':
        return 'Volante';
      case 'DEL':
      case 'DELANTERO':
        return 'Delantero';
      default:
        return pos.isNotEmpty ? pos : 'Jugador';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.cardAll,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
          child: Row(
            children: [
              PateaAvatar(
                photoUrl: photo,
                seed: player.uid.isNotEmpty ? player.uid : player.displayName,
                size: 46,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      player.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.headline(
                        size: 15,
                        weight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            _formatPosition(player.position),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.code(
                              size: 12,
                              weight: FontWeight.w800,
                              color: context.c.positionColor(player.position),
                            ),
                          ),
                        ),
                        if (player.ovr > 0) ...[
                          const SizedBox(width: 5),
                          Text(
                            '${player.ovr}',
                            style: AppTypography.code(
                              size: 12,
                              weight: FontWeight.w600,
                              color: context.c.textSecondary,
                            ),
                          ),
                        ],
                      ],
                    ),
                    _PlayerMatchBadges(match: match, playerUid: player.uid),
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

/// Badges deportivos individuales en el roster para goles, asistencias, tarjetas y figura.
class _PlayerMatchBadges extends StatelessWidget {
  final MatchModel match;
  final String playerUid;

  const _PlayerMatchBadges({required this.match, required this.playerUid});

  @override
  Widget build(BuildContext context) {
    if (playerUid.isEmpty) return const SizedBox.shrink();

    int goals = 0;
    int assists = 0;
    int yellows = 0;
    int reds = 0;

    for (final e in match.events) {
      if (e.type == 'goal') {
        if (e.playerId == playerUid) goals++;
        if (e.assistId == playerUid) assists++;
      } else if (e.type == 'card' && e.playerId == playerUid) {
        if (e.cardType == 'red') {
          reds++;
        } else {
          yellows++;
        }
      }
    }

    final isMvp = match.bestPlayerId == playerUid;

    if (goals == 0 && assists == 0 && yellows == 0 && reds == 0 && !isMvp) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Wrap(
        spacing: 4,
        runSpacing: 2,
        children: [
          if (isMvp)
            PateaCard(
              color: context.c.goldBorder.withValues(alpha: 0.2),
              radius: AppRadii.hairAll,
              borderColor: context.c.goldBorder.withValues(alpha: 0.5),
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.emoji_events_rounded,
                    size: 11,
                    color: context.c.goldText,
                  ),
                  const SizedBox(width: 2),
                  Flexible(
                    child: Text(
                      'Figura',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(
                        size: 12,
                        weight: FontWeight.w700,
                        color: context.c.goldText,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          if (goals > 0)
            _MiniBadge(
              icon: Icons.sports_soccer_rounded,
              text: goals > 1 ? '$goals' : null,
              semanticsLabel: '$goals ${goals == 1 ? 'gol' : 'goles'}',
              color: context.c.primary,
            ),
          if (assists > 0)
            _MiniBadge(
              icon: Icons.trending_up_rounded,
              text: assists > 1 ? '$assists' : null,
              semanticsLabel:
                  '$assists ${assists == 1 ? 'asistencia' : 'asistencias'}',
              color: context.c.textSecondary,
            ),
          if (reds > 0)
            _MiniBadge(
              icon: Icons.style_rounded,
              semanticsLabel: '$reds roja',
              color: context.c.destructive,
            ),
          if (yellows > 0)
            _MiniBadge(
              icon: Icons.style_rounded,
              semanticsLabel: '$yellows amarilla',
              color: context.c.warningText,
            ),
        ],
      ),
    );
  }
}

class _MiniBadge extends StatelessWidget {
  final IconData icon;
  final String? text;
  final String semanticsLabel;
  final Color color;

  const _MiniBadge({
    required this.icon,
    this.text,
    required this.semanticsLabel,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: semanticsLabel,
      excludeSemantics: true,
      child: PateaCard(
        color: color.withValues(alpha: 0.14),
        radius: AppRadii.hairAll,
        borderColor: color.withValues(alpha: 0.35),
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: color),
            if (text != null) ...[
              const SizedBox(width: 3),
              Text(
                text!,
                style: AppTypography.body(
                  size: 12,
                  weight: FontWeight.w600,
                  color: color,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Roster de jugadores confirmados cuando todavía no se armaron equipos.
class _PlayersConfirmedRoster extends ConsumerWidget {
  final MatchModel match;

  const _PlayersConfirmedRoster({required this.match});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PateaCard(
      color: context.c.card,
      radius: AppRadii.cardAll,
      borderColor: context.c.border.withValues(alpha: 0.35),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.groups_outlined,
                size: 18,
                color: context.c.textSecondary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Jugadores confirmados',
                  style: AppTypography.headline(size: 15),
                  maxLines: 2,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: context.c.cardSurface,
                  borderRadius: AppRadii.surfaceAll,
                ),
                child: Text(
                  '${match.players.length}/${match.matchSize}',
                  style: AppTypography.code(
                    color: context.c.textSecondary,
                    size: 12,
                    weight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (match.players.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  'Todavía no hay jugadores confirmados',
                  style: AppTypography.body(
                    size: 12,
                    color: context.c.textSecondary,
                  ),
                ),
              ),
            )
          else
            SizedBox(
              height: 126,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: match.players.length,
                separatorBuilder: (_, index) => const SizedBox(width: 14),
                itemBuilder: (context, index) {
                  final p = match.players[index];
                  return Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => _showPlayerCardModal(
                        context,
                        ref,
                        p,
                        photo: p.photoURL,
                      ),
                      borderRadius: AppRadii.cardAll,
                      child: Padding(
                        padding: const EdgeInsets.all(4.0),
                        child: SizedBox(
                          width: 76,
                          child: Column(
                            children: [
                              PateaAvatar(
                                photoUrl: p.photoURL,
                                seed: p.displayName,
                                size: 48,
                              ),
                              const SizedBox(height: 5),
                              Text(
                                p.displayName.split(' ').first,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: AppTypography.headline(
                                  size: 14,
                                  weight: FontWeight.w600,
                                ),
                              ),
                              Text(
                                '${p.position} ${p.ovr > 0 ? p.ovr : ""}'
                                    .trim(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.code(
                                  size: 12,
                                  color: context.c.positionColor(p.position),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

/// Panel completo de administración del organizador visible directamente en la pantalla.
class _OrganizerPanel extends StatelessWidget {
  final MatchModel match;

  /// Sólo el organizador borra el partido; un capitán gestiona lo demás.
  final bool isOwner;
  final bool hasTeams;
  final bool isCompetition;
  final bool isShuffling;
  final bool canFinalize;
  final bool isFinishing;
  final VoidCallback onShuffle;
  final VoidCallback onReschedule;
  final VoidCallback onChangeVenue;
  final VoidCallback onDelete;
  final VoidCallback? onCancel;
  final VoidCallback onFinish;

  const _OrganizerPanel({
    required this.match,
    required this.isOwner,
    required this.hasTeams,
    required this.isCompetition,
    required this.isShuffling,
    required this.canFinalize,
    required this.isFinishing,
    required this.onShuffle,
    required this.onReschedule,
    required this.onChangeVenue,
    required this.onDelete,
    this.onCancel,
    required this.onFinish,
  });

  @override
  Widget build(BuildContext context) {
    final canEvaluate = match.status == 'completed';
    // En un partido entre equipos los planteles son los de cada equipo: no se
    // reparten, no se re-equilibran y no se completan con jugadores sueltos.
    final isTeamMatch = match.isTeamMatch;

    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      shape: const Border(),
      collapsedShape: const Border(),
      leading: Icon(
        Icons.admin_panel_settings_outlined,
        color: context.c.textSecondary,
      ),
      title: Text(
        'Panel del organizador',
        style: AppTypography.action(size: 14),
      ),
      children: [
        PateaCard(
          color: context.c.card,
          radius: AppRadii.cardAll,
          borderColor: context.c.border.withValues(alpha: 0.35),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (match.status == 'upcoming' && !isCompetition) ...[
                    if (match.players.length < match.matchSize && !isTeamMatch)
                      OutlinedButton.icon(
                        onPressed: () =>
                            RecruitPlayersSheet.show(context, match),
                        icon: const Icon(
                          Icons.person_search_outlined,
                          size: 15,
                        ),
                        label: const Text('Falta uno'),
                        style: OutlinedButton.styleFrom(
                          backgroundColor: context.c.cardSurface.withValues(
                            alpha: 0.5,
                          ),
                          foregroundColor: context.c.textPrimary,
                          side: BorderSide(
                            color: context.c.border.withValues(alpha: 0.5),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: AppRadii.cardAll,
                          ),
                        ),
                      ),
                    if (hasTeams && !isTeamMatch && isOwner)
                      OutlinedButton.icon(
                        onPressed: isShuffling
                            ? null
                            : () => EditTeamsSheet.show(context, match),
                        icon: const Icon(Icons.swap_horiz_rounded, size: 15),
                        label: const Text('Armar equipos'),
                        style: OutlinedButton.styleFrom(
                          backgroundColor: context.c.cardSurface.withValues(
                            alpha: 0.5,
                          ),
                          foregroundColor: context.c.textPrimary,
                          side: BorderSide(
                            color: context.c.border.withValues(alpha: 0.5),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: AppRadii.cardAll,
                          ),
                        ),
                      ),
                    if (!isTeamMatch && isOwner)
                      OutlinedButton.icon(
                        onPressed: isShuffling ? null : onShuffle,
                        icon: isShuffling
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: PateaButtonProgress(),
                              )
                            : const Icon(Icons.shuffle_rounded, size: 15),
                        label: Text(
                          hasTeams
                              ? 'Recalcular equilibrio'
                              : 'Equilibrar equipos',
                        ),
                        style: OutlinedButton.styleFrom(
                          backgroundColor: context.c.cardSurface.withValues(
                            alpha: 0.5,
                          ),
                          foregroundColor: context.c.primary,
                          side: BorderSide(
                            color: context.c.primary.withValues(alpha: 0.4),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: AppRadii.cardAll,
                          ),
                        ),
                      ),
                    OutlinedButton.icon(
                      onPressed: onReschedule,
                      icon: const Icon(Icons.calendar_month_outlined, size: 15),
                      label: const Text('Reprogramar'),
                      style: OutlinedButton.styleFrom(
                        backgroundColor: context.c.cardSurface.withValues(
                          alpha: 0.5,
                        ),
                        foregroundColor: context.c.textPrimary,
                        side: BorderSide(
                          color: context.c.border.withValues(alpha: 0.5),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: AppRadii.cardAll,
                        ),
                      ),
                    ),
                    OutlinedButton.icon(
                      onPressed: onChangeVenue,
                      icon: const Icon(Icons.map_outlined, size: 15),
                      label: const Text('Cambiar Cancha'),
                      style: OutlinedButton.styleFrom(
                        backgroundColor: context.c.cardSurface.withValues(
                          alpha: 0.5,
                        ),
                        foregroundColor: context.c.textPrimary,
                        side: BorderSide(
                          color: context.c.border.withValues(alpha: 0.5),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: AppRadii.cardAll,
                        ),
                      ),
                    ),
                    if (canFinalize)
                      ElevatedButton.icon(
                        onPressed: isFinishing ? null : onFinish,
                        icon: isFinishing
                            ? SizedBox(
                                width: 14,
                                height: 14,
                                child: const PateaButtonProgress(),
                              )
                            : Icon(Icons.check_circle_outline, size: 15),
                        label: Text(
                          'Finalizar Partido',
                          style: AppTypography.action(
                            size: 14,
                            weight: FontWeight.w700,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: context.c.primary,
                          foregroundColor: context.c.onPrimary,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: AppRadii.cardAll,
                          ),
                        ),
                      ),
                  ],
                  if (canEvaluate) ...[
                    ElevatedButton.icon(
                      onPressed: () =>
                          context.push('/matches/${match.id}/evaluate'),
                      icon: Icon(
                        Icons.fact_check_rounded,
                        size: 15,
                        color: context.c.onPrimary,
                      ),
                      label: Text(
                        'Ver Evaluaciones',
                        style: AppTypography.action(
                          size: 14,
                          weight: FontWeight.w700,
                          color: context.c.onPrimary,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: context.c.primary,
                        foregroundColor: context.c.onPrimary,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: AppRadii.cardAll,
                        ),
                      ),
                    ),
                  ],
                  if (isOwner && onCancel != null)
                    OutlinedButton.icon(
                      onPressed: onCancel,
                      icon: Icon(
                        Icons.event_busy_rounded,
                        size: 15,
                        color: context.c.textSecondary,
                      ),
                      label: Text(
                        'Cancelar Partido',
                        style: AppTypography.action(
                          size: 14,
                          color: context.c.textSecondary,
                        ),
                      ),
                    ),
                  if (isOwner)
                    OutlinedButton.icon(
                      onPressed: onDelete,
                      icon: Icon(
                        Icons.delete_outline_rounded,
                        size: 15,
                        color: context.c.destructive,
                      ),
                      label: Text(
                        'Eliminar Partido',
                        style: AppTypography.action(
                          size: 14,
                          color: context.c.destructive,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        backgroundColor: context.c.cardSurface.withValues(
                          alpha: 0.5,
                        ),
                        foregroundColor: context.c.destructive,
                        side: BorderSide(
                          color: context.c.destructive.withValues(alpha: 0.4),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: AppRadii.cardAll,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Sticky Action Bar flotante fija en la parte inferior.
class _StickyActionBar extends StatelessWidget {
  final MatchModel match;
  final String? uid;
  final bool isOwner;

  /// Organizador o capitán: dirigen en vivo e inician/cierran el partido.
  final bool isManager;
  final bool isUserInMatch;
  final bool isPending;
  final bool isMatchFull;
  final bool isJoining;
  final bool isFinishing;
  final VoidCallback? onJoinLeave;
  final VoidCallback? onFinish;

  const _StickyActionBar({
    required this.match,
    required this.uid,
    required this.isOwner,
    required this.isManager,
    required this.isUserInMatch,
    required this.isPending,
    required this.isMatchFull,
    required this.isJoining,
    required this.isFinishing,
    required this.onJoinLeave,
    this.onFinish,
  });

  @override
  Widget build(BuildContext context) {
    final isCompetition = [
      'league',
      'cup',
      'league_final',
    ].contains(match.type);
    final isLive = match.status == 'active';
    final isCompleted = match.status == 'completed';

    Widget? actionWidget;

    if (isLive) {
      actionWidget = ElevatedButton.icon(
        onPressed: () => context.push('/matches/${match.id}/live'),
        style: ElevatedButton.styleFrom(
          backgroundColor: context.c.destructive,
          foregroundColor: context.c.onPrimary,
          padding: const EdgeInsets.symmetric(vertical: 14),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
        ),
        icon: Icon(Icons.sensors_rounded, size: 20, color: context.c.onPrimary),
        label: Text(
          isManager ? 'Dirigir en vivo' : 'Seguir en vivo',
          style: AppTypography.action(size: 16, color: context.c.onPrimary),
        ),
      );
    } else if (isCompleted && !isCompetition) {
      actionWidget = ElevatedButton.icon(
        onPressed: () => context.push(
          isOwner
              ? '/matches/${match.id}/evaluate'
              : '/evaluations/${match.id}',
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: context.c.primary,
          foregroundColor: context.c.onPrimary,
          padding: const EdgeInsets.symmetric(vertical: 14),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
        ),
        icon: Icon(
          isOwner ? Icons.fact_check_rounded : Icons.rate_review_rounded,
          size: 20,
          color: context.c.onPrimary,
        ),
        label: Text(
          isOwner ? 'Ver evaluaciones' : 'Evaluar partido',
          style: AppTypography.action(size: 16, color: context.c.onPrimary),
        ),
      );
    } else if (match.status == 'upcoming' && isCompetition && isManager) {
      // Los partidos de una competición también se dirigen desde acá: la pantalla
      // en vivo ofrece iniciar, y al finalizar el resultado llega solo a la
      // tabla o la llave (`syncCompetitionResult`).
      actionWidget = ElevatedButton.icon(
        onPressed: () => context.push('/matches/${match.id}/live'),
        style: ElevatedButton.styleFrom(
          backgroundColor: context.c.primary,
          foregroundColor: context.c.onPrimary,
          padding: const EdgeInsets.symmetric(vertical: 14),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
        ),
        icon: const Icon(Icons.play_arrow_rounded, size: 20),
        label: Text(
          'Dirigir',
          style: AppTypography.action(size: 16, color: context.c.onPrimary),
        ),
      );
    } else if (match.status == 'upcoming' && !isCompetition) {
      if (isManager) {
        final canFinalize = match.players.length >= 2;
        actionWidget = Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () => context.push('/matches/${match.id}/live'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: context.c.cardSurface,
                  foregroundColor: context.c.textPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                ),
                icon: const Icon(Icons.play_arrow_rounded, size: 18),
                label: Text(
                  'Dirigir',
                  style: AppTypography.action(
                    size: 15,
                    color: context.c.textPrimary,
                  ),
                ),
              ),
            ),
            if (canFinalize) ...[
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: isFinishing ? null : onFinish,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: context.c.primary,
                    foregroundColor: context.c.onPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadii.cardAll,
                    ),
                  ),
                  icon: isFinishing
                      ? SizedBox(
                          width: 16,
                          height: 16,
                          child: const PateaButtonProgress(),
                        )
                      : Icon(Icons.check_circle_outline, size: 18),
                  label: Text(
                    'Finalizar',
                    style: AppTypography.action(size: 15),
                  ),
                ),
              ),
            ],
          ],
        );
      } else {
        final needsApproval = match.needsApprovalFrom(uid);
        if (isUserInMatch) {
          actionWidget = Row(
            children: [
              PateaCard(
                color: context.c.cardSurface,
                radius: AppRadii.cardAll,
                borderColor: context.c.primary.withValues(alpha: 0.35),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.check_circle_rounded,
                      size: 16,
                      color: context.c.primary,
                    ),
                    const SizedBox(width: 7),
                    Text(
                      'Anotado',
                      style: AppTypography.body(
                        size: 12,
                        weight: FontWeight.w600,
                        color: context.c.primary,
                      ),
                    ),
                  ],
                ),
              ),
              // En un partido de plantel fijo nadie "se baja": el servidor lo
              // rechaza. Si no puede ir, lo avisa a los capitanes ("No puedo ir").
              ...[
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: isJoining ? null : onJoinLeave,
                  style: OutlinedButton.styleFrom(
                    backgroundColor: context.c.cardSurface.withValues(
                      alpha: 0.5,
                    ),
                    foregroundColor: context.c.textSecondary,
                    side: BorderSide(
                      color: context.c.border.withValues(alpha: 0.5),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadii.cardAll,
                    ),
                  ),
                  icon: isJoining
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: PateaButtonProgress(),
                        )
                      : Icon(
                          Icons.logout_rounded,
                          size: 16,
                          color: context.c.textSecondary,
                        ),
                  label: Text(
                    !match.hasFixedRoster
                        ? 'Darme de baja'
                        : (match.unavailablePlayerUids.contains(uid)
                              ? 'Sí puedo ir'
                              : 'No puedo ir'),
                    style: AppTypography.action(
                      size: 15,
                      weight: FontWeight.w600,
                      color: context.c.textSecondary,
                    ),
                  ),
                ),
              ),
              ],
            ],
          );
        } else if (isPending) {
          actionWidget = PateaCard(
            color: context.c.cardSurface,
            radius: AppRadii.cardAll,
            borderColor: context.c.primary.withValues(alpha: 0.3),
            padding: const EdgeInsets.symmetric(vertical: 13),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.hourglass_top_rounded,
                  size: 18,
                  color: context.c.primary,
                ),
                const SizedBox(width: 8),
                Text(
                  'Solicitud enviada',
                  style: AppTypography.action(
                    size: 14,
                    color: context.c.primary,
                  ),
                ),
              ],
            ),
          );
        } else if (isMatchFull) {
          actionWidget = PateaCard(
            color: context.c.cardSurface,
            radius: AppRadii.cardAll,
            borderColor: context.c.border.withValues(alpha: 0.3),
            padding: const EdgeInsets.symmetric(vertical: 13),
            // A Center without heightFactor expands the bottom bar to the
            // entire viewport, hiding the match for viewers without a place.
            child: Text(
              'Partido completo',
              textAlign: TextAlign.center,
              style: AppTypography.action(
                size: 15,
                color: context.c.textSecondary,
              ),
            ),
          );
        } else if (!match.isTeamMatch) {
          // Un partido entre equipos no se pide ni se toma de a un jugador:
          // el plantel es el de cada equipo.
          actionWidget = ElevatedButton.icon(
            onPressed: isJoining ? null : onJoinLeave,
            style: ElevatedButton.styleFrom(
              backgroundColor: context.c.primary,
              foregroundColor: context.c.onPrimary,
              padding: const EdgeInsets.symmetric(vertical: 14),
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
            ),
            icon: isJoining
                ? SizedBox(
                    width: 16,
                    height: 16,
                    child: const PateaButtonProgress(),
                  )
                : Icon(
                    needsApproval
                        ? Icons.how_to_reg_rounded
                        : Icons.sports_soccer_rounded,
                    size: 20,
                  ),
            label: Text(
              needsApproval ? 'Pedir lugar' : 'Anotarme al partido',
              style: AppTypography.action(size: 16),
            ),
          );
        }
      }
    }

    if (actionWidget == null) return const SizedBox.shrink();

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          padding: EdgeInsets.fromLTRB(
            16,
            10,
            16,
            10 + MediaQuery.of(context).padding.bottom,
          ),
          decoration: BoxDecoration(
            color: context.c.popover.withValues(alpha: 0.92),
            border: Border(
              top: BorderSide(color: context.c.border.withValues(alpha: 0.35)),
            ),
          ),
          child: actionWidget,
        ),
      ),
    );
  }
}

final matchLastMessageStreamProvider =
    StreamProvider.family<Map<String, dynamic>?, String>((ref, matchId) {
      try {
        return FirebaseFirestore.instance
            .collection('matches/$matchId/messages')
            .orderBy('createdAt', descending: true)
            .limit(1)
            .snapshots()
            .map(
              (snap) => snap.docs.isNotEmpty ? snap.docs.first.data() : null,
            );
      } catch (_) {
        return Stream.value(null);
      }
    });

/// Tarjeta resumen del chat en el feed del partido.
class _ChatPreviewCard extends ConsumerWidget {
  final String matchId;
  final VoidCallback onOpenChat;
  final bool canChat;

  const _ChatPreviewCard({
    required this.matchId,
    required this.onOpenChat,
    required this.canChat,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lastMsg = canChat
        ? ref.watch(matchLastMessageStreamProvider(matchId)).asData?.value
        : null;

    return PateaCard(
      color: context.c.card,
      radius: AppRadii.cardAll,
      borderColor: context.c.border.withValues(alpha: 0.35),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onOpenChat,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.chat_bubble_outline_rounded,
                      color: context.c.primary,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Chat del Partido',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.headline(size: 15),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2.5,
                      ),
                      decoration: BoxDecoration(
                        color: context.c.primary.withValues(alpha: 0.12),
                        borderRadius: AppRadii.cardAll,
                      ),
                      child: Text(
                        'Abrir',
                        style: AppTypography.action(
                          size: 14,
                          color: context.c.primary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                if (lastMsg == null)
                  Text(
                    canChat
                        ? 'Sin mensajes aún. Tocá para iniciar la charla.'
                        : 'Solo participantes y organizador.',
                    style: AppTypography.body(
                      size: 12,
                      color: context.c.textSecondary,
                    ),
                  )
                else
                  Text(
                    '${(lastMsg['senderName'] as String?) ?? "Jugador"}: ${(lastMsg['text'] as String?) ?? ""}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.body(
                      size: 12.5,
                      color: context.c.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Amplía la ficha directamente sobre el partido.
void _showPlayerCardModal(
  BuildContext context,
  WidgetRef ref,
  MatchPlayerEntry entry, {
  String? photo,
}) {
  showPlayerCardPreview(context, entry, photo: photo);
}

void _openMatchChat(BuildContext context, MatchModel match) {
  Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => MatchChatScreen(match: match)),
  );
}

class _IntergroupChallengeBanner extends ConsumerStatefulWidget {
  final MatchModel match;
  final String? uid;

  const _IntergroupChallengeBanner({required this.match, required this.uid});

  @override
  ConsumerState<_IntergroupChallengeBanner> createState() =>
      _IntergroupChallengeBannerState();
}

class _IntergroupChallengeBannerState
    extends ConsumerState<_IntergroupChallengeBanner> {
  bool _busy = false;

  Future<void> _respond(bool accepted) async {
    final toTeamId = widget.match.challengeToTeamId ?? '';
    final invitationId = widget.match.challengeInvitationId ?? '';
    if (_busy || toTeamId.isEmpty || invitationId.isEmpty) return;

    setState(() => _busy = true);
    try {
      await ref
          .read(teamChallengeServiceProvider)
          .respondTeamChallenge(
            toTeamId: toTeamId,
            invitationId: invitationId,
            accepted: accepted,
          );
      ref.invalidate(myTeamChallengesProvider);
      ref.invalidate(teamRivalsProvider);
      if (mounted) {
        PateaSnack.ok(
          context,
          accepted
              ? '¡Desafío aceptado! Partido confirmado.'
              : 'Desafío rechazado.',
        );
      }
    } catch (e) {
      if (mounted) {
        PateaSnack.error(context, challengeErrorMessage(e));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final match = widget.match;
    final uid = widget.uid;
    final isDeclined = match.challengeStatus == 'declined';

    if (isDeclined) {
      final canRetry = match.isManagedBy(uid);
      final fromTeamId = match.challengeFromTeamId ?? '';
      return PateaCard(
        radius: AppRadii.cardAll,
        color: c.card,
        borderColor: c.warningText.withValues(alpha: 0.45),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Icons.handshake_outlined, size: 20, color: c.warningText),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'El equipo anterior no pudo jugar este partido.',
                    style: AppTypography.body(
                      size: 13.5,
                      weight: FontWeight.w700,
                      color: c.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
            if (canRetry && fromTeamId.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                'Tu fecha, hora y cancha siguen guardadas. Elegí otro rival para no perder la reserva.',
                style: AppTypography.body(size: 12.5, color: c.textSecondary),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => context.push(
                  '/challenge?teamId=$fromTeamId&matchId=${match.id}',
                ),
                icon: const Icon(Icons.search, size: 18),
                label: const Text('Elegir otro rival'),
              ),
            ],
          ],
        ),
      );
    }

    final toTeamId = match.challengeToTeamId ?? '';
    final toTeam = toTeamId.isEmpty
        ? null
        : ref.watch(singleTeamStreamProvider(toTeamId)).value;
    final toGroupRole = toTeam == null || toTeam.groupId.isEmpty
        ? null
        : ref.watch(myGroupRoleProvider(toTeam.groupId)).value;
    final canRespond =
        uid != null &&
        toTeam != null &&
        (toTeam.createdBy == uid ||
            hasPermission(toGroupRole, GroupPermission.teamsEdit));

    final fromName = match.challengeFromTeamName?.isNotEmpty == true
        ? match.challengeFromTeamName!
        : 'Un equipo';
    final toName = match.challengeToTeamName?.isNotEmpty == true
        ? match.challengeToTeamName!
        : 'Rival por confirmar';
    final message = (match.challengeMessage ?? '').trim();

    return PateaCard(
      radius: AppRadii.cardAll,
      color: c.card,
      borderColor: (canRespond ? c.primary : c.overlayLine).withValues(
        alpha: canRespond ? 0.65 : 1,
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                Icons.handshake_outlined,
                size: 20,
                color: canRespond ? c.primary : c.textSecondary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  canRespond
                      ? '$fromName desafió a $toName'
                      : 'Desafío enviado a $toName · Esperando confirmación',
                  style: AppTypography.body(
                    size: 13.5,
                    weight: FontWeight.w700,
                    color: c.textPrimary,
                  ),
                ),
              ),
            ],
          ),
          if (message.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              '«$message»',
              style: AppTypography.body(
                size: 12.5,
                color: c.textSecondary,
              ),
            ),
          ],
          if (canRespond) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : () => _respond(false),
                    child: const Text('Rechazar'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: _busy ? null : () => _respond(true),
                    child: _busy
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: PateaButtonProgress(),
                          )
                        : const Text('Aceptar desafío'),
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
