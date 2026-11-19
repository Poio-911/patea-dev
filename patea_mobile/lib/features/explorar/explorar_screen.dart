import '../../core/utils/availability_labels.dart';
import '../../core/utils/explore_filters.dart';
import '../../core/widgets/patea_section_scene.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_states.dart';
import 'dart:async';
import '../../core/widgets/patea_card.dart';
import '../../core/constants/sections.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_avatar.dart';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/dates.dart';
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
import '../../core/widgets/patea_help_dialog.dart';
import '../../core/widgets/patea_page_header.dart';
import '../../core/widgets/patea_tabs.dart';

const _days = [
  {'id': 'lunes', 'short': 'Lun', 'name': 'Lunes'},
  {'id': 'martes', 'short': 'Mar', 'name': 'Martes'},
  {'id': 'miercoles', 'short': 'Mié', 'name': 'Miércoles'},
  {'id': 'jueves', 'short': 'Jue', 'name': 'Jueves'},
  {'id': 'viernes', 'short': 'Vie', 'name': 'Viernes'},
  {'id': 'sabado', 'short': 'Sáb', 'name': 'Sábado'},
  {'id': 'domingo', 'short': 'Dom', 'name': 'Domingo'},
];
const _times = [
  {
    'id': 'mañana',
    'label': 'Mañana',
    'sub': '8-13h',
    'icon': Icons.wb_sunny_outlined,
  },
  {
    'id': 'tarde',
    'label': 'Tarde',
    'sub': '13-19h',
    'icon': Icons.wb_twilight_outlined,
  },
  {
    'id': 'noche',
    'label': 'Noche',
    'sub': '19-00h',
    'icon': Icons.nightlight_outlined,
  },
];

