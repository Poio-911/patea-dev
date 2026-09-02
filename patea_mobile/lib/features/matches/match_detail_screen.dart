import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/match_theme.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/location_service.dart';
import '../../core/services/match_service.dart';
import '../../core/models/match_model.dart';
import '../../core/widgets/jersey_painter.dart';

const _spanishMonths = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

String _fmtDate(String raw) {
  final d = DateTime.tryParse(raw);
  if (d == null) return raw;
  final local = d.toLocal();
  return '${local.day.toString().padLeft(2, '0')} ${_spanishMonths[local.month - 1]}';
}

IconData _weatherIcon(String? icon) {
  switch (icon) {
    case 'Sun':
      return Icons.wb_sunny_rounded;
    case 'Cloud':
      return Icons.cloud_queue_rounded;
    case 'CloudRain':
      return Icons.grain_rounded;
    case 'CloudSnow':
      return Icons.ac_unit_rounded;
    case 'Wind':
      return Icons.air_rounded;
    case 'Zap':
      return Icons.bolt_rounded;
    default:
      return Icons.cloud_rounded;
  }
}

/// Port de MatchDetailView (src/components/match-detail-view.tsx) — versión
/// mobile de primera pasada. Cubre: hero (MatchInfoCard), roster
/// (MatchTeams/PlayersConfirmed), acciones de organizador
/// (MatchManagementActions), unirse/salir, y chat (MatchChatView).
///
/// Deliberadamente NO portado en esta pasada (ver plan de migración):
/// CupMatchView/LeagueMatchView (Sección 6 Competiciones), solicitud de
/// unión con aprobación del organizador (requestJoinMatchAction —  acá
/// "unirse" es directo tanto para manual como colaborativo, simplificación
/// consciente), AvailablePlayersSection, EditableTeamsDialog,
/// PhysicalMetricsCard/salud, IntegratedMatchStory, countdown, compartir
/// nativo, alerta de jugadores duplicados entre equipos.
class MatchDetailScreen extends ConsumerStatefulWidget {
  final String matchId;

  const MatchDetailScreen({super.key, required this.matchId});

  @override
  ConsumerState<MatchDetailScreen> createState() => _MatchDetailScreenState();
}

class _MatchDetailScreenState extends ConsumerState<MatchDetailScreen> {
  bool _isJoining = false;
  bool _isFinishing = false;
  bool _isDeleting = false;
  bool _isShuffling = false;

