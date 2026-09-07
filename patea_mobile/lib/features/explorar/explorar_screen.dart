import 'dart:async';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/player_position_badge.dart';
import '../../core/constants/sections.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_states.dart';

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
import '../../core/widgets/patea_page_header.dart';
import '../../core/widgets/patea_tabs.dart';
import '../../core/widgets/player_card_widget.dart';




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
  {'id': 'mañana', 'label': 'Mañana', 'sub': '8-13h', 'icon': Icons.wb_sunny_outlined},
  {'id': 'tarde', 'label': 'Tarde', 'sub': '13-19h', 'icon': Icons.wb_twilight_outlined},
  {'id': 'noche', 'label': 'Noche', 'sub': '19-00h', 'icon': Icons.nightlight_outlined},
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
            child: PateaPageHeader(
              title: spec(Section.explorar).title,
              description: spec(Section.explorar).description,
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
        PateaSnack.error(context, '$e');
      }
    } finally {
      if (mounted) setState(() => _loadingPlayers = false);
    }
  }

  Future<void> _showAvailabilitySheet(bool isCurrentlyVisible) async {
    await showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
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
              PateaCard(
                color: context.c.card,
                radius: AppRadii.cardAll,
                padding: const EdgeInsets.all(28),
                child: Column(
                  children: [
                    Icon(Icons.groups_outlined, size: 44, color: context.c.textSecondary),
                    const SizedBox(height: 10),
                    Text('Plantel Completo', style: AppTypography.headline(size: 15)),
                    const SizedBox(height: 6),
                    Text(
                      'El mercado se abre cuando organizás un partido al que le falten jugadores.',
                      textAlign: TextAlign.center,
                      style: AppTypography.body(size: 12, color: context.c.textSecondary),
                    ),
                  ],
                ),
              )
            else ...[
              Container(
                decoration: BoxDecoration(
                  color: context.c.isDarkSurface
                      ? context.c.cardSurface.withValues(alpha: 0.5)
                      : context.c.card,
                  borderRadius: AppRadii.cardAll,
                  border: Border.all(
                    color: context.c.isDarkSurface
                        ? context.c.primary.withValues(alpha: 0.3)
                        : context.c.border,
                    width: 1.2,
                  ),
                  boxShadow: context.c.isDarkSurface
                      ? null
                      : [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                ),
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'BUSCANDO REFUERZOS PARA',
                      style: AppTypography.code(
                        size: 10,
                        weight: FontWeight.w800,
                        color: context.c.primary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedMatchId,
                        isExpanded: true,
                        dropdownColor: context.c.cardSurface,
                        style: AppTypography.headline(size: 15, weight: FontWeight.w800, color: context.c.textPrimary),
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
                        Icon(Icons.calendar_today_outlined, size: 13, color: context.c.textSecondary),
                        const SizedBox(width: 6),
                        Text('${fmtDate(match.date)} · ${match.time ?? ''} hs', style: AppTypography.body(size: 11, color: context.c.textSecondary)),
                      ]),
                      if (match.location != null) ...[
                        const SizedBox(height: 4),
                        Row(children: [
                          Icon(Icons.location_on_outlined, size: 13, color: context.c.textSecondary),
                          const SizedBox(width: 6),
                          Expanded(child: Text(match.location!, style: AppTypography.body(size: 11, color: context.c.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis)),
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
                      padding: const EdgeInsets.only(right: 8),
                      child: InkWell(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() => _positionFilter = value);
                        },
                        borderRadius: AppRadii.surfaceAll,
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 160),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                          decoration: BoxDecoration(
                            color: selected
                                ? context.c.primary
                                : (context.c.isDarkSurface ? context.c.cardSurface : context.c.card),
                            borderRadius: AppRadii.surfaceAll,
                            border: Border.all(
                              color: selected ? context.c.primary : context.c.border,
                              width: 1,
                            ),
                            boxShadow: selected && !context.c.isDarkSurface
                                ? [
                                    BoxShadow(
                                      color: context.c.primary.withValues(alpha: 0.25),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ]
                                : null,
                          ),
                          child: Text(
                            pos,
                            style: AppTypography.code(
                              size: 11,
                              weight: FontWeight.w800,
                              color: selected
                                  ? context.c.onPrimary
                                  : context.c.textSecondary,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Text(
                    'JUGADORES DISPONIBLES',
                    style: AppTypography.code(size: 11, weight: FontWeight.w800, color: context.c.textSecondary),
                  ),
                  if (filteredPlayers.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: context.c.primary.withValues(alpha: context.c.isDarkSurface ? 0.20 : 0.10),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${filteredPlayers.length}',
                        style: AppTypography.code(
                          color: context.c.primary,
                          size: 11,
                          weight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
              if (_loadingPlayers)
                const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
              else if (filteredPlayers.isEmpty)
                PateaCard(
                  color: context.c.card.withValues(alpha: 0.4),
                  radius: AppRadii.cardAll,
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Icon(Icons.search_off, size: 36, color: context.c.textSecondary),
                      const SizedBox(height: 8),
                      Text('Nadie disponible en la zona', style: AppTypography.body(color: context.c.textSecondary, size: 13, weight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text('No encontramos jugadores libres para esa fecha, horario y ubicación.', textAlign: TextAlign.center, style: AppTypography.body(size: 11, color: context.c.textSecondary)),
                    ],
                  ),
                )
              else
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  padding: EdgeInsets.zero,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 14,
                    crossAxisSpacing: 10,
                    childAspectRatio: 0.58,
                  ),
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
      error: (e, _) => PateaError(error: e),
    );
  }
}

class _FreeAgentBanner extends StatelessWidget {
  final bool isFreeAgent;
  final VoidCallback onTap;

  const _FreeAgentBanner({required this.isFreeAgent, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isDark = context.c.isDarkSurface;
    final primary = context.c.primary;
    final onPrimary = context.c.onPrimary;

    final bgColor = isDark
        ? (isFreeAgent ? primary.withValues(alpha: 0.12) : context.c.card)
        : (isFreeAgent ? primary.withValues(alpha: 0.07) : context.c.card);

    final borderColor = isDark
        ? (isFreeAgent ? primary.withValues(alpha: 0.40) : context.c.border)
        : (isFreeAgent ? primary.withValues(alpha: 0.30) : context.c.border);

    return Container(
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: AppRadii.cardAll,
        border: Border.all(color: borderColor, width: 1.2),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isFreeAgent ? primary : context.c.cardSurface,
            ),
            child: Icon(
              Icons.campaign_rounded,
              size: 20,
              color: isFreeAgent ? onPrimary : context.c.textSecondary,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isFreeAgent ? 'Estás activo en el Mercado' : '¿Te falta partido?',
                  style: AppTypography.headline(size: 14, weight: FontWeight.w800, color: context.c.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  isFreeAgent
                      ? 'Los organizadores pueden invitarte a sus partidos.'
                      : 'Ofrecete como agente libre para recibir convocatorias.',
                  style: AppTypography.body(size: 11, color: context.c.textSecondary),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          ElevatedButton(
            onPressed: onTap,
            style: ElevatedButton.styleFrom(
              backgroundColor: isFreeAgent
                  ? (isDark ? primary : context.c.cardSurface)
                  : primary,
              foregroundColor: isFreeAgent
                  ? (isDark ? onPrimary : context.c.textPrimary)
                  : onPrimary,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceAll),
              side: isFreeAgent && !isDark
                  ? BorderSide(color: context.c.border)
                  : BorderSide.none,
            ),
            child: Text(
              isFreeAgent ? 'Ajustar' : 'Ofrecerme',
              style: AppTypography.body(size: 12, weight: FontWeight.w800),
            ),
          ),
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
    final isDark = context.c.isDarkSurface;
    final (chipLabel, chipColor, chipIcon) = player.matchScore == 2
        ? ('Coincide horario', context.c.success, Icons.check_circle_rounded)
        : player.matchScore == 1
            ? ('Horario parcial', context.c.warning, Icons.access_time_filled_rounded)
            : ('No coincide', context.c.destructive, Icons.cancel_rounded);

    final p = player.toPlayer();

    void openDetail() {
      showModalBottomSheet<void>(
        context: context,
        useRootNavigator: true,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (context) => _FreeAgentDetailSheet(player: player, matchId: matchId),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. Carta oficial de Pateá (idéntica a la sección Jugadores)
        Expanded(
          child: PlayerCardWidget(
            player: p,
            photoStyle: CardPhotoStyle.halfTop,
            onTap: openDetail,
          ),
        ),
        const SizedBox(height: 6),

        // 2. Chip de coincidencia de horario y distancia del mercado
        InkWell(
          onTap: openDetail,
          borderRadius: BorderRadius.circular(10),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
            decoration: BoxDecoration(
              color: isDark ? context.c.cardSurface : context.c.card,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: chipColor.withValues(alpha: isDark ? 0.45 : 0.35),
                width: 1,
              ),
              boxShadow: isDark
                  ? null
                  : [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(chipIcon, size: 11, color: chipColor),
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    player.distanceKm != null
                        ? '${player.distanceKm!.toStringAsFixed(1)} km · $chipLabel'
                        : chipLabel,
                    style: AppTypography.code(
                      size: 9.5,
                      weight: FontWeight.w800,
                      color: chipColor,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
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
        PateaSnack.ok(context, '¡Invitación enviada a ${widget.player.displayName}!');
      }
    } catch (e) {
      if (mounted) PateaSnack.error(context, '$e');
    } finally {
      if (mounted) setState(() => _isInviting = false);
    }
  }

  Color _tierColor(BuildContext context, int ovr) {
    if (ovr >= 85) return context.c.eliteBorder;
    if (ovr >= 75) return context.c.goldBorder;
    if (ovr >= 60) return context.c.silverBorder;
    return context.c.bronzeBorder;
  }

  @override
  Widget build(BuildContext context) {
    final player = widget.player;
    final isDark = context.c.isDarkSurface;
    final tierCol = _tierColor(context, player.ovr);

    return SafeArea(
      top: false,
      bottom: true,
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? context.c.cardSurface : context.c.card,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadii.surface)),
          border: Border(
            top: BorderSide(
              color: isDark ? context.c.primary.withValues(alpha: 0.35) : context.c.border,
              width: 1.2,
            ),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.4 : 0.08),
              blurRadius: 16,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        padding: EdgeInsets.fromLTRB(
          20,
          16,
          20,
          20 + bottomInset(context) + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: context.c.textSecondary.withValues(alpha: 0.35),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: tierCol, width: 2),
                ),
                child: PateaAvatar(
                  photoUrl: player.photoUrl,
                  seed: player.displayName,
                  size: 56,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(player.displayName, style: AppTypography.headline(size: 17, weight: FontWeight.w900)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        PlayerPositionBadge(position: player.position, fontSize: 11, dense: true),
                        const SizedBox(width: 8),
                        Text(
                          'OVR ${player.ovr}',
                          style: AppTypography.code(size: 12, weight: FontWeight.w800, color: tierCol),
                        ),
                        if (player.distanceKm != null) ...[
                          const SizedBox(width: 8),
                          Text('·', style: TextStyle(color: context.c.textSecondary)),
                          const SizedBox(width: 8),
                          Icon(Icons.location_on_outlined, size: 12, color: context.c.textSecondary),
                          Text(
                            '${player.distanceKm!.toStringAsFixed(1)} km',
                            style: AppTypography.body(size: 11, color: context.c.textSecondary),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (player.availability.isNotEmpty) ...[
            const SizedBox(height: 18),
            Text(
              'DISPONIBILIDAD HORARIA',
              style: AppTypography.code(size: 10, weight: FontWeight.w800, color: context.c.textSecondary),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: player.availability.entries.map((e) {
                return PateaCard(
                  color: context.c.cardSurface,
                  radius: AppRadii.surfaceAll,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${e.key[0].toUpperCase()}${e.key.substring(1)}: ',
                        style: AppTypography.code(size: 11, weight: FontWeight.w700, color: context.c.textPrimary),
                      ),
                      Text(
                        e.value.join(', '),
                        style: AppTypography.body(size: 11, color: context.c.primary),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ],
          const SizedBox(height: 20),
          if (player.isCurrentUser)
            PateaCard(
              borderColor: context.c.border,
              radius: AppRadii.cardAll,
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Text(
                'Tu perfil de Pase Libre en el mercado',
                textAlign: TextAlign.center,
                style: AppTypography.body(size: 12, color: context.c.textSecondary),
              ),
            )
          else
            ElevatedButton.icon(
              onPressed: _isInviting ? null : _invite,
              style: ElevatedButton.styleFrom(
                backgroundColor: context.c.primary,
                foregroundColor: context.c.onPrimary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
              ),
              icon: _isInviting
                  ? SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: context.c.onPrimary),
                    )
                  : const Icon(Icons.person_add_alt_1, size: 18),
              label: Text(
                'Invitar a mi partido',
                style: AppTypography.headline(size: 14, weight: FontWeight.w800, color: context.c.onPrimary),
              ),
            ),
        ],
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

  void _initScheduleAndLocation(Map<String, dynamic>? availData, Map<String, dynamic>? locData) {
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
      final label = _selectedLocation?.label ?? _currentLocationLabel ?? 'Montevideo';

      if (_selectedLocation != null) {
        await ref.read(exploreServiceProvider).saveUserLocation(
              lat: lat,
              lng: lng,
              label: label,
            );
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

      await ref.read(exploreServiceProvider).enableAvailability(
            availability: availabilityMap,
            lat: lat,
            lng: lng,
            label: label,
          );

      if (mounted) {
        Navigator.pop(context);
        PateaSnack.ok(context, '¡Disponibilidad guardada! Ya estás activo en el mercado.');
      }
    } catch (e) {
      if (mounted) PateaSnack.error(context, 'Error al guardar: $e');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final availabilityAsync = ref.watch(myAvailabilityStreamProvider(widget.uid));
    final locationAsync = ref.watch(savedLocationStreamProvider(widget.uid));

    _initScheduleAndLocation(availabilityAsync.value, locationAsync.value);

    final activeLocationLabel = _selectedLocation?.label ?? _currentLocationLabel ?? 'Montevideo';

    return Container(
      decoration: BoxDecoration(
        color: context.c.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadii.surface)),
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
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _isVisible
                        ? context.c.primary.withValues(alpha: context.c.isDarkSurface ? 0.20 : 0.12)
                        : context.c.cardSurface,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.radar,
                    size: 22,
                    color: _isVisible ? context.c.primary : context.c.textSecondary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Modo Agente Libre', style: AppTypography.headline(size: 16, weight: FontWeight.w900)),
                      Text(
                        _isVisible
                            ? 'Visible para organizadores en tu zona'
                            : 'Oculto (no recibirás convocatorias)',
                        style: AppTypography.body(size: 11, color: context.c.textSecondary),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: _isVisible,
                  activeThumbColor: context.c.primary,
                  activeTrackColor: context.c.primary.withValues(alpha: 0.35),
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
                  'DÍAS Y HORARIOS',
                  style: AppTypography.code(size: 10, weight: FontWeight.w800, color: context.c.textSecondary),
                ),
                const Spacer(),
                Text(
                  'Atajos rápidos:',
                  style: AppTypography.body(size: 10, color: context.c.textSecondary),
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
              'ZONA DE JUEGO',
              style: AppTypography.code(size: 10, weight: FontWeight.w800, color: context.c.textSecondary),
            ),
            const SizedBox(height: 6),
            Text(
              'Organizadores de partidos cercanos a esta zona podrán encontrarte.',
              style: AppTypography.body(size: 11, color: context.c.textSecondary),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _CityChip(
                  label: 'Montevideo',
                  enabled: _isVisible,
                  onTap: () => _selectQuickLocation('Montevideo, Uruguay', -34.9011, -56.1645),
                ),
                const SizedBox(width: 6),
                _CityChip(
                  label: 'Canelones',
                  enabled: _isVisible,
                  onTap: () => _selectQuickLocation('Ciudad de la Costa, Canelones', -34.8239, -55.9556),
                ),
                const SizedBox(width: 6),
                _CityChip(
                  label: 'Maldonado',
                  enabled: _isVisible,
                  onTap: () => _selectQuickLocation('Maldonado, Uruguay', -34.9000, -54.9500),
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
                hintStyle: AppTypography.body(size: 13, color: context.c.textSecondary),
                prefixIcon: Icon(Icons.search, size: 18, color: context.c.textSecondary),
                filled: true,
                fillColor: context.c.cardSurface,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
                      .map((s) => ListTile(
                            dense: true,
                            leading: Icon(Icons.location_on, size: 16, color: context.c.primary),
                            title: Text(
                              s.label,
                              style: AppTypography.body(color: context.c.textPrimary, size: 12),
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
                          ))
                      .toList(),
                ),
              ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: context.c.cardSurface,
                borderRadius: AppRadii.surfaceAll,
                border: Border.all(color: context.c.border.withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  Icon(Icons.my_location, size: 14, color: context.c.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Ubicación: $activeLocationLabel',
                      style: AppTypography.body(size: 11, color: context.c.textSecondary),
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
                backgroundColor: _isVisible ? context.c.primary : (context.c.isDarkSurface ? context.c.cardSurface : context.c.card),
                foregroundColor: _isVisible ? context.c.onPrimary : context.c.destructive,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                side: !_isVisible ? BorderSide(color: context.c.destructive.withValues(alpha: 0.5)) : BorderSide.none,
                elevation: _isVisible ? 2 : 0,
              ),
              icon: _isSaving
                  ? SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: _isVisible ? context.c.onPrimary : context.c.destructive,
                      ),
                    )
                  : Icon(_isVisible ? Icons.check : Icons.visibility_off, size: 18),
              label: Text(
                _isSaving
                    ? 'GUARDANDO...'
                    : _isVisible
                        ? 'GUARDAR DISPONIBILIDAD'
                        : 'DESACTIVAR MODO PÚBLICO',
                style: AppTypography.headline(
                  size: 13,
                  weight: FontWeight.w900,
                  color: _isVisible ? context.c.onPrimary : context.c.destructive,
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
          color: context.c.isDarkSurface ? context.c.cardSurface : context.c.card,
          borderRadius: AppRadii.surfaceAll,
          border: Border.all(color: context.c.border.withValues(alpha: 0.6)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: context.c.primary),
            const SizedBox(width: 4),
            Text(label, style: AppTypography.code(size: 10, weight: FontWeight.w700, color: context.c.textPrimary)),
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
            color: context.c.isDarkSurface ? context.c.cardSurface : context.c.card,
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
                style: AppTypography.code(size: 10, weight: FontWeight.w700, color: context.c.textPrimary),
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
                    : (isDark ? context.c.card.withValues(alpha: 0.4) : context.c.cardSurface.withValues(alpha: 0.6)),
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
                          color: Colors.black.withValues(alpha: 0.03),
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
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
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
                                color: isDayActive ? context.c.textPrimary : context.c.textSecondary,
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
                            padding: const EdgeInsets.symmetric(horizontal: 2.5),
                            child: InkWell(
                              onTap: () => onToggleSlot(dayId, slotId),
                              borderRadius: AppRadii.surfaceAll,
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 140),
                                padding: const EdgeInsets.symmetric(vertical: 7),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? primary
                                      : (isDark ? context.c.background.withValues(alpha: 0.7) : context.c.cardSurface),
                                  borderRadius: AppRadii.surfaceAll,
                                  border: Border.all(
                                    color: isSelected
                                        ? primary
                                        : context.c.border.withValues(alpha: 0.4),
                                  ),
                                  boxShadow: isSelected && !isDark
                                      ? [
                                          BoxShadow(
                                            color: primary.withValues(alpha: 0.25),
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
                                      color: isSelected ? onPrimary : context.c.textSecondary,
                                    ),
                                    const SizedBox(width: 3),
                                    Text(
                                      slotLabel,
                                      style: AppTypography.code(
                                        size: 10,
                                        weight: FontWeight.w800,
                                        color: isSelected ? onPrimary : context.c.textSecondary,
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
                  selectedColor: context.c.primary.withValues(alpha: 0.2),
                );
              }).toList(),
            ),
            const SizedBox(height: 14),
            if (filtered.isEmpty)
              PateaCard(
                color: context.c.card,
                radius: AppRadii.cardAll,
                padding: const EdgeInsets.all(28),
                child: Column(
                  children: [
                    Icon(Icons.calendar_month_outlined, size: 40, color: context.c.textSecondary),
                    const SizedBox(height: 10),
                    Text('No hay partidos disponibles', style: AppTypography.headline(size: 15)),
                    const SizedBox(height: 4),
                    Text('Probá quitando filtros, o creá un partido público para que otros se unan.', textAlign: TextAlign.center, style: AppTypography.body(size: 12, color: context.c.textSecondary)),
                  ],
                ),
              )
            else
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${filtered.length} partido${filtered.length != 1 ? 's' : ''} disponible${filtered.length != 1 ? 's' : ''}', style: AppTypography.body(size: 12, color: context.c.textSecondary)),
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
      error: (e, _) => PateaError(error: e),
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
      PateaSnack.info(context, pending
            ? 'Solicitud enviada. El organizador te va a responder.'
            : 'Te anotaste a "${widget.match.title}".');
    } catch (e) {
      if (!mounted) return;
      PateaSnack.error(context, '$e');
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
                decoration: BoxDecoration(shape: BoxShape.circle, color: theme.brandColor),
              ),
              const SizedBox(width: 7),
              Text(theme.label.toUpperCase(),
                  style: AppTypography.code(
                      size: 9, weight: FontWeight.w700, color: context.c.textSecondary)),
              const Spacer(),
              if (match.matchSize > 0 && spots > 0)
                Text(spots == 1 ? 'falta 1' : 'faltan $spots',
                    style: AppTypography.code(
                        size: 10, weight: FontWeight.w800, color: context.c.primary)),
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
              '${fmtDate(match.date)}  -  ${match.time ?? ''} hs'),
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
                          backgroundColor: context.c.primary,
                          foregroundColor: context.c.background,
                        ),
                        icon: _busy
                            ? SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: context.c.background))
                            : Icon(
                                needsApproval
                                    ? Icons.how_to_reg_rounded
                                    : Icons.person_add_alt_1,
                                size: 16),
                        label: Text(needsApproval ? 'Solicitar' : 'Unirme',
                            style: AppTypography.headline(
                                size: 13,
                                weight: FontWeight.w800,
                                color: context.c.background)),
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
          child: Text(text,
              style: AppTypography.body(size: 11, color: context.c.textSecondary),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }
}
