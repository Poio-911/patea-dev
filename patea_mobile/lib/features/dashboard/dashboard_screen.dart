import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/models/match_model.dart';
import '../../core/widgets/match_countdown.dart';
import '../../core/models/player_model.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/patea_help_dialog.dart';

const _spanishMonths = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

String _fmtDate(String raw) {
  final d = DateTime.tryParse(raw);
  if (d == null) return raw;
  final local = d.toLocal();
  return '${local.day.toString().padLeft(2, '0')} de ${_spanishMonths[local.month - 1]}';
}

DateTime? _matchDateTime(MatchModel m) {
  final d = DateTime.tryParse(m.date);
  if (d == null) return null;
  final local = d.toLocal();
  final clean = (m.time ?? '').replaceAll(' hs', '').replaceAll('hs', '').trim();
  final parts = clean.split(':');
  final hh = parts.isNotEmpty ? int.tryParse(parts[0]) ?? 0 : 0;
  final mm = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
  return DateTime(local.year, local.month, local.day, hh, mm);
}

DateTime? _kickoffOf(MatchModel m) {
  return _matchDateTime(m);
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
      showDialog<void>(context: context, builder: (_) => const PateaHelpDialog());
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
    await prefs.setString('dashboardActiveTab', index == 1 ? 'grupo' : 'resumen');
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = ref.watch(authServiceProvider).currentUser;
    final uid = currentUser?.uid;
    final playerAsync = uid != null ? ref.watch(singlePlayerStreamProvider(uid)) : null;
    final player = playerAsync?.value;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // Cabecera: Mate Oficial + EL VESTUARIO en Italic + Dorsal Pill
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
              sliver: SliverToBoxAdapter(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    SvgPicture.asset(
                      'assets/icons/mate.svg',
                      width: 34,
                      height: 34,
                      colorFilter: const ColorFilter.mode(AppColors.voltNeon, BlendMode.srcIn),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'EL VESTUARIO',
                            style: AppTypography.headline(
                              size: 26,
                              weight: FontWeight.w900,
                              letterSpacing: -0.5,
                            ),
                          ),
                          Text(
                            'El pantallazo del cuadro sin vueltas.',
                            style: AppTypography.body(size: 11, color: AppColors.textSecondary),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Tab Bar con barra deslizante Volt
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              sliver: SliverToBoxAdapter(
                child: _DashboardTabBar(active: _tab, onChanged: _saveTab),
              ),
            ),

            // Contenido dinámico según Tab
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
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
      ),
    );
  }
}

class _DashboardTabBar extends StatelessWidget {
  final int active;
  final ValueChanged<int> onChanged;

