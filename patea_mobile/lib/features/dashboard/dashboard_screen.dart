import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/match_theme.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/models/match_model.dart';
import '../../core/widgets/match_countdown.dart';
import '../../core/models/player_model.dart';
import '../../core/models/group_model.dart';
import '../../core/widgets/jersey_painter.dart';

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


/// Port de src/app/dashboard/page.tsx + components/dashboard/*: 2 tabs
/// ("Mi Resumen"/"Mi Grupo"), persistidos localmente (SharedPreferences ~
/// localStorage de la web). El tab activo, el próximo partido, partidos en
/// vivo, estadísticas reales del jugador (no hardcodeadas) y la progresión
/// de OVR viven en "Mi Resumen"; el grupo activo, sus stats rápidas, agenda
/// y últimos partidos evaluados viven en "Mi Grupo".
///
/// Deliberadamente NO portado en esta pasada: pantallas de onboarding
/// completas para "sin grupo"/"usuario nuevo" (dominio Auth, fuera del
/// barrido), TeamList/Equipos Guardados (depende de Sección 5
/// Grupos/Equipos, 0%), Amistosos Intergrupos, crónica de partido (IA) en
/// las cards de partidos evaluados, video de fondo del GroupHeroCard.
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

    // El fondo de cancha ahora se aplica una sola vez en el shell
    // (_ScaffoldWithNavBar), no hace falta repetirlo por pantalla.
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
          child: CustomScrollView(
            slivers: [
              // Título real de la web (src/app/dashboard/page.tsx): ícono
              // de mate + "El Vestuario" — no "PATEÁ / ¡Hola X!" (eso no
              // existe en la web, era invención de una pasada anterior).
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
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
                      const SizedBox(width: 13),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'EL VESTUARIO',
                              style: AppTypography.headline(
                                size: 24,
                                weight: FontWeight.w900,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 1),
                            Text(
                              'Un pantallazo de cómo está el cuadro.',
                              style: AppTypography.body(size: 12, color: AppColors.textSecondary),
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
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                sliver: SliverToBoxAdapter(
                  child: _DashboardTabBar(active: _tab, onChanged: _saveTab),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 24),
                sliver: SliverToBoxAdapter(
                  child: uid == null
                      ? const SizedBox()
                      : (_tab == 0 ? _ResumenTab(uid: uid) : _GrupoTab(uid: uid)),
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
    // Antes eran dos cajas redondeadas metidas dentro de otra caja
    // redondeada, con borde las tres. Ahora es un subrayado: el estándar de
    // cualquier app deportiva, y ocupa la mitad de alto.
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
                    size: 13,
                    weight: selected ? FontWeight.w900 : FontWeight.w600,
                    color: selected ? AppColors.textPrimary : AppColors.textMuted,
                    letterSpacing: 0.3,
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
        Container(height: 1, color: Colors.white.withValues(alpha: 0.07)),
      ],
    );
  }
}

class _ResumenTab extends ConsumerWidget {
  final String uid;

  const _ResumenTab({required this.uid});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupIdAsync = ref.watch(activeGroupIdStreamProvider(uid));

    return groupIdAsync.when(
      data: (groupId) => _ResumenTabBody(uid: uid, groupId: groupId),
      loading: () => const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator())),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }
}

/// "Mi Resumen" como tablero: todo en una pantalla, sin scroll.
///
/// Mosaico de piezas de distinto peso, como el gráfico de una transmisión. La
/// pieza más grande es la que contesta la pregunta por la que se abre la app:
/// cuánto falta para el próximo partido. Si hay uno en curso, esa pieza pasa a
/// ser el partido en vivo.
///
/// Rehecho de cero: antes era una pila de secciones con tarjeta y borde, cada
/// una del mismo peso, que obligaba a scrollear para llegar a los datos
/// propios.
class _ResumenTabBody extends ConsumerWidget {
  final String uid;
  final String? groupId;

