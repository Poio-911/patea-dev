import 'dart:async';
import '../../core/theme/app_radii.dart';
import '../../core/widgets/patea_avatar.dart';
import 'dart:ui' show ImageFilter;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/models/match_model.dart';
import '../../core/models/player_model.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/location_service.dart';
import '../../core/services/match_service.dart';
import '../../core/services/push_permission.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_insets.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/dates.dart';
import '../../core/theme/match_theme.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/player_avatar_fallback.dart';
import '../../core/widgets/player_card_widget.dart';
import 'widgets/edit_teams_sheet.dart';
import 'widgets/join_requests_section.dart';
import 'widgets/match_clips_view.dart';
import 'widgets/match_planning_view.dart';
import 'widgets/match_story_view.dart';
import 'widgets/match_timeline.dart';
import 'widgets/recruit_players_sheet.dart';
import 'widgets/weather_alert.dart';




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

  Future<void> _handleJoinLeave(MatchModel match, String uid, bool isUserInMatch) async {
    setState(() => _isJoining = true);
    try {
      if (isUserInMatch) {
        await ref.read(matchServiceProvider).leaveMatch(match.id, uid);
      } else if (match.type == 'manual' && match.ownerUid != uid) {
        final already = await ref.read(matchServiceProvider).requestJoinMatch(match.id);
        if (mounted) {
          _showSnack(already
              ? 'Ya habías pedido entrar a este partido.'
              : 'Solicitud enviada. El organizador te va a responder.');
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
      await ref.read(matchServiceProvider).finishMatch(match.id);
      if (mounted) _showSnack('Partido finalizado. Ya se habilitaron las evaluaciones.');
    } catch (e) {
      if (mounted) _showError('$e');
    } finally {
      if (mounted) setState(() => _isFinishing = false);
    }
  }

  Future<void> _handleShuffle(MatchModel match) async {
    setState(() => _isShuffling = true);
    try {
      await ref.read(matchServiceProvider).shuffleTeams(match.id);
      if (mounted) _showSnack('¡Equipos sorteados!');
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
        backgroundColor: AppColors.card,
        title: Text('¿Borrar este partido?', style: AppTypography.headline(size: 16)),
        content: Text(
          'Esta acción es permanente y no se puede deshacer. Los jugadores inscriptos recibirán una notificación de cancelación.',
          style: AppTypography.body(color: AppColors.textSecondary, size: 13),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.destructive),
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

  Future<void> _showRescheduleDialog(MatchModel match) async {
    DateTime selectedDate = DateTime.tryParse(match.date)?.toLocal() ?? DateTime.now().add(const Duration(days: 1));
    TimeOfDay selectedTime = () {
      final parts = (match.time ?? '21:00').split(':');
      return TimeOfDay(hour: int.tryParse(parts[0]) ?? 21, minute: parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0);
    }();
    bool submitting = false;

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: AppColors.card,
          title: Text('Reprogramar partido', style: AppTypography.headline(size: 16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.calendar_today),
                title: Text('${selectedDate.day}/${selectedDate.month}/${selectedDate.year}'),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: selectedDate,
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  if (picked != null) setDialogState(() => selectedDate = picked);
                },
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.access_time),
                title: Text(selectedTime.format(context)),
                onTap: () async {
                  final picked = await showTimePicker(context: context, initialTime: selectedTime);
                  if (picked != null) setDialogState(() => selectedTime = picked);
                },
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: submitting ? null : () => Navigator.pop(context), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      setDialogState(() => submitting = true);
                      final dateIso = DateTime(selectedDate.year, selectedDate.month, selectedDate.day).toIso8601String();
                      final timeStr = '${selectedTime.hour.toString().padLeft(2, '0')}:${selectedTime.minute.toString().padLeft(2, '0')}';
                      try {
                        await ref.read(matchServiceProvider).updateMatchDate(match.id, dateIso, timeStr);
                        if (context.mounted) Navigator.pop(context);
                      } catch (e) {
                        if (context.mounted) _showError('$e');
                        setDialogState(() => submitting = false);
                      }
                    },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: AppColors.onPrimary),
              child: submitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.onPrimary))
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

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: AppColors.card,
          title: Text('Cambiar cancha', style: AppTypography.headline(size: 16)),
          content: SizedBox(
            width: double.maxFinite,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: controller,
                  decoration: const InputDecoration(hintText: 'Buscá la nueva cancha...'),
                  onChanged: (v) {
                    selected = null;
                    debounce?.cancel();
                    debounce = Timer(const Duration(milliseconds: 300), () async {
                      if (v.trim().length < 3) {
                        setDialogState(() => suggestions = []);
                        return;
                      }
                      final results = await locationService.suggest(v);
                      setDialogState(() => suggestions = results);
                    });
                  },
                ),
                if (suggestions.isNotEmpty)
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 200),
                    child: ListView(
                      shrinkWrap: true,
                      children: suggestions
                          .map((s) => ListTile(
                                dense: true,
                                title: Text(s.label, style: AppTypography.body(color: AppColors.textSecondary, size: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
                                onTap: () => setDialogState(() {
                                  selected = s;
                                  controller.text = s.label;
                                  suggestions = [];
                                }),
                              ))
                          .toList(),
                    ),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: submitting ? null : () => Navigator.pop(context), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: submitting || selected == null
                  ? null
                  : () async {
                      setDialogState(() => submitting = true);
                      try {
                        await ref.read(matchServiceProvider).updateMatchLocation(
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
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: AppColors.onPrimary),
              child: submitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.onPrimary))
                  : const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
  }

  void _showSnack(String text) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text), backgroundColor: AppColors.success));
  }

  void _showError(String text) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text), backgroundColor: AppColors.destructive));
  }

  Future<void> _openMaps(MatchModel match) async {
    final loc = match.locationDetail;
    final query = Uri.encodeComponent(loc?.address.isNotEmpty == true ? loc!.address : (match.location ?? ''));
    final placeId = loc?.placeId ?? '';
    final url = 'https://www.google.com/maps/search/?api=1&query=$query${placeId.isNotEmpty ? '&query_place_id=$placeId' : ''}';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
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
            body: Center(child: Text('Partido no encontrado.', style: AppTypography.body(color: AppColors.textSecondary))),
          );
        }

        final isOwner = uid != null && match.ownerUid == uid;
        final isUserInMatch = uid != null && match.playerUids.contains(uid);
        final isPending = uid != null && match.pendingPlayerUids.contains(uid);
        final isMatchFull = match.players.length >= match.matchSize;
        final hasTeams = match.teamA != null && match.teamB != null;
        final isCompetition = ['league', 'cup', 'league_final'].contains(match.type);

        return Scaffold(
          backgroundColor: Colors.transparent,
          extendBodyBehindAppBar: true,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            leading: const BackButton(color: AppColors.textPrimary),
            actions: [
              IconButton(
                icon: const Icon(Icons.share_outlined, size: 20, color: AppColors.textPrimary),
                tooltip: 'Compartir partido',
                onPressed: () {
                  SharePlus.instance.share(
                    ShareParams(
                      text: '¡Se juega ${match.title}! Miralo o sumate en Pateá: https://patea.app/match/${match.id}',
                    ),
                  );
                },
              ),
              if (isOwner)
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert_rounded),
                  color: AppColors.card,
                  shape: RoundedRectangleBorder(
                    borderRadius: AppRadii.cardAll,
                    side: BorderSide(color: AppColors.border.withValues(alpha: 0.4)),
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
                    final isFinished = match.status == 'completed' || match.status == 'evaluated';
                    return [
                      if (!isFinished) ...[
                        PopupMenuItem(
                          value: 'reschedule',
                          child: Row(
                            children: [
                              const Icon(Icons.calendar_month_outlined, size: 18),
                              const SizedBox(width: 10),
                              Text('Reprogramar partido', style: AppTypography.body(color: AppColors.textSecondary, size: 13)),
                            ],
                          ),
                        ),
                        PopupMenuItem(
                          value: 'venue',
                          child: Row(
                            children: [
                              const Icon(Icons.map_outlined, size: 18),
                              const SizedBox(width: 10),
                              Text('Cambiar cancha', style: AppTypography.body(color: AppColors.textSecondary, size: 13)),
                            ],
                          ),
                        ),
                        const PopupMenuDivider(),
                      ],
                      PopupMenuItem(
                        value: 'delete',
                        child: Row(
                          children: [
                            const Icon(Icons.delete_outline, size: 18, color: AppColors.destructive),
                            const SizedBox(width: 10),
                            Text('Eliminar partido', style: AppTypography.body(size: 13, color: AppColors.destructive)),
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
            isUserInMatch: isUserInMatch,
            isPending: isPending,
            isMatchFull: isMatchFull,
            isJoining: _isJoining,
            isFinishing: _isFinishing,
            onJoinLeave: (uid == null || isCompetition) ? null : () => _handleJoinLeave(match, uid, isUserInMatch),
            onFinish: () => _handleFinish(match),
          ),
          body: ListView(
            padding: EdgeInsets.only(bottom: bottomInset(context) + 80),
            children: [
              _HeroCard(
                match: match,
                onOpenMaps: () => _openMaps(match),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    MatchWeatherAlert(match: match),
                    if (isOwner && hasTeams) ...[
                      const SizedBox(height: 10),
                      DuplicatePlayersAlert(match: match),
                    ],
                    if (match.status == 'planning' || match.isVotingOpen) ...[
                      const SizedBox(height: 14),
                      MatchPlanningView(match: match, uid: uid),
                    ],
                    if (isOwner && match.type == 'manual' && match.status == 'upcoming') ...[
                      const SizedBox(height: 14),
                      JoinRequestsSection(matchId: match.id),
                    ],
                    hasTeams
                        ? _TeamsRoster(match: match)
                        : _PlayersConfirmedRoster(match: match),
                    if (isOwner) ...[
                      const SizedBox(height: 16),
                      _OrganizerPanel(
                        match: match,
                        hasTeams: hasTeams,
                        isCompetition: isCompetition,
                        isShuffling: _isShuffling,
                        canFinalize: isOwner && match.status == 'upcoming' && match.players.length >= 2,
                        isFinishing: _isFinishing,
                        onShuffle: () => _handleShuffle(match),
                        onReschedule: () => _showRescheduleDialog(match),
                        onChangeVenue: () => _showChangeVenueDialog(match),
                        onDelete: () => _handleDelete(match),
                        onFinish: () => _handleFinish(match),
                      ),
                    ],
                    if (match.events.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      MatchTimelineView(match: match),
                    ],
                    if (match.status != 'upcoming') ...[
                      const SizedBox(height: 20),
                      MatchClipsView(match: match, canUpload: isUserInMatch || isOwner),
                    ],
                    const SizedBox(height: 20),
                    _ChatPreviewCard(
                      matchId: match.id,
                      onOpenChat: () => _openChatBottomSheet(context, match.id),
                    ),
                    if (match.status == 'evaluated' || match.status == 'completed' || match.chronicle != null) ...[
                      const SizedBox(height: 20),
                      MatchStoryView(match: match),
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
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Scaffold(
        backgroundColor: Colors.transparent,
        body: Center(child: Text('Error: $e', style: AppTypography.body(color: AppColors.destructive))),
      ),
    );
  }
}

/// Banner superior de Detalle de Partido:
/// Enfocado en el título del partido, tipo (en texto limpio), fecha y hora con protagonismo,
/// y sede resumida (nombre del local o dirección corta), sin equipos duplicados ni contenedores pesados.
class _HeroCard extends StatelessWidget {
  final MatchModel match;
  final VoidCallback onOpenMaps;

  const _HeroCard({
    required this.match,
    required this.onOpenMaps,
  });

  @override
  Widget build(BuildContext context) {
    final theme = getMatchTypeTheme(match.type);
    final isLive = match.status == 'active';
    final photoIndex = (match.id.codeUnits.fold<int>(0, (acc, c) => acc + c).abs() % 9) + 1;

    // Resumen de la sede: nombre del local o primera parte de la dirección
    final hasVenue = match.location != null && match.location!.trim().isNotEmpty;
    String venueName = 'Sede a confirmar';
    if (match.locationDetail != null && match.locationDetail!.name.trim().isNotEmpty) {
      venueName = match.locationDetail!.name.trim();
    } else if (hasVenue) {
      venueName = match.location!.trim().split(',').first.trim();
    }

    final dateStr = match.date.isNotEmpty ? fmtLongDate(match.date) : 'Fecha a definir';
    final timeStr = (match.time != null && match.time!.trim().isNotEmpty) ? '${match.time!.trim()} hs' : '';
    final dateTimeStr = timeStr.isNotEmpty ? '$dateStr • $timeStr' : dateStr;

    final categoryText = isLive ? '🔴 EN VIVO' : theme.label.toUpperCase();

    return Stack(
      children: [
        // Foto de fondo de estadio con viñeta cinematográfica
        Positioned.fill(
          child: Image.asset(
            'assets/backgrounds/fondo_$photoIndex.jpg',
            fit: BoxFit.cover,
            opacity: AlwaysStoppedAnimation(isLive ? 0.90 : 0.72),
          ),
        ),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: const [0.0, 0.50, 1.0],
                colors: [
                  Colors.black.withValues(alpha: 0.75),
                  Colors.black.withValues(alpha: 0.40),
                  AppColors.background,
                ],
              ),
            ),
          ),
        ),

        // Contenido tipográfico puro (sin cajas ni contenedores pesados)
        SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 36), // Espacio para botones del AppBar transparente (back / share)

                // Tipo de partido como texto puro
                Text(
                  categoryText,
                  style: AppTypography.code(
                    size: 11,
                    weight: FontWeight.w800,
                    color: isLive ? AppColors.destructive : AppColors.voltNeon,
                  ).copyWith(letterSpacing: 2.0),
                ),
                const SizedBox(height: 8),

                // Nombre del partido protagonista
                Text(
                  match.title.toUpperCase(),
                  style: AppTypography.jersey(
                    size: 34,
                    height: 1.05,
                    letterSpacing: 1.2,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 14),

                // Fecha y hora protagonista
                Row(
                  children: [
                    const Icon(Icons.calendar_today_rounded, size: 16, color: AppColors.voltNeon),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        dateTimeStr.toUpperCase(),
                        style: AppTypography.jersey(
                          size: 18,
                          letterSpacing: 0.8,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // Lugar resumido interactivo (sin contenedor)
                GestureDetector(
                  onTap: hasVenue ? onOpenMaps : null,
                  behavior: HitTestBehavior.opaque,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.place_outlined,
                        size: 17,
                        color: hasVenue ? AppColors.voltNeon : AppColors.textSecondary,
                      ),
                      const SizedBox(width: 7),
                      Flexible(
                        child: Text(
                          venueName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.body(
                            size: 14.5,
                            weight: FontWeight.w600,
                            color: hasVenue ? AppColors.textPrimary : AppColors.textSecondary,
                          ),
                        ),
                      ),
                      if (hasVenue) ...[
                        const SizedBox(width: 5),
                        const Icon(Icons.arrow_outward_rounded, size: 12, color: AppColors.voltNeon),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
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
            Text('Equipos', style: AppTypography.headline(size: 17, weight: FontWeight.w900)),
            const SizedBox(width: 8),
            Text(
              '${match.players.length} JUGADORES',
              style: AppTypography.code(size: 9, weight: FontWeight.w700, color: AppColors.textSecondary)
                  .copyWith(letterSpacing: 1.6),
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

    return Stack(
      clipBehavior: Clip.none,
      children: [
        // Marca de agua
        Positioned(
          left: -6,
          top: -24,
          right: 0,
          child: IgnorePointer(
            child: ClipRect(
              child: Transform(
                transform: Matrix4.skewX(-0.16),
                alignment: Alignment.bottomLeft,
                child: Text(
                  team.name.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.clip,
                  softWrap: false,
                  style: AppTypography.jersey(
                    size: 56,
                    color: AppColors.overlaySubtle,
                    letterSpacing: -1,
                    height: 1,
                  ),
                ),
              ),
            ),
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (team.jersey != null)
                  JerseyWidget(jersey: team.jersey!, size: 44)
                else
                  Icon(Icons.checkroom, size: 38, color: AppColors.textSecondary),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              team.name.toUpperCase(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.jersey(size: 22, letterSpacing: 0.3),
                            ),
                          ),
                          if (match.hasFinalScore) ...[
                            const SizedBox(width: 8),
                            Text(
                              '${team.score}',
                              style: AppTypography.jersey(
                                size: 28,
                                color: (team.score > (match.teamA == team ? (match.teamB?.score ?? 0) : (match.teamA?.score ?? 0)))
                                    ? AppColors.voltNeon
                                    : AppColors.textPrimary,
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 6,
                        runSpacing: 2,
                        children: [
                          Text(
                            '${team.players.length} JUGADORES',
                            style: AppTypography.code(size: 8.5, weight: FontWeight.w700, color: AppColors.textSecondary)
                                .copyWith(letterSpacing: 1.4),
                          ),
                          if (avgOvr != null) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                              decoration: BoxDecoration(
                                color: AppColors.voltNeon.withValues(alpha: 0.12),
                                borderRadius: AppRadii.hairAll,
                                border: Border.all(color: AppColors.voltNeon.withValues(alpha: 0.3)),
                              ),
                              child: Text(
                                'OVR PROM. ${avgOvr.toStringAsFixed(1)}',
                                style: AppTypography.code(
                                  size: 8,
                                  weight: FontWeight.w800,
                                  color: AppColors.voltNeon,
                                ),
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
            for (var i = 0; i < players.length; i += 2)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _MosaicPlayer(
                        player: players[i],
                        photo: _photoOf(players[i]),
                        match: match,
                        onTap: () => _showPlayerCardModal(context, ref, players[i], photo: _photoOf(players[i])),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: i + 1 < players.length
                          ? _MosaicPlayer(
                              player: players[i + 1],
                              photo: _photoOf(players[i + 1]),
                              match: match,
                              onTap: () => _showPlayerCardModal(context, ref, players[i + 1], photo: _photoOf(players[i + 1])),
                            )
                          : const SizedBox.shrink(),
                    ),
                  ],
                ),
              ),
          ],
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
              SizedBox(
                width: 36,
                height: 36,
                child: ClipOval(
                  child: (photo == null || photo!.isEmpty)
                      ? PlayerAvatarFallback(seed: player.uid.isNotEmpty ? player.uid : player.displayName)
                      : Image.network(
                          photo!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, error, stack) => PlayerAvatarFallback(
                              seed: player.uid.isNotEmpty ? player.uid : player.displayName),
                        ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      player.displayName.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.condensed(size: 13.5, weight: FontWeight.w600, letterSpacing: 0.3),
                    ),
                    Row(
                      children: [
                        Text(
                          player.position.isNotEmpty ? player.position : 'JUG',
                          style: AppTypography.code(
                            size: 8.5,
                            weight: FontWeight.w700,
                            color: AppColors.getPositionColor(player.position),
                          ),
                        ),
                        if (player.ovr > 0) ...[
                          const SizedBox(width: 4),
                          Text(
                            '${player.ovr}',
                            style: AppTypography.code(size: 8.5, weight: FontWeight.w700, color: AppColors.textSecondary),
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
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              decoration: BoxDecoration(
                color: AppColors.goldBorder.withValues(alpha: 0.2),
                borderRadius: AppRadii.hairAll,
                border: Border.all(color: AppColors.goldBorder.withValues(alpha: 0.5)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.emoji_events_rounded, size: 9, color: AppColors.goldBorder),
                  const SizedBox(width: 2),
                  Text('FIGURA', style: AppTypography.code(size: 7.5, weight: FontWeight.w800, color: AppColors.goldBorder)),
                ],
              ),
            ),
          if (goals > 0)
            _MiniBadge(label: goals > 1 ? '⚽ $goals' : '⚽', color: AppColors.voltNeon),
          if (assists > 0)
            _MiniBadge(label: assists > 1 ? '👟 $assists' : '👟', color: AppColors.textSecondary),
          if (reds > 0)
            _MiniBadge(label: '🟥', color: AppColors.destructive),
          if (yellows > 0)
            _MiniBadge(label: '🟨', color: AppColors.warning),
        ],
      ),
    );
  }
}

class _MiniBadge extends StatelessWidget {
  final String label;
  final Color color;

  const _MiniBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0.5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: AppRadii.hairAll,
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: AppTypography.code(size: 8, weight: FontWeight.w700, color: color),
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
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: 0.40),
        borderRadius: AppRadii.cardAll,
        border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.groups_outlined, size: 18, color: AppColors.textSecondary),
              const SizedBox(width: 8),
              Text('Jugadores Confirmados', style: AppTypography.headline(size: 15)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: AppColors.cardSurface, borderRadius: AppRadii.surfaceAll),
                child: Text('${match.players.length}/${match.matchSize}', style: AppTypography.code(color: AppColors.textSecondary, size: 11, weight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (match.players.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text('Todavía no hay jugadores confirmados', style: AppTypography.body(size: 12, color: AppColors.textSecondary)),
              ),
            )
          else
            SizedBox(
              height: 102,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: match.players.length,
                separatorBuilder: (_, index) => const SizedBox(width: 14),
                itemBuilder: (context, index) {
                  final p = match.players[index];
                  return Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => _showPlayerCardModal(context, ref, p, photo: p.photoURL),
                      borderRadius: AppRadii.cardAll,
                      child: Padding(
                        padding: const EdgeInsets.all(4.0),
                        child: SizedBox(
                          width: 62,
                          child: Column(
                            children: [
                              PateaAvatar(
                                photoUrl: p.photoURL,
                                seed: p.displayName,
                                size: 48,
                              ),
                              const SizedBox(height: 5),
                              Text(
                                p.displayName.split(' ').first.toUpperCase(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: AppTypography.condensed(size: 12, weight: FontWeight.w600),
                              ),
                              Text(
                                '${p.position} ${p.ovr > 0 ? p.ovr : ""}'.trim(),
                                style: AppTypography.code(size: 8.5, color: AppColors.getPositionColor(p.position)),
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
  final bool hasTeams;
  final bool isCompetition;
  final bool isShuffling;
  final bool canFinalize;
  final bool isFinishing;
  final VoidCallback onShuffle;
  final VoidCallback onReschedule;
  final VoidCallback onChangeVenue;
  final VoidCallback onDelete;
  final VoidCallback onFinish;

  const _OrganizerPanel({
    required this.match,
    required this.hasTeams,
    required this.isCompetition,
    required this.isShuffling,
    required this.canFinalize,
    required this.isFinishing,
    required this.onShuffle,
    required this.onReschedule,
    required this.onChangeVenue,
    required this.onDelete,
    required this.onFinish,
  });

  @override
  Widget build(BuildContext context) {
    final isFinished = match.status == 'completed' || match.status == 'evaluated';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: 0.55),
        borderRadius: AppRadii.cardAll,
        border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.voltNeon.withValues(alpha: 0.15),
                  borderRadius: AppRadii.chipAll,
                ),
                child: const Icon(Icons.admin_panel_settings_rounded, size: 16, color: AppColors.voltNeon),
              ),
              const SizedBox(width: 8),
              Text(
                'PANEL DEL ORGANIZADOR',
                style: AppTypography.code(size: 10, weight: FontWeight.w800, color: AppColors.voltNeon)
                    .copyWith(letterSpacing: 1.4),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (match.status == 'upcoming' && !isCompetition) ...[
                if (match.players.length < match.matchSize)
                  OutlinedButton.icon(
                    onPressed: () => RecruitPlayersSheet.show(context, match),
                    icon: const Icon(Icons.person_search_outlined, size: 15),
                    label: const Text('Falta uno'),
                    style: OutlinedButton.styleFrom(
                      backgroundColor: AppColors.cardSurface.withValues(alpha: 0.5),
                      foregroundColor: AppColors.textPrimary,
                      side: BorderSide(color: AppColors.border.withValues(alpha: 0.5)),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                    ),
                  ),
                if (hasTeams)
                  OutlinedButton.icon(
                    onPressed: () => EditTeamsSheet.show(context, match),
                    icon: const Icon(Icons.swap_horiz_rounded, size: 15),
                    label: const Text('Armar equipos'),
                    style: OutlinedButton.styleFrom(
                      backgroundColor: AppColors.cardSurface.withValues(alpha: 0.5),
                      foregroundColor: AppColors.textPrimary,
                      side: BorderSide(color: AppColors.border.withValues(alpha: 0.5)),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                    ),
                  ),
                OutlinedButton.icon(
                  onPressed: isShuffling ? null : onShuffle,
                  icon: isShuffling
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.voltNeon))
                      : const Icon(Icons.shuffle_rounded, size: 15),
                  label: Text(hasTeams ? 'Sortear' : 'Generar'),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: AppColors.cardSurface.withValues(alpha: 0.5),
                    foregroundColor: AppColors.voltNeon,
                    side: BorderSide(color: AppColors.voltNeon.withValues(alpha: 0.4)),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: onReschedule,
                  icon: const Icon(Icons.calendar_month_outlined, size: 15),
                  label: const Text('Reprogramar'),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: AppColors.cardSurface.withValues(alpha: 0.5),
                    foregroundColor: AppColors.textPrimary,
                    side: BorderSide(color: AppColors.border.withValues(alpha: 0.5)),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: onChangeVenue,
                  icon: const Icon(Icons.map_outlined, size: 15),
                  label: const Text('Cambiar Cancha'),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: AppColors.cardSurface.withValues(alpha: 0.5),
                    foregroundColor: AppColors.textPrimary,
                    side: BorderSide(color: AppColors.border.withValues(alpha: 0.5)),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                  ),
                ),
                if (canFinalize)
                  ElevatedButton.icon(
                    onPressed: isFinishing ? null : onFinish,
                    icon: isFinishing
                        ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.onPrimary))
                        : const Icon(Icons.check_circle_outline, size: 15, color: AppColors.onPrimary),
                    label: Text('Finalizar Partido', style: AppTypography.body(size: 13, weight: FontWeight.w700, color: AppColors.onPrimary)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.voltNeon,
                      foregroundColor: AppColors.onPrimary,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                    ),
                  ),
              ],
              if (isFinished) ...[
                ElevatedButton.icon(
                  onPressed: () => context.push('/matches/${match.id}/evaluate'),
                  icon: const Icon(Icons.fact_check_rounded, size: 15, color: AppColors.onPrimary),
                  label: Text('Ver Evaluaciones', style: AppTypography.body(size: 13, weight: FontWeight.w700, color: AppColors.onPrimary)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.voltNeon,
                    foregroundColor: AppColors.onPrimary,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                  ),
                ),
              ],
              OutlinedButton.icon(
                onPressed: onDelete,
                icon: const Icon(Icons.delete_outline_rounded, size: 15, color: AppColors.destructive),
                label: Text('Eliminar Partido', style: AppTypography.body(size: 13, color: AppColors.destructive)),
                style: OutlinedButton.styleFrom(
                  backgroundColor: AppColors.cardSurface.withValues(alpha: 0.5),
                  foregroundColor: AppColors.destructive,
                  side: BorderSide(color: AppColors.destructive.withValues(alpha: 0.4)),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Sticky Action Bar flotante fija en la parte inferior.
class _StickyActionBar extends StatelessWidget {
  final MatchModel match;
  final String? uid;
  final bool isOwner;
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
    final isCompetition = ['league', 'cup', 'league_final'].contains(match.type);
    final isLive = match.status == 'active';
    final isCompleted = match.status == 'completed';

    Widget? actionWidget;

    if (isLive) {
      actionWidget = ElevatedButton.icon(
        onPressed: () => context.push('/matches/${match.id}/live'),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.destructive,
          foregroundColor: AppColors.textPrimary,
          padding: const EdgeInsets.symmetric(vertical: 14),
          elevation: 4,
          shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
        ),
        icon: const Icon(Icons.sensors_rounded, size: 20, color: AppColors.textPrimary),
        label: Text(
          isOwner ? 'DIRIGIR EN VIVO' : 'SEGUIR EN VIVO',
          style: AppTypography.jersey(size: 16, color: AppColors.textPrimary, letterSpacing: 1.2),
        ),
      );
    } else if (isCompleted && !isCompetition) {
      actionWidget = ElevatedButton.icon(
        onPressed: () => context.push(isOwner ? '/matches/${match.id}/evaluate' : '/evaluations/${match.id}'),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.voltNeon,
          foregroundColor: AppColors.onPrimary,
          padding: const EdgeInsets.symmetric(vertical: 14),
          elevation: 4,
          shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
        ),
        icon: Icon(isOwner ? Icons.fact_check_rounded : Icons.rate_review_rounded, size: 20, color: AppColors.onPrimary),
        label: Text(
          isOwner ? 'VER EVALUACIONES' : 'EVALUAR PARTIDO',
          style: AppTypography.jersey(size: 16, color: AppColors.onPrimary, letterSpacing: 1.2),
        ),
      );
    } else if (match.status == 'evaluated') {
      actionWidget = ElevatedButton.icon(
        onPressed: () => context.push('/matches/${match.id}/evaluate'),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.voltNeon,
          foregroundColor: AppColors.onPrimary,
          padding: const EdgeInsets.symmetric(vertical: 14),
          elevation: 4,
          shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
        ),
        icon: const Icon(Icons.insights_rounded, size: 20, color: AppColors.onPrimary),
        label: Text(
          'VER EVALUACIONES',
          style: AppTypography.jersey(size: 16, color: AppColors.onPrimary, letterSpacing: 1.2),
        ),
      );
    } else if (match.status == 'upcoming' && !isCompetition) {
      if (isOwner) {
        final canFinalize = match.players.length >= 2;
        actionWidget = Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () => context.push('/matches/${match.id}/live'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.cardSurface,
                  foregroundColor: AppColors.textPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                ),
                icon: const Icon(Icons.play_arrow_rounded, size: 18),
                label: Text('DIRIGIR', style: AppTypography.jersey(size: 15, color: AppColors.textPrimary)),
              ),
            ),
            if (canFinalize) ...[
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: isFinishing ? null : onFinish,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.voltNeon,
                    foregroundColor: AppColors.onPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                  ),
                  icon: isFinishing
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.onPrimary))
                      : const Icon(Icons.check_circle_outline, size: 18, color: AppColors.onPrimary),
                  label: Text('FINALIZAR', style: AppTypography.jersey(size: 15, color: AppColors.onPrimary)),
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
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.cardSurface,
                  borderRadius: AppRadii.cardAll,
                  border: Border.all(color: AppColors.voltNeon.withValues(alpha: 0.35)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.check_circle_rounded, size: 16, color: AppColors.voltNeon),
                    const SizedBox(width: 7),
                    Text(
                      'ANOTADO',
                      style: AppTypography.code(size: 11, weight: FontWeight.w800, color: AppColors.voltNeon).copyWith(letterSpacing: 0.8),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: isJoining ? null : onJoinLeave,
                  style: OutlinedButton.styleFrom(
                    backgroundColor: AppColors.cardSurface.withValues(alpha: 0.5),
                    foregroundColor: AppColors.textSecondary,
                    side: BorderSide(color: AppColors.border.withValues(alpha: 0.5)),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                  ),
                  icon: isJoining
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textSecondary))
                      : const Icon(Icons.logout_rounded, size: 16, color: AppColors.textSecondary),
                  label: Text(
                    'Darme de baja',
                    style: AppTypography.body(size: 13, weight: FontWeight.w600, color: AppColors.textSecondary),
                  ),
                ),
              ),
            ],
          );
        } else if (isPending) {
          actionWidget = Container(
            padding: const EdgeInsets.symmetric(vertical: 13),
            decoration: BoxDecoration(
              color: AppColors.cardSurface,
              borderRadius: AppRadii.cardAll,
              border: Border.all(color: AppColors.voltNeon.withValues(alpha: 0.3)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.hourglass_top_rounded, size: 18, color: AppColors.voltNeon),
                const SizedBox(width: 8),
                Text('SOLICITUD ENVIADA', style: AppTypography.jersey(size: 14, color: AppColors.voltNeon, letterSpacing: 0.8)),
              ],
            ),
          );
        } else if (isMatchFull) {
          actionWidget = Container(
            padding: const EdgeInsets.symmetric(vertical: 13),
            decoration: BoxDecoration(
              color: AppColors.cardSurface,
              borderRadius: AppRadii.cardAll,
              border: Border.all(color: AppColors.border.withValues(alpha: 0.3)),
            ),
            child: Center(
              child: Text('PARTIDO COMPLETO', style: AppTypography.jersey(size: 15, color: AppColors.textSecondary, letterSpacing: 1)),
            ),
          );
        } else {
          actionWidget = ElevatedButton.icon(
            onPressed: isJoining ? null : onJoinLeave,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.voltNeon,
              foregroundColor: AppColors.onPrimary,
              padding: const EdgeInsets.symmetric(vertical: 14),
              elevation: 4,
              shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
            ),
            icon: isJoining
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.onPrimary))
                : Icon(needsApproval ? Icons.how_to_reg_rounded : Icons.sports_soccer_rounded, size: 20, color: AppColors.onPrimary),
            label: Text(
              needsApproval ? 'PEDIR LUGAR' : 'ANOTARME AL PARTIDO',
              style: AppTypography.jersey(size: 16, color: AppColors.onPrimary, letterSpacing: 1.2),
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
          padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.of(context).padding.bottom),
          decoration: BoxDecoration(
            color: const Color(0xFF0B0E14).withValues(alpha: 0.88),
            border: Border(
              top: BorderSide(color: AppColors.border.withValues(alpha: 0.35)),
            ),
          ),
          child: actionWidget,
        ),
      ),
    );
  }
}

