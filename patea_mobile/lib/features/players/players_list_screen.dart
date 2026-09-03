import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _selectedPosition == value;
    return GestureDetector(
      onTap: () => setState(() => _selectedPosition = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF2E3D1E) : const Color(0xFF141A24),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? AppColors.voltNeon : Colors.white.withValues(alpha: 0.15),
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isSelected) ...[
              const Icon(Icons.check, size: 13, color: AppColors.voltNeon),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: AppTypography.headline(
                size: 11,
                weight: FontWeight.w800,
                color: isSelected ? AppColors.voltNeon : Colors.white70,
              ),
            ),
          ],
        ),
      ),
    );
  }

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

            filtered.sort((a, b) => b.ovr.compareTo(a.ovr));

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

                // 1. Controles de la sección (Búsqueda y Chips)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                  sliver: SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Barra de Búsqueda
                        Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFF141A24),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.12),
                            ),
                          ),
                          child: TextField(
                            onChanged: (val) => setState(() => _searchQuery = val),
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                            decoration: InputDecoration(
                              hintText: 'Buscar jugador...',
                              hintStyle: TextStyle(
                                color: Colors.white.withValues(alpha: 0.35),
                                fontSize: 13,
                              ),
                              prefixIcon: Icon(
                                Icons.search,
                                size: 20,
                                color: Colors.white.withValues(alpha: 0.4),
                              ),
                              border: InputBorder.none,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Fila de Chips de Posición (ALL, DEL, MED, DEF, POR)
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: [
                              _buildFilterChip('ALL', 'ALL'),
                              const SizedBox(width: 8),
                              _buildFilterChip('DEL', 'DEL'),
                              const SizedBox(width: 8),
                              _buildFilterChip('MED', 'MED'),
                              const SizedBox(width: 8),
                              _buildFilterChip('DEF', 'DEF'),
                              const SizedBox(width: 8),
                              _buildFilterChip('POR', 'POR'),
                            ],
                          ),
                        ),
                      ],
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
                          return PlayerCardWidget(
                            player: player,
                            onTap: () => context.push('/players/${player.id}'),
                          );
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
