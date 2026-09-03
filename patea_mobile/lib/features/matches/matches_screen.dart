import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/match_theme.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/match_service.dart';
import '../../core/services/auth_service.dart';
import '../../core/models/match_model.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/parallax_background.dart';
import '../../core/widgets/patea_page_header.dart';

const _spanishMonths = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const _spanishWeekdays = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/// [includeTime]: la web solo muestra la hora dentro de la fecha cuando NO
/// hay un campo 'time' separado (algunos partidos viejos guardan todo en un
/// único datetime ISO). Si ya mostramos "Hora" aparte, no la repetimos acá.
String _formatMatchDate(String raw, {bool includeTime = false}) {
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) return raw; // ya viene formateado (ej. "19 de Abril")
  final local = parsed.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = _spanishMonths[local.month - 1];
  if (!includeTime) return '$day $month';
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$day $month, $hour:$minute';
}

String _formatLongDate(DateTime d) {
  final weekday = _spanishWeekdays[d.weekday - 1];
  return '$weekday, ${d.day} de ${_fullMonth(d.month)}';
}

const _spanishFullMonths = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
String _fullMonth(int month) => _spanishFullMonths[month - 1];

// Port de matchStatusConfig (src/lib/match-status-config.ts).
const Map<String, String> _statusLabels = {
  'planning': 'A Confirmar',
  'upcoming': 'Próximo',
  'active': 'Activo',
  'completed': 'Finalizado',
  'evaluated': 'Evaluado',
};

String _actionLabel(String status) {
  switch (status) {
    case 'active':
      return 'Ver En Vivo ⚡';
    case 'evaluated':
      return 'Ver Resultado';
    case 'completed':
      return 'Ver Resumen';
    case 'planning':
      return 'Ver y Confirmar';
    default:
      return 'Ver Detalles';
  }
}

// Port de amistososTypes en src/components/matches/match-filters.tsx —
// solo estos 4 tipos se muestran en /matches (ligas/copas viven en /competitions).
const _amistosoTypes = ['manual', 'collaborative', 'by_teams', 'intergroup_friendly'];
const _competitionTypes = {'league', 'cup', 'league_final'};

const Map<String, String> _amistosoTypeLabels = {
  'manual': 'Manual',
  'collaborative': 'Colaborativo',
  'by_teams': 'Por Equipos',
  'intergroup_friendly': 'Inter-grupos',
};

const Map<String, String> _statusFilterLabels = {
  'planning': 'A Confirmar',
  'upcoming': 'Próximo',
  'active': 'Activo',
  'completed': 'Finalizado',
  'evaluated': 'Evaluado',
};

DateTime? _matchDay(MatchModel m) {
  final d = DateTime.tryParse(m.date);
  if (d == null) return null;
  final local = d.toLocal();
  return DateTime(local.year, local.month, local.day);
}

/// Port de getTs() en next-match-card.tsx / page.tsx: combina la fecha con
/// el campo 'time' (ej. "21:00" o "21:00 hs") para saber si el partido ya pasó.
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

enum TimeFilter { upcoming, thisWeek, history }

class MatchFiltersState {
  final Set<String> types;
  final Set<String> statuses;
  final bool onlyMine;

  const MatchFiltersState({
    this.types = const {},
    this.statuses = const {},
    this.onlyMine = false,
  });

  MatchFiltersState copyWith({Set<String>? types, Set<String>? statuses, bool? onlyMine}) {
    return MatchFiltersState(
      types: types ?? this.types,
      statuses: statuses ?? this.statuses,
      onlyMine: onlyMine ?? this.onlyMine,
    );
  }

  int get activeCount => types.length + statuses.length + (onlyMine ? 1 : 0);
}

enum MatchViewMode { grid, compact }

class MatchesScreen extends ConsumerStatefulWidget {
  const MatchesScreen({super.key});

  @override
  ConsumerState<MatchesScreen> createState() => _MatchesScreenState();
}

class _MatchesScreenState extends ConsumerState<MatchesScreen> {
  TimeFilter _timeFilter = TimeFilter.upcoming;
  MatchFiltersState _filters = const MatchFiltersState();
  MatchViewMode _viewMode = MatchViewMode.grid;
  bool _hasCheckedPending = false;

