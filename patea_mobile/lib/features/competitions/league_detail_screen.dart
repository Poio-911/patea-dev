import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/competition_model.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/tournament_service.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/patea_states.dart';
import 'competition_management.dart';

final leagueDetailProvider = StreamProvider.family<CompetitionModel?, String>(
  (ref, id) => ref
      .watch(firestoreServiceProvider)
      .getSingleCompetitionStream(id: id, collection: 'leagues'),
);
final leagueMatchesProvider =
    StreamProvider.family<List<Map<String, dynamic>>, String>(
      (ref, id) => ref.watch(tournamentServiceProvider).leagueMatches(id),
    );

class LeagueDetailScreen extends ConsumerWidget {
  final String leagueId;
  const LeagueDetailScreen({super.key, required this.leagueId});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(
      title: Text('Liga', style: AppTypography.headline(size: 20)),
    ),
    body: ref
        .watch(leagueDetailProvider(leagueId))
        .when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => PateaError(error: e),
          data: (league) {
            if (league == null) {
              return const Center(child: Text('La liga ya no existe.'));
            }
            final teams = league.groupId == null
                ? null
                : ref.watch(groupTeamsStreamProvider(league.groupId!));
            final names = <String, String>{
              for (final t in teams?.value ?? []) t.id: t.name,
            };
            final fixture = ref.watch(leagueMatchesProvider(leagueId));
            final matches = [...?fixture.value]
              ..sort(
                (a, b) => ((a['leagueInfo']?['round'] as num?) ?? 0).compareTo(
                  (b['leagueInfo']?['round'] as num?) ?? 0,
                ),
              );
            final computed = TournamentService.calculateStandings(
              league.teamIds,
              names,
              matches,
            );
            final standings = matches.isEmpty && league.standings.isNotEmpty
                ? league.standings
                : computed;
            final owner = ref.watch(currentUidProvider) == league.ownerUid;
            return ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(league.name, style: AppTypography.headline(size: 28)),
                const SizedBox(height: 8),
                Text(
                  competitionStatusLabel(league.status),
                  style: AppTypography.body(size: 14),
                ),
                if (owner &&
                    ['draft', 'open_for_applications'].contains(league.status))
                  Padding(
                    padding: const EdgeInsets.only(top: 20),
                    child: _StartLeagueButton(id: league.id),
                  ),
                const SizedBox(height: 24),
                Text(
                  'Tabla de posiciones',
                  style: AppTypography.headline(size: 20),
                ),
                if (fixture.isLoading) const LinearProgressIndicator(),
                if (fixture.hasError) PateaError(error: fixture.error!),
                if (!fixture.hasError && !fixture.isLoading)
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: DataTable(
                      columns: const [
                        DataColumn(label: Text('Equipo')),
                        DataColumn(label: Text('PJ'), numeric: true),
                        DataColumn(label: Text('DG'), numeric: true),
                        DataColumn(label: Text('Pts'), numeric: true),
                      ],
                      rows: [
                        for (final row in standings)
                          DataRow(
                            cells: [
                              DataCell(Text(row.teamName)),
                              DataCell(Text('${row.played}')),
                              DataCell(Text('${row.goalDiff}')),
                              DataCell(Text('${row.points}')),
                            ],
                          ),
                      ],
                    ),
                  ),
                const SizedBox(height: 24),
                Text(
                  'Fechas y partidos',
                  style: AppTypography.headline(size: 20),
                ),
                if (!fixture.isLoading && !fixture.hasError && matches.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      'Las fechas se generan cuando el organizador inicia la liga.',
                    ),
                  ),
                for (final match in matches)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(match['title'] as String? ?? 'Partido'),
                    subtitle: Text(
                      'Fecha ${match['leagueInfo']?['round'] ?? '—'} · ${match['date']?.toString().split('T').first ?? ''} · ${match['time'] ?? ''}',
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/matches/${match['id']}'),
                  ),
                const SizedBox(height: 24),
                Text(
                  'Equipos participantes',
                  style: AppTypography.headline(size: 20),
                ),
                if (teams?.hasError == true) PateaError(error: teams!.error!),
                for (final id in league.teamIds)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.shield_outlined),
                    title: Text(names[id] ?? 'Equipo no disponible'),
                  ),
                if (owner)
                  Padding(
                    padding: const EdgeInsets.only(top: 24),
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.delete_outline),
                      label: const Text('Eliminar liga'),
                      onPressed: () async {
                        try {
                          final deleted = await confirmDeleteCompetition(
                            context,
                            ref,
                            league,
                          );
                          if (deleted && context.mounted) context.pop();
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('No se pudo eliminar: $e'),
                              ),
                            );
                          }
                        }
                      },
                    ),
                  ),
              ],
            );
          },
        ),
  );
}

String competitionStatusLabel(String status) => switch (status) {
  'draft' => 'Borrador',
  'open_for_applications' => 'Inscripciones abiertas',
  'published' => 'Publicada',
  'in_progress' => 'En juego',
  'completed' => 'Finalizada',
  _ => status,
};

class _StartLeagueButton extends ConsumerStatefulWidget {
  final String id;
  const _StartLeagueButton({required this.id});
  @override
  ConsumerState<_StartLeagueButton> createState() => _StartLeagueButtonState();
}

class _StartLeagueButtonState extends ConsumerState<_StartLeagueButton> {
  bool _busy = false;
  Future<void> _start() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final now = DateTime.now();
      final date = await showDatePicker(
        context: context,
        helpText: 'Primera fecha · una jornada por semana',
        initialDate: now.add(const Duration(days: 7)),
        firstDate: now,
        lastDate: now.add(const Duration(days: 730)),
      );
      if (date == null || !mounted) return;
      final time = await showTimePicker(
        context: context,
        initialTime: const TimeOfDay(hour: 21, minute: 0),
      );
      if (time == null || !mounted) return;
      final day =
          '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
      final clock =
          '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
      await ref
          .read(tournamentServiceProvider)
          .startLeague(id: widget.id, startDate: day, time: clock);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No se pudo iniciar la liga: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => FilledButton.icon(
    onPressed: _busy ? null : _start,
    icon: _busy
        ? const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : const Icon(Icons.play_arrow),
    label: Text(_busy ? 'Generando fechas…' : 'Iniciar liga y crear fechas'),
  );
}
