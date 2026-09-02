import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/services/firestore_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/patea_background.dart';
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
    final playersAsync = ref.watch(playersStreamProvider(null));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'PLANTEL',
          style: AppTypography.headline(size: 20, weight: FontWeight.w800),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.voltNeon,
        foregroundColor: Colors.black,
        elevation: 6,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        onPressed: () {
          showDialog(
            context: context,
            builder: (_) => const CreatePlayerDialog(),
          );
        },
        child: const Icon(Icons.person_add_rounded, size: 26),
      ),
      body: PateaBackground(
        child: playersAsync.when(
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
                // 1. Controles de la sección (Búsqueda y Chips)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
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
      ),
    );
  }
}
