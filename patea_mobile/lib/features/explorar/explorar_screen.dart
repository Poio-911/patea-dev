import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/match_theme.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/explore_service.dart';
import '../../core/services/location_service.dart';
import '../../core/models/match_model.dart';
import '../../core/models/available_player_model.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/theme/app_insets.dart';
import '../../core/services/match_service.dart';
import '../../core/theme/app_radii.dart';
import '../../core/widgets/patea_page_header.dart';
import '../../core/widgets/patea_tabs.dart';

const _spanishMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
String _fmtDate(String raw) {
  final d = DateTime.tryParse(raw);
  if (d == null) return raw;
  final local = d.toLocal();
  return '${local.day.toString().padLeft(2, '0')} ${_spanishMonths[local.month - 1]}';
}

const _days = [
  {'id': 'lunes', 'short': 'Lun'},
  {'id': 'martes', 'short': 'Mar'},
  {'id': 'miercoles', 'short': 'Mié'},
  {'id': 'jueves', 'short': 'Jue'},
  {'id': 'viernes', 'short': 'Vie'},
  {'id': 'sabado', 'short': 'Sáb'},
  {'id': 'domingo', 'short': 'Dom'},
];
const _times = [
  {'id': 'mañana', 'label': 'Mañana', 'icon': Icons.wb_sunny_outlined},
  {'id': 'tarde', 'label': 'Tarde', 'icon': Icons.cloud_outlined},
  {'id': 'noche', 'label': 'Noche', 'icon': Icons.nightlight_outlined},
];

/// Port de src/app/explorar/page.tsx: 2 tabs — "Mercado de Fichajes"
/// (`explore-content.tsx`, agentes libres cerca de un partido incompleto
/// propio) y "Partidos Abiertos" (`public-matches-content.tsx`, partidos
/// públicos con cupo). Se leyeron ambos componentes completos + sus server
/// actions (`recruitment-actions.ts`, `availability-actions.ts`,
/// `match-invitation-actions.ts`, `explore-actions.ts`) antes de portar.
///
/// Deliberadamente NO portado en esta pasada (ver comentarios inline):
/// "Sugerencia del DT" (scouting con IA, `findBestFitPlayerAction`), vista
/// de mapa y filtro por distancia con geolocalización del dispositivo en
/// Partidos Abiertos (dominio Maps nativo, fuera de alcance), ubicación por
/// GPS del dispositivo en la ficha de disponibilidad (se usa el buscador
/// Nominatim ya portado en el wizard de partidos, más simple que pedir
/// permisos de geolocalización nativos para el mismo resultado).
class ExplorarScreen extends ConsumerStatefulWidget {
  const ExplorarScreen({super.key});

  @override
  ConsumerState<ExplorarScreen> createState() => _ExplorarScreenState();
}

