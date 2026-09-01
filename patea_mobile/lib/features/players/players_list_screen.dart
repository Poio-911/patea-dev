import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/firestore_service.dart';
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
        onPressed: () {
          showDialog(
            context: context,
            builder: (_) => const CreatePlayerDialog(),
          );
        },
        child: const Icon(Icons.person_add),
      ),
      body: Column(
        children: [
          // Barra de búsqueda y filtros
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: TextField(
              onChanged: (val) => setState(() => _searchQuery = val.toLowerCase()),
              style: AppTypography.body(),
              decoration: const InputDecoration(
                hintText: 'Buscar jugador...',
                prefixIcon: Icon(Icons.search, color: AppColors.textMuted),
              ),
            ),
          ),
          // Chips de filtro por posición
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 6.0),
            child: Row(
              children: ['ALL', 'DEL', 'MED', 'DEF', 'POR'].map((pos) {
                final isSelected = _selectedPosition == pos;
                return Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: FilterChip(
                    label: Text(pos),
                    selected: isSelected,
                    onSelected: (_) => setState(() => _selectedPosition = pos),
                    selectedColor: AppColors.voltNeon.withValues(alpha: 0.2),
                    checkmarkColor: AppColors.voltNeon,
                    labelStyle: AppTypography.headline(
                      size: 12,
                      color: isSelected ? AppColors.voltNeon : AppColors.textSecondary,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 8),

          // Grid de Jugadores
          Expanded(
            child: playersAsync.when(
              data: (players) {
                final filtered = players.where((p) {
                  final matchesPos = _selectedPosition == 'ALL' || p.position == _selectedPosition;
                  final matchesQuery = p.name.toLowerCase().contains(_searchQuery);
                  return matchesPos && matchesQuery;
                }).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Text(
                      'No se encontraron jugadores',
                      style: AppTypography.body(color: AppColors.textMuted),
                    ),
                  );
                }

                return GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.68,
                    crossAxisSpacing: 14,
                    mainAxisSpacing: 14,
                  ),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final player = filtered[index];
                    return PlayerCardWidget(
                      player: player,
                      onTap: () => context.push('/players/${player.id}'),
                    );
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, stack) => Center(child: Text('Error: $err')),
            ),
          ),
        ],
      ),
    );
  }
}
