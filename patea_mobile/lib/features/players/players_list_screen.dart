import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/player_model.dart';
import '../../core/services/firestore_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/patea_page_header.dart';
import '../../core/widgets/player_card_widget.dart';
import 'create_player_dialog.dart';

class PlayersListScreen extends ConsumerStatefulWidget {
  const PlayersListScreen({super.key});

  @override
  ConsumerState<PlayersListScreen> createState() => _PlayersListScreenState();
}

class _PlayersListScreenState extends ConsumerState<PlayersListScreen> {
  String _selectedPosition = 'ALL';
  String _searchQuery = '';

  /// Atributo por el que se ordena. 'OVR' es el default y el único criterio
  /// que tenía la web (siempre descendente, fijo).
  String _sortBy = 'OVR';

  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  static const _sortOptions = <String, String>{
    'OVR': 'OVR',
    'PAC': 'RIT',
    'SHO': 'TIR',
    'PAS': 'PAS',
    'DRI': 'REG',
    'DEF': 'DEF',
    'PHY': 'FIS',
  };

  int _statOf(PlayerModel p, String key) => switch (key) {
        'PAC' => p.pac,
        'SHO' => p.sho,
        'PAS' => p.pas,
        'DRI' => p.dri,
        'DEF' => p.def,
        'PHY' => p.phy,
        _ => p.ovr,
      };


  /// Cuántos filtros hay puestos, para avisarlo en el botón.
  int get _activeFilterCount =>
      (_selectedPosition != 'ALL' ? 1 : 0) +
      (_searchQuery.trim().isNotEmpty ? 1 : 0) +
      (_sortBy != 'OVR' ? 1 : 0);

  /// Buscador, posición y orden viven acá adentro.
  ///
  /// Antes estaban los tres siempre a la vista: entre el título, el botón de
  /// agregar, el buscador, los chips de posición y la fila de ordenar había
  /// cinco bloques de chrome antes de ver un jugador. El default —todos, por
  /// OVR— es el que casi siempre se quiere.
  void _openFilters() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          void update(VoidCallback fn) {
            setSheetState(fn);
            setState(() {});
          }