class _ExplorarScreenState extends ConsumerState<ExplorarScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(authServiceProvider).currentUser?.uid;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Column(
        children: [
          // Misma norma que Jugadores y Partidos: titulo + descripcion como
          // contenido de la pagina, no como AppBar fijo. La cabecera no
          // scrollea aca porque las dos pestanas traen su propia lista y
          // meterlas dentro de un solo scroll obligaria a reescribir las dos
          // con slivers sin ganar nada.
          Padding(
            padding: EdgeInsets.fromLTRB(
                16, MediaQuery.of(context).padding.top + 12, 16, 0),
            child: const PateaPageHeader(
              title: 'Explorar',
              description:
                  'Reclutá agentes libres para tus partidos, o sumate a partidos abiertos.',
              showCountRow: false,
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: PateaTabs(
              tabs: const [
                PateaTab('Mercado'),
                PateaTab('Partidos abiertos'),
              ],
              active: _tab,
              onChanged: (i) => setState(() => _tab = i),
            ),
          ),
          Expanded(
            child: uid == null
                ? const SizedBox()
                : (_tab == 0 ? _MercadoTab(uid: uid) : _PartidosAbiertosTab(uid: uid)),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------
// Tab 1: Mercado de Fichajes
// ---------------------------------------------------------------------
class _MercadoTab extends ConsumerStatefulWidget {
  final String uid;

  const _MercadoTab({required this.uid});

  @override
  ConsumerState<_MercadoTab> createState() => _MercadoTabState();
}

class _MercadoTabState extends ConsumerState<_MercadoTab> {
  String? _selectedMatchId;
  String? _positionFilter;
  List<AvailablePlayerModel> _players = [];
  bool _loadingPlayers = false;
  String? _lastLoadedMatchId;

  Future<void> _loadPlayers(MatchModel match) async {
    setState(() => _loadingPlayers = true);
    _lastLoadedMatchId = match.id;
    try {
      final lat = match.locationDetail?.lat;
      final lng = match.locationDetail?.lng;
      if (lat == null || lng == null || (lat == 0 && lng == 0)) {
        setState(() => _players = []);
        return;
      }
      final dt = DateTime.tryParse(match.date)?.toLocal();
      String? dayOfWeek;
      if (dt != null) {
        const map = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
        dayOfWeek = map[dt.weekday - 1];
      }
      final hour = int.tryParse((match.time ?? '').split(':').first) ?? 12;
      final timeOfDay = hour < 12 ? 'mañana' : (hour >= 18 ? 'noche' : 'tarde');

      final players = await ref.read(exploreServiceProvider).getAvailableLocalPlayers(
            lat: lat,
            lng: lng,
            dayOfWeek: dayOfWeek,
            timeOfDay: timeOfDay,
            matchPlayerUids: match.playerUids,
          );
      if (mounted) setState(() => _players = players);
    } catch (e) {
      if (mounted) {
        setState(() => _players = []);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive));
      }
    } finally {
      if (mounted) setState(() => _loadingPlayers = false);
    }
  }

  Future<void> _showAvailabilitySheet(bool isCurrentlyVisible) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => _AvailabilitySheet(uid: widget.uid),
    );
  }

  @override
  Widget build(BuildContext context) {
    final upcomingAsync = ref.watch(userUpcomingMatchesStreamProvider(widget.uid));
    final availabilityAsync = ref.watch(myAvailabilityStreamProvider(widget.uid));
    final isFreeAgent = availabilityAsync.value != null;

    return upcomingAsync.when(
      data: (matches) {
        final incomplete = matches.where((m) => m.matchSize > 0 && m.playerUids.length < m.matchSize).toList();

        if (_selectedMatchId == null && incomplete.isNotEmpty) {
          _selectedMatchId = incomplete.first.id;
        } else if (incomplete.isEmpty) {
          _selectedMatchId = null;
        }

        final selectedMatch = incomplete.where((m) => m.id == _selectedMatchId).toList();
        final match = selectedMatch.isNotEmpty ? selectedMatch.first : null;

        if (match != null && match.id != _lastLoadedMatchId && !_loadingPlayers) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _loadPlayers(match);
          });
        }

        final filteredPlayers = _positionFilter == null ? _players : _players.where((p) => p.position == _positionFilter).toList();

        return ListView(
          padding: EdgeInsets.fromLTRB(16, 16, 16, bottomInset(context)),
          children: [
            _FreeAgentBanner(isFreeAgent: isFreeAgent, onTap: () => _showAvailabilitySheet(isFreeAgent)),
            const SizedBox(height: 18),
            if (incomplete.isEmpty)
              Container(
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16)),
                child: Column(
                  children: [
                    Icon(Icons.groups_outlined, size: 44, color: AppColors.textMuted),
                    const SizedBox(height: 10),
                    Text('Plantel Completo', style: AppTypography.headline(size: 15)),
                    const SizedBox(height: 6),
                    Text(
                      'El mercado se abre cuando organizás un partido al que le falten jugadores.',
                      textAlign: TextAlign.center,
                      style: AppTypography.body(size: 12, color: AppColors.textMuted),
                    ),
                  ],
                ),
              )
            else ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: AppColors.voltNeon.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.voltNeon.withValues(alpha: 0.25))),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('BUSCANDO REFUERZOS PARA', style: AppTypography.code(size: 10, weight: FontWeight.w800, color: AppColors.voltNeon)),
                    const SizedBox(height: 8),
                    DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedMatchId,
                        isExpanded: true,
                        dropdownColor: AppColors.cardSurface,
                        style: AppTypography.body(size: 14, weight: FontWeight.w700, color: AppColors.textPrimary),
                        items: incomplete
                            .map((m) => DropdownMenuItem(
                                  value: m.id,
                                  child: Text('${m.title} (faltan ${m.matchSize - m.playerUids.length})', overflow: TextOverflow.ellipsis),
                                ))
                            .toList(),
                        onChanged: (v) => setState(() => _selectedMatchId = v),
                      ),
                    ),
                    if (match != null) ...[
                      const SizedBox(height: 8),
                      Row(children: [
                        Icon(Icons.calendar_today_outlined, size: 13, color: AppColors.textMuted),
                        const SizedBox(width: 6),
                        Text('${_fmtDate(match.date)} · ${match.time ?? ''} hs', style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                      ]),
                      if (match.location != null) ...[
                        const SizedBox(height: 4),
                        Row(children: [
                          Icon(Icons.location_on_outlined, size: 13, color: AppColors.textMuted),
                          const SizedBox(width: 6),
                          Expanded(child: Text(match.location!, style: AppTypography.body(size: 11, color: AppColors.textMuted), maxLines: 1, overflow: TextOverflow.ellipsis)),
                        ]),
                      ],
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: ['Todos', 'POR', 'DEF', 'MED', 'DEL'].map((pos) {
                    final value = pos == 'Todos' ? null : pos;
                    final selected = _positionFilter == value;
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        label: Text(pos),
                        selected: selected,
                        onSelected: (_) => setState(() => _positionFilter = value),
                        selectedColor: AppColors.voltNeon.withValues(alpha: 0.25),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 14),
              Row(children: [
                Text('JUGADORES DISPONIBLES', style: AppTypography.headline(size: 12, weight: FontWeight.w800, color: AppColors.textSecondary)),
                if (filteredPlayers.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: AppColors.cardSurface, borderRadius: BorderRadius.circular(20)),
                    child: Text('${filteredPlayers.length}', style: AppTypography.code(size: 11, weight: FontWeight.w700)),
                  ),
                ],
              ]),
              const SizedBox(height: 10),
              if (_loadingPlayers)
                const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
              else if (filteredPlayers.isEmpty)
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(color: AppColors.card.withValues(alpha: 0.4), borderRadius: BorderRadius.circular(14)),
                  child: Column(
                    children: [
                      Icon(Icons.search_off, size: 36, color: AppColors.textMuted),
                      const SizedBox(height: 8),
                      Text('Nadie disponible en la zona', style: AppTypography.body(size: 13, weight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text('No encontramos jugadores libres para esa fecha, horario y ubicación.', textAlign: TextAlign.center, style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                    ],
                  ),
                )
              else
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 0.72),
                  itemCount: filteredPlayers.length,
                  itemBuilder: (context, index) => _FreeAgentCard(
                    player: filteredPlayers[index],
                    matchId: match!.id,
                  ),
                ),
            ],
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }
}

