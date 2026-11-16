import '../../core/widgets/patea_button_progress.dart';
import 'package:flutter/material.dart';
import '../../core/theme/app_radii.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_states.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/group_service.dart';
import '../../core/models/group_model.dart';
import '../../core/models/player_model.dart';
import 'jersey_designer.dart';

/// Port de create-team-dialog.tsx + JerseyDesigner (team-builder/jersey-designer.tsx):
/// wizard de 2 pasos (Identidad: nombre+camiseta; Plantel: selección de
/// jugadores).
///
/// Al crear, todos entran como titulares con dorsal según el orden de
/// selección: es un punto de partida, no una limitación. Los dorsales, el
/// banco y las altas/bajas se manejan después desde el detalle del equipo,
/// con `ManageRosterSheet`.
///
/// No portado: `assignSmartDorsal` y el límite de "máximo 3 equipos por
/// jugador" de la web.
class CreateTeamScreen extends ConsumerStatefulWidget {
  final String groupId;

  const CreateTeamScreen({super.key, required this.groupId});

  @override
  ConsumerState<CreateTeamScreen> createState() => _CreateTeamScreenState();
}

class _CreateTeamScreenState extends ConsumerState<CreateTeamScreen> {
  int _step = 1;
  final _nameController = TextEditingController();
  JerseyModel _jersey = JerseyModel(
    pattern: 'plain',
    primaryColor: popularTeamColors[1]['hex']!,
    secondaryColor: popularTeamColors[5]['hex']!,
  );
  final Set<String> _selectedPlayerIds = {};
  String _playerSearch = '';
  bool _isSubmitting = false;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  bool get _canGoToStep2 => _nameController.text.trim().length >= 2;

  Future<void> _handleCreate() async {
    if (_isSubmitting) return;
    setState(() => _isSubmitting = true);
    try {
      final members = _selectedPlayerIds
          .toList()
          .asMap()
          .entries
          .map(
            (e) => {
              'playerId': e.value,
              'number': e.key + 1,
              'status': 'titular',
            },
          )
          .toList();

      await ref
          .read(groupServiceProvider)
          .createTeam(
            groupId: widget.groupId,
            name: _nameController.text.trim(),
            jersey: {
              'type': _jersey.pattern,
              'primaryColor': _jersey.primaryColor,
              'secondaryColor': _jersey.secondaryColor,
            },
            members: members,
          );

      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        PateaSnack.error(context, '$e');
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final playersAsync = ref.watch(playersStreamProvider(widget.groupId));

    return Scaffold(
      // El router envuelve esta ruta en `PateaBackground`. Sin esto, el
      // Scaffold pinta su color opaco encima y tapa la foto de cancha.
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'Crear equipo',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
        leading: _step > 1
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => setState(() => _step -= 1),
              )
            : null,
      ),
      body: Column(
        children: [
          _StepIndicator(step: _step),
          Expanded(
            child: playersAsync.when(
              data: (players) =>
                  _step == 1 ? _buildStep1() : _buildStep2(players),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => PateaError(error: e),
            ),
          ),
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(
                    color: context.c.border.withValues(alpha: 0.3),
                  ),
                ),
              ),
              child: Row(
                children: [
                  if (_step > 1)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: OutlinedButton(
                        onPressed: _isSubmitting
                            ? null
                            : () => setState(() => _step -= 1),
                        child: const Text('Atrás'),
                      ),
                    ),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isSubmitting
                          ? null
                          : _step == 1
                          ? (_canGoToStep2
                                ? () {
                                    FocusScope.of(context).unfocus();
                                    setState(() => _step = 2);
                                  }
                                : null)
                          : (_selectedPlayerIds.isNotEmpty
                                ? _handleCreate
                                : null),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: context.c.primary,
                        foregroundColor: context.c.onPrimary,
                      ),
                      child: _isSubmitting
                          ? SizedBox(
                              height: 20,
                              width: 20,
                              child: const PateaButtonProgress(),
                            )
                          : Text(
                              _step == 1 ? 'Elegir jugadores' : 'Crear equipo',
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep1() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _nameController,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Nombre del equipo',
              prefixIcon: Icon(Icons.shield_outlined),
            ),
          ),
          const SizedBox(height: 24),
          JerseyDesigner(
            value: _jersey,
            onChanged: (j) => setState(() => _jersey = j),
          ),
        ],
      ),
    );
  }

  Widget _buildStep2(List<PlayerModel> allPlayers) {
    final filtered = allPlayers
        .where(
          (p) => p.name.toLowerCase().contains(_playerSearch.toLowerCase()),
        )
        .toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Elegí el plantel',
                    style: AppTypography.headline(
                      size: 13,
                      color: context.c.textSecondary,
                    ),
                  ),
                  Text(
                    '${_selectedPlayerIds.length} seleccionados',
                    style: AppTypography.body(
                      size: 12,
                      color: context.c.textSecondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                onChanged: (v) => setState(() => _playerSearch = v),
                decoration: const InputDecoration(
                  hintText: 'Buscar jugador...',
                  prefixIcon: Icon(Icons.search, size: 20),
                  isDense: true,
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: filtered.isEmpty
              ? Center(
                  child: Text(
                    _playerSearch.isEmpty
                        ? 'No hay jugadores en este grupo.'
                        : 'No encontramos jugadores con ese nombre.',
                    style: AppTypography.body(color: context.c.textSecondary),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final p = filtered[index];
                    final selected = _selectedPlayerIds.contains(p.id);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: CheckboxListTile(
                        value: selected,
                        selected: selected,
                        selectedTileColor: context.c.primary.withValues(
                          alpha: .08,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: AppRadii.cardAll,
                        ),
                        onChanged: (_) => setState(
                          () => selected
                              ? _selectedPlayerIds.remove(p.id)
                              : _selectedPlayerIds.add(p.id),
                        ),
                        secondary: PateaAvatar(
                          photoUrl: p.photoUrl,
                          seed: p.id,
                          size: 40,
                        ),
                        title: Text(
                          p.name,
                          style: AppTypography.body(
                            size: 15,
                            weight: FontWeight.w600,
                            color: context.c.textPrimary,
                          ),
                        ),
                        subtitle: Text(
                          '${p.position} · OVR ${p.ovr}',
                          style: AppTypography.body(
                            size: 12,
                            color: context.c.textSecondary,
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _StepIndicator extends StatelessWidget {
  final int step;
  const _StepIndicator({required this.step});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
    child: Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                '1. Identidad',
                style: AppTypography.body(
                  size: 14,
                  weight: step == 1 ? FontWeight.w700 : FontWeight.w400,
                  color: step == 1
                      ? context.c.textPrimary
                      : context.c.textSecondary,
                ),
              ),
            ),
            Expanded(
              child: Text(
                '2. Plantel',
                style: AppTypography.body(
                  size: 14,
                  weight: step == 2 ? FontWeight.w700 : FontWeight.w400,
                  color: step == 2
                      ? context.c.textPrimary
                      : context.c.textSecondary,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        LinearProgressIndicator(
          value: step / 2,
          minHeight: 3,
          color: context.c.primary,
          backgroundColor: context.c.border,
        ),
      ],
    ),
  );
}