  void _maybeShowPendingDialog(List<MatchModel> pending) {
    if (pending.isEmpty || _hasCheckedPending) return;
    _hasCheckedPending = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _showPendingFinalizationDialog(pending);
    });
  }

  Future<void> _showPendingFinalizationDialog(List<MatchModel> pending) async {
    bool isLoading = false;
    await showDialog<void>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: AppColors.card,
              title: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: AppColors.warning, size: 22),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('Tenés partidos sin finalizar', style: AppTypography.headline(size: 16)),
                  ),
                ],
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      pending.length == 1
                          ? 'Tenés un partido que ya pasó y no fue finalizado. Podés finalizarlo ahora o ver los detalles.'
                          : 'Tenés ${pending.length} partidos que ya pasaron y no fueron finalizados. Podés finalizarlos ahora o ver los detalles de cada uno.',
                      style: AppTypography.body(size: 13, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 12),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 260),
                      child: ListView.separated(
                        shrinkWrap: true,
                        itemCount: pending.length,
                        separatorBuilder: (_, index) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final match = pending[index];
                          return Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.cardSurface,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(match.title, style: AppTypography.body(size: 13, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
                                      const SizedBox(height: 3),
                                      Text(
                                        '${_formatMatchDate(match.date)} · ${match.time ?? ''} hs',
                                        style: AppTypography.body(size: 11, color: AppColors.textMuted),
                                      ),
                                    ],
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.visibility_outlined, size: 18),
                                  onPressed: () {
                                    Navigator.pop(context);
                                    context.push('/matches/${match.id}');
                                  },
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isLoading ? null : () => Navigator.pop(context),
                  child: const Text('Después'),
                ),
                ElevatedButton.icon(
                  onPressed: isLoading
                      ? null
                      : () async {
                          setDialogState(() => isLoading = true);
                          try {
                            await ref.read(matchServiceProvider).finalizePendingMatches(pending.map((m) => m.id).toList());
                          } finally {
                            if (context.mounted) Navigator.pop(context);
                          }
                        },
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black),
                  icon: isLoading
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                      : const Icon(Icons.check_circle_outline, size: 18),
                  label: Text(pending.length == 1 ? 'Finalizar Partido' : 'Finalizar ${pending.length} Partidos'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _openFiltersSheet() async {
    final result = await showModalBottomSheet<MatchFiltersState>(
      context: context,
      backgroundColor: AppColors.card,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => _MatchFiltersSheet(initial: _filters),
    );
    if (result != null) {
      setState(() => _filters = result);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Partidos del grupo activo, acotados y ordenados en el servidor.
    final matchesAsync = ref.watch(activeGroupMatchesProvider);
    final uid = ref.watch(authStateProvider).valueOrNull?.uid;

    // Sin `Scaffold.appBar` ni FAB flotante a propósito — igual que en
    // players_list_screen.dart: la web real (`src/app/matches/page.tsx`)
    // pone "Armar Partido" como contenido normal debajo del título dentro
    // de `PageHeader`, no como acción flotante fija.
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: matchesAsync.when(
        data: (allMatches) {
          final now = DateTime.now();
          final today = DateTime(now.year, now.month, now.day);
          final weekEnd = today.add(const Duration(days: 7));

          final amistosos = allMatches.where((m) => _amistosoTypes.contains(m.type)).toList();

          final pending = uid == null
              ? <MatchModel>[]
              : allMatches.where((m) {
                  if (m.ownerUid != uid || m.status != 'upcoming') return false;
                  if (_competitionTypes.contains(m.type)) return false;
                  final day = _matchDay(m);
                  return day != null && day.isBefore(today);
                }).toList();
          _maybeShowPendingDialog(pending);

          final bannerMatches = allMatches.where((m) {
            if (m.status == 'active') return true;
            if (m.status != 'upcoming') return false;
            final dt = _matchDateTime(m);
            return dt != null && !dt.isBefore(now);
          }).toList()
            ..sort((a, b) => (DateTime.tryParse(a.date) ?? DateTime(0)).compareTo(DateTime.tryParse(b.date) ?? DateTime(0)));

          final counts = <TimeFilter, int>{
            TimeFilter.upcoming: amistosos.where((m) {
              if (m.status == 'planning') return true;
              final day = _matchDay(m);
              return (day != null && !day.isBefore(today)) || m.status == 'active';
            }).length,
            TimeFilter.thisWeek: amistosos.where((m) {
              final day = _matchDay(m);
              return day != null && !day.isBefore(today) && day.isBefore(weekEnd);
            }).length,
            TimeFilter.history: amistosos.where((m) {
              final day = _matchDay(m);
              return day != null && day.isBefore(today) && (m.status == 'completed' || m.status == 'evaluated');
            }).length,
          };

          var filtered = amistosos.where((m) {
            if (_filters.types.isNotEmpty && !_filters.types.contains(m.type)) return false;
            if (_filters.statuses.isNotEmpty && !_filters.statuses.contains(m.status)) return false;
            if (_filters.onlyMine && m.ownerUid != uid) return false;
            return true;
          }).toList();

          switch (_timeFilter) {
            case TimeFilter.upcoming:
              filtered = filtered.where((m) {
                if (m.status == 'planning') return true;
                final day = _matchDay(m);
                return (day != null && !day.isBefore(today)) || m.status == 'active';
              }).toList();
            case TimeFilter.thisWeek:
              filtered = filtered.where((m) {
                final day = _matchDay(m);
                return day != null && !day.isBefore(today) && day.isBefore(weekEnd);
              }).toList();
            case TimeFilter.history:
              filtered = filtered.where((m) {
                final day = _matchDay(m);
                return day != null && day.isBefore(today) && (m.status == 'completed' || m.status == 'evaluated');
              }).toList();
          }

          filtered.sort((a, b) {
            final da = DateTime.tryParse(a.date) ?? DateTime(0);
            final db = DateTime.tryParse(b.date) ?? DateTime(0);
            return _timeFilter == TimeFilter.history ? db.compareTo(da) : da.compareTo(db);
          });

          return CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              // 0. Header real (título + descripción + "Armar Partido"
              // debajo). Medido en vivo con uiautomator (no a ojo): el body
              // ya arranca justo debajo del alto propio del header (60dp) —
              // solo falta compensar el status bar, no los 60dp de nuevo.
              SliverPadding(
                padding: EdgeInsets.fromLTRB(16, MediaQuery.of(context).padding.top + 12, 16, 0),
                sliver: SliverToBoxAdapter(
                  child: PateaPageHeader(
                    title: 'Partidos',
                    description: 'Organizá y gestioná todos tus partidos.',
                    showCountRow: false,
                    actionButton: SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () => context.push('/matches/create'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.voltNeon,
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        icon: const Icon(Icons.add_circle, size: 18),
                        label: Text(
                          'Armar Partido',
                          style: AppTypography.headline(size: 13, weight: FontWeight.w700, color: Colors.black),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              if (allMatches.isNotEmpty && _timeFilter != TimeFilter.history)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                    child: _NextMatchBanner(matches: bannerMatches),
                  ),
                ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: _QuickTimeFilterTabs(
                    active: _timeFilter,
                    counts: counts,
                    onChanged: (f) => setState(() => _timeFilter = f),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      OutlinedButton.icon(
                        onPressed: _openFiltersSheet,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.textPrimary,
                          side: BorderSide(color: AppColors.border),
                        ),
                        icon: const Icon(Icons.filter_list, size: 16),
                        label: Text(_filters.activeCount > 0 ? 'Filtros (${_filters.activeCount})' : 'Filtros'),
                      ),
                      const Spacer(),
                      _ViewModeToggle(
                        mode: _viewMode,
                        onChanged: (mode) => setState(() => _viewMode = mode),
                      ),
                    ],
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 12)),
              if (filtered.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Text(
                      'No hay partidos en esta vista',
                      style: AppTypography.body(color: AppColors.textMuted),
                    ),
                  ),
                )
              else if (_viewMode == MatchViewMode.grid)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  sliver: SliverList.separated(
                    itemCount: filtered.length,
                    separatorBuilder: (_, index) => const SizedBox(height: 14),
                    itemBuilder: (context, index) {
                      return _MatchCard(match: filtered[index])
                          .animate(delay: (index * 50).ms)
                          .fadeIn(duration: 300.ms)
                          .slideY(begin: 0.05, end: 0, duration: 300.ms);
                    },
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 0.72,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        return _CompactMatchCard(match: filtered[index])
                            .animate(delay: (index * 50).ms)
                            .fadeIn(duration: 300.ms)
                            .slideY(begin: 0.05, end: 0, duration: 300.ms);
                      },
                      childCount: filtered.length,
                    ),
                  ),
                ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Error: $err')),
      ),
    );
  }
}