class _FreeAgentBanner extends StatelessWidget {
  final bool isFreeAgent;
  final VoidCallback onTap;

  const _FreeAgentBanner({required this.isFreeAgent, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.voltNeon.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.voltNeon.withValues(alpha: 0.3))),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(shape: BoxShape.circle, color: isFreeAgent ? AppColors.voltNeon : AppColors.cardSurface),
            child: Icon(Icons.campaign_outlined, size: 18, color: isFreeAgent ? Colors.black : AppColors.textMuted),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(isFreeAgent ? 'Estás activo en el Mercado' : '¿Te falta partido?', style: AppTypography.body(size: 13, weight: FontWeight.w700)),
                Text(
                  isFreeAgent ? 'Los organizadores pueden reclutarte.' : 'Ofrecete como agente libre para que te inviten.',
                  style: AppTypography.body(size: 11, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          OutlinedButton(onPressed: onTap, child: Text(isFreeAgent ? 'Ajustar' : 'Ofrecerme')),
        ],
      ),
    );
  }
}

class _FreeAgentCard extends StatelessWidget {
  final AvailablePlayerModel player;
  final String matchId;

  const _FreeAgentCard({required this.player, required this.matchId});

  @override
  Widget build(BuildContext context) {
    final chip = player.matchScore == 2
        ? ('Coincide', AppColors.success)
        : player.matchScore == 1
            ? ('Parcial', AppColors.warning)
            : ('No coincide', AppColors.destructive);

    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => showModalBottomSheet<void>(
        context: context,
        backgroundColor: AppColors.card,
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        builder: (context) => _FreeAgentDetailSheet(player: player, matchId: matchId),
      ),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border.withValues(alpha: 0.4))),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${player.ovr}', style: AppTypography.headline(size: 20, weight: FontWeight.w900, color: AppColors.voltNeon)),
                Text(player.position, style: AppTypography.code(size: 11, weight: FontWeight.w800)),
              ],
            ),
            const SizedBox(height: 8),
            CircleAvatar(
              radius: 30,
              backgroundColor: AppColors.cardSurface,
              backgroundImage: player.photoUrl != null && player.photoUrl!.isNotEmpty ? NetworkImage(player.photoUrl!) : null,
              child: player.photoUrl == null || player.photoUrl!.isEmpty ? Text(player.displayName.isNotEmpty ? player.displayName[0].toUpperCase() : '?', style: AppTypography.headline(size: 18)) : null,
            ),
            const SizedBox(height: 8),
            Text(player.displayName, style: AppTypography.body(size: 12, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
            if (player.distanceKm != null) Text('${player.distanceKm!.toStringAsFixed(1)} km', style: AppTypography.body(size: 10, color: AppColors.textMuted)),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: chip.$2.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20), border: Border.all(color: chip.$2.withValues(alpha: 0.4))),
              child: Text(chip.$1, style: AppTypography.code(size: 9, weight: FontWeight.w700, color: chip.$2)),
            ),
          ],
        ),
      ),
    );
  }
}

