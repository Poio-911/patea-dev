import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/group_service.dart';
import '../../core/models/group_model.dart';
import '../../core/models/player_model.dart';
import '../../core/widgets/jersey_painter.dart';
import 'jersey_designer.dart';

/// Port de src/app/groups/teams/[id]/page.tsx: detalle de equipo con
/// edición de nombre/camiseta y eliminación. Simplificación consciente: la
/// edición de plantel (agregar/quitar jugadores, titular/suplente) usa el
/// mismo multi-select simple que la creación, sin el límite de "máximo 3
/// equipos por jugador" ni el análisis táctico (`TeamTacticalAnalysis`).
class TeamDetailScreen extends ConsumerStatefulWidget {
  final String teamId;

  const TeamDetailScreen({super.key, required this.teamId});

  @override
  ConsumerState<TeamDetailScreen> createState() => _TeamDetailScreenState();
}

class _TeamDetailScreenState extends ConsumerState<TeamDetailScreen> {
  bool _isDeleting = false;

  Future<void> _handleDelete(GroupTeamModel team) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text('¿Eliminar "${team.name}"?', style: AppTypography.headline(size: 16)),
        content: Text('Esta acción es permanente.', style: AppTypography.body(size: 13)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.destructive),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _isDeleting = true);
    try {
      await ref.read(groupServiceProvider).deleteTeam(team.id);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive));
        setState(() => _isDeleting = false);
      }
    }
  }

  Future<void> _showEditDialog(GroupTeamModel team) async {
    final controller = TextEditingController(text: team.name);
    JerseyModel jersey = team.jersey;
    bool submitting = false;

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.card,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20, right: 20, top: 20,
            bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Editar Equipo', style: AppTypography.headline(size: 16)),
                const SizedBox(height: 16),
                TextField(controller: controller, decoration: const InputDecoration(labelText: 'Nombre del Equipo')),
                const SizedBox(height: 20),
                JerseyDesigner(value: jersey, onChanged: (j) => setSheetState(() => jersey = j)),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: submitting
                      ? null
                      : () async {
                          if (controller.text.trim().length < 2) return;
                          setSheetState(() => submitting = true);
                          try {
                            await ref.read(groupServiceProvider).updateTeam(
                                  teamId: team.id,
                                  name: controller.text.trim(),
                                  jersey: {'type': jersey.pattern, 'primaryColor': jersey.primaryColor, 'secondaryColor': jersey.secondaryColor},
                                );
                            if (context.mounted) Navigator.pop(context);
                          } catch (e) {
                            setSheetState(() => submitting = false);
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive));
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black),
                  child: submitting
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                      : const Text('Guardar'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _showEditMembersSheet(GroupTeamModel team, List<PlayerModel> groupPlayers) async {
    final selected = {...team.playerIds};
    String search = '';
    bool submitting = false;

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.card,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) {
          final filtered = groupPlayers.where((p) => p.name.toLowerCase().contains(search.toLowerCase())).toList();
          return Padding(
            padding: EdgeInsets.only(
              left: 20, right: 20, top: 20,
              bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Editar Plantel', style: AppTypography.headline(size: 16)),
                const SizedBox(height: 12),
                TextField(
                  onChanged: (v) => setSheetState(() => search = v),
                  decoration: const InputDecoration(hintText: 'Buscar jugador...', prefixIcon: Icon(Icons.search, size: 20), isDense: true),
                ),
                const SizedBox(height: 10),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 360),
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final p = filtered[index];
                      final isSelected = selected.contains(p.id);
                      return CheckboxListTile(
                        value: isSelected,
                        onChanged: (v) => setSheetState(() => v == true ? selected.add(p.id) : selected.remove(p.id)),
                        title: Text(p.name, style: AppTypography.body(size: 13, weight: FontWeight.w700)),
                        subtitle: Text('${p.position} · OVR ${p.ovr}', style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                        activeColor: AppColors.voltNeon,
                        checkColor: Colors.black,
                        dense: true,
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: submitting
                      ? null
                      : () async {
                          setSheetState(() => submitting = true);
                          try {
                            final members = selected
                                .toList()
                                .asMap()
                                .entries
                                .map((e) => {'playerId': e.value, 'number': e.key + 1, 'status': 'titular'})
                                .toList();
                            await ref.read(groupServiceProvider).updateTeamMembers(teamId: team.id, members: members);
                            if (context.mounted) Navigator.pop(context);
                          } catch (e) {
                            setSheetState(() => submitting = false);
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.destructive));
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.voltNeon, foregroundColor: Colors.black),
                  child: submitting
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                      : Text('Guardar (${selected.length})'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final teamAsync = ref.watch(singleTeamStreamProvider(widget.teamId));

    return Scaffold(
      appBar: AppBar(title: Text('EQUIPO', style: AppTypography.headline(size: 18, weight: FontWeight.w800))),
      body: teamAsync.when(
        data: (team) {
          if (team == null) {
            return Center(child: Text('Equipo no encontrado.', style: AppTypography.body(color: AppColors.textMuted)));
          }
          final groupPlayersAsync = ref.watch(playersStreamProvider(team.groupId));
          final groupPlayers = groupPlayersAsync.value ?? const <PlayerModel>[];
          final playersById = {for (final p in groupPlayers) p.id: p};

          return ListView(
            padding: const EdgeInsets.all(18),
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border.withValues(alpha: 0.5))),
                child: Column(
                  children: [
                    JerseyWidget(jersey: team.jersey, size: 80),
                    const SizedBox(height: 12),
                    Text(team.name, style: AppTypography.headline(size: 20, weight: FontWeight.w900), textAlign: TextAlign.center),
                    const SizedBox(height: 4),
                    Text('${team.members.length} jugadores', style: AppTypography.body(size: 12, color: AppColors.textMuted)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _showEditDialog(team),
                      icon: const Icon(Icons.edit_outlined, size: 16),
                      label: const Text('Editar'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _showEditMembersSheet(team, groupPlayers),
                      icon: const Icon(Icons.group_outlined, size: 16),
                      label: const Text('Plantel'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: _isDeleting ? null : () => _handleDelete(team),
                style: TextButton.styleFrom(foregroundColor: AppColors.destructive),
                icon: _isDeleting
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.destructive))
                    : const Icon(Icons.delete_outline, size: 16),
                label: const Text('Eliminar equipo'),
              ),
              const SizedBox(height: 20),
              Text('PLANTEL', style: AppTypography.headline(size: 13, weight: FontWeight.w800, color: AppColors.textSecondary)),
              const SizedBox(height: 10),
              if (team.members.isEmpty)
                Text('Sin jugadores todavía.', style: AppTypography.body(size: 12, color: AppColors.textMuted))
              else
                ...team.members.map((m) {
                  final p = playersById[m.playerId];
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: AppColors.cardSurface.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(10)),
                    child: Row(
                      children: [
                        Container(
                          width: 26,
                          height: 26,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.card),
                          child: Text('${m.number}', style: AppTypography.code(size: 11, weight: FontWeight.w800)),
                        ),
                        const SizedBox(width: 10),
                        CircleAvatar(
                          radius: 16,
                          backgroundColor: AppColors.card,
                          backgroundImage: p?.photoUrl != null && p!.photoUrl!.isNotEmpty ? NetworkImage(p.photoUrl!) : null,
                          child: p?.photoUrl == null || p!.photoUrl!.isEmpty ? Text(p?.name.isNotEmpty == true ? p!.name[0].toUpperCase() : '?') : null,
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: Text(p?.name ?? m.playerId, style: AppTypography.body(size: 13, weight: FontWeight.w700))),
                        if (p != null) Text('${p.position} · OVR ${p.ovr}', style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                      ],
                    ),
                  );
                }),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }
}