/// Port de QuickTimeFilter (src/components/matches/quick-time-filter.tsx).
class _QuickTimeFilterTabs extends StatelessWidget {
  final TimeFilter active;
  final Map<TimeFilter, int> counts;
  final ValueChanged<TimeFilter> onChanged;

  const _QuickTimeFilterTabs({required this.active, required this.counts, required this.onChanged});

  static const _labels = {
    TimeFilter.upcoming: 'Próximos',
    TimeFilter.thisWeek: 'Semana',
    TimeFilter.history: 'Historial',
  };

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: _labels.entries.map((entry) {
            final isActive = entry.key == active;
            final count = counts[entry.key] ?? 0;
            return Padding(
              padding: const EdgeInsets.only(right: 4),
              child: InkWell(
                onTap: () => onChanged(entry.key),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: isActive ? AppColors.voltNeon : Colors.transparent, width: 2),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        entry.value,
                        style: AppTypography.body(
                          size: 14,
                          weight: FontWeight.w700,
                          color: isActive ? AppColors.voltNeon : AppColors.textMuted,
                        ),
                      ),
                      if (count > 0) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: isActive ? AppColors.voltNeon : AppColors.cardSurface,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            '$count',
                            style: AppTypography.body(
                              size: 10,
                              weight: FontWeight.w700,
                              color: isActive ? Colors.black : AppColors.textMuted,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
        Container(height: 1, color: AppColors.border.withValues(alpha: 0.3)),
      ],
    );
  }
}