  const _ResumenTabBody({required this.uid, required this.groupId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matchesAsync = ref.watch(matchesStreamProvider(groupId));
    final playerAsync = ref.watch(singlePlayerStreamProvider(uid));
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
      data: (matches) {
        final now = DateTime.now();

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

        // Último partido con resultado real, para la pieza de abajo.
        final played = matches
            .where((m) =>
                (m.status == 'completed' || m.status == 'evaluated') &&
                m.teamA != null &&
                m.teamB != null)
            .toList()
          ..sort((a, b) => (DateTime.tryParse(b.date) ?? DateTime(0))
              .compareTo(DateTime.tryParse(a.date) ?? DateTime(0)));
        final lastPlayed = played.isNotEmpty ? played.first : null;

        final player = playerAsync.value;
        final history = ovrHistoryAsync.value ?? const <OvrHistoryEntry>[];
        final trend = history.isEmpty ? 0 : history.last.newOVR - history.first.oldOVR;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Pieza principal ──────────────────────────────────────────
            if (next != null)
              _KickoffTile(match: next, isLive: live.isNotEmpty)
            else
              const _EmptyTile(
                label: 'SIN PARTIDOS',
                value: 'Nada agendado',
                hint: 'Armá uno desde Partidos.',
              ),

            const SizedBox(height: 5),

            // ── Dónde · Anotados ─────────────────────────────────────────
            if (next != null)
              // IntrinsicHeight es obligatorio acá: sin él, un Row con
              // crossAxisAlignment.stretch dentro de una Column sin altura
              // acotada deja a los hijos en altura cero y las piezas
              // desaparecen sin lanzar error.
              IntrinsicHeight(
                child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    flex: 3,
                    child: _Tile(
                      label: 'DÓNDE',
                      value: next.location ?? 'A definir',
                      valueSize: 15,
                      hint: _whenLine(next),
                    ),
                  ),
                  const SizedBox(width: 5),
                  Expanded(
                    flex: 2,
                    child: _Tile(
                      label: 'ANOTADOS',
                      value: '${next.playerUids.length}',
                      suffix: next.matchSize > 0 ? '/${next.matchSize}' : null,
                    ),
                  ),
                ],
                ),
              ),

            const SizedBox(height: 5),

            // ── Tu OVR · Tus números ─────────────────────────────────────
            if (player != null)
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: _OvrTile(ovr: player.ovr, trend: trend, history: history),
                    ),
                    const SizedBox(width: 5),
                    Expanded(
                      child: _TotalsTile(
                        matches: player.stats.matchesPlayed,
                        goals: player.stats.goals,
                      ),
                    ),
                  ],
                ),
              ),

            const SizedBox(height: 5),

            // ── Último resultado ─────────────────────────────────────────
            if (lastPlayed != null)
              _LastResultTile(match: lastPlayed)
            else
              const _EmptyTile(
                label: 'ÚLTIMO RESULTADO',
                value: 'Todavía nada',
                hint: 'Acá va a aparecer cuando jueguen el primero.',
              ),
          ],
        );
      },
    );
  }
}

/// Cuándo y hora en una línea.
String _whenLine(MatchModel m) {
  final d = _fmtDate(m.date);
  final t = m.time;
  return t == null ? d : '$d · $t';
}

// ─────────────────────────────────────────────────────────────────────────
// Piezas del tablero
// ─────────────────────────────────────────────────────────────────────────

const _tileBg = Color(0xFF151C27);

/// Combina `date` (ISO) con `time` ("21:00" o "21:00 hs") para saber a qué
/// hora arranca. Sin hora, se asume el arranque del día.
DateTime? _kickoffOf(MatchModel m) {
  final d = DateTime.tryParse(m.date);
  if (d == null) return null;
  final local = d.toLocal();
  final clean = (m.time ?? '').replaceAll('hs', '').trim();
  final parts = clean.split(':');
  final hh = parts.isNotEmpty ? int.tryParse(parts[0]) ?? 0 : 0;
  final mm = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
  return DateTime(local.year, local.month, local.day, hh, mm);
}

class _Tile extends StatelessWidget {
  final String label;
  final String value;
  final String? suffix;
  final String? hint;
  final double valueSize;
  final Color? valueColor;

  const _Tile({
    required this.label,
    required this.value,
    this.suffix,
    this.hint,
    this.valueSize = 24,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(11, 9, 11, 11),
      color: _tileBg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: AppTypography.code(size: 8, color: AppColors.textMuted)),
          const SizedBox(height: 3),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Flexible(
                child: Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.sportNumber(
                    size: valueSize,
                    color: valueColor ?? AppColors.textPrimary,
                  ),
                ),
              ),
              if (suffix != null)
                Text(
                  suffix!,
                  style: AppTypography.sportNumber(size: 13, color: AppColors.textMuted),
                ),
            ],
          ),
          if (hint != null) ...[
            const SizedBox(height: 2),
            Text(
              hint!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.code(size: 9, color: AppColors.textMuted),
            ),
          ],
        ],
      ),
    );
  }
}

