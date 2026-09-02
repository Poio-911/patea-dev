import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/match_theme.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/models/match_model.dart';
import '../../core/models/player_model.dart';
import '../../core/models/group_model.dart';
import '../../core/widgets/patea_background.dart';
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

const Map<String, String> _statusLabels = {
  'planning': 'A Confirmar',
  'upcoming': 'Próximo',
  'active': 'Activo',
  'completed': 'Finalizado',
  'evaluated': 'Evaluado',
};

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

    return Scaffold(
      body: PateaBackground(
        child: SafeArea(
          child: CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
                sliver: SliverToBoxAdapter(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('PATEÁ', style: AppTypography.headline(size: 11, weight: FontWeight.w900, color: AppColors.voltNeon)),
                          const SizedBox(height: 2),
                          Text(
                            currentUser?.displayName != null ? '¡Hola, ${currentUser!.displayName!.split(' ').first}!' : '¡Bienvenido, Crack!',
                            style: AppTypography.headline(size: 22, weight: FontWeight.w900),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.smart_toy_outlined, color: AppColors.voltNeon),
                            tooltip: 'DT Virtual IA',
                            onPressed: () => context.push('/coach'),
                          ),
                          IconButton(
                            icon: const Icon(Icons.leaderboard_outlined, color: AppColors.textSecondary),
                            tooltip: 'Rankings',
                            onPressed: () => context.push('/leaderboard'),
                          ),
                          IconButton(
                            icon: const Icon(Icons.groups_2_outlined, color: AppColors.textSecondary),
                            tooltip: 'Mis Grupos',
                            onPressed: () => context.push('/groups'),
                          ),
                          IconButton(
                            icon: const Icon(Icons.logout_rounded, color: AppColors.destructive, size: 20),
                            tooltip: 'Cerrar Sesión',
                            onPressed: () async => ref.read(authServiceProvider).signOut(),
                          ),
                        ],
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
    Widget tab(String label, IconData icon, int index) {
      final selected = active == index;
      return Expanded(
        child: InkWell(
          onTap: () => onChanged(index),
          borderRadius: BorderRadius.circular(10),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: selected ? AppColors.background : Colors.transparent,
              borderRadius: BorderRadius.circular(10),
              border: selected ? Border.all(color: AppColors.border.withValues(alpha: 0.5)) : null,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 16, color: selected ? AppColors.textPrimary : AppColors.textMuted),
                const SizedBox(width: 6),
                Text(label, style: AppTypography.body(size: 13, weight: FontWeight.w700, color: selected ? AppColors.textPrimary : AppColors.textMuted)),
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          tab('Mi Resumen', Icons.bar_chart_rounded, 0),
          const SizedBox(width: 6),
          tab('Mi Grupo', Icons.groups_2_outlined, 1),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------
// Tab 1: Mi Resumen (ResumenTab)
// ---------------------------------------------------------------------
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
      data: (matches) {
        final now = DateTime.now();
        final upcoming = matches.where((m) {
          if (m.status == 'active') return true;
          if (m.status != 'upcoming') return false;
          final dt = _matchDateTime(m);
          return dt != null && !dt.isBefore(now);
        }).toList()
          ..sort((a, b) => (_matchDateTime(a) ?? DateTime(9999)).compareTo(_matchDateTime(b) ?? DateTime(9999)));
        final nextMatch = upcoming.isNotEmpty ? upcoming.first : null;

        final liveMatches = matches.where((m) => m.status == 'active').toList();

        final recentMatches = matches.where((m) => m.status != 'upcoming').toList()
          ..sort((a, b) => (DateTime.tryParse(b.date) ?? DateTime(0)).compareTo(DateTime.tryParse(a.date) ?? DateTime(0)));
        final lastTwo = recentMatches.take(2).toList();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (nextMatch != null) ...[
              Row(children: [
                Icon(Icons.calendar_today, size: 15, color: AppColors.voltNeon),
                const SizedBox(width: 8),
                Text('PRÓXIMO PARTIDO', style: AppTypography.headline(size: 12, weight: FontWeight.w800, color: AppColors.textSecondary)),
              ]),
              const SizedBox(height: 10),
              _NextMatchCard(match: nextMatch),
              const SizedBox(height: 22),
            ],

            _SectionCard(
              icon: Icons.play_circle_outline,
              title: 'Partidos en Vivo',
              subtitle: 'Partidos de tu grupo que están en curso.',
              child: liveMatches.isEmpty
                  ? Text('No hay partidos en vivo ahora.', style: AppTypography.body(size: 12, color: AppColors.textMuted))
                  : Column(
                      children: liveMatches
                          .map((m) => Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: _LiveMatchRow(match: m),
                              ))
                          .toList(),
                    ),
            ),
            const SizedBox(height: 22),

            playerAsync.when(
              data: (player) {
                if (player == null) return const SizedBox();
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(children: [
                      Icon(Icons.star, size: 15, color: AppColors.voltNeon),
                      const SizedBox(width: 8),
                      Text('MIS ESTADÍSTICAS', style: AppTypography.headline(size: 12, weight: FontWeight.w800, color: AppColors.textSecondary)),
                    ]),
                    const SizedBox(height: 10),
                    ovrHistoryAsync.when(
                      data: (history) => _PlayerStatsGrid(player: player, ovrHistory: history),
                      loading: () => _PlayerStatsGrid(player: player, ovrHistory: const []),
                      error: (e, _) => _PlayerStatsGrid(player: player, ovrHistory: const []),
                    ),
                    const SizedBox(height: 22),
                    ovrHistoryAsync.when(
                      data: (history) => _OvrProgressionChart(player: player, history: history),
                      loading: () => const SizedBox(height: 200, child: Center(child: CircularProgressIndicator())),
                      error: (e, _) => const SizedBox(),
                    ),
                    const SizedBox(height: 22),
                  ],
                );
              },
              loading: () => const SizedBox(),
              error: (e, _) => const SizedBox(),
            ),

            _SectionCard(
              icon: Icons.history,
              title: 'Partidos Anteriores',
              child: lastTwo.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Text('Aún no hay partidos jugados en este grupo.', style: AppTypography.body(size: 12, color: AppColors.textMuted)),
                      ),
                    )
                  : Column(
                      children: lastTwo
                          .map((m) => InkWell(
                                onTap: () => context.push('/matches/${m.id}'),
                                borderRadius: BorderRadius.circular(10),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(m.title, style: AppTypography.body(size: 14, weight: FontWeight.w700)),
                                            Text(_fmtDate(m.date), style: AppTypography.body(size: 12, color: AppColors.textMuted)),
                                          ],
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(color: AppColors.cardSurface, borderRadius: BorderRadius.circular(20)),
                                        child: Text(_statusLabels[m.status] ?? m.status, style: AppTypography.code(size: 10, weight: FontWeight.w700)),
                                      ),
                                    ],
                                  ),
                                ),
                              ))
                          .toList(),
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

