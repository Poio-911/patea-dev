import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models/group_model.dart';
import '../../core/models/player_model.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/group_service.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/patea_avatar.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';
import 'jersey_designer.dart';

/// Asistente pantalla completa para crear o editar un equipo:
/// - Crear: 2 pasos (`Identidad` -> `Plantel`).
/// - Editar (`initialTeam != null`): 1 paso (`Identidad`).
///
/// `Identidad` es UN solo lienzo (nombre + taller de camiseta y escudo con
/// pestañas). Antes eran dos pasos —camiseta y escudo— y para ver cómo quedaba
/// el escudo sobre la camiseta había que volver al paso anterior.
class CreateTeamScreen extends ConsumerStatefulWidget {
  final String groupId;
  final GroupTeamModel? initialTeam;
  final Future<File?> Function()? onPickCrestFile;

  const CreateTeamScreen({
    super.key,
    required this.groupId,
    this.initialTeam,
    this.onPickCrestFile,
  });

  @override
  ConsumerState<CreateTeamScreen> createState() => _CreateTeamScreenState();
}

class _CreateTeamScreenState extends ConsumerState<CreateTeamScreen> {
  int _step = 1;
  int _maxStepReached = 1;
  late final TextEditingController _nameController;
  late JerseyModel _jersey;
  File? _localCrestFile;
  final Set<String> _selectedPlayerIds = {};
  String _playerSearch = '';
  bool _isSubmitting = false;

  bool get _isEditing => widget.initialTeam != null;
  int get _totalSteps => _isEditing ? 1 : 2;