final matchLastMessageStreamProvider = StreamProvider.family<Map<String, dynamic>?, String>((ref, matchId) {
  try {
    return FirebaseFirestore.instance
        .collection('matches/$matchId/messages')
        .orderBy('createdAt', descending: true)
        .limit(1)
        .snapshots()
        .map((snap) => snap.docs.isNotEmpty ? snap.docs.first.data() : null);
  } catch (_) {
    return Stream.value(null);
  }
});

/// Tarjeta resumen del chat en el feed del partido.
class _ChatPreviewCard extends ConsumerWidget {
  final String matchId;
  final VoidCallback onOpenChat;

  const _ChatPreviewCard({required this.matchId, required this.onOpenChat});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lastMsg = ref.watch(matchLastMessageStreamProvider(matchId)).valueOrNull;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: 0.40),
        borderRadius: AppRadii.cardAll,
        border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
      ),
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
                    Icon(Icons.chat_bubble_outline_rounded, color: AppColors.voltNeon, size: 18),
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
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                      decoration: BoxDecoration(
                        color: AppColors.voltNeon.withValues(alpha: 0.12),
                        borderRadius: AppRadii.cardAll,
                      ),
                      child: Text(
                        'ABRIR',
                        style: AppTypography.code(size: 9.5, weight: FontWeight.w800, color: AppColors.voltNeon)
                            .copyWith(letterSpacing: 1),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                if (lastMsg == null)
                  Text(
                    'Sin mensajes aún. Tocá para iniciar la charla.',
                    style: AppTypography.body(size: 12, color: AppColors.textSecondary),
                  )
                else
                  Text(
                    '${(lastMsg['senderName'] as String?) ?? "Jugador"}: ${(lastMsg['text'] as String?) ?? ""}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.body(size: 12.5, color: AppColors.textSecondary),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Abre el modal de la Player Card 3D al tocar un jugador.
void _showPlayerCardModal(BuildContext context, WidgetRef ref, MatchPlayerEntry entry, {String? photo}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      return Container(
        decoration: BoxDecoration(
          color: const Color(0xFF0F141C),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadii.surface)),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 38,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.overlayStrong,
                borderRadius: AppRadii.hairAll,
              ),
            ),
            const SizedBox(height: 18),
            Consumer(
              builder: (context, ref, _) {
                final snap = entry.uid.isNotEmpty ? ref.watch(singlePlayerStreamProvider(entry.uid)) : null;
                final fullPlayer = snap?.valueOrNull;

                final effectivePlayer = fullPlayer ??
                    Player(
                      id: entry.uid,
                      name: entry.displayName,
                      position: entry.position.isNotEmpty ? entry.position : 'MED',
                      ovr: entry.ovr > 0 ? entry.ovr : 60,
                      pac: entry.ovr > 0 ? entry.ovr : 60,
                      sho: entry.ovr > 0 ? entry.ovr : 60,
                      pas: entry.ovr > 0 ? entry.ovr : 60,
                      dri: entry.ovr > 0 ? entry.ovr : 60,
                      def: entry.ovr > 0 ? entry.ovr : 60,
                      phy: entry.ovr > 0 ? entry.ovr : 60,
                      photoUrl: photo ?? entry.photoURL,
                    );

                return SizedBox(
                  width: 255,
                  height: 365,
                  child: PlayerCardWidget(
                    player: effectivePlayer,
                    photoStyle: CardPhotoStyle.halfTop,
                  ),
                );
              },
            ),
            const SizedBox(height: 18),
            if (entry.uid.isNotEmpty)
              OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  context.push('/players/${entry.uid}');
                },
                icon: const Icon(Icons.badge_outlined, size: 16),
                label: const Text('Ver perfil completo'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.textPrimary,
                  side: BorderSide(color: AppColors.border.withValues(alpha: 0.6)),
                ),
              ),
          ],
        ),
      );
    },
  );
}