/// Port de ViewModeToggle (src/components/matches/view-mode-toggle.tsx).
class _ViewModeToggle extends StatelessWidget {
  final MatchViewMode mode;
  final ValueChanged<MatchViewMode> onChanged;

  const _ViewModeToggle({required this.mode, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    Widget button(IconData icon, MatchViewMode value) {
      final selected = mode == value;
      return InkWell(
        borderRadius: BorderRadius.circular(6),
        onTap: () => onChanged(value),
        child: Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: selected ? AppColors.voltNeon : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Icon(icon, size: 16, color: selected ? Colors.black : AppColors.textMuted),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.cardSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          button(Icons.grid_view_rounded, MatchViewMode.grid),
          const SizedBox(width: 2),
          button(Icons.view_list_rounded, MatchViewMode.compact),
        ],
      ),
    );
  }
}

/// Port de MatchFilters (src/components/matches/match-filters.tsx), como
/// bottom sheet en vez de Popover. Estado local (sin persistencia en
/// Firestore, a diferencia de la web que llama updateUserPreferencesAction).
class _MatchFiltersSheet extends StatefulWidget {
  final MatchFiltersState initial;

  const _MatchFiltersSheet({required this.initial});

  @override
  State<_MatchFiltersSheet> createState() => _MatchFiltersSheetState();
}

