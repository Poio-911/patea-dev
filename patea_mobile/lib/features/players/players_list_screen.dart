import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/auth_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/patea_background.dart';
import '../../core/widgets/patea_top_header.dart';
import '../../core/widgets/patea_page_header.dart';
import '../../core/widgets/player_card_widget.dart';
import 'create_player_dialog.dart';

class PlayersListScreen extends ConsumerStatefulWidget {
  const PlayersListScreen({super.key});

  @override
  ConsumerState<PlayersListScreen> createState() => _PlayersListScreenState();
}

class _PlayersListScreenState extends ConsumerState<PlayersListScreen> {
  String? _selectedPosition;

  void _showAddPlayerDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => const CreatePlayerDialog(),
    );
  }

  void _showFiltersModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF141923),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Filtrar Jugadores',
                        style: AppTypography.headline(size: 18, weight: FontWeight.w800),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: AppColors.textMuted),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'POSICIÓN',
                    style: AppTypography.headline(size: 11, weight: FontWeight.w800, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _buildFilterChip('TODOS', null, setModalState),
                      _buildFilterChip('DELANTEROS', 'DEL', setModalState),
                      _buildFilterChip('MEDIOCAMPISTAS', 'MED', setModalState),
                      _buildFilterChip('DEFENSORES', 'DEF', setModalState),
                      _buildFilterChip('PORTEROS', 'POR', setModalState),
                    ],
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildFilterChip(String label, String? position, StateSetter setModalState) {
    final isSelected = _selectedPosition == position;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        setModalState(() {
          _selectedPosition = selected ? position : null;
        });
        setState(() {
          _selectedPosition = selected ? position : null;
        });
        Navigator.pop(context);
      },
      selectedColor: AppColors.voltNeon,
      backgroundColor: const Color(0xFF1E2636),
      labelStyle: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        color: isSelected ? Colors.black : Colors.white,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final playersAsync = ref.watch(playersStreamProvider(null));
    final currentUser = ref.watch(authServiceProvider).currentUser;
    final userName = currentUser?.displayName?.split(' ').first ?? 'Briseida';

    return Scaffold(
      body: PateaBackground(
        child: SafeArea(
          child: Column(
            children: [
              // 1. Barra Superior con Logo Pateá Neón y Perfil
              PateaTopHeader(
                userName: userName,
                userPosition: 'DEL',
                onHelpTap: () {},
                onInvitationsTap: () => context.push('/competitions'),
                onNotificationsTap: () {},
                onProfileTap: () {},
              ),

              // 2. Cuerpo desplazable
              Expanded(
                child: playersAsync.when(
                  data: (players) {
                    var sorted = [...players]..sort((a, b) => b.ovr.compareTo(a.ovr));
                    if (_selectedPosition != null) {
                      sorted = sorted.where((p) => p.position.toUpperCase() == _selectedPosition!.toUpperCase()).toList();
                    }

                    return CustomScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      slivers: [
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                            child: PateaPageHeader(
                              title: 'Plantel',
                              description: 'Gestioná la plantilla de tu equipo y las estadísticas de los jugadores.',
                              currentCount: sorted.length,
                              totalCount: players.length,
                              onHelpTap: () {},
                              onFiltersTap: () => _showFiltersModal(context),
                              actionButton: SizedBox(
                                width: double.infinity,
                                child: ElevatedButton.icon(
                                  onPressed: () => _showAddPlayerDialog(context),
                                  icon: const Icon(Icons.add_circle_outline_rounded, color: Colors.black, size: 20),
                                  label: Text(
                                    'Agregar Jugador',
                                    style: AppTypography.headline(
                                      size: 14,
                                      weight: FontWeight.w900,
                                      color: Colors.black,
                                    ),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.voltNeon,
                                    foregroundColor: Colors.black,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                    padding: const EdgeInsets.symmetric(vertical: 13),
                                    elevation: 0,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),

                        // Grilla de 2 columnas de Cartas 3D
                        if (sorted.isEmpty)
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.all(32.0),
                              child: Center(
                                child: Text(
                                  'No hay jugadores que coincidan con el filtro.',
                                  style: AppTypography.body(size: 13, color: AppColors.textMuted),
                                ),
                              ),
                            ),
                          )
                        else
                          SliverPadding(
                            padding: const EdgeInsets.fromLTRB(14, 4, 14, 24),
                            sliver: SliverGrid(
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                childAspectRatio: 2.0 / 3.0,
                                crossAxisSpacing: 12,
                                mainAxisSpacing: 14,
                              ),
                              delegate: SliverChildBuilderDelegate(
                                (context, index) {
                                  final player = sorted[index];
                                  return PlayerCardWidget(
                                    player: player,
                                    onTap: () => context.push('/players/${player.id}'),
                                  );
                                },
                                childCount: sorted.length,
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                  loading: () => const Center(
                    child: CircularProgressIndicator(color: AppColors.voltNeon),
                  ),
                  error: (err, stack) => Center(child: Text('Error: $err')),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