  const _DashboardTabBar({required this.active, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    Widget tab(String label, int index) {
      final selected = active == index;
      return Expanded(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            HapticFeedback.selectionClick();
            onChanged(index);
          },
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: Text(
                  label.toUpperCase(),
                  style: AppTypography.headline(
                    size: 12,
                    weight: selected ? FontWeight.w900 : FontWeight.w600,
                    color: selected ? AppColors.textPrimary : AppColors.textMuted,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOutCubic,
                height: 2.5,
                decoration: BoxDecoration(
                  color: selected ? AppColors.voltNeon : Colors.transparent,
                  borderRadius: BorderRadius.circular(2),
                  boxShadow: selected
                      ? [BoxShadow(color: AppColors.voltNeon.withValues(alpha: 0.4), blurRadius: 8)]
                      : null,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: [
        Row(
          children: [
            tab('Mi Resumen', 0),
            tab('Mi Grupo', 1),
          ],
        ),
        Container(height: 1, color: Colors.white.withValues(alpha: 0.08)),
      ],
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
      loading: () => const Padding(
        padding: EdgeInsets.all(40),
        child: Center(child: CircularProgressIndicator(color: AppColors.voltNeon)),
      ),
      error: (e, _) => Center(
        child: Text('Error: $e', style: AppTypography.body(color: AppColors.destructive)),
      ),
    );
  }
}

class _ResumenTabBody extends ConsumerWidget {
  final String uid;
  final String? groupId;
  final PlayerModel? player;

  const _ResumenTabBody({required this.uid, required this.groupId, required this.player});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matchesAsync = ref.watch(matchesStreamProvider(groupId));
    final ovrHistoryAsync = ref.watch(ovrHistoryStreamProvider(uid));

    return matchesAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 48),
        child: Center(child: CircularProgressIndicator(color: AppColors.voltNeon)),
      ),
      error: (e, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Text('No se pudo cargar tu panel.',
            style: AppTypography.body(size: 13, color: AppColors.textMuted)),
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
        final upcoming = matches.where((m) {
          if (m.status != 'upcoming') return false;
          final dt = _matchDateTime(m);
          return dt != null && !dt.isBefore(now);
        }).toList()
          ..sort((a, b) => (_matchDateTime(a) ?? DateTime(9999))
              .compareTo(_matchDateTime(b) ?? DateTime(9999)));

        final next = live.isNotEmpty
            ? live.first
            : (upcoming.isNotEmpty ? upcoming.first : null);

        final played = matches
            .where((m) =>
                (m.status == 'completed' || m.status == 'evaluated') &&
                m.teamA != null &&
                m.teamB != null)
            .toList()
          ..sort((a, b) => (DateTime.tryParse(b.date) ?? DateTime(0))
              .compareTo(DateTime.tryParse(a.date) ?? DateTime(0)));
        final lastPlayed = played.isNotEmpty ? played.first : null;

        final history = ovrHistoryAsync.value ?? const <OvrHistoryEntry>[];
        final trend = history.isEmpty ? 0 : history.last.newOVR - history.first.oldOVR;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── 1. EL TÚNEL DE PRÓXIMO PARTIDO (CON CAMISETAS ROTADAS) ──
            if (next != null)
              _TunnelMatchHero(match: next, isLive: live.isNotEmpty)
            else
              _EmptyMural(
                label: 'SIN PARTIDOS AGENDADOS',
                message: 'No estás anotada en ningún partido todavía.',
                actionLabel: 'Crear partido',
                onAction: () => context.push('/matches'),
              ),

            const SizedBox(height: 16),
            Divider(height: 1, thickness: 1.5, color: Colors.white.withValues(alpha: 0.1)),
            const SizedBox(height: 16),

            // ── 2. TUS NÚMEROS (OVR MONUMENTAL + EFECTIVIDAD) ───────────
            if (player != null)
              _PlayerPerformanceMural(player: player!, trend: trend)
            else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Text('Cargando ficha del jugador...',
                    style: AppTypography.body(size: 12, color: AppColors.textMuted)),
              ),

            const SizedBox(height: 16),
            Divider(height: 1, thickness: 1.5, color: Colors.white.withValues(alpha: 0.1)),
            const SizedBox(height: 16),

            // ── 3. ÚLTIMO PARTIDO JUGADO EN LÍNEA ABIERTA ────────────────
            if (lastPlayed != null)
              _LastResultMural(match: lastPlayed)
            else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text('Todavía no disputaste ningún partido evaluado.',
                    style: AppTypography.body(size: 12, color: AppColors.textMuted)),
              ),
          ],
        );
      },
    );
  }
}