  @override
  void initState() {
    super.initState();
    final initial = widget.initialTeam;
    _nameController = TextEditingController(text: initial?.name ?? '');
    _jersey =
        initial?.jersey ??
        JerseyModel(
          pattern: 'plain',
          primaryColor: popularTeamColors[1]['hex']!,
          secondaryColor: popularTeamColors[5]['hex']!,
        );
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  bool get _canAdvanceFromStep1 => _nameController.text.trim().length >= 2;

  String get _stepTitle => switch (_step) {
    1 => 'Identidad',
    _ => 'Plantel',
  };

  void _goToStep(int target) {
    FocusScope.of(context).unfocus();
    setState(() {
      _step = target;
      if (target > _maxStepReached) {
        _maxStepReached = target;
      }
    });
  }

  Future<void> _handleSubmit() async {
    if (_isSubmitting) return;
    if (_nameController.text.trim().length < 2) return;
    if (!_isEditing && _selectedPlayerIds.isEmpty) return;

    setState(() => _isSubmitting = true);
    try {
      final service = ref.read(groupServiceProvider);
      var jerseyToSave = _jersey;

      if (jerseyToSave.crestMode == 'uploaded') {
        if (_localCrestFile != null) {
          final uploadedUrl = await service.uploadTeamCrest(
            groupId: widget.groupId,
            file: _localCrestFile!,
          );
          jerseyToSave = jerseyToSave.copyWith(
            crestMode: 'uploaded',
            crestUrl: uploadedUrl,
          );
        } else if (jerseyToSave.crestUrl.trim().isEmpty) {
          jerseyToSave = jerseyToSave.copyWith(crestMode: 'none');
        }
      }

      if (_isEditing) {
        await service.updateTeam(
          teamId: widget.initialTeam!.id,
          name: _nameController.text.trim(),
          jersey: jerseyToSave.toMap(),
        );
      } else {
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

        await service.createTeam(
          groupId: widget.groupId,
          name: _nameController.text.trim(),
          jersey: jerseyToSave.toMap(),
          members: members,
        );
      }

      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      assert(() {
        debugPrint('CreateTeamScreen error: $e');
        return true;
      }());
      if (mounted) {
        PateaSnack.error(
          context,
          _isEditing
              ? 'No se pudieron guardar los cambios. Intentá de nuevo.'
              : 'No se pudo crear el equipo. Intentá de nuevo.',
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  VoidCallback? _primaryAction() {
    if (_isSubmitting) return null;
    if (_step == 1) {
      if (!_canAdvanceFromStep1) return null;
      return _isEditing ? _handleSubmit : () => _goToStep(2);
    }
    return _selectedPlayerIds.isNotEmpty ? _handleSubmit : null;
  }

  String _primaryLabel() {
    if (_isEditing) return 'Guardar cambios';
    if (_step == 1) return 'Elegir jugadores';
    return 'Crear equipo';
  }

  @override
  Widget build(BuildContext context) {
    final playersAsync = ref.watch(playersStreamProvider(widget.groupId));

    return PopScope<dynamic>(
      canPop: !_isSubmitting && _step == 1,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && !_isSubmitting && _step > 1) {
          setState(() => _step -= 1);
        }
      },
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          title: Text(
            _isEditing ? 'Editar equipo' : 'Crear equipo',
            style: AppTypography.headline(size: 20, weight: FontWeight.w700),
          ),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            tooltip: _step > 1 ? 'Paso anterior' : 'Volver',
            onPressed: _isSubmitting
                ? null
                : () {
                    if (_step > 1) {
                      setState(() => _step -= 1);
                    } else {
                      Navigator.maybePop(context);
                    }
                  },
          ),
        ),
        body: Column(
          children: [
            // Con un solo paso (editar) no hay nada que indicar.
            if (_totalSteps > 1)
              _StepIndicator(
                step: _step,
                totalSteps: _totalSteps,
                label: _stepTitle,
                maxStepReached: _maxStepReached,
                onSelectStep: (target) {
                  if (!_isSubmitting && target <= _maxStepReached) {
                    _goToStep(target);
                  }
                },
              ),
            Expanded(
              child: switch (_step) {
                1 => _buildIdentityStep(),
                _ => playersAsync.when(
                  data: _buildRosterStep,
                  loading: () => const PateaLoading(),
                  error: (e, _) => PateaError(
                    error: e,
                    message: 'No se pudieron cargar los jugadores.',
                    onRetry: () =>
                        ref.invalidate(playersStreamProvider(widget.groupId)),
                  ),
                ),
              },
            ),
            SafeArea(
              top: false,
              child: Container(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: context.c.overlayLine)),
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _primaryAction(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: context.c.primary,
                      foregroundColor: context.c.onPrimary,
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: PateaButtonProgress(),
                          )
                        : Text(_primaryLabel()),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIdentityStep() {
    return JerseyDesigner(
      value: _jersey,
      teamName: _nameController.text,
      localCrestFile: _localCrestFile,
      onLocalCrestFileChanged: (f) => setState(() => _localCrestFile = f),
      onPickCrestFile: widget.onPickCrestFile,
      expandPanel: true,
      topHeader: TextField(
        controller: _nameController,
        textCapitalization: TextCapitalization.words,
        onChanged: (_) => setState(() {}),
        decoration: const InputDecoration(
          labelText: 'Nombre del equipo',
          hintText: 'Ej. La Academia',
        ),
      ),
      onChanged: (next) => setState(() => _jersey = next),
    );
  }

  Widget _buildRosterStep(List<PlayerModel> allPlayers) {
    final filtered = allPlayers
        .where(
          (p) => p.name.toLowerCase().contains(_playerSearch.toLowerCase()),
        )
        .toList();
    final hasAnyCrest =
        _jersey.hasCrest ||
        (_jersey.crestMode == 'uploaded' && _localCrestFile != null);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 12),
          child: Column(
            children: [
              Row(
                children: [
                  JerseyWidget(
                    jersey: _jersey,
                    teamName: _nameController.text,
                    localCrestFile: _localCrestFile,
                    size: 40,
                  ),
                  if (hasAnyCrest) ...[
                    const SizedBox(width: 8),
                    TeamCrestWidget(
                      jersey: _jersey,
                      teamName: _nameController.text,
                      localCrestFile: _localCrestFile,
                      size: 32,
                    ),
                  ],
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _nameController.text.trim(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.headline(
                            size: 16,
                            weight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          _selectedPlayerIds.isEmpty
                              ? 'Elegí al menos 1 jugador'
                              : '${_selectedPlayerIds.length} ${_selectedPlayerIds.length == 1 ? 'jugador seleccionado' : 'jugadores seleccionados'}',
                          style: AppTypography.body(
                            size: 12,
                            color: context.c.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                onChanged: (v) => setState(() => _playerSearch = v),
                decoration: const InputDecoration(
                  hintText: 'Buscar jugador...',
                  prefixIcon: Icon(Icons.search, size: 20),
                ),
              ),
            ],
          ),
        ),
        Divider(height: 1, color: context.c.overlayLine),
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
                          alpha: 0.08,
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
  final int totalSteps;
  final String label;
  final int maxStepReached;
  final ValueChanged<int> onSelectStep;

  const _StepIndicator({
    required this.step,
    required this.totalSteps,
    required this.label,
    required this.maxStepReached,
    required this.onSelectStep,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 6, 20, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Paso $step de $totalSteps · $label',
            style: AppTypography.body(
              size: 13,
              weight: FontWeight.w600,
              color: context.c.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              for (int i = 1; i <= totalSteps; i++) ...[
                Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: i <= maxStepReached ? () => onSelectStep(i) : null,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        height: 3,
                        decoration: BoxDecoration(
                          color: i <= step
                              ? context.c.primary
                              : context.c.overlayLine,
                          borderRadius: AppRadii.hairAll,
                        ),
                      ),
                    ),
                  ),
                ),
                if (i < totalSteps) const SizedBox(width: 6),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