class _EmptyTile extends StatelessWidget {
  final String label;
  final String value;
  final String hint;

  const _EmptyTile({required this.label, required this.value, required this.hint});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(13, 11, 13, 13),
      color: _tileBg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppTypography.code(size: 8, color: AppColors.textMuted)),
          const SizedBox(height: 4),
          Text(value, style: AppTypography.headline(size: 16, weight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(hint, style: AppTypography.body(size: 11, color: AppColors.textMuted)),
        ],
      ),
    );
  }
}

/// La pieza grande: cuánto falta, o el marcador si ya está jugándose.
class _KickoffTile extends StatelessWidget {
  final MatchModel match;
  final bool isLive;

  const _KickoffTile({required this.match, required this.isLive});

  @override
  Widget build(BuildContext context) {
    final kickoff = _kickoffOf(match);
    final a = match.teamA;
    final b = match.teamB;

    return InkWell(
      onTap: () => context.push('/matches/${match.id}'),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(13, 11, 13, 13),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF17202E), Color(0xFF131A26)],
          ),
          border: isLive
              ? Border.all(color: AppColors.destructive.withValues(alpha: 0.55))
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isLive ? 'EN VIVO · ${match.currentMinute ?? 1}\'' : 'ARRANCA EN',
              style: AppTypography.code(
                size: 8,
                color: isLive ? AppColors.destructive : AppColors.textMuted,
              ),
            ),
            const SizedBox(height: 5),

            if (isLive && a != null && b != null)
              Text(
                '${a.score} — ${b.score}',
                style: AppTypography.sportNumber(size: 40, color: AppColors.voltNeon),
              )
            else if (kickoff != null)
              MatchCountdown(kickoff: kickoff)
            else
              Text(match.title, style: AppTypography.headline(size: 20, weight: FontWeight.w800)),

            const SizedBox(height: 9),

            // Quién juega contra quién, en una línea.
            if (a != null && b != null)
              Row(
                children: [
                  _MiniKit(jersey: a.jersey),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      a.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(size: 11, color: AppColors.textSecondary),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Text('VS',
                        style: AppTypography.code(size: 9, color: AppColors.textMuted)),
                  ),
                  Flexible(
                    child: Text(
                      b.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(size: 11, color: AppColors.textSecondary),
                    ),
                  ),
                  const SizedBox(width: 6),
                  _MiniKit(jersey: b.jersey),
                ],
              )
            else
              Text(
                match.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.body(size: 11, color: AppColors.textSecondary),
              ),
          ],
        ),
      ),
    );
  }
}

class _MiniKit extends StatelessWidget {
  final JerseyModel? jersey;

  const _MiniKit({required this.jersey});

  @override
  Widget build(BuildContext context) {
    final j = jersey;
    if (j == null) {
      return Icon(Icons.checkroom, size: 17, color: AppColors.textMuted);
    }
    return JerseyWidget(jersey: j, size: 20);
  }
}

/// OVR con su línea de evolución de fondo.
class _OvrTile extends StatelessWidget {
  final int ovr;
  final int trend;
  final List<OvrHistoryEntry> history;

  const _OvrTile({required this.ovr, required this.trend, required this.history});

  @override
  Widget build(BuildContext context) {
    final up = trend > 0;
    return Container(
      padding: const EdgeInsets.fromLTRB(11, 9, 11, 9),
      color: _tileBg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('TU OVR', style: AppTypography.code(size: 8, color: AppColors.textMuted)),
          const SizedBox(height: 3),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text('$ovr', style: AppTypography.sportNumber(size: 30)),
              const SizedBox(width: 6),
              if (trend != 0)
                Text(
                  '${up ? '+' : ''}$trend',
                  style: AppTypography.sportNumber(
                    size: 14,
                    color: up ? AppColors.success : AppColors.destructive,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          // La progresión como línea chica, no como sección aparte: mostrar un
          // gráfico de media pantalla para decir que pasaste de 51 a 53 no se
          // justifica.
          SizedBox(
            height: 22,
            width: double.infinity,
            child: history.length < 2
                ? const SizedBox.shrink()
                : CustomPaint(painter: _Sparkline(history.map((e) => e.newOVR).toList())),
          ),
        ],
      ),
    );
  }
}