/// Abre el chat en un BottomSheet deslizable optimizado para teclado.
void _openChatBottomSheet(BuildContext context, String matchId) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      return _ChatModalSheet(matchId: matchId);
    },
  );
}

class _ChatModalSheet extends StatefulWidget {
  final String matchId;

  const _ChatModalSheet({required this.matchId});

  @override
  State<_ChatModalSheet> createState() => _ChatModalSheetState();
}

class _ChatModalSheetState extends State<_ChatModalSheet> {
  final _controller = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    final user = FirebaseAuth.instance.currentUser;
    if (text.isEmpty || user == null) return;
    setState(() => _sending = true);
    try {
      await FirebaseFirestore.instance.collection('matches/${widget.matchId}/messages').add({
        'text': text,
        'senderId': user.uid,
        'senderName': user.displayName ?? 'Usuario',
        'senderPhotoUrl': user.photoURL ?? '',
        'createdAt': FieldValue.serverTimestamp(),
        'status': 'sent',
      });
      _controller.clear();
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final keyboardHeight = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      height: MediaQuery.of(context).size.height * 0.82,
      padding: EdgeInsets.only(bottom: keyboardHeight),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadii.surface)),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 38,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.overlayStrong,
              borderRadius: AppRadii.hairAll,
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 10),
            child: Row(
              children: [
                Icon(Icons.chat_bubble_outline_rounded, color: AppColors.voltNeon, size: 18),
                const SizedBox(width: 8),
                Text('Chat del Partido', style: AppTypography.headline(size: 16)),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded, size: 20),
                  color: AppColors.textSecondary,
                ),
              ],
            ),
          ),
          Container(height: 1, color: AppColors.border.withValues(alpha: 0.3)),
          Expanded(
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: FirebaseFirestore.instance
                  .collection('matches/${widget.matchId}/messages')
                  .orderBy('createdAt', descending: false)
                  .snapshots(),
              builder: (context, snapshot) {
                if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
                final docs = snapshot.data!.docs;
                if (docs.isEmpty) {
                  return Center(
                    child: Text('¡Sé el primero en saludar al grupo!',
                        style: AppTypography.body(size: 13, color: AppColors.textSecondary)),
                  );
                }
                final uid = FirebaseAuth.instance.currentUser?.uid;
                return ListView.builder(
                  reverse: false,
                  padding: const EdgeInsets.all(14),
                  itemCount: docs.length,
                  itemBuilder: (context, index) {
                    final data = docs[index].data();
                    final isMine = data['senderId'] == uid;
                    return Align(
                      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                        constraints: const BoxConstraints(maxWidth: 270),
                        decoration: BoxDecoration(
                          color: isMine ? AppColors.voltNeon.withValues(alpha: 0.18) : AppColors.cardSurface,
                          borderRadius: AppRadii.cardAll,
                          border: Border.all(
                            color: isMine ? AppColors.voltNeon.withValues(alpha: 0.35) : AppColors.border.withValues(alpha: 0.25),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (!isMine)
                              Text(
                                data['senderName'] as String? ?? 'Usuario',
                                style: AppTypography.body(size: 10.5, weight: FontWeight.w700, color: AppColors.voltNeon),
                              ),
                            Text(data['text'] as String? ?? '', style: AppTypography.body(color: AppColors.textSecondary, size: 13)),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
          Container(height: 1, color: AppColors.border.withValues(alpha: 0.3)),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    decoration: const InputDecoration(
                      hintText: 'Escribí un mensaje...',
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _sending ? null : _send,
                  icon: _sending
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : Icon(Icons.send_rounded, color: AppColors.voltNeon),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