  Future<void> _handleJoinLeave(MatchModel match, String uid, bool isUserInMatch) async {
    setState(() => _isJoining = true);
    try {
      if (isUserInMatch) {
        await ref.read(matchServiceProvider).leaveMatch(match.id, uid);
      } else {
        await ref.read(matchServiceProvider).joinMatch(match.id, uid);
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
      if (mounted) _showSnack('Partido finalizado. Ya se generaron las evaluaciones.');
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
          style: AppTypography.body(size: 13),
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

    setState(() => _isDeleting = true);
    try {
      await ref.read(matchServiceProvider).deleteMatch(match.id);
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) _showError('$e');
    } finally {
      if (mounted) setState(() => _isDeleting = false);
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
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black),
              child: submitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
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
                                title: Text(s.label, style: AppTypography.body(size: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
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
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black),
              child: submitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
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

    return Scaffold(
      appBar: AppBar(title: Text('PARTIDO', style: AppTypography.headline(size: 18, weight: FontWeight.w800))),
      body: matchAsync.when(
        data: (match) {
          if (match == null) {
            return Center(child: Text('Partido no encontrado.', style: AppTypography.body(color: AppColors.textMuted)));
          }

          final isOwner = uid != null && match.ownerUid == uid;
          final isUserInMatch = uid != null && match.playerUids.contains(uid);
          final isMatchFull = match.players.length >= match.matchSize;
          final canFinalize = isOwner && match.status == 'upcoming' && match.players.length >= 2;
          final hasTeams = match.teamA != null && match.teamB != null;
          final isCompetition = ['league', 'cup', 'league_final'].contains(match.type);

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _HeroCard(
                match: match,
                isOwner: isOwner,
                isUserInMatch: isUserInMatch,
                isMatchFull: isMatchFull,
                isJoining: _isJoining,
                onJoinLeave: (uid == null || isCompetition) ? null : () => _handleJoinLeave(match, uid, isUserInMatch),
                onOpenMaps: () => _openMaps(match),
              ),
              const SizedBox(height: 16),
              hasTeams ? _TeamsRoster(match: match) : _PlayersConfirmedRoster(match: match),
              const SizedBox(height: 16),
              if (isOwner)
                _ManagementActions(
                  match: match,
                  canFinalize: canFinalize,
                  isFinishing: _isFinishing,
                  isDeleting: _isDeleting,
                  isShuffling: _isShuffling,
                  isCompetition: isCompetition,
                  onFinish: () => _handleFinish(match),
                  onDelete: () => _handleDelete(match),
                  onShuffle: () => _handleShuffle(match),
                  onReschedule: () => _showRescheduleDialog(match),
                  onChangeVenue: () => _showChangeVenueDialog(match),
                ),
              if (isOwner && !isCompetition && (match.status == 'upcoming' || match.status == 'active')) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => context.push('/matches/${match.id}/live'),
                  icon: const Icon(Icons.timer_outlined, size: 16),
                  label: const Text('Panel de partido en vivo'),
                ),
              ],
              const SizedBox(height: 16),
              _ChatSection(matchId: match.id),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  final MatchModel match;
  final bool isOwner;
  final bool isUserInMatch;
  final bool isMatchFull;
  final bool isJoining;
  final VoidCallback? onJoinLeave;
  final VoidCallback onOpenMaps;

  const _HeroCard({
    required this.match,
    required this.isOwner,
    required this.isUserInMatch,
    required this.isMatchFull,
    required this.isJoining,
    required this.onJoinLeave,
    required this.onOpenMaps,
  });

  @override
  Widget build(BuildContext context) {
    final theme = getMatchTypeTheme(match.type);
    final hasTeams = match.teamA != null && match.teamB != null;
    final hasScore = match.status == 'completed' || match.status == 'evaluated';
    final isLive = match.status == 'active';
    final spotsLeft = match.matchSize - match.players.length;
    final showJoinButton = onJoinLeave != null &&
        (match.type == 'manual' || match.type == 'collaborative') &&
        match.status == 'upcoming' &&
        !isOwner;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: theme.brandColor.withValues(alpha: 0.4), width: isLive ? 1.5 : 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.cardSurface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(width: 7, height: 7, decoration: BoxDecoration(shape: BoxShape.circle, color: theme.brandColor)),
                    const SizedBox(width: 6),
                    Text(theme.label.toUpperCase(), style: AppTypography.code(size: 10, weight: FontWeight.w700, color: AppColors.textPrimary)),
                  ],
                ),
              ),
              const Spacer(),
              if (isLive)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.destructive.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Container(width: 6, height: 6, decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.green)),
                    const SizedBox(width: 5),
                    Text('EN VIVO', style: AppTypography.code(size: 10, weight: FontWeight.w700, color: AppColors.destructive)),
                  ]),
                ),
            ],
          ),
          const SizedBox(height: 18),
          if (hasTeams)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                Expanded(child: _HeroTeam(team: match.teamA!)),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (hasScore)
                      Text('${match.teamA!.score} - ${match.teamB!.score}', style: AppTypography.sportNumber(size: 32))
                    else
                      Text('VS', style: AppTypography.headline(size: 22, weight: FontWeight.w900, color: AppColors.textMuted)),
                  ],
                ),
                Expanded(child: _HeroTeam(team: match.teamB!)),
              ],
            )
          else
            Column(
              children: [
                Text(match.title, textAlign: TextAlign.center, style: AppTypography.headline(size: 24, weight: FontWeight.w900)),
                if (spotsLeft > 0 && match.status == 'upcoming') ...[
                  const SizedBox(height: 8),
                  Text(
                    '${match.players.length} / ${match.matchSize} jugadores · $spotsLeft lugar${spotsLeft != 1 ? 'es' : ''} disponible${spotsLeft != 1 ? 's' : ''}',
                    style: AppTypography.body(size: 12, color: AppColors.textMuted),
                  ),
                ],
              ],
            ),
          const SizedBox(height: 18),
          Container(
            decoration: BoxDecoration(color: AppColors.cardSurface, borderRadius: BorderRadius.circular(14)),
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              children: [
                Expanded(
                  child: _InfoStripItem(
                    icon: Icons.calendar_today_outlined,
                    text: (match.status == 'planning' || match.date.isEmpty) ? 'A definir' : _fmtDate(match.date),
                  ),
                ),
                Expanded(
                  child: _InfoStripItem(
                    icon: Icons.access_time,
                    text: (match.status == 'planning' || match.time == null) ? 'A definir' : '${match.time} hs',
                  ),
                ),
                if (match.weather != null)
                  Expanded(
                    child: _InfoStripItem(icon: _weatherIcon(match.weather!.icon), text: '${match.weather!.temperature}°'),
                  ),
              ],
            ),
          ),
          if (match.location != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(Icons.location_on_outlined, size: 16, color: AppColors.textMuted),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(match.location!, style: AppTypography.body(size: 12, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
              ],
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onOpenMaps,
                  icon: const Icon(Icons.navigation_outlined, size: 16),
                  label: const Text('Cómo llegar'),
                ),
              ),
              if (showJoinButton) ...[
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: isMatchFull && !isUserInMatch
                      ? ElevatedButton(
                          onPressed: null,
                          child: const Text('Lleno'),
                        )
                      : ElevatedButton.icon(
                          onPressed: isJoining ? null : onJoinLeave,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isUserInMatch ? AppColors.cardSurface : AppColors.voltNeon,
                            foregroundColor: isUserInMatch ? AppColors.textPrimary : Colors.black,
                          ),
                          icon: isJoining
                              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                              : Icon(isUserInMatch ? Icons.logout : Icons.person_add_alt_1, size: 16),
                          label: Text(isUserInMatch ? 'Baja' : 'Apuntarse'),
                        ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroTeam extends StatelessWidget {
  final MatchTeam team;

  const _HeroTeam({required this.team});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (team.jersey != null) JerseyWidget(jersey: team.jersey!, size: 60) else Icon(Icons.checkroom, size: 52, color: AppColors.textMuted),
        const SizedBox(height: 8),
        Text(team.name, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppTypography.body(size: 13, weight: FontWeight.w700)),
      ],
    );
  }
}