class _Sparkline extends CustomPainter {
  final List<int> values;

  _Sparkline(this.values);

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2 || size.isEmpty) return;
    final lo = values.reduce((a, b) => a < b ? a : b).toDouble();
    final hi = values.reduce((a, b) => a > b ? a : b).toDouble();
    final span = (hi - lo).abs() < 0.5 ? 1.0 : hi - lo;

    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = size.width * (i / (values.length - 1));
      final y = size.height - ((values[i] - lo) / span) * size.height;
      i == 0 ? path.moveTo(x, y) : path.lineTo(x, y);
    }

    canvas.drawPath(
      path,
      Paint()
        ..color = AppColors.voltNeon
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.8
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_Sparkline old) => old.values != values;
}

/// Partidos y goles juntos: son la misma pregunta.
class _TotalsTile extends StatelessWidget {
  final int matches;
  final int goals;

  const _TotalsTile({required this.matches, required this.goals});

  @override
  Widget build(BuildContext context) {
    final avg = matches > 0 ? (goals / matches).toStringAsFixed(1) : '0.0';
    return Container(
      padding: const EdgeInsets.fromLTRB(11, 9, 11, 9),
      color: _tileBg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('PARTIDOS', style: AppTypography.code(size: 8, color: AppColors.textMuted)),
          Text('$matches', style: AppTypography.sportNumber(size: 24)),
          const SizedBox(height: 7),
          Text('GOLES', style: AppTypography.code(size: 8, color: AppColors.textMuted)),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text('$goals', style: AppTypography.sportNumber(size: 24)),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  '$avg por partido',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.code(size: 9, color: AppColors.textMuted),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LastResultTile extends StatelessWidget {
  final MatchModel match;

  const _LastResultTile({required this.match});

  @override
  Widget build(BuildContext context) {
    final a = match.teamA!;
    final b = match.teamB!;
    return InkWell(
      onTap: () => context.push('/matches/${match.id}'),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(11, 9, 11, 11),
        color: _tileBg,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('ÚLTIMO RESULTADO',
                    style: AppTypography.code(size: 8, color: AppColors.textMuted)),
                const Spacer(),
                Text(_fmtDate(match.date),
                    style: AppTypography.code(size: 8, color: AppColors.textMuted)),
              ],
            ),
            const SizedBox(height: 5),
            Row(
              children: [
                Flexible(
                  child: Text(
                    a.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.body(size: 12, weight: FontWeight.w600),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Text('${a.score} — ${b.score}',
                      style: AppTypography.sportNumber(size: 20)),
                ),
                Flexible(
                  child: Text(
                    b.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.right,
                    style: AppTypography.body(size: 12, weight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Port de PlayerStatsCard: 4 métricas reales (no hardcodeadas como el
/// dashboard viejo tenía: Partidos/Goles/Asistencias/Rating no eran datos
/// reales). Coinciden exactamente con la web: Partidos Jugados, Goles,
/// Promedio de Goles por partido, y Tendencia de OVR (de ovrHistory).
class _GrupoTab extends ConsumerWidget {
  final String uid;

  const _GrupoTab({required this.uid});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupIdAsync = ref.watch(activeGroupIdStreamProvider(uid));

    return groupIdAsync.when(
      data: (groupId) {
        if (groupId == null) {
          return Container(
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16)),
            child: Column(
              children: [
                Icon(Icons.groups_2_outlined, size: 40, color: AppColors.textMuted),
                const SizedBox(height: 10),
                Text('No hay un grupo activo', style: AppTypography.headline(size: 15)),
                const SizedBox(height: 4),
                Text('Creá un grupo o unite a uno para empezar.', style: AppTypography.body(size: 12, color: AppColors.textMuted), textAlign: TextAlign.center),
                const SizedBox(height: 14),
                ElevatedButton(
                  onPressed: () => context.push('/groups'),
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black),
                  child: const Text('Ir a Grupos'),
                ),
              ],
            ),
          );
        }
        return _GrupoTabBody(groupId: groupId);
      },
      loading: () => const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator())),
      error: (e, _) => Center(child: Text('Error: $e')),
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
      data: (group) {
        if (group == null) return const SizedBox();
        final players = playersAsync.value ?? const <PlayerModel>[];
        final matches = matchesAsync.value ?? const <MatchModel>[];

        final topMvp = ([...players]..sort((a, b) => b.stats.mvpCount.compareTo(a.stats.mvpCount)))
            .where((p) => p.stats.mvpCount > 0)
            .toList();
        final topMvpPlayer = topMvp.isNotEmpty ? topMvp.first : null;

        final totalMatchesCount = matches.where((m) => m.status == 'evaluated' || m.status == 'completed' || m.status == 'active').length;

        final upcoming = matches.where((m) => m.status == 'upcoming').toList()
          ..sort((a, b) => (DateTime.tryParse(a.date) ?? DateTime(9999)).compareTo(DateTime.tryParse(b.date) ?? DateTime(9999)));

        final evaluated = matches.where((m) => m.status == 'evaluated').toList()
          ..sort((a, b) => (DateTime.tryParse(b.date) ?? DateTime(0)).compareTo(DateTime.tryParse(a.date) ?? DateTime(0)));
        final recentEvaluated = evaluated.take(4).toList();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _GroupHeroCard(group: group),
            const SizedBox(height: 20),

            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.card.withValues(alpha: 0.4), borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border.withValues(alpha: 0.4))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Icon(Icons.search, size: 16, color: AppColors.voltNeon),
                    const SizedBox(width: 8),
                    Text('LA LUPA', style: AppTypography.headline(size: 12, weight: FontWeight.w800, color: AppColors.voltNeon)),
                  ]),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _QuickStatBox(
                          icon: Icons.history,
                          label: 'Partidos\nTotales',
                          value: '$totalMatchesCount',
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _MvpBox(player: topMvpPlayer),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            _SectionCard(
              icon: Icons.newspaper_outlined,
              title: 'En Agenda',
              child: upcoming.isEmpty
                  ? Text('No hay partidos próximos.', style: AppTypography.body(size: 12, color: AppColors.textMuted))
                  : Column(
                      children: upcoming
                          .take(5)
                          .map((m) => InkWell(
                                onTap: () => context.push('/matches/${m.id}'),
                                borderRadius: BorderRadius.circular(10),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 8),
                                  child: Row(
                                    children: [
                                      Icon(Icons.calendar_today_outlined, size: 14, color: AppColors.textMuted),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(m.title, style: AppTypography.body(size: 13, weight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                                      ),
                                      Text(_fmtDate(m.date), style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                                    ],
                                  ),
                                ),
                              ))
                          .toList(),
                    ),
            ),
            const SizedBox(height: 20),

            if (recentEvaluated.isNotEmpty)
              _SectionCard(
                icon: Icons.emoji_events_outlined,
                title: 'Últimos Partidos',
                child: GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 0.95),
                  itemCount: recentEvaluated.length,
                  itemBuilder: (context, index) => _EvaluatedMatchCard(match: recentEvaluated[index]),
                ),
              ),
          ],
        );
      },
      loading: () => const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator())),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }
}