class _FreeAgentDetailSheet extends ConsumerStatefulWidget {
  final AvailablePlayerModel player;
  final String matchId;

  const _FreeAgentDetailSheet({required this.player, required this.matchId});

  @override
  ConsumerState<_FreeAgentDetailSheet> createState() => _FreeAgentDetailSheetState();
}

class _FreeAgentDetailSheetState extends ConsumerState<_FreeAgentDetailSheet> {
  bool _isInviting = false;

  Future<void> _invite() async {
    setState(() => _isInviting = true);
    try {
      await ref.read(exploreServiceProvider).sendMatchInvitations(matchId: widget.matchId, playerIds: [widget.player.uid]);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('¡Invitación enviada!'), backgroundColor: AppColors.success));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive));
    } finally {
      if (mounted) setState(() => _isInviting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final player = widget.player;
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 30,
                backgroundColor: AppColors.cardSurface,
                backgroundImage: player.photoUrl != null && player.photoUrl!.isNotEmpty ? NetworkImage(player.photoUrl!) : null,
                child: player.photoUrl == null || player.photoUrl!.isEmpty ? Text(player.displayName.isNotEmpty ? player.displayName[0].toUpperCase() : '?', style: AppTypography.headline(size: 18)) : null,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(player.displayName, style: AppTypography.headline(size: 17)),
                    Text('${player.position} · OVR ${player.ovr}', style: AppTypography.body(size: 12, color: AppColors.textMuted)),
                    if (player.distanceKm != null) Text('${player.distanceKm!.toStringAsFixed(1)} km', style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                  ],
                ),
              ),
            ],
          ),
          if (player.availability.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('DISPONIBILIDAD', style: AppTypography.headline(size: 11, weight: FontWeight.w800, color: AppColors.textSecondary)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: player.availability.entries.map((e) {
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: AppColors.cardSurface, borderRadius: BorderRadius.circular(10)),
                  child: Text('${e.key}: ${e.value.join(', ')}', style: AppTypography.body(size: 11)),
                );
              }).toList(),
            ),
          ],
          const SizedBox(height: 20),
          if (player.isCurrentUser)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(border: Border.all(color: AppColors.border, style: BorderStyle.solid), borderRadius: BorderRadius.circular(10)),
              child: Text('Tu perfil de Pase Libre', textAlign: TextAlign.center, style: AppTypography.body(size: 12, color: AppColors.textMuted)),
            )
          else
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _isInviting ? null : _invite,
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black, padding: const EdgeInsets.symmetric(vertical: 12)),
                icon: _isInviting
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                    : const Icon(Icons.person_add_alt_1, size: 18),
                label: const Text('Invitar a mi partido'),
              ),
            ),
        ],
      ),
    );
  }
}

class _AvailabilitySheet extends ConsumerStatefulWidget {
  final String uid;

  const _AvailabilitySheet({required this.uid});

  @override
  ConsumerState<_AvailabilitySheet> createState() => _AvailabilitySheetState();
}