class _MatchFiltersSheetState extends State<_MatchFiltersSheet> {
  late Set<String> _types = {...widget.initial.types};
  late Set<String> _statuses = {...widget.initial.statuses};
  late bool _onlyMine = widget.initial.onlyMine;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 20, right: 20, top: 20,
          bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Filtros', style: AppTypography.headline(size: 16)),
                const Spacer(),
                TextButton(
                  onPressed: () => setState(() {
                    _types = {};
                    _statuses = {};
                    _onlyMine = false;
                  }),
                  child: const Text('Limpiar'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text('Por tipo', style: AppTypography.body(size: 12, weight: FontWeight.w700, color: AppColors.textMuted)),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: _amistosoTypeLabels.entries.map((entry) {
                final selected = _types.contains(entry.key);
                return FilterChip(
                  label: Text(entry.value),
                  selected: selected,
                  onSelected: (v) => setState(() => v ? _types.add(entry.key) : _types.remove(entry.key)),
                  selectedColor: AppColors.voltNeon.withValues(alpha: 0.25),
                  checkmarkColor: AppColors.voltNeon,
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
            Text('Por estado', style: AppTypography.body(size: 12, weight: FontWeight.w700, color: AppColors.textMuted)),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: _statusFilterLabels.entries.map((entry) {
                final selected = _statuses.contains(entry.key);
                return FilterChip(
                  label: Text(entry.value),
                  selected: selected,
                  onSelected: (v) => setState(() => v ? _statuses.add(entry.key) : _statuses.remove(entry.key)),
                  selectedColor: AppColors.voltNeon.withValues(alpha: 0.25),
                  checkmarkColor: AppColors.voltNeon,
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
            Container(height: 1, color: AppColors.border.withValues(alpha: 0.3)),
            const SizedBox(height: 8),
            Row(
              children: [
                Text('Solo mis partidos', style: AppTypography.body(size: 13, weight: FontWeight.w600)),
                const Spacer(),
                Switch(
                  value: _onlyMine,
                  activeThumbColor: AppColors.voltNeon,
                  onChanged: (v) => setState(() => _onlyMine = v),
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(
                  context,
                  MatchFiltersState(types: _types, statuses: _statuses, onlyMine: _onlyMine),
                ),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black),
                child: const Text('Aplicar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Port de NextMatchCard (src/components/next-match-card.tsx): carrusel del
/// próximo partido, con auto-avance cada 8s. A color completo (no grayscale,
/// a diferencia de la card normal/compacta).
class _NextMatchBanner extends StatefulWidget {
  final List<MatchModel> matches;

  const _NextMatchBanner({required this.matches});

  @override
  State<_NextMatchBanner> createState() => _NextMatchBannerState();
}

class _NextMatchBannerState extends State<_NextMatchBanner> {
  int _index = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _scheduleAutoAdvance();
  }

  @override
  void didUpdateWidget(covariant _NextMatchBanner oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_index >= widget.matches.length) _index = 0;
    _scheduleAutoAdvance();
  }

  void _scheduleAutoAdvance() {
    _timer?.cancel();
    if (widget.matches.length <= 1) return;
    _timer = Timer.periodic(const Duration(seconds: 8), (_) {
      if (!mounted) return;
      setState(() => _index = (_index + 1) % widget.matches.length);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  static int _photoIndexFor(String id) {
    final sum = id.codeUnits.fold<int>(0, (acc, c) => acc + c);
    return (sum.abs() % 9) + 1;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.matches.isEmpty) {
      return Container(
        height: 200,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.4), style: BorderStyle.solid),
          color: AppColors.card.withValues(alpha: 0.3),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.calendar_today_outlined, size: 40, color: AppColors.textMuted.withValues(alpha: 0.6)),
            const SizedBox(height: 10),
            Text('No hay fútbol a la vista', style: AppTypography.headline(size: 15)),
            const SizedBox(height: 6),
            Text(
              'Armá un nuevo partido para que empiece a rodar la pelota.',
              textAlign: TextAlign.center,
              style: AppTypography.body(size: 12, color: AppColors.textMuted),
            ),
          ],
        ),
      );
    }

    final match = widget.matches[_index];
    final theme = getMatchTypeTheme(match.type);
    final photoIndex = _photoIndexFor(match.id);
    final hasTeams = match.type == 'by_teams' && match.teamA != null && match.teamB != null;
    final dateObj = DateTime.tryParse(match.date)?.toLocal();

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        height: 320,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: theme.brandColor.withValues(alpha: 0.5), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.4),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 600),
              layoutBuilder: (currentChild, previousChildren) => Stack(
                fit: StackFit.expand,
                children: [
                  ...previousChildren,
                  if (currentChild != null) currentChild,
                ],
              ),
              child: SizedBox.expand(
                key: ValueKey(match.id),
                child: Image.asset(
                  'assets/backgrounds/fondo_$photoIndex.jpg',
                  fit: BoxFit.cover,
                  width: double.infinity,
                  height: double.infinity,
                ),
              ),
            ),
            Container(color: Colors.black.withValues(alpha: 0.45)),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.95),
                    Colors.black.withValues(alpha: 0.35),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
            Container(color: theme.brandColor.withValues(alpha: 0.12)),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.6),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: theme.brandColor)),
                            const SizedBox(width: 6),
                            Text(theme.label.toUpperCase(), style: AppTypography.code(size: 9, weight: FontWeight.w800, color: Colors.white)),
                          ],
                        ),
                      ),
                      const Spacer(),
                      _BannerOrganizerBadge(ownerUid: match.ownerUid),
                    ],
                  ),
                  Expanded(
                    child: Center(
                      child: hasTeams
                          ? Row(
                              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                              children: [
                                Expanded(child: _BannerTeam(team: match.teamA!)),
                                Text('VS', style: AppTypography.headline(size: 22, weight: FontWeight.w900, color: Colors.white.withValues(alpha: 0.15))),
                                Expanded(child: _BannerTeam(team: match.teamB!)),
                              ],
                            )
                          : Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              child: Text(
                                match.title.toUpperCase(),
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.headline(size: 24, weight: FontWeight.w900, color: Colors.white),
                              ),
                            ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.only(top: 8),
                    decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.1)))),
                    child: Wrap(
                      spacing: 16,
                      runSpacing: 4,
                      children: [
                        if (dateObj != null) _BannerInfoRow(icon: Icons.calendar_today, text: _formatLongDate(dateObj)),
                        if (match.time != null) _BannerInfoRow(icon: Icons.access_time, text: '${match.time} hs'),
                        if (match.location != null) _BannerInfoRow(icon: Icons.navigation_outlined, text: match.location!),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Center(
                    child: ElevatedButton.icon(
                      onPressed: () => context.push('/matches/${match.id}'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.voltNeon,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      icon: const Text('Ver Detalles'),
                      label: const Icon(Icons.arrow_forward, size: 16),
                    ),
                  ),
                  if (widget.matches.length > 1) ...[
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(widget.matches.length, (i) {
                        final active = i == _index;
                        return AnimatedContainer(
                          duration: const Duration(milliseconds: 250),
                          margin: const EdgeInsets.symmetric(horizontal: 2),
                          width: active ? 20 : 6,
                          height: 4,
                          decoration: BoxDecoration(
                            color: active ? Colors.white : Colors.white.withValues(alpha: 0.4),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        );
                      }),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BannerInfoRow extends StatelessWidget {
  final IconData icon;
  final String text;

  const _BannerInfoRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 180),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: Colors.white.withValues(alpha: 0.7)),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.body(size: 11, weight: FontWeight.w600, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}

class _BannerTeam extends StatelessWidget {
  final MatchTeam team;

  const _BannerTeam({required this.team});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (team.jersey != null)
          JerseyWidget(jersey: team.jersey!, size: 56)
        else
          const Icon(Icons.checkroom, size: 48, color: Colors.white70),
        const SizedBox(height: 6),
        Text(
          team.name.toUpperCase(),
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.headline(size: 12, weight: FontWeight.w800, color: Colors.white),
        ),
      ],
    );
  }
}

class _BannerOrganizerBadge extends StatelessWidget {
  final String? ownerUid;

  const _BannerOrganizerBadge({required this.ownerUid});

  @override
  Widget build(BuildContext context) {
    if (ownerUid == null) return const SizedBox.shrink();
    return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      future: FirebaseFirestore.instance.collection('users').doc(ownerUid).get(),
      builder: (context, snapshot) {
        final name = snapshot.data?.data()?['displayName'] as String? ?? 'Club';
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
          ),
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(text: 'Organiza: ', style: AppTypography.body(size: 9, weight: FontWeight.w700, color: Colors.white)),
                TextSpan(text: name.toUpperCase(), style: AppTypography.body(size: 9, weight: FontWeight.w800, color: AppColors.voltNeon)),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _MatchCard extends StatefulWidget {
  final MatchModel match;

  const _MatchCard({required this.match});

  @override
  State<_MatchCard> createState() => _MatchCardState();
}

class _MatchCardState extends State<_MatchCard> with SingleTickerProviderStateMixin {
  /// Late sólo si el partido está en curso. Un partido en vivo tiene que
  /// sentirse vivo en la lista, no distinguirse por el color de un borde.
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void initState() {
    super.initState();
    if (widget.match.status == 'active') _pulse.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(_MatchCard old) {
    super.didUpdateWidget(old);
    final live = widget.match.status == 'active';
    if (live && !_pulse.isAnimating) {
      _pulse.repeat(reverse: true);
    } else if (!live && _pulse.isAnimating) {
      _pulse.stop();
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final match = widget.match;
    final theme = getMatchTypeTheme(match.type);
    final isLive = match.status == 'active';
    // Un partido ya jugado se apaga: no compite por atención con los que
    // todavía importan.
    final isPast = match.status == 'completed' || match.status == 'evaluated';
    final statusLabel = _statusLabels[match.status] ?? 'Finalizado';
    final hasTeams = (match.type == 'by_teams' ||
            match.type == 'league' ||
            match.type == 'cup' ||
            match.type == 'league_final') &&
        match.teamA != null &&
        match.teamB != null;
    final photoIndex = (match.id.codeUnits.fold<int>(0, (acc, c) => acc + c).abs() % 9) + 1;

    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, child) {
        // El halo respira alrededor de la tarjeta en vivo.
        final glow = isLive ? (0.18 + _pulse.value * 0.32) : 0.0;
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            boxShadow: isLive
                ? [
                    BoxShadow(
                      color: AppColors.destructive.withValues(alpha: glow),
                      blurRadius: 18 + _pulse.value * 10,
                      spreadRadius: _pulse.value * 2,
                    ),
                  ]
                : null,
          ),
          child: child,
        );
      },
      child: InkWell(
      onTap: () => context.push('/matches/${match.id}'),
      borderRadius: BorderRadius.circular(16),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF141A24),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isLive ? AppColors.destructive : theme.brandColor.withValues(alpha: 0.35),
              width: isLive ? 1.5 : 1.0,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.3),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Stack(
            children: [
              // Fondo de estadio con parallax: se desplaza según dónde está
              // la tarjeta en la pantalla. Un partido en vivo lo muestra más
              // fuerte y uno ya jugado más apagado, así el estado se lee
              // antes de leer el texto.
              Positioned.fill(
                child: ParallaxBackground(
                  asset: 'assets/backgrounds/fondo_$photoIndex.jpg',
                  opacity: isLive ? 0.34 : (isPast ? 0.10 : 0.22),
                ),
              ),
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        const Color(0xFF141A24).withValues(alpha: 0.95),
                        const Color(0xFF141A24).withValues(alpha: 0.65),
                      ],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
            Text(
              match.title,
              style: AppTypography.headline(size: 17, weight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            _OrganizerRow(ownerUid: match.ownerUid),
            const SizedBox(height: 10),

            // Tipo de partido + estado
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
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: theme.brandColor,
                          boxShadow: [BoxShadow(color: theme.brandColor.withValues(alpha: 0.7), blurRadius: 6)],
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        theme.label.toUpperCase(),
                        style: AppTypography.code(size: 10, weight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                  decoration: BoxDecoration(
                    color: isLive ? AppColors.destructive.withValues(alpha: 0.15) : AppColors.voltNeon.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isLive) ...[
                        // Antes era verde con el texto al lado en rojo.
                        // Ahora late en el mismo rojo que el resto del estado.
                        FadeTransition(
                          opacity: Tween<double>(begin: 0.35, end: 1.0).animate(_pulse),
                          child: Container(
                            width: 6,
                            height: 6,
                            margin: const EdgeInsets.only(right: 5),
                            decoration: const BoxDecoration(
                                shape: BoxShape.circle, color: AppColors.destructive),
                          ),
                        ),
                      ],
                      Text(
                        statusLabel.toUpperCase(),
                        style: AppTypography.code(size: 10, weight: FontWeight.w700, color: isLive ? AppColors.destructive : AppColors.voltNeon),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 14),
            Container(height: 1, color: AppColors.border.withValues(alpha: 0.3)),
            const SizedBox(height: 14),

            // Fecha / hora. Los partidos en 'planning' todavía no tienen
            // fecha/hora confirmada (se define por votación) — igual que
            // match-card.tsx real, mostramos placeholders en vez de vacío.
            Row(
              children: [
                Expanded(
                  child: _InfoRow(
                    icon: Icons.calendar_today_outlined,
                    label: 'Fecha',
                    value: (match.status == 'planning' || match.date.isEmpty)
                        ? 'Por confirmar'
                        : _formatMatchDate(match.date, includeTime: match.time == null),
                  ),
                ),
                Expanded(
                  child: _InfoRow(
                    icon: Icons.access_time,
                    label: 'Hora',
                    value: (match.status == 'planning' || match.time == null) ? 'Por votar' : '${match.time} hs',
                  ),
                ),
              ],
            ),
            if (match.location != null) ...[
              const SizedBox(height: 10),
              _InfoRow(
                icon: Icons.location_on_outlined,
                label: 'Lugar',
                value: match.location!,
              ),
            ],

            const SizedBox(height: 14),

            if (hasTeams)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _TeamJersey(team: match.teamA!),
                  Column(
                    children: [
                      Text('VS', style: AppTypography.code(size: 12, weight: FontWeight.w700, color: AppColors.textMuted)),
                      if (match.status == 'completed' || match.status == 'evaluated')
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            '${match.teamA!.score} - ${match.teamB!.score}',
                            style: AppTypography.sportNumber(size: 18),
                          ),
                        ),
                    ],
                  ),
                  _TeamJersey(team: match.teamB!),
                ],
              )
            else
              Row(
                children: [
                  Icon(Icons.groups_outlined, size: 20, color: AppColors.textMuted),
                  const SizedBox(width: 8),
                  Text(
                    match.matchSize > 0 ? '${match.playerUids.length} / ${match.matchSize}' : '${match.playerUids.length}',
                    style: AppTypography.sportNumber(size: 18),
                  ),
                  const SizedBox(width: 4),
                  Text('Jugadores', style: AppTypography.body(size: 13)),
                ],
              ),

            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => context.push('/matches/${match.id}'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isLive ? AppColors.destructive : AppColors.voltNeon,
                  foregroundColor: isLive ? Colors.white : Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(Icons.visibility_outlined, size: 18),
                label: Text(_actionLabel(match.status), style: AppTypography.headline(size: 13, color: isLive ? Colors.white : Colors.black)),
              ),
            ),
          ],
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

/// Port de CompactMatchCard (src/components/compact-match-card.tsx).
class _CompactMatchCard extends StatelessWidget {
  final MatchModel match;

  const _CompactMatchCard({required this.match});

  @override
  Widget build(BuildContext context) {
    final theme = getMatchTypeTheme(match.type);
    final isByTeams = match.type == 'by_teams' && match.teamA != null && match.teamB != null;
    final hasScore = match.status == 'completed' || match.status == 'evaluated';
    final statusLabel = _statusLabels[match.status] ?? 'Finalizado';
    final isPlanning = match.status == 'planning';
    final photoIndex = (match.id.codeUnits.fold<int>(0, (acc, c) => acc + c).abs() % 9) + 1;

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => context.push('/matches/${match.id}'),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF141A24),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: theme.brandColor.withValues(alpha: 0.35)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.25),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Stack(
            children: [
              // Fondo de estadio
              Positioned.fill(
                child: Opacity(
                  opacity: 0.22,
                  child: Image.asset(
                    'assets/backgrounds/fondo_$photoIndex.jpg',
                    fit: BoxFit.cover,
                  ),
                ),
              ),
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        const Color(0xFF141A24).withValues(alpha: 0.95),
                        const Color(0xFF141A24).withValues(alpha: 0.65),
                      ],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.cardSurface,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(width: 5, height: 5, decoration: BoxDecoration(shape: BoxShape.circle, color: theme.brandColor)),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            theme.label.toUpperCase(),
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.code(size: 8, weight: FontWeight.w700, color: AppColors.textSecondary),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  statusLabel.toUpperCase(),
                  style: AppTypography.code(
                    size: 8,
                    weight: FontWeight.w700,
                    color: match.status == 'active' ? AppColors.destructive : AppColors.voltNeon,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (isByTeams)
              Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      Expanded(
                        child: match.teamA!.jersey != null
                            ? JerseyWidget(jersey: match.teamA!.jersey!, size: 32)
                            : Icon(Icons.checkroom, size: 28, color: AppColors.textMuted),
                      ),
                      Text(
                        hasScore ? '${match.teamA!.score}-${match.teamB!.score}' : 'vs',
                        style: AppTypography.body(size: 11, weight: FontWeight.w700, color: AppColors.textMuted),
                      ),
                      Expanded(
                        child: match.teamB!.jersey != null
                            ? JerseyWidget(jersey: match.teamB!.jersey!, size: 32)
                            : Icon(Icons.checkroom, size: 28, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          match.teamA!.name,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.body(size: 9, weight: FontWeight.w700),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          match.teamB!.name,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.body(size: 9, weight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                ],
              )
            else ...[
              SizedBox(
                height: 32,
                child: Center(
                  child: Text(
                    match.title,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.body(size: 12, weight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.groups_outlined, size: 11, color: AppColors.textMuted),
                  const SizedBox(width: 3),
                  Text(
                    match.matchSize > 0
                        ? '${match.playerUids.length}/${match.matchSize} jugadores'
                        : '${match.playerUids.length} jugadores',
                    style: AppTypography.body(size: 9, color: AppColors.textMuted),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _CompactInfoRow(icon: Icons.calendar_today_outlined, text: isPlanning ? 'Fecha por confirmar' : _formatMatchDate(match.date)),
                const SizedBox(height: 3),
                _CompactInfoRow(icon: Icons.access_time, text: isPlanning ? 'Por votar' : '${match.time ?? ''} hs'),
                if (match.location != null) ...[
                  const SizedBox(height: 3),
                  _CompactInfoRow(icon: Icons.location_on_outlined, text: match.location!),
                ],
              ],
            ),
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerRight,
              child: Icon(Icons.chevron_right, size: 14, color: AppColors.textMuted),
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
}

class _CompactInfoRow extends StatelessWidget {
  final IconData icon;
  final String text;

  const _CompactInfoRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 10, color: AppColors.textMuted),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.body(size: 9, color: AppColors.textMuted),
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: AppColors.textMuted),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: AppTypography.body(size: 11, color: AppColors.textMuted)),
              Text(
                value,
                style: AppTypography.body(size: 13, weight: FontWeight.w700, color: AppColors.textPrimary),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TeamJersey extends StatelessWidget {
  final MatchTeam team;

  const _TeamJersey({required this.team});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (team.jersey != null)
          JerseyWidget(jersey: team.jersey!, size: 44)
        else
          Icon(Icons.checkroom, size: 40, color: AppColors.textMuted),
        const SizedBox(height: 6),
        SizedBox(
          width: 88,
          child: Text(
            team.name,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.body(size: 12, weight: FontWeight.w600, color: AppColors.textPrimary),
          ),
        ),
      ],
    );
  }
}

/// Muestra el nombre del organizador buscando su documento en `users/{uid}`,
/// igual que hace MatchCard en la web.
class _OrganizerRow extends StatelessWidget {
  final String? ownerUid;

  const _OrganizerRow({required this.ownerUid});

  @override
  Widget build(BuildContext context) {
    if (ownerUid == null) return const SizedBox.shrink();

    return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      future: FirebaseFirestore.instance.collection('users').doc(ownerUid).get(),
      builder: (context, snapshot) {
        final data = snapshot.data?.data();
        final name = data?['displayName'] as String? ?? 'Organizador';
        final photoUrl = data?['photoURL'] as String?;

        return Row(
          children: [
            CircleAvatar(
              radius: 10,
              backgroundColor: AppColors.cardSurface,
              backgroundImage: photoUrl != null ? NetworkImage(photoUrl) : null,
              child: photoUrl == null ? Icon(Icons.person, size: 12, color: AppColors.textMuted) : null,
            ),
            const SizedBox(width: 6),
            Text(name, style: AppTypography.body(size: 12, color: AppColors.textMuted)),
          ],
        );
      },
    );
  }
}