/// Hero del Partido con Camisetas en Perspectiva ("El Túnel")
/// El próximo partido: las dos camisetas saliendo del túnel y el choque.
///
/// La animación es una sola coreografía, no efectos sueltos:
///
/// 1. **Salida al campo.** Cada camiseta entra desde su costado, más ladeada
///    de lo que va a quedar (±16° contra los ±4° de reposo) y más chica, y se
///    va acomodando sobre el eje. La visitante sale 120 ms después que la
///    local, para que se lea como dos equipos y no como un bloque.
/// 2. **El choque.** El `/VS/` no aparece: entra de golpe justo cuando las dos
///    camisetas terminan de cruzarse, del triple de su tamaño, con un rebote.
///    Ese instante es el que le da sentido al resto.
/// 3. **La tela.** Después nada se queda quieto: cada camiseta oscila sobre su
///    ángulo de reposo y flota, con frecuencias distintas (1.00 y 1.18) y
///    desfasadas un cuarto de ciclo. Frecuencias iguales se sincronizan y el
///    ojo lo lee como un GIF; distintas y sin múltiplo común, nunca repite.
/// 4. **En vivo.** El marcador late y el `/VS/` se pone rojo.
///
/// Si el sistema pide menos movimiento (`MediaQuery.disableAnimations`), se
/// dibuja el estado final quieto y no se crea ningún ticker.
class _TunnelMatchHero extends StatefulWidget {
  final MatchModel match;
  final bool isLive;

  const _TunnelMatchHero({required this.match, required this.isLive});

  @override
  State<_TunnelMatchHero> createState() => _TunnelMatchHeroState();
}