class _InfoStripItem extends StatelessWidget {
  final IconData icon;
  final String text;

  const _InfoStripItem({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: AppColors.textMuted),
        const SizedBox(height: 4),
        Text(text, style: AppTypography.body(size: 11, weight: FontWeight.w700, color: AppColors.textPrimary)),
      ],
    );
  }
}

/// Port simplificado de PlayersConfirmed: fila horizontal de avatares.
class _PlayersConfirmedRoster extends StatelessWidget {
  final MatchModel match;

  const _PlayersConfirmedRoster({required this.match});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.groups_outlined, size: 18, color: AppColors.textMuted),
              const SizedBox(width: 8),
              Text('Jugadores', style: AppTypography.headline(size: 15)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: AppColors.cardSurface, borderRadius: BorderRadius.circular(20)),
                child: Text('${match.players.length}/${match.matchSize}', style: AppTypography.code(size: 11, weight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (match.players.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text('Todavía no hay jugadores confirmados', style: AppTypography.body(size: 12, color: AppColors.textMuted)),
              ),
            )
          else
            SizedBox(
              height: 92,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: match.players.length,
                separatorBuilder: (_, index) => const SizedBox(width: 12),
                itemBuilder: (context, index) {
                  final p = match.players[index];
                  return SizedBox(
                    width: 60,
                    child: Column(
                      children: [
                        CircleAvatar(
                          radius: 24,
                          backgroundColor: AppColors.cardSurface,
                          backgroundImage: (p.photoURL != null && p.photoURL!.isNotEmpty) ? NetworkImage(p.photoURL!) : null,
                          child: (p.photoURL == null || p.photoURL!.isEmpty)
                              ? Text(p.displayName.isNotEmpty ? p.displayName[0].toUpperCase() : '?', style: AppTypography.body(size: 14, weight: FontWeight.w700))
                              : null,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          p.displayName.split(' ').first,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.body(size: 10, weight: FontWeight.w600),
                        ),
                        Text(
                          '${p.position} ${p.ovr}',
                          style: AppTypography.body(size: 9, color: AppColors.getPositionColor(p.position)),
                        ),
                      ],
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

/// Port simplificado de MatchTeams: 2 columnas con jersey + roster de cada equipo.
class _TeamsRoster extends StatelessWidget {
  final MatchModel match;

  const _TeamsRoster({required this.match});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Equipos Generados', style: AppTypography.headline(size: 15)),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _TeamColumn(team: match.teamA!)),
              const SizedBox(width: 12),
              Expanded(child: _TeamColumn(team: match.teamB!)),
            ],
          ),
        ],
      ),
    );
  }
}

class _TeamColumn extends StatelessWidget {
  final MatchTeam team;

  const _TeamColumn({required this.team});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            if (team.jersey != null) JerseyWidget(jersey: team.jersey!, size: 28),
            const SizedBox(width: 8),
            Expanded(child: Text(team.name, style: AppTypography.body(size: 13, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis)),
          ],
        ),
        const SizedBox(height: 8),
        ...team.players.map((p) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  Expanded(
                    child: Text(p.displayName, style: AppTypography.body(size: 11, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                  Text(p.position, style: AppTypography.code(size: 9, weight: FontWeight.w700, color: AppColors.getPositionColor(p.position))),
                ],
              ),
            )),
      ],
    );
  }
}

class _ManagementActions extends StatelessWidget {
  final MatchModel match;
  final bool canFinalize;
  final bool isFinishing;
  final bool isDeleting;
  final bool isShuffling;
  final bool isCompetition;
  final VoidCallback onFinish;
  final VoidCallback onDelete;
  final VoidCallback onShuffle;
  final VoidCallback onReschedule;
  final VoidCallback onChangeVenue;

