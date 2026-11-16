import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/competition_model.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/tournament_service.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/patea_states.dart';

class CreateCompetitionScreen extends ConsumerStatefulWidget {
  final bool isCup;
  final String groupId;
  const CreateCompetitionScreen({
    super.key,
    required this.isCup,
    required this.groupId,
  });
  @override
  ConsumerState<CreateCompetitionScreen> createState() =>
      _CreateCompetitionScreenState();
}

class _CreateCompetitionScreenState
    extends ConsumerState<CreateCompetitionScreen> {
  final _name = TextEditingController();
  final _selected = <String>{};
  bool _saving = false;
  bool _returnLeg = false;
  String? _error;
  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref
          .read(tournamentServiceProvider)
          .createCompetition(
            isCup: widget.isCup,
            name: _name.text,
            groupId: widget.groupId,
            teamIds: _selected.toList(),
            homeAndAway: _returnLeg,
          );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = e
              .toString()
              .replaceFirst('Bad state: ', '')
              .replaceFirst('Invalid argument(s): ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final teams = ref.watch(groupTeamsStreamProvider(widget.groupId));
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.isCup ? 'Crear copa' : 'Crear liga',
          style: AppTypography.headline(size: 20),
        ),
      ),
      body: teams.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => PateaError(error: e),
        data: (items) => ListView(
          padding: const EdgeInsets.all(20),
          children: [
            TextField(
              controller: _name,
              enabled: !_saving,
              maxLength: 80,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(labelText: 'Nombre del torneo'),
            ),
            const SizedBox(height: 20),
            Text(
              widget.isCup ? 'Eliminación directa' : 'Todos contra todos',
              style: AppTypography.headline(size: 20),
            ),
            const SizedBox(height: 8),
            Text(
              widget.isCup
                  ? 'Elegí 2, 4, 8, 16 o 32 equipos del grupo.'
                  : 'Elegí entre 2 y 16 equipos del grupo.',
              style: AppTypography.body(size: 14),
            ),
            if (!widget.isCup)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Ida y vuelta'),
                value: _returnLeg,
                onChanged: _saving
                    ? null
                    : (v) => setState(() => _returnLeg = v),
              ),
            const SizedBox(height: 20),
            Text(
              'Equipos seleccionados: ${_selected.length}',
              style: AppTypography.body(size: 15),
            ),
            if (items.length < 2)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  'Primero creá al menos dos equipos desde Gestionar grupos.',
                  style: AppTypography.body(size: 14),
                ),
              ),
            for (final team in items)
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(team.name, style: AppTypography.body(size: 16)),
                subtitle: Text('${team.members.length} jugadores'),
                value: _selected.contains(team.id),
                onChanged: _saving
                    ? null
                    : (v) => setState(() {
                        if (v == true) {
                          _selected.add(team.id);
                        } else {
                          _selected.remove(team.id);
                        }
                      }),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  _error!,
                  style: AppTypography.body(color: context.c.destructive),
                ),
              ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.add),
            label: Text(
              _saving
                  ? 'Creando…'
                  : (widget.isCup ? 'Crear copa' : 'Crear liga'),
            ),
          ),
        ),
      ),
    );
  }
}

Future<bool> confirmDeleteCompetition(
  BuildContext context,
  WidgetRef ref,
  CompetitionModel competition,
) async {
  final accepted = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('¿Eliminar ${competition.name}?'),
      content: const Text(
        'Se eliminará el torneo y su configuración. Los partidos ya registrados conservan su historial. Esta acción no se puede deshacer.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Eliminar torneo'),
        ),
      ],
    ),
  );
  if (accepted != true) return false;
  await ref
      .read(tournamentServiceProvider)
      .deleteCompetition(id: competition.id, isCup: competition.type == 'cup');
  return true;
}