class _GroupHeroCard extends StatelessWidget {
  final GroupModel group;

  const _GroupHeroCard({required this.group});

  Future<void> _shareInvite(BuildContext context) async {
    final text = '¡Sumate a nuestro grupo de fútbol "${group.name}" en Pateá! Usá este código para unirte: ${group.inviteCode}';
    final uri = Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}');
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.card, AppColors.cardSurface],
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.5), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.groups_2_outlined, size: 14, color: AppColors.voltNeon),
            const SizedBox(width: 6),
            Text('GRUPO ACTIVO', style: AppTypography.code(size: 10, weight: FontWeight.w800, color: AppColors.voltNeon)),
          ]),
          const SizedBox(height: 8),
          Text(group.name, style: AppTypography.headline(size: 24, weight: FontWeight.w900), maxLines: 2, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: group.inviteCode));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('¡Código copiado!'), backgroundColor: AppColors.success),
                    );
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(8), border: Border.all(color: AppColors.border)),
                    child: Row(
                      children: [
                        Text('CÓDIGO', style: AppTypography.body(size: 10, color: AppColors.textMuted)),
                        const SizedBox(width: 8),
                        Expanded(child: Text(group.inviteCode, style: AppTypography.code(size: 14, weight: FontWeight.w800), overflow: TextOverflow.ellipsis)),
                        Icon(Icons.copy, size: 14, color: AppColors.textMuted),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: () => _shareInvite(context),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF25D366), foregroundColor: Colors.white),
                icon: const Icon(Icons.share, size: 16),
                label: const Text('Invitar'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _QuickStatBox extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _QuickStatBox({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      decoration: BoxDecoration(color: AppColors.cardSurface.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border.withValues(alpha: 0.5))),
      child: Column(
        children: [
          Icon(icon, size: 20, color: AppColors.textMuted),
          const SizedBox(height: 6),
          Text(label, textAlign: TextAlign.center, style: AppTypography.code(size: 9, weight: FontWeight.w800, color: AppColors.textMuted)),
          const SizedBox(height: 4),
          Text(value, style: AppTypography.headline(size: 22, weight: FontWeight.w900, color: AppColors.voltNeon)),
        ],
      ),
    );
  }
}

