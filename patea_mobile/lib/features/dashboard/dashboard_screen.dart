import 'widgets/dashboard_match_hero.dart';
import 'widgets/latest_match_review.dart';

import 'package:flutter/material.dart';
import '../../core/constants/sections.dart';
import '../../core/widgets/patea_page_header.dart';
import '../../core/widgets/patea_snack.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/widgets/patea_states.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/patea_tabs.dart';
import '../../core/utils/dates.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/models/match_model.dart';
import '../../core/models/player_model.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/patea_help_dialog.dart';

DateTime? _matchDateTime(MatchModel m) {
  final d = DateTime.tryParse(m.date);
  if (d == null) return null;
  final local = d.toLocal();
  final clean = (m.time ?? '')
      .replaceAll(' hs', '')
      .replaceAll('hs', '')
      .trim();
  final parts = clean.split(':');
  final hh = parts.isNotEmpty ? int.tryParse(parts[0]) ?? 0 : 0;
  final mm = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
  return DateTime(local.year, local.month, local.day, hh, mm);
}

/// Rediseño "El Túnel de Vestuarios" (Versión 3):
/// Cero contenedores y cajas anidadas. Los datos viven directamente en el lienzo
/// de juego, con escala tipográfica monumental itálica, camisetas vectoriales
/// oficiales con rotación angular enfrentada, cuenta regresiva viva en Volt Neón,
/// y líneas de cal sutiles como separadores.
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _loadSavedTab();
    _maybeShowWelcome();
  }

  /// Abre el tutorial la primera vez, como hace la web.
  ///
  /// Allá el registro redirige a `/dashboard?new_user=true` y `WelcomeDialog`
  /// fuerza el `HelpDialog`. Acá el diálogo ya estaba portado pero sólo se
  /// abría desde el "?" del header, así que el usuario nuevo entraba a una
  /// app vacía sin que nadie le dijera por dónde empezar.
  Future<void> _maybeShowWelcome() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool('welcomeShown') == true) return;
    await prefs.setBool('welcomeShown', true);
    if (!mounted) return;
    // Después del primer frame: si no, el diálogo compite con el armado de
    // la pantalla y aparece a medias.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      showDialog<void>(
        context: context,
        builder: (_) => const PateaHelpDialog(),
      );
    });
  }

  Future<void> _loadSavedTab() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('dashboardActiveTab');
    if (saved == 'grupo' && mounted) setState(() => _tab = 1);
  }

  Future<void> _saveTab(int index) async {
    setState(() => _tab = index);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      'dashboardActiveTab',
      index == 1 ? 'grupo' : 'resumen',
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = ref.watch(authServiceProvider).currentUser;
    final uid = currentUser?.uid;
    final playerAsync = uid != null
        ? ref.watch(singlePlayerStreamProvider(uid))
        : null;
    final player = playerAsync?.value;
    final hasGroup = ref.watch(activeGroupIdProvider).value != null;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: CustomScrollView(
        slivers: [
          SliverPadding(
            padding: EdgeInsets.fromLTRB(
              20,
              MediaQuery.paddingOf(context).top + 12,
              20,
              0,
            ),
            sliver: SliverToBoxAdapter(
              child: PateaPageHeader(
                iconAsset: 'assets/icons/mate.svg',
                title: player == null
                    ? 'Tu fútbol, acá.'
                    : 'Dale, ${player.name.split(' ').first}.',
                description: spec(Section.panel).description,
                showCountRow: false,
                actionButton: hasGroup
                    ? PateaHeaderActionButton(
                        label: spec(Section.panel).action!,
                        icon: Icons.add_rounded,
                        onPressed: () => context.push('/matches/create'),
                      )
                    : null,
              ),
            ),
          ),

          // Tab Bar con barra deslizante Volt
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            sliver: SliverToBoxAdapter(
              child: PateaTabs(
                tabs: const [PateaTab('Mi fútbol'), PateaTab('El grupo')],
                active: _tab,
                onChanged: _saveTab,
              ),
            ),
          ),

          // Contenido dinámico según Tab
          SliverPadding(
            padding: EdgeInsets.fromLTRB(
              20,
              14,
              20,
              28 + MediaQuery.of(context).padding.bottom,
            ),
            sliver: SliverToBoxAdapter(
              child: uid == null
                  ? const SizedBox.shrink()
                  : (_tab == 0
                        ? _ResumenTab(uid: uid, player: player)
                        : _GrupoTab(uid: uid)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PESTAÑA 1: MI RESUMEN (EL TÚNEL DE VESTUARIOS)
// ─────────────────────────────────────────────────────────────────────────
class _ResumenTab extends ConsumerWidget {
  final String uid;
  final PlayerModel? player;

  const _ResumenTab({required this.uid, required this.player});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupIdAsync = ref.watch(activeGroupIdStreamProvider(uid));

    return groupIdAsync.when(
      data: (groupId) {
        // Sin grupo no hay nada que resumir. Esta es la pantalla que ve el
        // usuario recién registrado, así que en vez de dejarla vacía dice
        // qué hacer. El tab "Mi Grupo" ya tenía su estado vacío; éste no,
        // y es el que se abre por defecto.
        if (groupId == null) return const _WelcomeEmptyState();
        return _ResumenTabBody(uid: uid, groupId: groupId, player: player);
      },
      loading: () => const PateaLoading(height: 120),
      error: (e, _) => PateaError(
        error: e,
        message: 'No pudimos cargar tu grupo.',
        onRetry: () => ref.invalidate(activeGroupIdStreamProvider(uid)),
      ),
    );
  }
}

class _ResumenTabBody extends ConsumerWidget {
  final String uid;
  final String? groupId;
  final PlayerModel? player;

  const _ResumenTabBody({
    required this.uid,
    required this.groupId,
    required this.player,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matchesAsync = ref.watch(matchesStreamProvider(groupId));
    final ovrHistoryAsync = ref.watch(ovrHistoryStreamProvider(uid));

    return matchesAsync.when(
      loading: () => const PateaLoading(height: 140),
      error: (e, _) => PateaError(
        error: e,
        message: 'No se pudo cargar tu panel.',
        compact: true,
        onRetry: () => ref.invalidate(matchesStreamProvider(groupId)),
      ),
      data: (allMatches) {
        final now = DateTime.now();

        // La pestaña se llama "Mi Resumen": son los partidos que jugás vos, no
        // todos los del grupo. Antes te mostraba el próximo partido del cuadro
        // aunque no estuvieras anotada. Los partidos viejos no siempre tienen
        // `playerUids`, así que también se mira el roster de los equipos.
        bool imIn(MatchModel m) {
          if (m.playerUids.contains(uid)) return true;
          for (final t in [m.teamA, m.teamB]) {
            if (t == null) continue;
            if (t.playerIds.contains(uid)) return true;
            if (t.players.any((p) => p.uid == uid)) return true;
          }
          return false;
        }

        final matches = allMatches.where(imIn).toList();

        final live = matches.where((m) => m.status == 'active').toList();
        final upcoming =
            matches.where((m) {
              if (m.status != 'upcoming') return false;
              final dt = _matchDateTime(m);
              return dt != null && !dt.isBefore(now);
            }).toList()..sort(
              (a, b) => (_matchDateTime(a) ?? DateTime(9999)).compareTo(
                _matchDateTime(b) ?? DateTime(9999),
              ),
            );

        final next = live.isNotEmpty
            ? live.first
            : (upcoming.isNotEmpty ? upcoming.first : null);

        final played =
            matches
                .where(
                  (m) =>
                      (m.status == 'completed' || m.status == 'evaluated') &&
                      m.teamA != null &&
                      m.teamB != null,
                )
                .toList()
              ..sort(
                (a, b) => (DateTime.tryParse(b.date) ?? DateTime(0)).compareTo(
                  DateTime.tryParse(a.date) ?? DateTime(0),
                ),
              );
        final lastPlayed = played.isNotEmpty ? played.first : null;

        final history = ovrHistoryAsync.value ?? const <OvrHistoryEntry>[];
        final trend = history.isEmpty
            ? 0
            : history.last.newOVR - history.first.oldOVR;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── 1. EL TÚNEL DE PRÓXIMO PARTIDO (CON CAMISETAS ROTADAS) ──
            if (next != null)
              DashboardMatchHero(match: next, isLive: live.isNotEmpty)
            else
              PateaEmpty(
                icon: Icons.sports_soccer_outlined,
                title: 'La cancha está esperando.',
                hint: 'Armá la próxima juntada con tu grupo.',
                compact: true,
                action: OutlinedButton(
                  onPressed: () => context.push('/matches/create'),
                  child: const Text('Armar un partido'),
                ),
              ),

            const SizedBox(height: 16),
            Divider(height: 1, thickness: 1.5, color: context.c.overlayLine),
            const SizedBox(height: 16),

            // ── 2. TUS NÚMEROS (OVR MONUMENTAL + EFECTIVIDAD) ───────────
            if (player != null)
              _PlayerPerformanceMural(player: player!, trend: trend)
            else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Text(
                  'Cargando ficha del jugador...',
                  style: AppTypography.body(
                    size: 12,
                    color: context.c.textSecondary,
                  ),
                ),
              ),

            const SizedBox(height: 16),
            Divider(height: 1, thickness: 1.5, color: context.c.overlayLine),
            const SizedBox(height: 16),

            // ── 3. ÚLTIMO PARTIDO JUGADO EN LÍNEA ABIERTA ────────────────
            if (lastPlayed != null)
              LatestMatchReview(match: lastPlayed)
            else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  'Todavía no disputaste ningún partido evaluado.',
                  style: AppTypography.body(
                    size: 12,
                    color: context.c.textSecondary,
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Rendimiento del Jugador: OVR Monumental y Totales
class _PlayerPerformanceMural extends StatelessWidget {
  final PlayerModel player;
  final int trend;

  const _PlayerPerformanceMural({required this.player, required this.trend});

  @override
  Widget build(BuildContext context) {
    final up = trend > 0;
    final matches = player.stats.matchesPlayed;
    final goals = player.stats.goals;
    final avg = matches > 0 ? (goals / matches).toStringAsFixed(1) : '0.0';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        // Columna Izquierda: OVR Gigante en Canvas
        Expanded(
          flex: 5,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Tu OVR actual',
                style: AppTypography.body(
                  size: 12,
                  weight: FontWeight.w600,
                  color: context.c.textSecondary,
                ),
              ),
              const SizedBox(height: 2),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    '${player.ovr}',
                    style: AppTypography.sportNumber(
                      size: 68,
                      color: context.c.textPrimary,
                    ).copyWith(fontStyle: FontStyle.italic, letterSpacing: -2),
                  ),
                  if (trend != 0) ...[
                    const SizedBox(width: 4),
                    Text(
                      '${up ? '+' : ''}$trend',
                      style: AppTypography.sportNumber(
                        size: 18,
                        color: up ? context.c.primary : context.c.destructive,
                      ),
                    ),
                  ],
                ],
              ),
              Text(
                'Nivel ${player.tier}',
                style: AppTypography.body(
                  size: 12,
                  weight: FontWeight.w600,
                  color: context.c.ovrTextColor(player.ovr),
                ),
              ),
            ],
          ),
        ),

        // Columna Derecha: Totales Deportivos
        Expanded(
          flex: 6,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                goals == 1 ? '1 gol' : '$goals goles',
                style: AppTypography.sportNumber(
                  size: 30,
                  color: context.c.primary,
                ).copyWith(fontStyle: FontStyle.italic),
              ),
              const SizedBox(height: 2),
              Text(
                matches == 1
                    ? '1 partido jugado'
                    : '$matches partidos jugados',
                style: AppTypography.body(
                  size: 13,
                  weight: FontWeight.w700,
                  color: context.c.textSecondary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Promedio: $avg G/PJ',
                style: AppTypography.body(
                  size: 12,
                  weight: FontWeight.w600,
                  color: context.c.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PESTAÑA 2: MI GRUPO (EL CUADRO EN EL TÚNEL)
// ─────────────────────────────────────────────────────────────────────────
class _GrupoTab extends ConsumerWidget {
  final String uid;

  const _GrupoTab({required this.uid});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupIdAsync = ref.watch(activeGroupIdStreamProvider(uid));

    return groupIdAsync.when(
      data: (groupId) {
        if (groupId == null) {
          return PateaEmpty(
            icon: Icons.groups_outlined,
            title: 'Sin grupo activo',
            hint: 'Unite o creá tu grupo para ver las estadísticas del cuadro.',
            compact: true,
            action: OutlinedButton(
              onPressed: () => context.push('/groups'),
              child: const Text('Ir a Mis Grupos'),
            ),
          );
        }
        return _GrupoTabBody(groupId: groupId);
      },
      loading: () => const PateaLoading(height: 120),
      error: (e, _) => PateaError(
        error: e,
        message: 'No pudimos cargar tu grupo.',
        onRetry: () => ref.invalidate(activeGroupIdStreamProvider(uid)),
      ),
    );
  }
}

class _GrupoTabBody extends ConsumerWidget {
  final String groupId;

  const _GrupoTabBody({required this.groupId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupAsync = ref.watch(singleGroupStreamProvider(groupId));
    final playersAsync = ref.watch(playersStreamProvider(groupId));
    final matchesAsync = ref.watch(matchesStreamProvider(groupId));

    return groupAsync.when(
      loading: () => const PateaLoading(height: 140),
      error: (e, _) => PateaError(
        error: e,
        message: 'No se pudo cargar el grupo.',
        compact: true,
        onRetry: () => ref.invalidate(singleGroupStreamProvider(groupId)),
      ),
      data: (group) {
        if (group == null) {
          return PateaEmpty(
            icon: Icons.group_off_outlined,
            title: 'Grupo no encontrado',
            hint: 'El grupo no existe o fue eliminado.',
            compact: true,
            action: OutlinedButton(
              onPressed: () => context.push('/groups'),
              child: const Text('Explorar Grupos'),
            ),
          );
        }

        final players = playersAsync.value ?? const [];
        final matches = matchesAsync.value ?? const [];
        final played = matches
            .where((m) => m.status == 'completed' || m.status == 'evaluated')
            .toList();

        final byGoals = [...players]
          ..sort((a, b) => b.stats.goals.compareTo(a.stats.goals));
        final byOvr = [...players]..sort((a, b) => b.ovr.compareTo(a.ovr));
        final topScorer = byGoals.isNotEmpty && byGoals.first.stats.goals > 0
            ? byGoals.first
            : null;
        final topOvr = byOvr.isNotEmpty ? byOvr.first : null;

        final now = DateTime.now();
        final agenda =
            matches.where((m) {
              if (m.status != 'upcoming') return false;
              final dt = _matchDateTime(m);
              return dt != null && !dt.isBefore(now);
            }).toList()..sort(
              (a, b) => (_matchDateTime(a) ?? DateTime(9999)).compareTo(
                _matchDateTime(b) ?? DateTime(9999),
              ),
            );

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── 1. CABECERA DEL CUADRO CON SU CAMISETA OFICIAL ──────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Tu cuadro',
                        style: AppTypography.body(
                          size: 12,
                          weight: FontWeight.w600,
                          color: context.c.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        group.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.headline(
                          size: 30,
                          weight: FontWeight.w800,
                          letterSpacing: -0.8,
                        ),
                      ),
                      const SizedBox(height: 4),
                      InkWell(
                        onTap: () {
                          Clipboard.setData(
                            ClipboardData(text: group.inviteCode),
                          );
                          HapticFeedback.selectionClick();
                          PateaSnack.info(
                            context,
                            'Código copiado: ${group.inviteCode}',
                          );
                        },
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Código: ',
                              style: AppTypography.body(
                                size: 12,
                                color: context.c.textSecondary,
                              ),
                            ),
                            Text(
                              group.inviteCode,
                              style: AppTypography.code(
                                size: 12,
                                weight: FontWeight.w800,
                                color: context.c.primary,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(
                              Icons.copy_rounded,
                              size: 12,
                              color: context.c.primary,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                _TeamJerseyStack(groupId: groupId),
              ],
            ),

            const SizedBox(height: 16),
            Divider(height: 1, thickness: 1.5, color: context.c.overlayLine),
            const SizedBox(height: 16),

            // ── 2. TOTALES DEL PLANTEL (EN LÍNEA ABIERTA) ────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Plantel total',
                      style: AppTypography.body(
                        size: 12,
                        weight: FontWeight.w600,
                        color: context.c.textSecondary,
                      ),
                    ),
                    Text(
                      '${players.length}',
                      style: AppTypography.sportNumber(size: 38),
                    ),
                    Text(
                      'jugadores registrados',
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.textSecondary,
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Partidos jugados',
                      style: AppTypography.body(
                        size: 12,
                        weight: FontWeight.w600,
                        color: context.c.textSecondary,
                      ),
                    ),
                    Text(
                      '${played.length}',
                      style: AppTypography.sportNumber(
                        size: 38,
                        color: context.c.primary,
                      ),
                    ),
                    Text(
                      'en el historial',
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),

            const SizedBox(height: 16),
            Divider(height: 1, thickness: 1.5, color: context.c.overlayLine),
            const SizedBox(height: 16),

            // ── 3. DESTACADOS DEL PLANTEL (MEJOR OVR Y GOLEADOR) ────────
            Text(
              'Figuras del plantel',
              style: AppTypography.body(
                size: 12,
                weight: FontWeight.w600,
                color: context.c.textSecondary,
              ),
            ),
            const SizedBox(height: 12),

            if (topOvr != null)
              _GroupFigureRow(
                label: 'Mejor OVR · ${topOvr.tier}',
                name: topOvr.name,
                value: '${topOvr.ovr}',
                valueColor: context.c.textPrimary,
                tierColor: context.c.ovrTextColor(topOvr.ovr),
                onTap: () => context.push('/players/${topOvr.id}'),
              ),

            if (topScorer != null) ...[
              const SizedBox(height: 10),
              _GroupFigureRow(
                label: 'Máximo goleador',
                name: topScorer.name,
                value: '${topScorer.stats.goals} G',
                valueColor: context.c.primary,
                tierColor: context.c.ovrBorderColor(topScorer.ovr),
                onTap: () => context.push('/players/${topScorer.id}'),
              ),
            ],

            const SizedBox(height: 16),
            Divider(height: 1, thickness: 1.5, color: context.c.overlayLine),
            const SizedBox(height: 16),

            // ── 4. EN AGENDA (LISTA ABIERTA) ─────────────────────────────
            Text(
              'En agenda',
              style: AppTypography.body(
                size: 12,
                weight: FontWeight.w600,
                color: context.c.textSecondary,
              ),
            ),
            const SizedBox(height: 8),

            if (agenda.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  'Nada agendado todavía.',
                  style: AppTypography.body(
                    size: 12,
                    color: context.c.textSecondary,
                  ),
                ),
              )
            else
              ...agenda
                  .take(4)
                  .map(
                    (m) => InkWell(
                      onTap: () => context.push('/matches/${m.id}'),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 7),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                m.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.body(
                                  color: context.c.textSecondary,
                                  size: 13,
                                  weight: FontWeight.w800,
                                ),
                              ),
                            ),
                            Text(
                              m.time == null
                                  ? fmtDate(m.date)
                                  : '${fmtDate(m.date)} · ${m.time}',
                              style: AppTypography.body(
                                size: 12,
                                weight: FontWeight.w600,
                                color: context.c.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => SharePlus.instance.share(
                ShareParams(
                  text:
                      '¡Sumate a "${group.name}" en Pateá! Código: ${group.inviteCode}',
                ),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: context.c.primary,
                side: BorderSide(color: context.c.primary, width: 1.2),
                padding: const EdgeInsets.symmetric(vertical: 11),
                shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
              ),
              icon: const Icon(Icons.share_rounded, size: 16),
              label: Text(
                'Invitar al cuadro',
                style: AppTypography.headline(
                  size: 13,
                  weight: FontWeight.w800,
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Las camisetas de los equipos del grupo, encimadas.
///
/// Acá antes iba `group.defaultJersey`, un campo que no existe ni en Firestore
/// ni en el schema de la web: siempre dibujaba la camiseta por defecto, igual
/// para todos los grupos. Las camisetas son de los equipos, así que se muestran
/// esas — hasta tres, la del frente es el equipo más nuevo.
class _TeamJerseyStack extends ConsumerWidget {
  final String groupId;

  const _TeamJerseyStack({required this.groupId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final teams =
        ref.watch(groupTeamsStreamProvider(groupId)).value ?? const [];

    if (teams.isEmpty) {
      return SizedBox(
        width: 72,
        height: 72,
        child: Center(
          child: Icon(
            Icons.checkroom_rounded,
            size: 34,
            color: context.c.textSecondary.withValues(alpha: 0.4),
          ),
        ),
      );
    }

    final shown = teams.take(3).toList();

    return SizedBox(
      width: 72,
      height: 72,
      child: Stack(
        alignment: Alignment.centerRight,
        children: [
          // Se dibujan de atrás hacia adelante: el último de la lista queda al
          // fondo, corrido y más chico.
          for (var i = shown.length - 1; i >= 0; i--)
            Positioned(
              right: i * 13.0,
              child: Transform.rotate(
                angle: i * -0.09,
                child: Opacity(
                  opacity: i == 0 ? 1 : 0.55 - (i - 1) * 0.15,
                  child: JerseyWidget(
                    jersey: shown[i].jersey,
                    size: 58 - i * 4.0,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _GroupFigureRow extends StatelessWidget {
  final String label;
  final String name;
  final String value;
  final Color valueColor;
  final Color tierColor;
  final VoidCallback onTap;

  const _GroupFigureRow({
    required this.label,
    required this.name,
    required this.value,
    required this.valueColor,
    required this.tierColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: tierColor,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: tierColor.withValues(alpha: 0.5),
                      blurRadius: 6,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: AppTypography.headline(
                      size: 14,
                      weight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    label,
                    style: AppTypography.body(
                      size: 12,
                      color: context.c.textSecondary,
                    ),
                  ),
                ],
              ),
            ],
          ),
          Text(
            value,
            style: AppTypography.sportNumber(
              size: 26,
              color: valueColor,
            ).copyWith(fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }
}

/// Lo que ve alguien que acaba de crear su cuenta.
///
/// Un panel en blanco no le dice nada a quien recién llega: acá están las dos
/// únicas cosas que puede hacer —armar su grupo o entrar al de un amigo con
/// el código— y el acceso al tutorial.
class _WelcomeEmptyState extends StatelessWidget {
  const _WelcomeEmptyState();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: AppRadii.surfaceAll,
            child: AspectRatio(
              aspectRatio: 1.65,
              child: Image.asset(
                'assets/brand/patea_groups.webp',
                fit: BoxFit.cover,
                alignment: Alignment.centerRight,
                errorBuilder: (_, _, _) =>
                    ColoredBox(color: context.c.cardSurface),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Tu cuadro empieza acá',
            style: AppTypography.body(
              size: 12,
              weight: FontWeight.w600,
              color: context.c.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Primero, juntá a tu gente.',
            style: AppTypography.headline(size: 22, weight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          Text(
            'Un grupo es tu cuadro: ahí viven los jugadores, los partidos y las '
            'evaluaciones. Armá el tuyo o entrá al de un amigo con su código.',
            style: AppTypography.body(
              size: 13,
              color: context.c.textSecondary,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 22),
          FilledButton.icon(
            onPressed: () => context.push('/groups'),
            style: FilledButton.styleFrom(
              backgroundColor: context.c.primary,
              foregroundColor: context.c.onPrimary,
              padding: const EdgeInsets.symmetric(vertical: 15),
              shape: const RoundedRectangleBorder(
                borderRadius: AppRadii.cardAll,
              ),
            ),
            icon: const Icon(Icons.group_add_rounded, size: 18),
            label: Text(
              'Crear mi grupo',
              style: AppTypography.headline(
                size: 14,
                weight: FontWeight.w800,
                color: context.c.onPrimary,
              ),
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => context.push('/groups'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 15),
            ),
            icon: const Icon(Icons.vpn_key_outlined, size: 18),
            label: const Text('Tengo un código de invitación'),
          ),
          const SizedBox(height: 22),
          Center(
            child: TextButton.icon(
              onPressed: () => showDialog<void>(
                context: context,
                builder: (_) => const PateaHelpDialog(),
              ),
              icon: const Icon(Icons.help_outline, size: 16),
              label: const Text('Cómo funciona Pateá'),
              style: TextButton.styleFrom(
                foregroundColor: context.c.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