/// Discovery keeps browsing independent from publishing availability.
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
              16,
              MediaQuery.of(context).padding.top + 12,
              16,
              0,
            ),
            child: PateaPageHeader(
              section: Section.explorar,
              title: spec(Section.explorar).title,
              description: spec(Section.explorar).description,
              showCountRow: false,
              helpTooltip: 'Cómo funciona Explorar',
              onHelpTap: () => showContextualHelpSheet(
                context,
                topic: HelpTopic.explore,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: PateaTabs(
              tabs: const [PateaTab('Jugadores'), PateaTab('Partidos')],
              active: _tab,
              onChanged: (i) => setState(() => _tab = i),
            ),
          ),
          Expanded(
            child: uid == null
                ? const SizedBox()
                : IndexedStack(
                    index: _tab,
                    children: [
                      _MercadoTab(uid: uid),
                      _PartidosAbiertosTab(uid: uid),
                    ],
                  ),
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
  String? _selectedMatchId, _position, _queryKey, _error;
  LocationSuggestion? _zone;
  double _radius = 15;
  int _request = 0;
  bool _loading = true;
  List<AvailablePlayerModel> _players = [];

  Future<void> _load(
    MatchModel? match,
    LocationSuggestion zone,
    String key,
  ) async {
    final request = ++_request;
    setState(() {
      _loading = true;
      _error = null;
      _queryKey = key;
    });
    try {
      final date = match == null
          ? null
          : DateTime.tryParse(match.date)?.toLocal();
      final hour = int.tryParse((match?.time ?? '').split(':').first);
      final players = await ref
          .read(exploreServiceProvider)
          .getAvailableLocalPlayers(
            lat: zone.lat,
            lng: zone.lng,
            radiusInKm: _radius,
            dayOfWeek: date == null ? null : _days[date.weekday - 1]['id'],
            timeOfDay: hour == null
                ? null
                : (hour < 13
                      ? 'mañana'
                      : hour < 19
                      ? 'tarde'
                      : 'noche'),
            matchPlayerUids: match?.playerUids ?? const [],
          );
      if (mounted && request == _request) {
        setState(() {
          _players =
              players
                  .where((p) => !p.isCurrentUser && p.uid != widget.uid)
                  .toList()
                ..sort((a, b) {
                  final score = match == null
                      ? 0
                      : b.matchScore.compareTo(a.matchScore);
                  return score != 0
                      ? score
                      : (a.distanceKm ?? 999).compareTo(b.distanceKm ?? 999);
                });
        });
      }
    } catch (_) {
      if (mounted && request == _request) {
        setState(
          () => _error = 'No pudimos buscar jugadores. Volvé a intentar.',
        );
      }
    } finally {
      if (mounted && request == _request) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final owned = ref.watch(ownedUpcomingMatchesProvider(widget.uid));
    final available = ref.watch(myAvailabilityStreamProvider(widget.uid));
    final savedAsync = ref.watch(savedLocationStreamProvider(widget.uid));
    if (savedAsync.isLoading) {
      return const PateaLoading();
    }
    final saved = savedAsync.value;
    final matches =
        (owned.value ?? <MatchModel>[])
            .where((m) => canRecruitFor(m, widget.uid, DateTime.now()))
            .toList()
          ..sort((a, b) => a.date.compareTo(b.date));
    final selected = matches.where((m) => m.id == _selectedMatchId).firstOrNull;
    final loc = selected?.locationDetail;
    final zone =
        _zone ??
        (loc != null && (loc.lat != 0 || loc.lng != 0)
            ? LocationSuggestion(
                label: loc.name,
                lat: loc.lat,
                lng: loc.lng,
                placeId: '',
              )
            : _savedZone(saved));
    final key =
        '${selected?.id}|${selected?.date}|${selected?.time}|${selected?.playerUids.join(',')}|${zone.lat}|${zone.lng}|$_radius';
    if (key != _queryKey) {
      _queryKey = key;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _load(selected, zone, key);
      });
    }
    final players = _players
        .where((p) => _position == null || p.position == _position)
        .toList();
    return RefreshIndicator(
      onRefresh: () => _load(selected, zone, key),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(16, 16, 16, bottomInset(context)),
        children: [
          Text(
            'Buscar jugadores para',
            style: AppTypography.body(size: 12, color: context.c.textSecondary),
          ),
          Row(
            children: [
              Icon(
                selected == null ? Icons.travel_explore : Icons.sports_soccer,
                size: 19,
                color: context.c.textSecondary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: selected?.id ?? '',
                    isExpanded: true,
                    style: AppTypography.body(
                      size: 14,
                      weight: FontWeight.w600,
                      color: context.c.textPrimary,
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: '',
                        child: Text('En mi zona'),
                      ),
                      ...matches.map(
                        (m) => DropdownMenuItem(
                          value: m.id,
                          child: Text(
                            m.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    ],
                    onChanged: (v) => setState(() {
                      _selectedMatchId = v == '' ? null : v;
                      _zone = null;
                    }),
                  ),
                ),
              ),
            ],
          ),
          if (selected != null)
            Text(
              '${fmtDate(selected.date)} · ${selected.time ?? 'Horario a definir'} · ${selected.matchSize == 0
                      ? 'Cupo abierto'
                      : '${selected.matchSize - selected.playerUids.length} lugares'}',
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
          if (owned.hasError)
            Text(
              'No pudimos cargar tus partidos. Podés buscar en tu zona.',
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
          const SizedBox(height: 8),
          _ZoneControl(
            zone: zone,
            radius: _radius,
            suggested: _zone == null && saved == null && loc == null,
            onZone: (z) => setState(() => _zone = z),
            onRadius: (v) => setState(() => _radius = v),
          ),
          const SizedBox(height: 14),
          Divider(height: 1, color: context.c.overlayLine),
          ListTile(
            key: const ValueKey('my-explore-availability'),
            contentPadding: EdgeInsets.zero,
            leading: Icon(
              Icons.person_search_outlined,
              size: 23,
              color: context.c.textSecondary,
            ),
            title: Text(
              'Tu disponibilidad',
              style: AppTypography.body(size: 14, weight: FontWeight.w600),
            ),
            subtitle: Text(
              available.isLoading
                  ? 'Consultando tu estado…'
                  : available.hasError
                  ? 'No pudimos consultar tu estado'
                  : available.value != null
                  ? 'Disponible · Editar horarios'
                  : 'Sin publicar · Elegir horarios',
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
            trailing: Icon(
              Icons.chevron_right,
              size: 18,
              color: context.c.textSecondary,
            ),
            onTap: () => showModalBottomSheet<void>(
              context: context,
              useRootNavigator: true,
              isScrollControlled: true,
              backgroundColor: Colors.transparent,
              builder: (_) => _AvailabilitySheet(uid: widget.uid),
            ),
          ),
          Divider(height: 1, color: context.c.overlayLine),
          const SizedBox(height: 24),
          Text(
            _loading
                ? 'Buscando jugadores…'
                : players.length.toString() +
                      (players.length == 1
                          ? ' jugador cerca'
                          : ' jugadores cerca'),
            style: AppTypography.headline(size: 17),
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final pos in ['Todos', 'POR', 'DEF', 'MED', 'DEL'])
                  Semantics(
                    selected: _position == (pos == 'Todos' ? null : pos),
                    child: Container(
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            width: 2,
                            color: _position == (pos == 'Todos' ? null : pos)
                                ? context.c.primary
                                : Colors.transparent,
                          ),
                        ),
                      ),
                      child: TextButton(
                        onPressed: () => setState(
                          () => _position = pos == 'Todos' ? null : pos,
                        ),
                        style: TextButton.styleFrom(
                          foregroundColor:
                              _position == (pos == 'Todos' ? null : pos)
                              ? context.c.textPrimary
                              : context.c.textSecondary,
                          minimumSize: const Size(55, 44),
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                        ),
                        child: Text(pos, style: AppTypography.action(size: 12)),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          if (_loading)
            const PateaLoading(height: 160)
          else if (_error != null)
            PateaError(
              error: _error,
              message: _error!,
              compact: true,
              onRetry: () => _load(selected, zone, key),
            )
          else if (players.isEmpty)
            PateaSectionScene(
              image: PateaSectionScene.explore,
              title: _position == null
                  ? 'Todavía no hay jugadores en esta zona'
                  : 'No hay jugadores en esa posición',
              description:
                  'Ampliá la distancia o cambiá de zona para seguir buscando.',
            )
          else
            for (final player in players)
              _DiscoveryPlayerRow(player: player, matchId: selected?.id),
        ],
      ),
    );
  }
}

LocationSuggestion _savedZone(Map<String, dynamic>? saved) =>
    LocationSuggestion(
      label: saved?['label'] as String? ?? 'Montevideo',
      lat: (saved?['lat'] as num?)?.toDouble() ?? -34.9011,
      lng: (saved?['lng'] as num?)?.toDouble() ?? -56.1645,
      placeId: '',
    );

Color _discoveryOvrColor(BuildContext context) => context.c.ratingAccent;

Color _discoveryPositionColor(BuildContext context, String position) =>
    context.c.positionColor(position);

class _DiscoveryPlayerRow extends StatelessWidget {
  final AvailablePlayerModel player;
  final String? matchId;
  const _DiscoveryPlayerRow({required this.player, this.matchId});
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: () => showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      backgroundColor: context.c.popover,
      builder: (_) => _FreeAgentDetailSheet(player: player, matchId: matchId),
    ),
    child: Padding(
      padding: const EdgeInsets.only(top: 15),
      child: Column(
        children: [
          Row(
            children: [
              PateaAvatar(
                seed: player.uid,
                photoUrl: player.photoUrl,
                size: 64,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      player.displayName,
                      style: AppTypography.body(
                        size: 15,
                        weight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Wrap(
                      spacing: 8,
                      runSpacing: 3,
                      children: [
                        Text(
                          player.position.isEmpty
                              ? 'Posición a consultar'
                              : player.position,
                          style: AppTypography.body(
                            size: 12,
                            weight: FontWeight.w700,
                            color: _discoveryPositionColor(
                              context,
                              player.position,
                            ),
                          ),
                        ),
                        if (player.distanceKm != null)
                          Text(
                            '${player.distanceKm!.toStringAsFixed(1)} km',
                            style: AppTypography.body(
                              size: 12,
                              color: context.c.textSecondary,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      availabilitySummary(player.availability),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                children: [
                  Text(
                    player.ovr > 0 ? player.ovr.toString() : '—',
                    style: AppTypography.sportNumber(
                      size: 23,
                      color: _discoveryOvrColor(context),
                    ),
                  ),
                  Text(
                    'OVR',
                    style: AppTypography.body(
                      size: 12,
                      color: context.c.textSecondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.chevron_right,
                size: 17,
                color: context.c.textSecondary,
              ),
            ],
          ),
          const SizedBox(height: 15),
          Divider(height: 1, color: context.c.overlayLine),
        ],
      ),
    ),
  );
}

class _ZoneControl extends StatelessWidget {
  final LocationSuggestion zone;
  final double radius;
  final bool suggested;
  final ValueChanged<LocationSuggestion> onZone;
  final ValueChanged<double> onRadius;
  const _ZoneControl({
    required this.zone,
    required this.radius,
    required this.onZone,
    required this.onRadius,
    this.suggested = false,
  });
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(
        flex: 3,
        child: TextButton(
          style: TextButton.styleFrom(
            foregroundColor: context.c.textPrimary,
            alignment: Alignment.centerLeft,
            padding: EdgeInsets.zero,
            minimumSize: const Size(48, 48),
          ),
          onPressed: () async {
            final value = await showModalBottomSheet<LocationSuggestion>(
              context: context,
              isScrollControlled: true,
              useRootNavigator: true,
              builder: (_) => const _DiscoveryZoneSheet(),
            );
            if (value != null) onZone(value);
          },
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.location_on_outlined,
                size: 19,
                color: context.c.textSecondary,
              ),
              const SizedBox(width: 7),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      zone.label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(
                        size: 13,
                        weight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      suggested ? 'Zona sugerida · Cambiar' : 'Cambiar zona',
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
        ),
      ),
      const SizedBox(width: 10),
      Flexible(
        flex: 2,
        child: PopupMenuButton<double>(
          tooltip: 'Distancia de búsqueda',
          initialValue: radius,
          onSelected: onRadius,
          itemBuilder: (_) => [
            if (radius == 0)
              const PopupMenuItem(value: 0, child: Text('Todas las zonas')),
            for (final km in [5.0, 15.0, 30.0, 50.0])
              PopupMenuItem(
                value: km,
                child: Text('${km.toInt()} km'),
              ),
          ],
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    radius == 0
                        ? 'Todas las zonas'
                        : 'Hasta ${radius.toInt()} km',
                    style: AppTypography.body(
                      size: 12,
                      weight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 3),
                Icon(
                  Icons.expand_more,
                  size: 18,
                  color: context.c.textSecondary,
                ),
              ],
            ),
          ),
        ),
      ),
    ],
  );
}

class _DiscoveryZoneSheet extends StatefulWidget {
  const _DiscoveryZoneSheet();
  @override
  State<_DiscoveryZoneSheet> createState() => _DiscoveryZoneSheetState();
}

class _DiscoveryZoneSheetState extends State<_DiscoveryZoneSheet> {
  final _controller = TextEditingController();
  Timer? _timer;
  int _request = 0;
  bool _busy = false;
  String? _error;
  List<LocationSuggestion> _results = [];
  void _search(String query) {
    _timer?.cancel();
    final request = ++_request;
    setState(() {
      _error = null;
      _results = [];
      _busy = query.trim().length >= 3;
    });
    if (!_busy) return;
    _timer = Timer(const Duration(milliseconds: 450), () async {
      try {
        final results = await LocationService().suggest(query);
        if (mounted && request == _request) {
          setState(() {
            _results = results;
            _busy = false;
          });
        }
      } catch (_) {
        if (mounted && request == _request) {
          setState(() {
            _error = 'No pudimos buscar esa zona. Intentá de nuevo.';
            _busy = false;
          });
        }
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        20,
        20,
        MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: SizedBox(
        height: 410,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '¿Dónde querés jugar?',
              style: AppTypography.headline(size: 23),
            ),
            const SizedBox(height: 8),
            const Text('Esta zona se usa solo para esta búsqueda.'),
            const SizedBox(height: 16),
            TextField(
              controller: _controller,
              onChanged: _search,
              decoration: const InputDecoration(
                labelText: 'Barrio, ciudad o dirección',
                prefixIcon: Icon(Icons.search),
              ),
            ),
            const SizedBox(height: 12),
            if (_busy) const LinearProgressIndicator(),
            if (_error != null) Text(_error!),
            Expanded(
              child: ListView(
                children: [
                  if (_controller.text.trim().length < 3)
                    ListTile(
                      title: const Text('Montevideo'),
                      subtitle: const Text('Usar el centro de la ciudad'),
                      onTap: () => Navigator.pop(context, _savedZone(null)),
                    ),
                  if (!_busy &&
                      _error == null &&
                      _controller.text.trim().length >= 3 &&
                      _results.isEmpty)
                    const ListTile(
                      title: Text('No encontramos esa zona'),
                      subtitle: Text('Probá agregando la ciudad o el país.'),
                    ),
                  for (final result in _results)
                    ListTile(
                      leading: const Icon(Icons.place_outlined),
                      title: Text(result.label),
                      onTap: () => Navigator.pop(context, result),
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

class _FreeAgentDetailSheet extends ConsumerStatefulWidget {
  final AvailablePlayerModel player;
  final String? matchId;

  const _FreeAgentDetailSheet({required this.player, required this.matchId});

  @override
  ConsumerState<_FreeAgentDetailSheet> createState() =>
      _FreeAgentDetailSheetState();
}

class _FreeAgentDetailSheetState extends ConsumerState<_FreeAgentDetailSheet> {
  bool _isInviting = false;

  Future<void> _invite() async {
    if (_isInviting) return;
    setState(() => _isInviting = true);
    try {
      String? matchId = widget.matchId;
      final uid = ref.read(authServiceProvider).currentUser?.uid;
      if (uid == null) return;
      final owned = await ref.read(ownedUpcomingMatchesProvider(uid).future);
      if (!mounted) return;
      final choices = owned
          .where(
            (m) =>
                canRecruitFor(m, uid, DateTime.now()) &&
                !m.playerUids.contains(widget.player.uid),
          )
          .toList();
      if (!choices.any((m) => m.id == matchId)) matchId = null;
      if (matchId == null) {
        matchId = await showDialog<String>(
          context: context,
          builder: (context) => SimpleDialog(
            title: const Text('Elegí tu partido'),
            children: [
              if (choices.isEmpty) ...[
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'Organizá un partido con lugares disponibles para invitar.',
                  ),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context, '__create__'),
                  child: const Text('Armar partido'),
                ),
              ],
              for (final m in choices)
                SimpleDialogOption(
                  onPressed: () => Navigator.pop(context, m.id),
                  child: Text(
                    '${m.title} · ${fmtDate(m.date)} · ${m.time ?? "Sin hora"}',
                  ),
                ),
            ],
          ),
        );
        if (!mounted || matchId == null) return;
        if (matchId == '__create__') {
          Navigator.pop(context);
          context.push('/matches/create');
          return;
        }
      }
      final alreadyPending = await ref
          .read(firestoreServiceProvider)
          .hasPendingMatchInvitation(matchId, widget.player.uid);
      if (!mounted) return;
      if (alreadyPending) {
        PateaSnack.info(
          context,
          'Ya le enviaste una invitación a este partido.',
        );
        return;
      }
      final selected = choices.firstWhere((m) => m.id == matchId);
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('Invitar a ${widget.player.displayName}'),
          content: Text(
            '${selected.title}\n${fmtDate(selected.date)} · ${selected.time ?? "Horario a definir"}\n${selected.location ?? "Cancha a definir"}',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Volver'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Enviar invitación'),
            ),
          ],
        ),
      );
      if (confirmed != true || !mounted) return;
      await ref
          .read(exploreServiceProvider)
          .sendMatchInvitations(
            matchId: matchId,
            playerIds: [widget.player.uid],
          );
      if (mounted) {
        Navigator.pop(context);
        PateaSnack.ok(
          context,
          '¡Invitación enviada a ${widget.player.displayName}!',
        );
      }
    } catch (_) {
      if (mounted) {
        PateaSnack.error(
          context,
          'No pudimos enviar la invitación. Revisá el partido e intentá de nuevo.',
        );
      }
    } finally {
      if (mounted) setState(() => _isInviting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final player = widget.player;
    final uid = ref.watch(authStateProvider).value?.uid;
    final selected = uid == null || widget.matchId == null
        ? null
        : ref
              .watch(ownedUpcomingMatchesProvider(uid))
              .value
              ?.where(
                (m) =>
                    m.id == widget.matchId &&
                    canRecruitFor(m, uid, DateTime.now()) &&
                    !m.playerUids.contains(player.uid),
              )
              .firstOrNull;
    final schedule = availabilityDescriptions(player.availability);
    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * .82,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  PateaAvatar(
                    photoUrl: player.photoUrl,
                    seed: player.uid,
                    size: 76,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          player.displayName,
                          style: AppTypography.headline(size: 23),
                        ),
                        const SizedBox(height: 7),
                        Wrap(
                          spacing: 10,
                          runSpacing: 5,
                          children: [
                            Text(
                              player.position.isEmpty
                                  ? 'Posición a consultar'
                                  : player.position,
                              style: AppTypography.body(
                                size: 13,
                                weight: FontWeight.w700,
                                color: _discoveryPositionColor(
                                  context,
                                  player.position,
                                ),
                              ),
                            ),
                            Text(
                              'OVR ${player.ovr > 0
                                      ? player.ovr.toString()
                                      : '—'}',
                              style: AppTypography.body(
                                size: 13,
                                weight: FontWeight.w600,
                                color: _discoveryOvrColor(context),
                              ),
                            ),
                            if (player.distanceKm != null)
                              Text(
                                '${player.distanceKm!.toStringAsFixed(1)} km',
                                style: AppTypography.body(
                                  size: 12,
                                  color: context.c.textSecondary,
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 26),
              Text('Puede jugar', style: AppTypography.headline(size: 16)),
              const SizedBox(height: 10),
              if (schedule.isEmpty)
                Text(
                  'Consultá con el jugador sus horarios disponibles.',
                  style: AppTypography.body(
                    size: 14,
                    color: context.c.textSecondary,
                  ),
                )
              else
                for (final line in schedule)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      line,
                      style: AppTypography.body(
                        size: 14,
                        color: context.c.textSecondary,
                      ),
                    ),
                  ),
              const SizedBox(height: 16),
              if (selected != null) ...[
                Divider(color: context.c.overlayLine),
                const SizedBox(height: 10),
                Text(
                  'Tu convocatoria',
                  style: AppTypography.body(
                    size: 12,
                    color: context.c.textSecondary,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  selected.title,
                  style: AppTypography.body(size: 15, weight: FontWeight.w600),
                ),
                const SizedBox(height: 5),
                Text(
                  '${fmtDate(selected.date)} · ${selected.time ?? 'Horario a definir'}',
                  style: AppTypography.body(
                    size: 13,
                    color: context.c.textSecondary,
                  ),
                ),
                const SizedBox(height: 20),
              ],
              if (player.isCurrentUser)
                Text(
                  'Esta es tu disponibilidad publicada.',
                  style: AppTypography.body(
                    size: 13,
                    color: context.c.textSecondary,
                  ),
                )
              else
                FilledButton.icon(
                  onPressed: _isInviting ? null : _invite,
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 15,
                    ),
                  ),
                  icon: _isInviting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: PateaButtonProgress(),
                        )
                      : const Icon(Icons.person_add_alt_1, size: 19),
                  label: Text(
                    selected == null
                        ? 'Elegir partido para invitar'
                        : 'Invitar a ${selected.title}',
                    textAlign: TextAlign.center,
                    style: AppTypography.action(size: 14),
                  ),
                ),
            ],
          ),
        ),
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
  LocationSuggestion? _selectedLocation;
  Timer? _debounce;
  bool _isSaving = false;
  bool _initialized = false;
  bool _isVisible = false;

  final Map<String, Set<String>> _schedule = {
    'lunes': {},
    'martes': {},
    'miercoles': {},
    'jueves': {},
    'viernes': {},
    'sabado': {},
    'domingo': {},
  };

  double? _currentLat;
  double? _currentLng;
  String? _currentLocationLabel;

  @override
  void dispose() {
    _locationController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _initScheduleAndLocation(
    Map<String, dynamic>? availData,
    Map<String, dynamic>? locData,
  ) {
    if (_initialized) return;
    _initialized = true;

    if (availData != null) {
      _isVisible = true;
      final rawAvail = availData['availability'] as Map<String, dynamic>? ?? {};
      for (final d in _days) {
        final id = d['id'] as String;
        final list = rawAvail[id];
        if (list is List) {
          _schedule[id] = list.map((e) => e.toString()).toSet();
        }
      }
    } else {
      _isVisible = true;
      _schedule['sabado'] = {'tarde', 'noche'};
      _schedule['domingo'] = {'tarde', 'noche'};
    }

    if (locData != null) {
      _currentLat = (locData['lat'] as num?)?.toDouble();
      _currentLng = (locData['lng'] as num?)?.toDouble();
      _currentLocationLabel = locData['label'] as String?;
    }
    _currentLat ??= -34.9011;
    _currentLng ??= -56.1645;
    _currentLocationLabel ??= 'Montevideo (Predeterminado)';
  }

  void _applyPreset(String preset) {
    HapticFeedback.selectionClick();
    setState(() {
      for (final key in _schedule.keys) {
        _schedule[key]!.clear();
      }
      switch (preset) {
        case 'weekend':
          _schedule['sabado'] = {'tarde', 'noche'};
          _schedule['domingo'] = {'tarde', 'noche'};
          break;
        case 'nights':
          for (final key in _schedule.keys) {
            _schedule[key] = {'noche'};
          }
          break;
        case 'afternoons_nights':
          for (final key in _schedule.keys) {
            _schedule[key] = {'tarde', 'noche'};
          }
          break;
        case 'clear':
          break;
      }
    });
  }

  void _toggleSlot(String dayId, String slotId) {
    HapticFeedback.selectionClick();
    setState(() {
      final slots = _schedule[dayId] ?? {};
      if (slots.contains(slotId)) {
        slots.remove(slotId);
      } else {
        slots.add(slotId);
      }
      _schedule[dayId] = slots;
    });
  }

  void _toggleAllDay(String dayId) {
    HapticFeedback.selectionClick();
    setState(() {
      final slots = _schedule[dayId] ?? {};
      if (slots.length == 3) {
        slots.clear();
      } else {
        slots.addAll(['mañana', 'tarde', 'noche']);
      }
      _schedule[dayId] = slots;
    });
  }

  void _selectQuickLocation(String label, double lat, double lng) {
    HapticFeedback.selectionClick();
    setState(() {
      _selectedLocation = LocationSuggestion(
        label: label,
        lat: lat,
        lng: lng,
        placeId: 'quick:${label.toLowerCase().replaceAll(' ', '_')}',
      );
      _locationController.text = label;
      _suggestions = [];
    });
  }

  Future<void> _save() async {
    setState(() => _isSaving = true);
    try {
      if (!_isVisible) {
        await ref.read(exploreServiceProvider).disableAvailability();
        if (mounted) {
          Navigator.pop(context);
          PateaSnack.ok(context, 'Modo Agente Libre desactivado.');
        }
        return;
      }

      final lat = _selectedLocation?.lat ?? _currentLat ?? -34.9011;
      final lng = _selectedLocation?.lng ?? _currentLng ?? -56.1645;
      final label =
          _selectedLocation?.label ?? _currentLocationLabel ?? 'Montevideo';

      if (_selectedLocation != null) {
        await ref
            .read(exploreServiceProvider)
            .saveUserLocation(lat: lat, lng: lng, label: label);
      }

      final availabilityMap = <String, List<String>>{};
      for (final entry in _schedule.entries) {
        if (entry.value.isNotEmpty) {
          availabilityMap[entry.key] = entry.value.toList();
        }
      }

      if (availabilityMap.isEmpty) {
        availabilityMap['sabado'] = ['tarde', 'noche'];
        availabilityMap['domingo'] = ['tarde', 'noche'];
      }

      await ref
          .read(exploreServiceProvider)
          .enableAvailability(
            availability: availabilityMap,
            lat: lat,
            lng: lng,
            label: label,
          );

      if (mounted) {
        Navigator.pop(context);
        PateaSnack.ok(
          context,
          '¡Disponibilidad guardada! Ya estás activo en el mercado.',
        );
      }
    } catch (e) {
      if (mounted) PateaSnack.error(context, 'Error al guardar: $e');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final availabilityAsync = ref.watch(
      myAvailabilityStreamProvider(widget.uid),
    );
    final locationAsync = ref.watch(savedLocationStreamProvider(widget.uid));

    _initScheduleAndLocation(availabilityAsync.value, locationAsync.value);

    final activeLocationLabel =
        _selectedLocation?.label ?? _currentLocationLabel ?? 'Montevideo';

    return Container(
      decoration: BoxDecoration(
        color: context.c.background,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppRadii.surface),
        ),
        border: Border(top: BorderSide(color: context.c.border, width: 1)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: 24 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: context.c.border.withValues(alpha: 0.6),
                  borderRadius: AppRadii.hairAll,
                ),
              ),
            ),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _isVisible
                        ? context.c.primary.withValues(
                            alpha: context.c.isDarkSurface ? 0.20 : 0.12,
                          )
                        : context.c.cardSurface,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.radar,
                    size: 22,
                    color: _isVisible
                        ? context.c.primary
                        : context.c.textSecondary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Modo Agente Libre',
                        style: AppTypography.headline(
                          size: 16,
                          weight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        _isVisible
                            ? 'Visible para organizadores en tu zona'
                            : 'Oculto (no recibirás convocatorias)',
                        style: AppTypography.body(
                          size: 12,
                          color: context.c.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: _isVisible,
                  onChanged: (v) {
                    HapticFeedback.selectionClick();
                    setState(() => _isVisible = v);
                  },
                ),
              ],
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Text(
                  'Días y horarios',
                  style: AppTypography.code(
                    size: 12,
                    weight: FontWeight.w700,
                    color: context.c.textSecondary,
                  ),
                ),
                const Spacer(),
                Text(
                  'Atajos rápidos:',
                  style: AppTypography.body(
                    size: 12,
                    color: context.c.textSecondary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _PresetChip(
                    icon: Icons.flash_on,
                    label: 'Fines de semana',
                    enabled: _isVisible,
                    onTap: () => _applyPreset('weekend'),
                  ),
                  const SizedBox(width: 6),
                  _PresetChip(
                    icon: Icons.nightlight_outlined,
                    label: 'Todas las noches',
                    enabled: _isVisible,
                    onTap: () => _applyPreset('nights'),
                  ),
                  const SizedBox(width: 6),
                  _PresetChip(
                    icon: Icons.schedule,
                    label: 'Tardes y Noches',
                    enabled: _isVisible,
                    onTap: () => _applyPreset('afternoons_nights'),
                  ),
                  const SizedBox(width: 6),
                  _PresetChip(
                    icon: Icons.close,
                    label: 'Limpiar',
                    enabled: _isVisible,
                    onTap: () => _applyPreset('clear'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            _ScheduleMatrixPicker(
              schedule: _schedule,
              enabled: _isVisible,
              onToggleSlot: _toggleSlot,
              onToggleAllDay: _toggleAllDay,
            ),
            const SizedBox(height: 18),
            Text(
              'Zona de juego',
              style: AppTypography.code(
                size: 12,
                weight: FontWeight.w700,
                color: context.c.textSecondary,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Organizadores de partidos cercanos a esta zona podrán encontrarte.',
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _CityChip(
                  label: 'Montevideo',
                  enabled: _isVisible,
                  onTap: () => _selectQuickLocation(
                    'Montevideo, Uruguay',
                    -34.9011,
                    -56.1645,
                  ),
                ),
                const SizedBox(width: 6),
                _CityChip(
                  label: 'Canelones',
                  enabled: _isVisible,
                  onTap: () => _selectQuickLocation(
                    'Ciudad de la Costa, Canelones',
                    -34.8239,
                    -55.9556,
                  ),
                ),
                const SizedBox(width: 6),
                _CityChip(
                  label: 'Maldonado',
                  enabled: _isVisible,
                  onTap: () => _selectQuickLocation(
                    'Maldonado, Uruguay',
                    -34.9000,
                    -54.9500,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _locationController,
              enabled: _isVisible,
              style: AppTypography.body(size: 13),
              decoration: InputDecoration(
                hintText: 'Buscá tu barrio o calle...',
                hintStyle: AppTypography.body(
                  size: 13,
                  color: context.c.textSecondary,
                ),
                prefixIcon: Icon(
                  Icons.search,
                  size: 18,
                  color: context.c.textSecondary,
                ),
                filled: true,
                fillColor: context.c.cardSurface,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                border: OutlineInputBorder(
                  borderRadius: AppRadii.surfaceAll,
                  borderSide: BorderSide(color: context.c.border),
                ),
              ),
              onChanged: (v) {
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
              PateaCard(
                color: context.c.cardSurface,
                radius: AppRadii.cardAll,
                margin: const EdgeInsets.only(top: 4),
                child: Column(
                  children: _suggestions
                      .map(
                        (s) => ListTile(
                          dense: true,
                          leading: Icon(
                            Icons.location_on,
                            size: 16,
                            color: context.c.primary,
                          ),
                          title: Text(
                            s.label,
                            style: AppTypography.body(
                              color: context.c.textPrimary,
                              size: 12,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          onTap: () {
                            HapticFeedback.selectionClick();
                            setState(() {
                              _selectedLocation = s;
                              _locationController.text = s.label;
                              _suggestions = [];
                            });
                          },
                        ),
                      )
                      .toList(),
                ),
              ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: context.c.cardSurface,
                borderRadius: AppRadii.surfaceAll,
                border: Border.all(
                  color: context.c.border.withValues(alpha: 0.4),
                ),
              ),
              child: Row(
                children: [
                  Icon(Icons.my_location, size: 14, color: context.c.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Ubicación: $activeLocationLabel',
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            ElevatedButton.icon(
              onPressed: _isSaving ? null : _save,
              style: ElevatedButton.styleFrom(
                backgroundColor: _isVisible
                    ? context.c.primary
                    : (context.c.isDarkSurface
                          ? context.c.cardSurface
                          : context.c.card),
                foregroundColor: _isVisible
                    ? context.c.onPrimary
                    : context.c.destructive,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: const RoundedRectangleBorder(
                  borderRadius: AppRadii.cardAll,
                ),
                side: !_isVisible
                    ? BorderSide(
                        color: context.c.destructive.withValues(alpha: 0.5),
                      )
                    : BorderSide.none,
                elevation: 0,
              ),
              icon: _isSaving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: PateaButtonProgress(),
                    )
                  : Icon(
                      _isVisible ? Icons.check : Icons.visibility_off,
                      size: 18,
                    ),
              label: Text(
                _isSaving
                    ? 'Guardando…'
                    : _isVisible
                    ? 'Guardar disponibilidad'
                    : 'Desactivar modo público',
                style: AppTypography.action(
                  size: 15,
                  color: _isVisible
                      ? context.c.onPrimary
                      : context.c.destructive,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PresetChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool enabled;
  final VoidCallback onTap;

  const _PresetChip({
    required this.icon,
    required this.label,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: AppRadii.surfaceAll,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: context.c.isDarkSurface
              ? context.c.cardSurface
              : context.c.card,
          borderRadius: AppRadii.surfaceAll,
          border: Border.all(color: context.c.border.withValues(alpha: 0.6)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: context.c.primary),
            const SizedBox(width: 4),
            Text(
              label,
              style: AppTypography.code(
                size: 12,
                weight: FontWeight.w700,
                color: context.c.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CityChip extends StatelessWidget {
  final String label;
  final bool enabled;
  final VoidCallback onTap;

  const _CityChip({
    required this.label,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: AppRadii.surfaceAll,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 6),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: context.c.isDarkSurface
                ? context.c.cardSurface
                : context.c.card,
            borderRadius: AppRadii.surfaceAll,
            border: Border.all(color: context.c.border.withValues(alpha: 0.6)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.place_outlined, size: 12, color: context.c.primary),
              const SizedBox(width: 3),
              Text(
                label,
                style: AppTypography.code(
                  size: 12,
                  weight: FontWeight.w700,
                  color: context.c.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ScheduleMatrixPicker extends StatelessWidget {
  final Map<String, Set<String>> schedule;
  final bool enabled;
  final void Function(String dayId, String slotId) onToggleSlot;
  final void Function(String dayId) onToggleAllDay;

  const _ScheduleMatrixPicker({
    required this.schedule,
    required this.enabled,
    required this.onToggleSlot,
    required this.onToggleAllDay,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = context.c.isDarkSurface;
    final primary = context.c.primary;
    final onPrimary = context.c.onPrimary;

    return Opacity(
      opacity: enabled ? 1.0 : 0.45,
      child: IgnorePointer(
        ignoring: !enabled,
        child: Column(
          children: _days.map((day) {
            final dayId = day['id'] as String;
            final dayShort = day['short'] as String;
            final selectedSlots = schedule[dayId] ?? {};
            final isDayActive = selectedSlots.isNotEmpty;

            return Container(
              margin: const EdgeInsets.only(bottom: 7),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
              decoration: BoxDecoration(
                color: isDayActive
                    ? (isDark ? context.c.cardSurface : context.c.card)
                    : (isDark
                          ? context.c.card
                          : context.c.cardSurface.withValues(alpha: 0.6)),
                borderRadius: AppRadii.cardAll,
                border: Border.all(
                  color: isDayActive
                      ? primary.withValues(alpha: isDark ? 0.5 : 0.4)
                      : context.c.border.withValues(alpha: 0.35),
                  width: isDayActive ? 1.2 : 1.0,
                ),
                boxShadow: isDayActive && !isDark
                    ? [
                        BoxShadow(
                          color: context.c.textPrimary.withValues(alpha: 0.04),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ]
                    : null,
              ),
              child: Row(
                children: [
                  InkWell(
                    onTap: () => onToggleAllDay(dayId),
                    borderRadius: AppRadii.surfaceAll,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 4,
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isDayActive ? primary : context.c.border,
                            ),
                          ),
                          const SizedBox(width: 6),
                          SizedBox(
                            width: 32,
                            child: Text(
                              dayShort,
                              style: AppTypography.code(
                                size: 12,
                                weight: FontWeight.w800,
                                color: isDayActive
                                    ? context.c.textPrimary
                                    : context.c.textSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Row(
                      children: _times.map((slot) {
                        final slotId = slot['id'] as String;
                        final slotLabel = slot['label'] as String;
                        final slotIcon = slot['icon'] as IconData;
                        final isSelected = selectedSlots.contains(slotId);

                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 2.5,
                            ),
                            child: InkWell(
                              onTap: () => onToggleSlot(dayId, slotId),
                              borderRadius: AppRadii.surfaceAll,
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 140),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 7,
                                ),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? primary
                                      : (isDark
                                            ? context.c.background.withValues(
                                                alpha: 0.7,
                                              )
                                            : context.c.cardSurface),
                                  borderRadius: AppRadii.surfaceAll,
                                  border: Border.all(
                                    color: isSelected
                                        ? primary
                                        : context.c.border.withValues(
                                            alpha: 0.4,
                                          ),
                                  ),
                                  boxShadow: isSelected && !isDark
                                      ? [
                                          BoxShadow(
                                            color: primary.withValues(
                                              alpha: 0.25,
                                            ),
                                            blurRadius: 4,
                                            offset: const Offset(0, 1.5),
                                          ),
                                        ]
                                      : null,
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      slotIcon,
                                      size: 12,
                                      color: isSelected
                                          ? onPrimary
                                          : context.c.textSecondary,
                                    ),
                                    const SizedBox(width: 3),
                                    Text(
                                      slotLabel,
                                      style: AppTypography.code(
                                        size: 12,
                                        weight: FontWeight.w700,
                                        color: isSelected
                                            ? onPrimary
                                            : context.c.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
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
  ConsumerState<_PartidosAbiertosTab> createState() =>
      _PartidosAbiertosTabState();
}

class _PartidosAbiertosTabState extends ConsumerState<_PartidosAbiertosTab> {
  LocationSuggestion? _zone;
  double _radius = 15;
  String _date = 'Todos', _admission = 'Todos';
  @override
  Widget build(BuildContext context) {
    final matchesAsync = ref.watch(publicMatchesStreamProvider);
    final saved = ref.watch(savedLocationStreamProvider(widget.uid)).value;
    final zone = _zone ?? _savedZone(saved);
    return matchesAsync.when(
      data: (matches) {
        final now = DateTime.now();
        final today = DateTime(now.year, now.month, now.day);
        double? distance(MatchModel m) {
          final l = m.locationDetail;
          if (l == null || (l.lat == 0 && l.lng == 0)) return null;
          return discoveryDistance(zone.lat, zone.lng, l.lat, l.lng);
        }

        final filtered =
            matches.where((m) {
              if (!isPublicDiscoveryMatch(m, widget.uid, now)) return false;
              final d = distance(m);
              if (_radius != 0 && (d == null || d > _radius)) return false;
              final date = discoveryKickoff(m)!;
              if (_date == 'Hoy' &&
                  (date.year != today.year ||
                      date.month != today.month ||
                      date.day != today.day)) {
                return false;
              }
              if (_date == '7 días' &&
                  !date.isBefore(today.add(const Duration(days: 7)))) {
                return false;
              }
              if (_admission == 'Directa' && m.needsApprovalFrom(widget.uid)) {
                return false;
              }
              if (_admission == 'Con aprobación' &&
                  !m.needsApprovalFrom(widget.uid)) {
                return false;
              }
              return true;
            }).toList()..sort(
              (a, b) => discoveryKickoff(a)!.compareTo(discoveryKickoff(b)!),
            );
        return ListView(
          padding: EdgeInsets.fromLTRB(16, 16, 16, bottomInset(context)),
          children: [
            PateaCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _ZoneControl(
                    zone: zone,
                    radius: _radius,
                    onZone: (v) => setState(() => _zone = v),
                    onRadius: (v) => setState(() => _radius = v),
                  ),
                  FilterChip(
                    label: const Text('Todas las zonas'),
                    selected: _radius == 0,
                    onSelected: (_) =>
                        setState(() => _radius = _radius == 0 ? 15 : 0),
                  ),
                  const SizedBox(height: 8),
                  ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    title: const Text('Fecha e ingreso'),
                    subtitle: Text(
                      '${_date == 'Todos' ? 'Cualquier fecha' : _date} · ${_admission == 'Todos' ? 'Cualquier ingreso' : _admission}',
                    ),
                    children: [
                      Wrap(
                        spacing: 8,
                        children: [
                          for (final value in ['Todos', 'Hoy', '7 días'])
                            ChoiceChip(
                              label: Text(
                                value == 'Todos' ? 'Cualquier fecha' : value,
                              ),
                              selected: _date == value,
                              onSelected: (_) => setState(() => _date = value),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        children: [
                          for (final value in [
                            'Todos',
                            'Directa',
                            'Con aprobación',
                          ])
                            ChoiceChip(
                              label: Text(
                                value == 'Todos' ? 'Cualquier ingreso' : value,
                              ),
                              selected: _admission == value,
                              onSelected: (_) =>
                                  setState(() => _admission = value),
                            ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              '${filtered.length} partidos para jugar',
              style: AppTypography.body(size: 14, weight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            if (filtered.isEmpty) ...[
              const PateaSectionScene(
                image: PateaSectionScene.explore,
                title: 'No encontramos partidos con estos filtros',
                description:
                    'Probá otra zona o ampliá la búsqueda. También podés organizar el tuyo.',
              ),
              TextButton(
                onPressed: () => setState(() {
                  _date = 'Todos';
                  _admission = 'Todos';
                  _radius = 0;
                }),
                child: const Text('Ver todas las zonas y fechas'),
              ),
            ],
            for (final m in filtered)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _PublicMatchCard(
                  key: ValueKey(m.id),
                  match: m,
                  uid: widget.uid,
                  distance: distance(m),
                ),
              ),
          ],
        );
      },
      loading: () => const PateaLoading(),
      error: (e, _) => PateaError(
        error: e,
        message: 'No pudimos cargar los partidos.',
        onRetry: () => ref.invalidate(publicMatchesStreamProvider),
      ),
    );
  }
}

/// Admission is reviewed before writing; pending/joined cards stay visible.
class _PublicMatchCard extends ConsumerStatefulWidget {
  final MatchModel match;
  final String uid;
  final double? distance;

  const _PublicMatchCard({
    super.key,
    required this.match,
    required this.uid,
    this.distance,
  });

  @override
  ConsumerState<_PublicMatchCard> createState() => _PublicMatchCardState();
}

class _PublicMatchCardState extends ConsumerState<_PublicMatchCard> {
  bool _busy = false;
  bool _sent = false;
  bool _joined = false;

  Future<void> _join() async {
    final approval = widget.match.needsApprovalFrom(widget.uid);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          approval ? 'Solicitar un lugar' : 'Confirmar participación',
        ),
        content: Text(
          '${widget.match.title}\n${fmtDate(widget.match.date)} · ${widget.match.time ?? "Horario a definir"}\n${widget.match.location ?? "Cancha a definir"}\n\n${approval ? "El organizador debe aprobar tu solicitud. Todavía no ocupás un lugar." : "Vas a ocupar un lugar en el partido."}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Volver'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(approval ? 'Enviar solicitud' : 'Confirmar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted || _busy) return;
    setState(() => _busy = true);
    try {
      final pending = await ref
          .read(matchServiceProvider)
          .joinOrRequest(widget.match, widget.uid);
      if (!mounted) return;
      setState(() {
        _sent = pending;
        _joined = !pending;
      });
      PateaSnack.info(
        context,
        pending
            ? 'Solicitud enviada. El organizador te va a responder.'
            : 'Te anotaste a "${widget.match.title}".',
      );
    } catch (e) {
      if (!mounted) return;
      PateaSnack.error(
        context,
        'No pudimos confirmar tu lugar. Volvé a intentar.',
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final match = widget.match;
    final theme = getMatchTypeTheme(match.type);
    final hasTeams = match.teamA != null && match.teamB != null;
    final pending = _sent || match.pendingPlayerUids.contains(widget.uid);
    final joined = _joined || match.playerUids.contains(widget.uid);
    final spots = match.matchSize - match.playerUids.length;
    final needsApproval = match.needsApprovalFrom(widget.uid);

    return PateaCard(
      color: context.c.card,
      radius: AppRadii.cardAll,
      borderColor: theme.brandColor.withValues(alpha: 0.35),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: theme.brandColor,
                ),
              ),
              const SizedBox(width: 7),
              Text(
                theme.label,
                style: AppTypography.code(
                  size: 12,
                  weight: FontWeight.w700,
                  color: context.c.textSecondary,
                ),
              ),
              const Spacer(),
              if (match.matchSize > 0 && spots > 0)
                Text(
                  spots == 1 ? 'falta 1' : 'faltan $spots',
                  style: AppTypography.code(
                    size: 12,
                    weight: FontWeight.w800,
                    color: context.c.primary,
                  ),
                ),
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
                child: Text(
                  match.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.headline(
                    size: 20,
                    weight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _row(
            Icons.calendar_today_outlined,
            '${fmtDate(match.date)}  -  ${match.time ?? ''} hs',
          ),
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
          const SizedBox(height: 10),
          Text(
            joined
                ? 'Ya estás en el plantel'
                : pending
                ? 'Tu solicitud está pendiente de aprobación'
                : needsApproval
                ? 'Ingreso con aprobación del organizador'
                : 'Ingreso directo · tu lugar se confirma al unirte',
            style: AppTypography.body(size: 12, color: context.c.textSecondary),
          ),
          if (widget.distance != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'A ${widget.distance!.toStringAsFixed(1)} km de tu zona',
                style: AppTypography.body(
                  size: 12,
                  color: context.c.textSecondary,
                ),
              ),
            ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => context.push('/matches/${match.id}'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                  ),
                  child: const Text('Detalle'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: joined
                    ? OutlinedButton.icon(
                        onPressed: null,
                        icon: const Icon(Icons.check_circle_outline, size: 16),
                        label: const Text('Ya participás'),
                      )
                    : pending
                    ? OutlinedButton.icon(
                        onPressed: null,
                        icon: const Icon(Icons.hourglass_top_rounded, size: 16),
                        label: const Text('Pedido enviado'),
                      )
                    : OutlinedButton.icon(
                        onPressed: _busy ? null : _join,
                        style: OutlinedButton.styleFrom(
                          backgroundColor: context.c.cardSurface,
                          foregroundColor: context.c.primary,
                          side: BorderSide(
                            color: context.c.primary.withValues(alpha: 0.4),
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: AppRadii.cardAll,
                          ),
                        ),
                        icon: _busy
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: PateaButtonProgress(),
                              )
                            : Icon(
                                needsApproval
                                    ? Icons.how_to_reg_rounded
                                    : Icons.person_add_alt_1,
                                size: 16,
                              ),
                        label: Text(
                          needsApproval ? 'Solicitar' : 'Unirme',
                          style: AppTypography.action(
                            size: 14,
                            color: context.c.primary,
                          ),
                        ),
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
        Icon(icon, size: 12, color: context.c.textSecondary),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            style: AppTypography.body(size: 13, color: context.c.textSecondary),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
