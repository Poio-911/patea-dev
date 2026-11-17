import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/competition_model.dart';
import '../../core/models/group_model.dart';
import '../../core/services/competition_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';
import '../../core/widgets/patea_tabs.dart';
import 'competition_management.dart';

class CompetitionApplySheet extends ConsumerStatefulWidget {
  final CompetitionModel competition;
  const CompetitionApplySheet({super.key, required this.competition});
  @override
  ConsumerState<CompetitionApplySheet> createState() => _ApplyState();
}

class _ApplyState extends ConsumerState<CompetitionApplySheet> {
  final _message = TextEditingController();
  String? _team, _error;
  bool _busy = false;
  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(currentUidProvider), c = widget.competition;
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          20 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Tu equipo puede estar acá',
                style: AppTypography.headline(size: 23),
              ),
              const SizedBox(height: 8),
              Text(
                'Elegí un equipo que administres. El organizador confirma la participación.',
                style: AppTypography.body(
                  size: 14,
                  color: context.c.textSecondary,
                ),
              ),
              const SizedBox(height: 20),
              if (uid == null)
                const Text('Iniciá sesión para inscribirte.')
              else
                ref
                    .watch(ownedCompetitionTeamsProvider(uid))
                    .when(
                      loading: () => const PateaLoading(height: 90),
                      error: (e, _) => PateaError(error: e),
                      data: (all) {
                        final teams = all
                            .where((t) => !c.teamIds.contains(t.id))
                            .toList();
                        if (teams.isEmpty) {
                          return const PateaEmpty(
                            icon: Icons.shield_outlined,
                            title: 'No hay equipos disponibles',
                            hint:
                                'Necesitás administrar un equipo que todavía no participe en este torneo.',
                          );
                        }
                        return DropdownButtonFormField<String>(
                          initialValue: _team,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Equipo a postular',
                          ),
                          items: [
                            for (final t in teams)
                              DropdownMenuItem(
                                value: t.id,
                                child: Text(
                                  t.name,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                          onChanged: _busy
                              ? null
                              : (v) => setState(() => _team = v),
                        );
                      },
                    ),
              const SizedBox(height: 16),
              TextField(
                controller: _message,
                maxLength: 500,
                maxLines: 3,
                enabled: !_busy,
                decoration: const InputDecoration(
                  labelText: 'Mensaje para el organizador (opcional)',
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    _error!,
                    style: AppTypography.body(color: context.c.destructive),
                  ),
                ),
              FilledButton.icon(
                onPressed: _busy || uid == null
                    ? null
                    : () async {
                        if (_team == null) {
                          setState(() => _error = 'Elegí un equipo.');
                          return;
                        }
                        setState(() {
                          _busy = true;
                          _error = null;
                        });
                        try {
                          await ref.read(competitionServiceProvider).command(
                            c.type == 'cup' ? 'cups' : 'leagues',
                            c.id,
                            'apply',
                            {'teamId': _team, 'message': _message.text.trim()},
                          );
                          if (context.mounted) Navigator.pop(context, true);
                        } catch (e) {
                          if (mounted) {
                            setState(() {
                              _busy = false;
                              _error = competitionError(e);
                            });
                          }
                        }
                      },
                icon: _busy
                    ? const PateaButtonProgress()
                    : const Icon(Icons.send_outlined),
                label: Text(_busy ? 'Enviando…' : 'Enviar solicitud'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class CompetitionApplicationsPanel extends ConsumerStatefulWidget {
  final CompetitionModel competition;
  const CompetitionApplicationsPanel({super.key, required this.competition});
  @override
  ConsumerState<CompetitionApplicationsPanel> createState() =>
      _ApplicationsState();
}

class _ApplicationsState extends ConsumerState<CompetitionApplicationsPanel> {
  int _tab = 0;
  String? _busy;
  Future<void> _review(Map<String, dynamic> a, String decision) async {
    final c = widget.competition, col = c.type == 'cup' ? 'cups' : 'leagues';
    String? team;
    if (a['source'] == 'external' && decision == 'approved') {
      final uid = ref.read(currentUidProvider);
      if (uid == null) return;
      try {
        final all = await ref.read(ownedCompetitionTeamsProvider(uid).future);
        if (!mounted) return;
        final eligible = all.where((t) => !c.teamIds.contains(t.id)).toList();
        team = await showDialog<String>(
          context: context,
          builder: (context) => SimpleDialog(
            title: const Text('Vincular equipo a la inscripción externa'),
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'Elegí un equipo que administres para representar esta inscripción y mantener su plantel en la app.',
                ),
              ),
              if (eligible.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    'Primero creá el equipo y su plantel desde Gestionar grupos.',
                  ),
                ),
              for (final t in eligible)
                SimpleDialogOption(
                  onPressed: () => Navigator.pop(context, t.id),
                  child: Text(t.name),
                ),
            ],
          ),
        );
        if (team == null) return;
      } catch (e) {
        if (mounted) PateaSnack.error(context, competitionError(e));
        return;
      }
    }
    setState(() => _busy = '${a['source']}/${a['id']}');
    try {
      await ref
          .read(competitionServiceProvider)
          .command(col, c.id, 'reviewApplication', {
            'applicationId': a['id'],
            'source': a['source'],
            'decision': decision,
            'teamId': ?team,
          });
      if (mounted) {
        PateaSnack.ok(
          context,
          decision == 'approved'
              ? 'Equipo incorporado al torneo.'
              : decision == 'revoked'
              ? 'Participación revocada.'
              : 'Solicitud rechazada.',
        );
      }
    } catch (e) {
      if (mounted) PateaSnack.error(context, competitionError(e));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.competition,
        async = ref.watch(
          competitionApplicationsProvider((
            c.type == 'cup' ? 'cups' : 'leagues',
            c.id,
          )),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Quién se suma al torneo',
          style: AppTypography.headline(size: 22),
        ),
        const SizedBox(height: 8),
        Text(
          'Aprobá participantes antes del inicio. Los cupos se confirman en el servidor.',
          style: AppTypography.body(size: 14, color: context.c.textSecondary),
        ),
        const SizedBox(height: 16),
        PateaTabs(
          tabs: const [PateaTab('Pendientes'), PateaTab('Resueltas')],
          active: _tab,
          onChanged: (v) => setState(() => _tab = v),
        ),
        const SizedBox(height: 12),
        async.when(
          loading: () => const PateaLoading(height: 120),
          error: (e, _) => PateaError(error: e),
          data: (all) {
            final items =
                all
                    .where(
                      (a) => _tab == 0
                          ? a['status'] == 'pending'
                          : a['status'] != 'pending',
                    )
                    .toList()
                  ..sort(
                    (a, b) => (b['submittedAt'] ?? '').toString().compareTo(
                      (a['submittedAt'] ?? '').toString(),
                    ),
                  );
            if (items.isEmpty) {
              return PateaEmpty(
                icon: Icons.how_to_reg_outlined,
                title: _tab == 0
                    ? 'Sin solicitudes pendientes'
                    : 'Todavía no hay solicitudes resueltas',
                hint:
                    'Las postulaciones de equipos y los registros de la web aparecen acá.',
              );
            }
            return Column(
              children: [
                for (final a in items)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            JerseyWidget(
                              jersey: JerseyModel.fromMap(
                                a['teamJersey'] is Map
                                    ? Map<String, dynamic>.from(a['teamJersey'])
                                    : null,
                              ),
                              size: 38,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                (a['teamName'] ?? 'Equipo externo').toString(),
                                style: AppTypography.headline(size: 17),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          switch (a['status']) {
                            'pending' => 'Pendiente de decisión',
                            'approved' => 'Participación aprobada',
                            'rejected' => 'Solicitud rechazada',
                            'revoked' => 'Participación revocada',
                            'withdrawn' => 'Retirada por el equipo',
                            _ => 'Estado de la solicitud',
                          },
                          style: AppTypography.body(
                            size: 13,
                            color: context.c.textSecondary,
                          ),
                        ),
                        if (a['source'] == 'external')
                          const Padding(
                            padding: EdgeInsets.only(top: 6),
                            child: Text('Inscripción externa de la web'),
                          ),
                        if ((a['message'] ?? '').toString().isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(
                              a['message'].toString(),
                              style: AppTypography.body(size: 14),
                            ),
                          ),
                        if (a['source'] == 'external' &&
                            a['captainName'] != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              'Capitán: ${a['captainName']}',
                              style: AppTypography.body(size: 13),
                            ),
                          ),
                        if ([
                              'draft',
                              'open_for_applications',
                            ].contains(c.status) &&
                            !c.isArchived) ...[
                          const SizedBox(height: 10),
                          if (a['status'] == 'pending')
                            Wrap(
                              spacing: 12,
                              runSpacing: 8,
                              children: [
                                FilledButton(
                                  onPressed: _busy != null
                                      ? null
                                      : () => _review(a, 'approved'),
                                  child: Text(
                                    a['source'] == 'external'
                                        ? 'Vincular y aprobar'
                                        : 'Aprobar equipo',
                                  ),
                                ),
                                OutlinedButton(
                                  onPressed: _busy != null
                                      ? null
                                      : () => _review(a, 'rejected'),
                                  child: const Text('Rechazar'),
                                ),
                              ],
                            ),
                          if (a['status'] == 'approved' &&
                              a['source'] != 'external')
                            TextButton(
                              onPressed: _busy != null
                                  ? null
                                  : () => _review(a, 'revoked'),
                              child: const Text('Revocar participación'),
                            ),
                        ],
                        if (_busy == '${a['source']}/${a['id']}')
                          const Padding(
                            padding: EdgeInsets.only(top: 10),
                            child: LinearProgressIndicator(),
                          ),
                        const SizedBox(height: 16),
                        Divider(height: 1, color: context.c.overlayLine),
                      ],
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}
