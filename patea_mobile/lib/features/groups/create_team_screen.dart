import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/group_service.dart';
import '../../core/models/group_model.dart';
import '../../core/models/player_model.dart';
import 'jersey_designer.dart';

/// Port de create-team-dialog.tsx + JerseyDesigner (team-builder/jersey-designer.tsx):
/// wizard de 2 pasos (Identidad: nombre+camiseta; Plantel: selección de
/// jugadores). Simplificación consciente respecto a la web: no distingue
/// titular/suplente ni asigna dorsal "inteligente" (assignSmartDorsal) — acá
/// el dorsal es simplemente el orden de selección, y el estado siempre
/// 'titular'. El límite de "máximo 3 equipos por jugador" tampoco se portó.
class CreateTeamScreen extends ConsumerStatefulWidget {
  final String groupId;

  const CreateTeamScreen({super.key, required this.groupId});

  @override
  ConsumerState<CreateTeamScreen> createState() => _CreateTeamScreenState();
}

class _CreateTeamScreenState extends ConsumerState<CreateTeamScreen> {
  int _step = 1;
  final _nameController = TextEditingController();
  JerseyModel _jersey = JerseyModel(pattern: 'plain', primaryColor: popularTeamColors[1]['hex']!, secondaryColor: popularTeamColors[5]['hex']!);
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
    setState(() => _isSubmitting = true);
    try {
      final members = _selectedPlayerIds
          .toList()
          .asMap()
          .entries
          .map((e) => {'playerId': e.value, 'number': e.key + 1, 'status': 'titular'})
          .toList();

      await ref.read(groupServiceProvider).createTeam(
            groupId: widget.groupId,
            name: _nameController.text.trim(),
            jersey: {'type': _jersey.pattern, 'primaryColor': _jersey.primaryColor, 'secondaryColor': _jersey.secondaryColor},
            members: members,
          );

      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive));
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final playersAsync = ref.watch(playersStreamProvider(widget.groupId));

    return Scaffold(
      appBar: AppBar(
        title: Text('CREAR EQUIPO', style: AppTypography.headline(size: 18, weight: FontWeight.w800)),
        leading: _step > 1 ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => setState(() => _step -= 1)) : null,
      ),
      body: Column(
        children: [
          _StepIndicator(step: _step),
          Expanded(
            child: playersAsync.when(
              data: (players) => _step == 1 ? _buildStep1() : _buildStep2(players),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
            ),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: AppColors.border.withValues(alpha: 0.3)))),
            child: Row(
              children: [
                if (_step > 1)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: OutlinedButton(onPressed: _isSubmitting ? null : () => setState(() => _step -= 1), child: const Text('Atrás')),
                  ),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isSubmitting
                        ? null
                        : _step == 1
                            ? (_canGoToStep2 ? () => setState(() => _step = 2) : null)
                            : (_selectedPlayerIds.isNotEmpty ? _handleCreate : null),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black),
                    child: _isSubmitting
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                        : Text(_step == 1 ? 'Siguiente' : 'CREAR EQUIPO'),
                  ),
                ),
              ],
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
            decoration: const InputDecoration(labelText: 'Nombre del Equipo', prefixIcon: Icon(Icons.shield_outlined)),
          ),
          const SizedBox(height: 24),
          JerseyDesigner(value: _jersey, onChanged: (j) => setState(() => _jersey = j)),
        ],
      ),
    );
  }

  Widget _buildStep2(List<PlayerModel> allPlayers) {
    final filtered = allPlayers.where((p) => p.name.toLowerCase().contains(_playerSearch.toLowerCase())).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('PLANTEL', style: AppTypography.headline(size: 13, color: AppColors.textMuted)),
                  Text('${_selectedPlayerIds.length} seleccionados', style: AppTypography.body(size: 12, color: AppColors.textMuted)),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                onChanged: (v) => setState(() => _playerSearch = v),
                decoration: const InputDecoration(hintText: 'Buscar jugador...', prefixIcon: Icon(Icons.search, size: 20), isDense: true),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: filtered.isEmpty
              ? Center(child: Text('No hay jugadores en este grupo.', style: AppTypography.body(color: AppColors.textMuted)))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final p = filtered[index];
                    final selected = _selectedPlayerIds.contains(p.id);
                    return InkWell(
                      onTap: () => setState(() => selected ? _selectedPlayerIds.remove(p.id) : _selectedPlayerIds.add(p.id)),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: selected ? AppColors.voltNeon.withValues(alpha: 0.1) : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: selected ? AppColors.voltNeon : AppColors.border.withValues(alpha: 0.4)),
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 16,
                              backgroundColor: AppColors.cardSurface,
                              backgroundImage: p.photoUrl != null && p.photoUrl!.isNotEmpty ? NetworkImage(p.photoUrl!) : null,
                              child: p.photoUrl == null || p.photoUrl!.isEmpty ? Text(p.name.isNotEmpty ? p.name[0].toUpperCase() : '?') : null,
                            ),
                            const SizedBox(width: 10),
                            Expanded(child: Text(p.name, style: AppTypography.body(size: 13, weight: FontWeight.w700))),
                            Text('OVR ${p.ovr}', style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                            const SizedBox(width: 10),
                            Container(
                              width: 22,
                              height: 22,
                              decoration: BoxDecoration(
                                color: selected ? AppColors.voltNeon : Colors.transparent,
                                borderRadius: BorderRadius.circular(5),
                                border: Border.all(color: selected ? AppColors.voltNeon : AppColors.textMuted),
                              ),
                              child: selected ? const Icon(Icons.check, size: 16, color: Colors.black) : null,
                            ),
                          ],
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
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: Row(
        children: List.generate(2, (i) {
          final isActive = i < step;
          return Expanded(
            child: Container(
              margin: EdgeInsets.only(right: i < 1 ? 6 : 0),
              height: 4,
              decoration: BoxDecoration(color: isActive ? AppColors.voltNeon : AppColors.cardSurface, borderRadius: BorderRadius.circular(2)),
            ),
          );
        }),
      ),
    );
  }
}