class _NextMatchCard extends StatelessWidget {
  final MatchModel match;

  const _NextMatchCard({required this.match});

  @override
  Widget build(BuildContext context) {
    final theme = getMatchTypeTheme(match.type);
    final isLive = match.status == 'active';
    final hasTeams = match.teamA != null && match.teamB != null;

    return InkWell(
      onTap: () => context.push('/matches/${match.id}'),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isLive ? AppColors.destructive : theme.brandColor.withValues(alpha: 0.5), width: 1.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: (isLive ? AppColors.destructive : theme.brandColor).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: isLive ? AppColors.destructive : theme.brandColor),
                  ),
                  child: Text(
                    isLive ? 'EN VIVO • MINUTO ${match.currentMinute ?? 1}\'' : 'PRÓXIMO PARTIDO',
                    style: AppTypography.headline(size: 10, weight: FontWeight.w800, color: isLive ? AppColors.destructive : theme.brandColor),
                  ),
                ),
                Text(_fmtDate(match.date), style: AppTypography.code(size: 11, color: AppColors.textSecondary)),
              ],
            ),
            const SizedBox(height: 14),
            Text(match.title, style: AppTypography.headline(size: 18, weight: FontWeight.w800)),
            if (match.location != null) ...[
              const SizedBox(height: 4),
              Row(children: [
                Icon(Icons.location_on_outlined, size: 14, color: AppColors.textMuted),
                const SizedBox(width: 4),
                Expanded(child: Text(match.location!, style: AppTypography.body(size: 12, color: AppColors.textMuted), maxLines: 1, overflow: TextOverflow.ellipsis)),
              ]),
            ],
            const SizedBox(height: 16),
            if (hasTeams)
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: AppColors.cardSurface.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(14)),
                child: Row(
                  children: [
                    if (match.teamA!.jersey != null) JerseyWidget(jersey: match.teamA!.jersey!, size: 36),
                    Expanded(child: Text(match.teamA!.name, style: AppTypography.headline(size: 14, weight: FontWeight.w700), textAlign: TextAlign.center)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
                      child: Text('${match.teamA!.score} : ${match.teamB!.score}', style: AppTypography.sportNumber(size: 18, color: isLive ? AppColors.destructive : AppColors.voltNeon)),
                    ),
                    Expanded(child: Text(match.teamB!.name, style: AppTypography.headline(size: 14, weight: FontWeight.w700), textAlign: TextAlign.center)),
                    if (match.teamB!.jersey != null) JerseyWidget(jersey: match.teamB!.jersey!, size: 36),
                  ],
                ),
              )
            else
              Row(children: [
                Icon(Icons.groups_outlined, size: 18, color: AppColors.textMuted),
                const SizedBox(width: 6),
                Text('${match.playerUids.length}${match.matchSize > 0 ? ' / ${match.matchSize}' : ''} jugadores', style: AppTypography.body(size: 13, color: AppColors.textSecondary)),
              ]),
          ],
        ),
      ),
    );
  }
}