          return Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(sheetContext).viewInsets.bottom,
            ),
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
              decoration: const BoxDecoration(
                color: Color(0xFF141B27),
                borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              ),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 48,
                        height: 5,
                        margin: const EdgeInsets.only(bottom: 18),
                        decoration: BoxDecoration(
                          color: AppColors.textMuted.withValues(alpha: 0.3),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        Text('Filtros',
                            style: AppTypography.headline(size: 18, weight: FontWeight.w700)),
                        const Spacer(),
                        if (_activeFilterCount > 0)
                          TextButton(
                            onPressed: () => update(() {
                              _selectedPosition = 'ALL';
                              _searchQuery = '';
                              _searchController.clear();
                              _sortBy = 'OVR';
                            }),
                            child: Text('Limpiar',
                                style: AppTypography.body(
                                    size: 13, color: AppColors.textSecondary)),
                          ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F141D),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                      ),
                      child: TextField(
                        controller: _searchController,
                        onChanged: (val) => update(() => _searchQuery = val),
                        style: const TextStyle(color: Colors.white, fontSize: 14),
                        decoration: InputDecoration(
                          hintText: 'Buscar jugador...',
                          hintStyle: TextStyle(
                            color: Colors.white.withValues(alpha: 0.35),
                            fontSize: 13,
                          ),
                          prefixIcon: Icon(Icons.search,
                              size: 20, color: Colors.white.withValues(alpha: 0.4)),
                          border: InputBorder.none,
                          contentPadding:
                              const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text('POSICIÓN',
                        style: AppTypography.code(size: 10, color: AppColors.textMuted)),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final pos in ['ALL', 'DEL', 'MED', 'DEF', 'POR'])
                          GestureDetector(
                            onTap: () {
                              HapticFeedback.selectionClick();
                              update(() => _selectedPosition = pos);
                            },
                            child: _chip(pos, _selectedPosition == pos),
                          ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Text('ORDENAR POR',
                        style: AppTypography.code(size: 10, color: AppColors.textMuted)),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final entry in _sortOptions.entries)
                          GestureDetector(
                            onTap: () {
                              HapticFeedback.selectionClick();
                              update(() => _sortBy = entry.key);
                            },
                            child: _chip(entry.value, _sortBy == entry.key),
                          ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(sheetContext),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.voltNeon,
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text('Ver jugadores',
                            style: AppTypography.headline(
                                size: 14, weight: FontWeight.w700, color: Colors.black)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _chip(String label, bool selected) => AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.voltNeon.withValues(alpha: 0.16)
              : const Color(0xFF0F141D),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? AppColors.voltNeon : Colors.white.withValues(alpha: 0.12),
            width: selected ? 1.4 : 1,
          ),
        ),
        child: Text(
          label,
          style: AppTypography.headline(
            size: 12,
            weight: selected ? FontWeight.w800 : FontWeight.w600,
            color: selected ? AppColors.voltNeon : Colors.white70,
          ),
        ),
      );


  @override
  Widget build(BuildContext context) {
    // Jugadores del grupo activo, no de toda la plataforma. Sin grupo activo
    // no se consulta nada — igual que `players/page.tsx:44` en la web.
    final playersAsync = ref.watch(activeGroupPlayersProvider);

    // Sin `Scaffold.appBar` ni FAB flotante a propósito: la web real
    // (`src/app/players/page.tsx`) pone el botón "Agregar Jugador" como
    // contenido normal DEBAJO del título dentro de `PageHeader`
    // (`flex-col` en mobile), no como una acción fija/flotante — y el
    // título mismo scrollea con la página, no queda pegado arriba.
    // El fondo de cancha (PateaBackground) ahora se aplica una sola vez en
    // el shell (_ScaffoldWithNavBar), compartido por las 5 pestañas — no
    // hace falta repetirlo acá.
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: playersAsync.when(
          data: (players) {
            var filtered = [...players];

            // Filtro de posición
            if (_selectedPosition != 'ALL') {
              filtered = filtered
                  .where((p) => p.position.toUpperCase() == _selectedPosition.toUpperCase())
                  .toList();
            }

            // Filtro de búsqueda
            if (_searchQuery.trim().isNotEmpty) {
              final q = _searchQuery.toLowerCase();
              filtered = filtered.where((p) => p.name.toLowerCase().contains(q)).toList();
            }

            // Orden por el atributo elegido, siempre de mayor a menor. Con
            // el OVR como desempate para que el orden sea estable entre
            // jugadores con el mismo valor y no salte al reordenar.
            filtered.sort((a, b) {
              final byStat = _statOf(b, _sortBy).compareTo(_statOf(a, _sortBy));
              return byStat != 0 ? byStat : b.ovr.compareTo(a.ovr);
            });

            return CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                // 0. Header real (título + descripción + "Agregar Jugador"
                // debajo, igual que PageHeader en la web). Medido en vivo
                // con uiautomator (no a ojo): el body YA arranca justo
                // debajo del alto propio del header (60dp) — solo falta
                // compensar el status bar, no los 60dp de nuevo.
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(16, MediaQuery.of(context).padding.top + 12, 16, 0),
                  sliver: SliverToBoxAdapter(
                    child: PateaPageHeader(
                      title: 'Plantel',
                      description: 'Gestioná la plantilla de tu equipo y las estadísticas de los jugadores.',
                      currentCount: filtered.length,
                      totalCount: players.length,
                      activeFilterCount: _activeFilterCount,
                      onFiltersTap: _openFilters,
                      actionButton: SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () {
                            showDialog(
                              context: context,
                              builder: (_) => const CreatePlayerDialog(),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.voltNeon,
                            foregroundColor: Colors.black,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          icon: const Icon(Icons.add_circle, size: 18),
                          label: Text(
                            'Agregar Jugador',
                            style: AppTypography.headline(size: 13, weight: FontWeight.w700, color: Colors.black),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                // 2. Grilla de Cartas de Jugadores
                if (filtered.isEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(40.0),
                      child: Center(
                        child: Text(
                          'No hay jugadores que coincidan con la búsqueda.',
                          style: AppTypography.body(size: 13, color: AppColors.textMuted),
                        ),
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(14, 6, 14, 100),
                    sliver: SliverGrid(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        childAspectRatio: 2.0 / 3.0,
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 12,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final player = filtered[index];
                          return Hero(
                            // La carta vuela de la grilla a la ficha en vez de
                            // cortar. El tag lleva el criterio de orden porque
                            // si no, al reordenar quedan dos Heros con el
                            // mismo tag en el árbol durante la transición.
                            tag: 'player-card-${player.id}',
                            flightShuttleBuilder: (_, _, _, _, _) =>
                                PlayerCardWidget(player: player),
                            child: PlayerCardWidget(
                              player: player,
                              highlightStat: _sortBy == 'OVR' ? null : _sortBy,
                              onTap: () => context.push('/players/${player.id}'),
                            ),
                          )
                              // Al cambiar el orden las cartas entran
                              // escalonadas: se lee como que el plantel se
                              // reacomodó, no como un salto de contenido.
                              .animate(key: ValueKey('$_sortBy-${player.id}'))
                              .fadeIn(duration: 220.ms, delay: (index * 22).ms)
                              .slideY(begin: 0.06, end: 0, curve: Curves.easeOutCubic);
                        },
                        childCount: filtered.length,
                      ),
                    ),
                  ),
              ],
            );
          },
          loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.voltNeon),
          ),
          error: (err, stack) => Center(child: Text('Error: $err', style: const TextStyle(color: Colors.white))),
        ),
    );
  }
}