class _TunnelMatchHeroState extends State<_TunnelMatchHero>
    with TickerProviderStateMixin {
  late final AnimationController _entrance;
  late final AnimationController _ambient;

  /// Reposo de cada camiseta, en radianes (unos 4°).
  static const _restAngle = 0.07;

  @override
  void initState() {
    super.initState();
    _entrance = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1150),
    );
    // El vaivén: 4,2 s da un movimiento de tela, no de péndulo.
    _ambient = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4200),
    );
  }

  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Arranca acá y no en initState porque necesita saber si el sistema pide
    // menos movimiento, y eso sale del MediaQuery.
    if (_started) return;
    _started = true;
    if (!MediaQuery.disableAnimationsOf(context)) {
      _entrance.forward();
      _ambient.repeat();
    }
  }

  @override
  void didUpdateWidget(covariant _TunnelMatchHero old) {
    super.didUpdateWidget(old);
    // Si cambió el partido, vuelven a salir del túnel.
    if (old.match.id != widget.match.id &&
        !MediaQuery.disableAnimationsOf(context)) {
      _entrance.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _entrance.dispose();
    _ambient.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final match = widget.match;
    final isLive = widget.isLive;
    final kickoff = _kickoffOf(match);
    final a = match.teamA;
    final b = match.teamB;

    final aColor = a != null
        ? _parseHexColor(a.jersey?.primaryColor ?? a.color, const Color(0xFF2563EB))
        : const Color(0xFF2563EB);
    final bColor = b != null
        ? _parseHexColor(b.jersey?.primaryColor ?? b.color, const Color(0xFFEA580C))
        : const Color(0xFFEA580C);

    return InkWell(
      onTap: () => context.push('/matches/${match.id}'),
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Fila Superior: Reloj Countdown + Fecha & Hora
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isLive
                          ? 'EN VIVO · MINUTO ${match.currentMinute ?? 1}\''
                          : 'ARRANCA EN',
                      style: AppTypography.code(
                        size: 9,
                        weight: FontWeight.w800,
                        color: isLive ? AppColors.destructive : AppColors.textMuted,
                      ),
                    ),
                    const SizedBox(height: 2),
                    if (isLive && a != null && b != null)
                      _LivePulse(
                        listenable: _ambient,
                        child: Text(
                          '${a.score} — ${b.score}',
                          style: AppTypography.sportNumber(
                                  size: 42, color: AppColors.voltNeon)
                              .copyWith(fontStyle: FontStyle.italic),
                        ),
                      )
                    else if (kickoff != null)
                      MatchCountdown(
                        kickoff: kickoff,
                        size: 42,
                        color: AppColors.voltNeon,
                        isItalic: true,
                      )
                    else
                      Text(
                        match.title,
                        style: AppTypography.headline(size: 22, weight: FontWeight.w900)
                            .copyWith(fontStyle: FontStyle.italic),
                      ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    match.time == null
                        ? _fmtDate(match.date).toUpperCase()
                        : '${_fmtDate(match.date).toUpperCase()} · ${match.time}',
                    style: AppTypography.code(
                        size: 10, weight: FontWeight.w800, color: AppColors.voltNeon),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'DÍA DE PARTIDO',
                    style: AppTypography.code(size: 9, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Choque de Camisetas y Nombres jugando con sus colores
          if (a != null && b != null)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Flexible(
                  child: _CleanTunnelSide(
                    entrance: _entrance,
                    ambient: _ambient,
                    team: a,
                    teamColor: aColor,
                    fromLeft: true,
                  ),
                ),
                _CleanVsDivider(
                  entrance: _entrance,
                  live: isLive,
                ),
                Flexible(
                  child: _CleanTunnelSide(
                    entrance: _entrance,
                    ambient: _ambient,
                    team: b,
                    teamColor: bColor,
                    fromLeft: false,
                  ),
                ),
              ],
            ),

          const SizedBox(height: 18),

          // Metadatos Limpios: Sede recortada (solo nombre local) y Convocados
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.stadium_outlined, size: 14, color: AppColors.textMuted),
                  const SizedBox(width: 6),
                  Text(
                    _shortLocation(match.location),
                    style: AppTypography.code(
                      size: 10,
                      weight: FontWeight.w700,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.groups_outlined, size: 14, color: AppColors.textMuted),
                  const SizedBox(width: 6),
                  Text(
                    '${match.playerUids.length}/${match.matchSize > 0 ? match.matchSize : 14} CONVOCADOS',
                    style: AppTypography.code(
                      size: 10,
                      weight: FontWeight.w800,
                      color: AppColors.voltNeon,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

String _shortLocation(String? loc) {
  if (loc == null || loc.trim().isEmpty) return 'CANCHA A DEFINIR';
  final first = loc.split(',').first.trim();
  return (first.isNotEmpty ? first : loc).toUpperCase();
}

Color _parseHexColor(String? hex, Color fallback) {
  if (hex == null) return fallback;
  final clean = hex.replaceAll('#', '').trim();
  if (clean.length == 6) {
    final val = int.tryParse(clean, radix: 16);
    if (val != null) return Color(0xFF000000 | val);
  } else if (clean.length == 3) {
    final r = clean[0];
    final g = clean[1];
    final b = clean[2];
    final val = int.tryParse('$r$r$g$g$b$b', radix: 16);
    if (val != null) return Color(0xFF000000 | val);
  }
  return fallback;
}

/// Lado de Equipo Limpio: Camiseta + Nombre con barra de acento en su color
class _CleanTunnelSide extends StatelessWidget {
  final Animation<double> entrance;
  final Animation<double> ambient;
  final MatchTeam team;
  final Color teamColor;
  final bool fromLeft;

  const _CleanTunnelSide({
    required this.entrance,
    required this.ambient,
    required this.team,
    required this.teamColor,
    required this.fromLeft,
  });

  @override
  Widget build(BuildContext context) {
    final delay = fromLeft ? 0.0 : 0.08;
    final rest = _TunnelMatchHeroState._restAngle * (fromLeft ? -1 : 1);

    final slide = CurvedAnimation(
      parent: entrance,
      curve: Interval(delay, delay + 0.60, curve: Curves.easeOutCubic),
    );
    final settle = CurvedAnimation(
      parent: entrance,
      curve: Interval(delay + 0.15, delay + 0.85, curve: Curves.easeOutBack),
    );
    final nameIn = CurvedAnimation(
      parent: entrance,
      curve: Interval(delay + 0.30, delay + 0.75, curve: Curves.easeOut),
    );

    return AnimatedBuilder(
      animation: Listenable.merge([entrance, ambient]),
      builder: (context, _) {
        final dx = (1 - slide.value) * (fromLeft ? -80.0 : 80.0);
        final angle = rest + (1 - settle.value) * (fromLeft ? -0.15 : 0.15);
        final scale = 0.80 + 0.20 * slide.value;

        return Transform.translate(
          offset: Offset(dx, 0),
          child: Opacity(
            opacity: slide.value.clamp(0.0, 1.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Camiseta rotada limpiamente sobre el césped
                Transform.rotate(
                  angle: angle,
                  child: Transform.scale(
                    scale: scale,
                    child: team.jersey != null
                        ? JerseyWidget(jersey: team.jersey!, size: 82)
                        : const Icon(Icons.checkroom,
                            size: 64, color: AppColors.textMuted),
                  ),
                ),

                const SizedBox(height: 6),

                // Sombra sutil y limpia de apoyo
                Container(
                  width: 50,
                  height: 6,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),

                const SizedBox(height: 10),

                // Nombre del equipo en tipografía deportiva pura (sin cajas ni bordes)
                Opacity(
                  opacity: nameIn.value,
                  child: Transform.translate(
                    offset: Offset(0, (1 - nameIn.value) * 8),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          team.name.toUpperCase(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.bebasNeue(
                            fontSize: 22,
                            letterSpacing: 1.5,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 2),
                        // Barra deportiva mínima en el color de su camiseta
                        Container(
                          width: 22,
                          height: 2.5,
                          decoration: BoxDecoration(
                            color: teamColor,
                            borderRadius: BorderRadius.circular(1.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Divisor VS Deportivo: Solo "VS" en blanco sólido con tipografía atlética
class _CleanVsDivider extends StatelessWidget {
  final Animation<double> entrance;
  final bool live;

  const _CleanVsDivider({
    required this.entrance,
    required this.live,
  });

  @override
  Widget build(BuildContext context) {
    final impact = CurvedAnimation(
      parent: entrance,
      curve: const Interval(0.45, 0.80, curve: Curves.easeOutBack),
    );

    return AnimatedBuilder(
      animation: entrance,
      builder: (context, _) {
        final k = impact.value;
        final scale = 0.75 + 0.25 * k.clamp(0.0, 1.0);

        return Opacity(
          opacity: k.clamp(0.0, 1.0),
          child: Transform.scale(
            scale: scale,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Text(
                'VS',
                style: GoogleFonts.bebasNeue(
                  fontSize: 26,
                  letterSpacing: 2.0,
                  color: live ? AppColors.destructive : Colors.white,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// El marcador en vivo latiendo, enganchado al mismo ciclo que todo lo demás.
class _LivePulse extends StatelessWidget {
  final Listenable listenable;
  final Widget child;

  const _LivePulse({required this.listenable, required this.child});

  @override
  Widget build(BuildContext context) {
    final anim = listenable as Animation<double>;
    return AnimatedBuilder(
      animation: anim,
      builder: (context, ch) => Transform.scale(
        // Late al doble de rápido que la tela: se lee como pulso, no como vaivén.
        scale: 1 + math.sin(4 * math.pi * anim.value).abs() * 0.04,
        alignment: Alignment.centerLeft,
        child: ch,
      ),
      child: child,
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
                'TU OVR ACTUAL',
                style: AppTypography.code(size: 9, weight: FontWeight.w800, color: AppColors.textMuted),
              ),
              const SizedBox(height: 2),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    '${player.ovr}',
                    style: AppTypography.sportNumber(size: 68, color: Colors.white)
                        .copyWith(fontStyle: FontStyle.italic, letterSpacing: -2),
                  ),
                  if (trend != 0) ...[
                    const SizedBox(width: 4),
                    Text(
                      '${up ? '+' : ''}$trend',
                      style: AppTypography.sportNumber(
                        size: 18,
                        color: up ? AppColors.voltNeon : AppColors.destructive,
                      ),
                    ),
                  ],
                ],
              ),
              Text(
                'TIER ${player.tier.toUpperCase()}',
                style: AppTypography.code(
                  size: 9,
                  weight: FontWeight.w800,
                  color: AppColors.getOvrBorderColor(player.ovr),
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
                '$goals GOLES',
                style: AppTypography.sportNumber(size: 30, color: AppColors.voltNeon)
                    .copyWith(fontStyle: FontStyle.italic),
              ),
              const SizedBox(height: 2),
              Text(
                '$matches PARTIDOS JUGADOS',
                style: AppTypography.body(size: 13, weight: FontWeight.w700, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 4),
              Text(
                'PROMEDIO: $avg G/PJ',
                style: AppTypography.code(size: 10, weight: FontWeight.w700, color: Colors.white),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Último Partido en Línea
class _LastResultMural extends StatelessWidget {
  final MatchModel match;

  const _LastResultMural({required this.match});

  @override
  Widget build(BuildContext context) {
    final a = match.teamA!;
    final b = match.teamB!;
    final diff = a.score - b.score;
    final stamp = diff > 0 ? 'W' : (diff < 0 ? 'L' : 'D');
    final stampColor = diff > 0 ? AppColors.voltNeon : (diff < 0 ? AppColors.destructive : AppColors.textMuted);

    return InkWell(
      onTap: () => context.push('/matches/${match.id}'),
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ÚLTIMO JUGADO · ${_fmtDate(match.date).toUpperCase()}',
                  style: AppTypography.code(size: 9, weight: FontWeight.w800, color: AppColors.textMuted),
                ),
                const SizedBox(height: 3),
                Text(
                  '${a.name} ${a.score} — ${b.score} ${b.name}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body(size: 14, weight: FontWeight.w800),
                ),
                Text(
                  'Toque para ver crónica y calificaciones',
                  style: AppTypography.body(size: 11, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          Text(
            stamp,
            style: AppTypography.sportNumber(size: 28, color: stampColor)
                .copyWith(fontStyle: FontStyle.italic),
          ),
        ],
      ),
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
          return _EmptyMural(
            label: 'SIN GRUPO ACTIVO',
            message: 'Unite o creá tu grupo para ver las estadísticas del cuadro.',
            actionLabel: 'Ir a Mis Grupos',
            onAction: () => context.push('/groups'),
          );
        }
        return _GrupoTabBody(groupId: groupId);
      },
      loading: () => const Padding(
        padding: EdgeInsets.all(40),
        child: Center(child: CircularProgressIndicator(color: AppColors.voltNeon)),
      ),
      error: (e, _) => Center(
        child: Text('Error: $e', style: AppTypography.body(color: AppColors.destructive)),
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
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 48),
        child: Center(child: CircularProgressIndicator(color: AppColors.voltNeon)),
      ),
      error: (e, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Text('No se pudo cargar el grupo.',
            style: AppTypography.body(size: 13, color: AppColors.textMuted)),
      ),
      data: (group) {
        if (group == null) {
          return _EmptyMural(
            label: 'GRUPO NO ENCONTRADO',
            message: 'El grupo no existe o fue eliminado.',
            actionLabel: 'Explorar Grupos',
            onAction: () => context.push('/groups'),
          );
        }

        final players = playersAsync.value ?? const [];
        final matches = matchesAsync.value ?? const [];
        final played = matches.where((m) => m.status == 'completed' || m.status == 'evaluated').toList();

        final byGoals = [...players]..sort((a, b) => b.stats.goals.compareTo(a.stats.goals));
        final byOvr = [...players]..sort((a, b) => b.ovr.compareTo(a.ovr));
        final topScorer = byGoals.isNotEmpty && byGoals.first.stats.goals > 0 ? byGoals.first : null;
        final topOvr = byOvr.isNotEmpty ? byOvr.first : null;

        final now = DateTime.now();
        final agenda = matches.where((m) {
          if (m.status != 'upcoming') return false;
          final dt = _matchDateTime(m);
          return dt != null && !dt.isBefore(now);
        }).toList()
          ..sort((a, b) => (_matchDateTime(a) ?? DateTime(9999)).compareTo(_matchDateTime(b) ?? DateTime(9999)));

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
                        'TU CUADRO',
                        style: AppTypography.code(size: 9, weight: FontWeight.w800, color: AppColors.textMuted),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        group.name.toUpperCase(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.headline(size: 32, weight: FontWeight.w900)
                            .copyWith(fontStyle: FontStyle.italic, letterSpacing: -1),
                      ),
                      const SizedBox(height: 4),
                      InkWell(
                        onTap: () {
                          Clipboard.setData(ClipboardData(text: group.inviteCode));
                          HapticFeedback.selectionClick();
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Código copiado: ${group.inviteCode}'),
                              backgroundColor: AppColors.cardSurface,
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        },
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'CÓDIGO: ',
                              style: AppTypography.code(size: 11, color: AppColors.textMuted),
                            ),
                            Text(
                              group.inviteCode,
                              style: AppTypography.code(size: 12, weight: FontWeight.w800, color: AppColors.voltNeon),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.copy_rounded, size: 12, color: AppColors.voltNeon),
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
            Divider(height: 1, thickness: 1.5, color: Colors.white.withValues(alpha: 0.1)),
            const SizedBox(height: 16),

            // ── 2. TOTALES DEL PLANTEL (EN LÍNEA ABIERTA) ────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('PLANTEL TOTAL', style: AppTypography.code(size: 9, weight: FontWeight.w800, color: AppColors.textMuted)),
                    Text('${players.length}', style: AppTypography.sportNumber(size: 38)),
                    Text('jugadores registrados', style: AppTypography.body(size: 11, color: AppColors.textSecondary)),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('PARTIDOS JUGADOS', style: AppTypography.code(size: 9, weight: FontWeight.w800, color: AppColors.textMuted)),
                    Text('${played.length}', style: AppTypography.sportNumber(size: 38, color: AppColors.voltNeon)),
                    Text('en el historial', style: AppTypography.body(size: 11, color: AppColors.textSecondary)),
                  ],
                ),
              ],
            ),

            const SizedBox(height: 16),
            Divider(height: 1, thickness: 1.5, color: Colors.white.withValues(alpha: 0.1)),
            const SizedBox(height: 16),

            // ── 3. DESTACADOS DEL PLANTEL (MEJOR OVR Y GOLEADOR) ────────
            Text(
              'FIGURAS DEL PLANTEL',
              style: AppTypography.code(size: 9, weight: FontWeight.w800, color: AppColors.textMuted),
            ),
            const SizedBox(height: 12),

            if (topOvr != null)
              _GroupFigureRow(
                label: 'MEJOR OVR · ${topOvr.tier.toUpperCase()}',
                name: topOvr.name,
                value: '${topOvr.ovr}',
                valueColor: Colors.white,
                tierColor: AppColors.getOvrBorderColor(topOvr.ovr),
                onTap: () => context.push('/players/${topOvr.id}'),
              ),

            if (topScorer != null) ...[
              const SizedBox(height: 10),
              _GroupFigureRow(
                label: 'MÁXIMO GOLEADOR',
                name: topScorer.name,
                value: '${topScorer.stats.goals} G',
                valueColor: AppColors.voltNeon,
                tierColor: AppColors.getOvrBorderColor(topScorer.ovr),
                onTap: () => context.push('/players/${topScorer.id}'),
              ),
            ],

            const SizedBox(height: 16),
            Divider(height: 1, thickness: 1.5, color: Colors.white.withValues(alpha: 0.1)),
            const SizedBox(height: 16),

            // ── 4. EN AGENDA (LISTA ABIERTA) ─────────────────────────────
            Text(
              'EN AGENDA',
              style: AppTypography.code(size: 9, weight: FontWeight.w800, color: AppColors.textMuted),
            ),
            const SizedBox(height: 8),

            if (agenda.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text('Nada agendado todavía.',
                    style: AppTypography.body(size: 12, color: AppColors.textMuted)),
              )
            else
              ...agenda.take(4).map(
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
                                style: AppTypography.body(size: 13, weight: FontWeight.w800),
                              ),
                            ),
                            Text(
                              m.time == null ? _fmtDate(m.date) : '${_fmtDate(m.date)} · ${m.time}',
                              style: AppTypography.code(size: 10, weight: FontWeight.w800, color: AppColors.voltNeon),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => SharePlus.instance.share(
                ShareParams(text: '¡Sumate a "${group.name}" en Pateá! Código: ${group.inviteCode}'),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.voltNeon,
                side: const BorderSide(color: AppColors.voltNeon, width: 1.2),
                padding: const EdgeInsets.symmetric(vertical: 11),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(Icons.share_rounded, size: 16),
              label: Text('Invitar al cuadro', style: AppTypography.headline(size: 13, weight: FontWeight.w800)),
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
    final teams = ref.watch(groupTeamsStreamProvider(groupId)).value ?? const [];

    if (teams.isEmpty) {
      return SizedBox(
        width: 72,
        height: 72,
        child: Center(
          child: Icon(Icons.checkroom_rounded,
              size: 34, color: AppColors.textMuted.withValues(alpha: 0.4)),
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
                  child: JerseyWidget(jersey: shown[i].jersey, size: 58 - i * 4.0),
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
                  boxShadow: [BoxShadow(color: tierColor.withValues(alpha: 0.5), blurRadius: 6)],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name.toUpperCase(),
                    style: AppTypography.headline(size: 14, weight: FontWeight.w800),
                  ),
                  Text(
                    label,
                    style: AppTypography.code(size: 9, color: AppColors.textMuted),
                  ),
                ],
              ),
            ],
          ),
          Text(
            value,
            style: AppTypography.sportNumber(size: 26, color: valueColor)
                .copyWith(fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }
}

class _EmptyMural extends StatelessWidget {
  final String label;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  const _EmptyMural({
    required this.label,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppTypography.code(size: 9, weight: FontWeight.w800, color: AppColors.textMuted)),
          const SizedBox(height: 6),
          Text(message, style: AppTypography.headline(size: 16, weight: FontWeight.w800)),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: onAction,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.voltNeon,
              foregroundColor: Colors.black,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: Text(actionLabel, style: AppTypography.headline(size: 12, weight: FontWeight.w800)),
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
          Text('PRIMER PASO',
              style: AppTypography.headline(
                  size: 11,
                  weight: FontWeight.w800,
                  color: AppColors.textMuted,
                  letterSpacing: 1.2)),
          const SizedBox(height: 8),
          Text('Todavía no estás en ningún grupo',
              style: AppTypography.headline(size: 22, weight: FontWeight.w900)),
          const SizedBox(height: 8),
          Text(
            'Un grupo es tu cuadro: ahí viven los jugadores, los partidos y las '
            'evaluaciones. Armá el tuyo o entrá al de un amigo con su código.',
            style: AppTypography.body(size: 13, color: AppColors.textSecondary, height: 1.5),
          ),
          const SizedBox(height: 22),
          FilledButton.icon(
            onPressed: () => context.push('/groups'),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.voltNeon,
              foregroundColor: AppColors.background,
              padding: const EdgeInsets.symmetric(vertical: 15),
              shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
            ),
            icon: const Icon(Icons.group_add_rounded, size: 18),
            label: Text('Crear mi grupo',
                style: AppTypography.headline(
                    size: 14, weight: FontWeight.w800, color: AppColors.background)),
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
              style: TextButton.styleFrom(foregroundColor: AppColors.textMuted),
            ),
          ),
        ],
      ),
    );
  }
}