class _AvailabilitySheetState extends ConsumerState<_AvailabilitySheet> {
  final _locationService = LocationService();
  final _locationController = TextEditingController();
  List<LocationSuggestion> _suggestions = [];
  LocationSuggestion? _newLocation;
  Timer? _debounce;
  bool _isSaving = false;

  Set<String> _days = {};
  Set<String> _times = {};

  @override
  void dispose() {
    _locationController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _toggle(bool visible, Map<String, dynamic>? currentLocation) async {
    setState(() => _isSaving = true);
    try {
      if (visible) {
        double? lat = _newLocation?.lat ?? (currentLocation?['lat'] as num?)?.toDouble();
        double? lng = _newLocation?.lng ?? (currentLocation?['lng'] as num?)?.toDouble();
        if (lat == null || lng == null) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Buscá y elegí tu ubicación primero.'), backgroundColor: AppColors.destructive));
          return;
        }
        if (_newLocation != null) {
          await ref.read(exploreServiceProvider).saveUserLocation(lat: lat, lng: lng, label: _newLocation!.label);
        }
        final days = _days.isEmpty ? ['sabado', 'domingo'] : _days.toList();
        final times = _times.isEmpty ? ['tarde', 'noche'] : _times.toList();
        await ref.read(exploreServiceProvider).enableAvailability(days: days, times: times, lat: lat, lng: lng);
      } else {
        await ref.read(exploreServiceProvider).disableAvailability();
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _updatePrefs(bool isVisible) async {
    if (!isVisible) return;
    try {
      await ref.read(exploreServiceProvider).updateAvailabilityPreferences(days: _days.toList(), times: _times.toList());
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final availabilityAsync = ref.watch(myAvailabilityStreamProvider(widget.uid));
    final locationAsync = ref.watch(savedLocationStreamProvider(widget.uid));
    final isVisible = availabilityAsync.value != null;

    if (_days.isEmpty && _times.isEmpty && availabilityAsync.value != null) {
      final avail = availabilityAsync.value!['availability'] as Map<String, dynamic>? ?? {};
      _days = avail.keys.toSet();
      _times = avail.values.expand((v) => (v as List).cast<String>()).toSet();
    }

    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: 20 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              Icon(Icons.search, color: AppColors.voltNeon),
              const SizedBox(width: 8),
              Text('Buscar Partido', style: AppTypography.headline(size: 16)),
            ]),
            Text('Mostrá tu perfil a organizadores para que te inviten', style: AppTypography.body(size: 11, color: AppColors.textMuted)),
            const SizedBox(height: 16),
            Row(
              children: [
                Text('Visible para otros', style: AppTypography.body(size: 13, weight: FontWeight.w700)),
                const Spacer(),
                if (_isSaving) const Padding(padding: EdgeInsets.only(right: 8), child: SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))),
                Switch(value: isVisible, activeThumbColor: AppColors.voltNeon, onChanged: _isSaving ? null : (v) => _toggle(v, locationAsync.value)),
              ],
            ),
            const SizedBox(height: 12),
            if (_days.isEmpty && isVisible)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text('Por defecto: sábado y domingo', style: AppTypography.body(size: 11, color: AppColors.textMuted)),
              ),
            _DayTimePicker(
              days: _days,
              times: _times,
              enabled: isVisible,
              onDaysChanged: (d) {
                setState(() => _days = d);
                _updatePrefs(isVisible);
              },
              onTimesChanged: (t) {
                setState(() => _times = t);
                _updatePrefs(isVisible);
              },
            ),
            const SizedBox(height: 16),
            Text('UBICACIÓN', style: AppTypography.code(size: 10, weight: FontWeight.w800, color: AppColors.textMuted)),
            const SizedBox(height: 8),
            TextField(
              controller: _locationController,
              enabled: isVisible,
              decoration: const InputDecoration(hintText: 'Buscá tu ubicación...', prefixIcon: Icon(Icons.location_on_outlined)),
              onChanged: (v) {
                _newLocation = null;
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 300), () async {
                  if (v.trim().length < 3) {
                    setState(() => _suggestions = []);
                    return;
                  }
                  final results = await _locationService.suggest(v);
                  if (mounted) setState(() => _suggestions = results);
                });
              },
            ),
            if (_suggestions.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: 4),
                decoration: BoxDecoration(color: AppColors.cardSurface, borderRadius: BorderRadius.circular(10)),
                child: Column(
                  children: _suggestions
                      .map((s) => ListTile(
                            dense: true,
                            title: Text(s.label, style: AppTypography.body(size: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
                            onTap: () => setState(() {
                              _newLocation = s;
                              _locationController.text = s.label;
                              _suggestions = [];
                            }),
                          ))
                      .toList(),
                ),
              )
            else if (locationAsync.value != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text('Actual: ${locationAsync.value!['label'] ?? '${locationAsync.value!['lat']}, ${locationAsync.value!['lng']}'}', style: AppTypography.body(size: 11, color: AppColors.textMuted)),
              ),
          ],
        ),
      ),
    );
  }
}