class _LiveMatchRow extends StatelessWidget {
  final MatchModel match;

  const _LiveMatchRow({required this.match});

  @override
  Widget build(BuildContext context) {
    final isHalfTime = match.liveStatus == 'half_time';
    return InkWell(
      onTap: () => context.push('/matches/${match.id}/live'),
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: AppColors.cardSurface.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(10)),
        child: Row(
          children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: isHalfTime ? AppColors.warning : AppColors.success)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(match.title, style: AppTypography.body(size: 13, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (match.teamA != null && match.teamB != null)
                    Text('${match.teamA!.name} vs ${match.teamB!.name}', style: AppTypography.body(size: 11, color: AppColors.textMuted), maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: (isHalfTime ? AppColors.warning : AppColors.success).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(20)),
              child: Text(isHalfTime ? 'ET' : 'Vivo', style: AppTypography.code(size: 10, weight: FontWeight.w700, color: isHalfTime ? AppColors.warning : AppColors.success)),
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
class _PlayerStatsGrid extends StatelessWidget {
  final PlayerModel player;
  final List<OvrHistoryEntry> ovrHistory;

  const _PlayerStatsGrid({required this.player, required this.ovrHistory});

  @override
  Widget build(BuildContext context) {
    final totalMatches = player.stats.matchesPlayed;
    final totalGoals = player.stats.goals;
    final avgGoals = totalMatches > 0 ? (totalGoals / totalMatches).toStringAsFixed(1) : '0.0';
    int ovrTrend = 0;
    if (ovrHistory.isNotEmpty) {
      ovrTrend = ovrHistory.last.newOVR - ovrHistory.first.oldOVR;
    }

    return Row(
      children: [
        _StatCard(label: 'PARTIDOS', value: '$totalMatches', icon: Icons.calendar_today_outlined, color: AppColors.info),
        const SizedBox(width: 8),
        _StatCard(label: 'GOLES', value: '$totalGoals', icon: Icons.adjust, color: AppColors.warning),
        const SizedBox(width: 8),
        _StatCard(label: 'PROM. GOLES', value: avgGoals, icon: Icons.emoji_events_outlined, color: AppColors.success),
        const SizedBox(width: 8),
        _StatCard(
          label: 'TEND. OVR',
          value: ovrTrend > 0 ? '+$ovrTrend' : '$ovrTrend',
          icon: Icons.trending_up,
          color: ovrTrend >= 0 ? AppColors.success : AppColors.destructive,
        ),
      ],
    );
  }
}

class _OvrProgressionChart extends StatelessWidget {
  final PlayerModel player;
  final List<OvrHistoryEntry> history;

  const _OvrProgressionChart({required this.player, required this.history});

  @override
  Widget build(BuildContext context) {
    if (history.isEmpty) {
      return _SectionCard(
        icon: Icons.trending_up,
        title: 'Progresión de OVR',
        subtitle: 'Tu evolución a lo largo de los partidos evaluados.',
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Text(
              'Aún no tenés partidos evaluados. ¡Jugá y evaluá tus partidos para ver tu progresión!',
              style: AppTypography.body(size: 12, color: AppColors.textMuted),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    final ovrs = history.map((e) => e.newOVR).toList();
    final change = ovrs.last - ovrs.first;
    final highest = [...ovrs, player.ovr].reduce((a, b) => a > b ? a : b);
    final lowest = [...ovrs, player.ovr].reduce((a, b) => a < b ? a : b);

    return _SectionCard(
      icon: Icons.trending_up,
      title: 'Progresión de OVR',
      subtitle: 'Tu evolución a lo largo de los partidos evaluados.',
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _MiniStat(label: 'Cambio', value: change > 0 ? '+$change' : '$change'),
              _MiniStat(label: 'Máximo', value: '$highest'),
              _MiniStat(label: 'Mínimo', value: '$lowest'),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 200,
            child: LineChart(
              LineChartData(
                gridData: const FlGridData(show: true, drawVerticalLine: false),
                titlesData: const FlTitlesData(
                  topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 32)),
                ),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: [for (var i = 0; i < ovrs.length; i++) FlSpot(i.toDouble(), ovrs[i].toDouble())],
                    isCurved: true,
                    color: AppColors.voltNeon,
                    barWidth: 3,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(show: true, color: AppColors.voltNeon.withValues(alpha: 0.15)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;

  const _MiniStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: AppTypography.body(size: 11, color: AppColors.textMuted)),
        Text(value, style: AppTypography.headline(size: 20, weight: FontWeight.w800)),
      ],
    );
  }
}

// ---------------------------------------------------------------------
// Tab 2: Mi Grupo (GrupoTab)
// ---------------------------------------------------------------------
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
class _SectionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget child;

  const _SectionCard({required this.icon, required this.title, this.subtitle, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.card.withValues(alpha: 0.4), borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border.withValues(alpha: 0.4))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 18, color: AppColors.voltNeon),
            const SizedBox(width: 8),
            Text(title, style: AppTypography.headline(size: 15)),
          ]),
          if (subtitle != null) ...[
            const SizedBox(height: 2),
            Text(subtitle!, style: AppTypography.body(size: 11, color: AppColors.textMuted)),
          ],
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? color;

  const _StatCard({required this.label, required this.value, required this.icon, this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border.withValues(alpha: 0.5))),
        child: Column(
          children: [
            Icon(icon, size: 16, color: color ?? AppColors.textSecondary),
            const SizedBox(height: 4),
            Text(value, style: AppTypography.sportNumber(size: 18, color: color ?? AppColors.textPrimary)),
            const SizedBox(height: 2),
            Text(label, style: AppTypography.code(size: 8, weight: FontWeight.w700, color: AppColors.textMuted), maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}