  const _ManagementActions({
    required this.match,
    required this.canFinalize,
    required this.isFinishing,
    required this.isDeleting,
    required this.isShuffling,
    required this.isCompetition,
    required this.onFinish,
    required this.onDelete,
    required this.onShuffle,
    required this.onReschedule,
    required this.onChangeVenue,
  });

  @override
  Widget build(BuildContext context) {
    final hasTeams = match.teamA != null && match.teamB != null;
    final canShuffle = !isCompetition && match.type != 'intergroup_friendly' && match.status != 'evaluated';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Acciones', style: AppTypography.headline(size: 15)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (canShuffle)
                OutlinedButton.icon(
                  onPressed: isShuffling ? null : onShuffle,
                  icon: isShuffling
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.shuffle, size: 16),
                  label: Text(hasTeams ? 'Sortear' : 'Generar Equipos'),
                ),
              if (canFinalize)
                ElevatedButton.icon(
                  onPressed: isFinishing ? null : onFinish,
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black),
                  icon: isFinishing
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                      : const Icon(Icons.check_circle_outline, size: 16),
                  label: const Text('Finalizar'),
                ),
              if (!isCompetition && match.status == 'completed')
                ElevatedButton.icon(
                  onPressed: () => context.push('/matches/${match.id}/evaluate'),
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black),
                  icon: const Icon(Icons.fact_check_outlined, size: 16),
                  label: const Text('Evaluar Partido'),
                ),
              if (match.status == 'upcoming' && !isCompetition) ...[
                OutlinedButton.icon(onPressed: onReschedule, icon: const Icon(Icons.calendar_month_outlined, size: 16), label: const Text('Reprogramar')),
                OutlinedButton.icon(onPressed: onChangeVenue, icon: const Icon(Icons.map_outlined, size: 16), label: const Text('Cambiar Cancha')),
              ],
              TextButton.icon(
                onPressed: isDeleting ? null : onDelete,
                style: TextButton.styleFrom(foregroundColor: AppColors.destructive),
                icon: isDeleting
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.destructive))
                    : const Icon(Icons.delete_outline, size: 16),
                label: const Text('Eliminar'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Port simplificado de MatchChatView: sin reacciones/reply/read-receipts en
/// esta primera pasada — mensajes de texto simple, orden ascendente,
/// escritura directa a Firestore (permitido por firestore.rules para
/// participantes, sin necesitar Cloud Function).
class _ChatSection extends StatefulWidget {
  final String matchId;

  const _ChatSection({required this.matchId});

  @override
  State<_ChatSection> createState() => _ChatSectionState();
}

class _ChatSectionState extends State<_ChatSection> {
  bool _isOpen = false;
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
    return Container(
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => setState(() => _isOpen = !_isOpen),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(Icons.chat_bubble_outline, color: AppColors.voltNeon),
                  const SizedBox(width: 10),
                  Text('Chat del Partido', style: AppTypography.headline(size: 15)),
                  const Spacer(),
                  Icon(_isOpen ? Icons.expand_less : Icons.expand_more, color: AppColors.textMuted),
                ],
              ),
            ),
          ),
          if (_isOpen) ...[
            Container(height: 1, color: AppColors.border.withValues(alpha: 0.3)),
            SizedBox(
              height: 320,
              child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: FirebaseFirestore.instance
                    .collection('matches/${widget.matchId}/messages')
                    .orderBy('createdAt', descending: false)
                    .snapshots(),
                builder: (context, snapshot) {
                  if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
                  final docs = snapshot.data!.docs;
                  if (docs.isEmpty) {
                    return Center(child: Text('¡Sé el primero en saludar!', style: AppTypography.body(size: 12, color: AppColors.textMuted)));
                  }
                  final uid = FirebaseAuth.instance.currentUser?.uid;
                  return ListView.builder(
                    reverse: false,
                    padding: const EdgeInsets.all(12),
                    itemCount: docs.length,
                    itemBuilder: (context, index) {
                      final data = docs[index].data();
                      final isMine = data['senderId'] == uid;
                      return Align(
                        alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.symmetric(vertical: 4),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          constraints: const BoxConstraints(maxWidth: 260),
                          decoration: BoxDecoration(
                            color: isMine ? AppColors.voltNeon.withValues(alpha: 0.15) : AppColors.cardSurface,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (!isMine)
                                Text(data['senderName'] as String? ?? 'Usuario', style: AppTypography.body(size: 10, weight: FontWeight.w700, color: AppColors.voltNeon)),
                              Text(data['text'] as String? ?? '', style: AppTypography.body(size: 13)),
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
              padding: const EdgeInsets.all(10),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      decoration: const InputDecoration(hintText: 'Escribí un mensaje...', isDense: true),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  IconButton(
                    onPressed: _sending ? null : _send,
                    icon: _sending
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : Icon(Icons.send, color: AppColors.voltNeon),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