class _MvpBox extends StatelessWidget {
  final PlayerModel? player;

  const _MvpBox({required this.player});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      decoration: BoxDecoration(
        color: AppColors.cardSurface.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.goldBorder.withValues(alpha: 0.4)),
      ),
      child: Column(
        children: [
          if (player != null)
            CircleAvatar(
              radius: 14,
              backgroundColor: AppColors.goldBorder.withValues(alpha: 0.2),
              backgroundImage: player!.photoUrl != null && player!.photoUrl!.isNotEmpty ? NetworkImage(player!.photoUrl!) : null,
              child: player!.photoUrl == null || player!.photoUrl!.isEmpty ? Text(player!.name.isNotEmpty ? player!.name[0] : '?', style: AppTypography.body(size: 12, weight: FontWeight.w700)) : null,
            )
          else
            Icon(Icons.military_tech_outlined, size: 20, color: AppColors.textMuted),
          const SizedBox(height: 6),
          Text('TOP\nMVP', textAlign: TextAlign.center, style: AppTypography.code(size: 9, weight: FontWeight.w800, color: AppColors.textMuted)),
          const SizedBox(height: 4),
          Text(
            player != null ? player!.name.split(' ').first : '-',
            style: AppTypography.headline(size: 13, weight: FontWeight.w800, color: AppColors.goldBorder),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (player != null) Text('${player!.stats.mvpCount}x', style: AppTypography.body(size: 10, color: AppColors.goldBorder.withValues(alpha: 0.7))),
        ],
      ),
    );
  }
}

class _EvaluatedMatchCard extends StatelessWidget {
  final MatchModel match;

  const _EvaluatedMatchCard({required this.match});

  @override
  Widget build(BuildContext context) {
    final theme = getMatchTypeTheme(match.type);
    final hasTeams = match.teamA != null && match.teamB != null;

    return InkWell(
      onTap: () => context.push('/matches/${match.id}'),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: AppColors.cardSurface.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(12), border: Border.all(color: theme.brandColor.withValues(alpha: 0.3))),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: theme.brandColor)),
                Text('✓ EVALUADO', style: AppTypography.code(size: 8, weight: FontWeight.w800, color: AppColors.success)),
              ],
            ),
            const SizedBox(height: 8),
            if (hasTeams)
              Row(
                children: [
                  Expanded(child: Text(match.teamA!.name, style: AppTypography.body(size: 10, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  Text('${match.teamA!.score}-${match.teamB!.score}', style: AppTypography.body(size: 11, weight: FontWeight.w800)),
                  Expanded(child: Text(match.teamB!.name, textAlign: TextAlign.right, style: AppTypography.body(size: 10, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis)),
                ],
              )
            else
              Text(match.title, style: AppTypography.body(size: 12, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
            const Spacer(),
            Text(_fmtDate(match.date), style: AppTypography.body(size: 9, color: AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------
// Widgets compartidos
// ---------------------------------------------------------------------
/// Bloque de sección: barra de acento, título y contenido apoyado sobre el
/// fondo.
///
/// Antes cada sección era una tarjeta con fondo propio y borde. Apiladas —
/// próximo partido, en vivo, estadísticas, progresión, anteriores— la pantalla
/// terminaba siendo una pila de recuadros grises, todos del mismo peso, sin
/// que ninguno destacara sobre otro.
class _SectionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget child;

  const _SectionCard({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 3,
              height: 15,
              margin: const EdgeInsets.only(top: 1, right: 9),
              color: AppColors.voltNeon,
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title.toUpperCase(),
                    style: AppTypography.headline(
                      size: 13,
                      weight: FontWeight.w900,
                      letterSpacing: 0.4,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: AppTypography.body(size: 11, color: AppColors.textMuted),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        child,
      ],
    );
  }
}