class _DayTimePicker extends StatelessWidget {
  final Set<String> days;
  final Set<String> times;
  final bool enabled;
  final ValueChanged<Set<String>> onDaysChanged;
  final ValueChanged<Set<String>> onTimesChanged;

  const _DayTimePicker({required this.days, required this.times, required this.enabled, required this.onDaysChanged, required this.onTimesChanged});

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: IgnorePointer(
        ignoring: !enabled,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _days.map((d) {
                final id = d['id'] as String;
                final selected = days.contains(id);
                return FilterChip(
                  label: Text(d['short'] as String),
                  selected: selected,
                  onSelected: (v) => onDaysChanged(v ? {...days, id} : {...days}..remove(id)),
                  selectedColor: AppColors.voltNeon.withValues(alpha: 0.2),
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
            Text('HORARIOS PREFERIDOS', style: AppTypography.code(size: 10, weight: FontWeight.w800, color: AppColors.textMuted)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              children: _times.map((t) {
                final id = t['id'] as String;
                final selected = times.contains(id);
                return FilterChip(
                  avatar: Icon(t['icon'] as IconData, size: 14),
                  label: Text(t['label'] as String),
                  selected: selected,
                  onSelected: (v) => onTimesChanged(v ? {...times, id} : {...times}..remove(id)),
                  selectedColor: AppColors.voltNeon.withValues(alpha: 0.2),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------
// Tab 2: Partidos Abiertos
// ---------------------------------------------------------------------
class _PartidosAbiertosTab extends ConsumerStatefulWidget {
  final String uid;

  const _PartidosAbiertosTab({required this.uid});

  @override
  ConsumerState<_PartidosAbiertosTab> createState() => _PartidosAbiertosTabState();
}

class _PartidosAbiertosTabState extends ConsumerState<_PartidosAbiertosTab> {
  final Set<String> _selectedTypes = {};

  static const _typeFilters = {'manual': 'Amistoso', 'collaborative': 'Colaborativo', 'by_teams': 'Por Equipos'};

  @override
  Widget build(BuildContext context) {
    final matchesAsync = ref.watch(publicMatchesStreamProvider);

    return matchesAsync.when(
      data: (matches) {
        var filtered = matches.where((m) => !m.playerUids.contains(widget.uid)).where((m) => m.matchSize == 0 || m.playerUids.length < m.matchSize).toList();
        if (_selectedTypes.isNotEmpty) {
          filtered = filtered.where((m) => _selectedTypes.contains(m.type)).toList();
        }

        return ListView(
          padding: EdgeInsets.fromLTRB(16, 16, 16, bottomInset(context)),
          children: [
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _typeFilters.entries.map((e) {
                final selected = _selectedTypes.contains(e.key);
                return FilterChip(
                  label: Text(e.value),
                  selected: selected,
                  onSelected: (v) => setState(() => v ? _selectedTypes.add(e.key) : _selectedTypes.remove(e.key)),
                  selectedColor: AppColors.voltNeon.withValues(alpha: 0.2),
                );
              }).toList(),
            ),
            const SizedBox(height: 14),
            if (filtered.isEmpty)
              Container(
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16)),
                child: Column(
                  children: [
                    Icon(Icons.calendar_month_outlined, size: 40, color: AppColors.textMuted),
                    const SizedBox(height: 10),
                    Text('No hay partidos disponibles', style: AppTypography.headline(size: 15)),
                    const SizedBox(height: 4),
                    Text('Probá quitando filtros, o creá un partido público para que otros se unan.', textAlign: TextAlign.center, style: AppTypography.body(size: 12, color: AppColors.textMuted)),
                  ],
                ),
              )
            else
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${filtered.length} partido${filtered.length != 1 ? 's' : ''} disponible${filtered.length != 1 ? 's' : ''}', style: AppTypography.body(size: 12, color: AppColors.textMuted)),
                  const SizedBox(height: 10),
                  for (final m in filtered)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _PublicMatchCard(match: m, uid: widget.uid),
                    ),
                ],
              ),
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }
}

/// Un partido al que te podes sumar.
///
/// Antes era media tarjeta en una grilla de dos columnas y el unico gesto era
/// tocarla para ir al detalle. Ahora la accion vive en la tarjeta: sumarse es
/// lo que uno viene a hacer aca, y no tiene por que costar dos pantallas.
class _PublicMatchCard extends ConsumerStatefulWidget {
  final MatchModel match;
  final String uid;

  const _PublicMatchCard({required this.match, required this.uid});

  @override
  ConsumerState<_PublicMatchCard> createState() => _PublicMatchCardState();
}

class _PublicMatchCardState extends ConsumerState<_PublicMatchCard> {
  bool _busy = false;

  Future<void> _join() async {
    setState(() => _busy = true);
    try {
      final pending =
          await ref.read(matchServiceProvider).joinOrRequest(widget.match, widget.uid);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(pending
            ? 'Solicitud enviada. El organizador te va a responder.'
            : 'Te anotaste a "${widget.match.title}".'),
      ));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('$e'),
        backgroundColor: AppColors.destructive,
      ));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final match = widget.match;
    final theme = getMatchTypeTheme(match.type);
    final hasTeams = match.teamA != null && match.teamB != null;
    final pending = match.pendingPlayerUids.contains(widget.uid);
    final spots = match.matchSize - match.playerUids.length;
    final needsApproval = match.needsApprovalFrom(widget.uid);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadii.cardAll,
        border: Border.all(color: theme.brandColor.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(shape: BoxShape.circle, color: theme.brandColor),
              ),
              const SizedBox(width: 7),
              Text(theme.label.toUpperCase(),
                  style: AppTypography.code(
                      size: 9, weight: FontWeight.w700, color: AppColors.textSecondary)),
              const Spacer(),
              if (match.matchSize > 0 && spots > 0)
                Text(spots == 1 ? 'falta 1' : 'faltan $spots',
                    style: AppTypography.code(
                        size: 10, weight: FontWeight.w800, color: AppColors.voltNeon)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              if (hasTeams) ...[
                if (match.teamA!.jersey != null)
                  JerseyWidget(jersey: match.teamA!.jersey!, size: 30),
                const SizedBox(width: 4),
                if (match.teamB!.jersey != null)
                  JerseyWidget(jersey: match.teamB!.jersey!, size: 30),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Text(match.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.headline(size: 15, weight: FontWeight.w800)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _row(Icons.calendar_today_outlined,
              '${_fmtDate(match.date)}  -  ${match.time ?? ''} hs'),
          if (match.location != null) ...[
            const SizedBox(height: 4),
            _row(Icons.location_on_outlined, match.location!),
          ],
          const SizedBox(height: 4),
          _row(
            Icons.groups_outlined,
            match.matchSize > 0
                ? '${match.playerUids.length}/${match.matchSize} jugadores'
                : '${match.playerUids.length} jugadores',
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => context.push('/matches/${match.id}'),
                  child: const Text('Ver detalles'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: pending
                    ? OutlinedButton.icon(
                        onPressed: null,
                        icon: const Icon(Icons.hourglass_top_rounded, size: 16),
                        label: const Text('Pedido enviado'),
                      )
                    : FilledButton.icon(
                        onPressed: _busy ? null : _join,
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.voltNeon,
                          foregroundColor: AppColors.background,
                        ),
                        icon: _busy
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: AppColors.background))
                            : Icon(
                                needsApproval
                                    ? Icons.how_to_reg_rounded
                                    : Icons.person_add_alt_1,
                                size: 16),
                        label: Text(needsApproval ? 'Solicitar' : 'Unirme',
                            style: AppTypography.headline(
                                size: 13,
                                weight: FontWeight.w800,
                                color: AppColors.background)),
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _row(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 12, color: AppColors.textMuted),
        const SizedBox(width: 6),
        Expanded(
          child: Text(text,
              style: AppTypography.body(size: 11, color: AppColors.textMuted),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }
}
