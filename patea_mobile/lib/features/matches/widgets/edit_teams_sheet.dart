import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/match_model.dart';
import '../../../core/services/match_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/jersey_painter.dart';

/// Mover jugadores de un equipo al otro.
///
/// Port de `EditableTeamsDialog`. La web usa drag & drop, que en un teléfono
/// es incómodo y propenso a soltar donde no va: acá se toca al jugador y se
/// pasa al otro equipo. Misma capacidad, un gesto en vez de tres.
///
/// Al servidor le va sólo `{uid: 0|1}` — el plantel lo tiene él.
class EditTeamsSheet extends ConsumerStatefulWidget {
  final MatchModel match;

  const EditTeamsSheet({super.key, required this.match});

  static Future<void> show(BuildContext context, MatchModel match) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceTop),
      builder: (_) => EditTeamsSheet(match: match),
    );
  }

  @override
  ConsumerState<EditTeamsSheet> createState() => _EditTeamsSheetState();
}

class _EditTeamsSheetState extends ConsumerState<EditTeamsSheet> {
  /// uid -> 0 (local) o 1 (visitante).
  late Map<String, int> _side;
  late Map<String, MatchPlayerEntry> _byUid;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _side = {};
    _byUid = {};

    final teams = [widget.match.teamA, widget.match.teamB];
    for (var i = 0; i < teams.length; i++) {
      for (final p in teams[i]?.players ?? const <MatchPlayerEntry>[]) {
        // Si un jugador figura en los dos equipos (el bug que la alerta de
        // duplicados avisa), gana el primero: así la pantalla arranca en un
        // estado válido y guardar lo arregla solo.
        _side.putIfAbsent(p.uid, () => i);
        _byUid.putIfAbsent(p.uid, () => p);
      }
    }
  }

  bool get _dirty {
    final teams = [widget.match.teamA, widget.match.teamB];
    for (var i = 0; i < teams.length; i++) {
      for (final p in teams[i]?.players ?? const <MatchPlayerEntry>[]) {
        if (_side[p.uid] != i) return true;
      }
    }
    return false;
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(matchServiceProvider).updateMatchTeams(widget.match.id, _side);
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Equipos actualizados.')));
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('$e'),
        backgroundColor: AppColors.destructive,
      ));
    }
  }

  List<MatchPlayerEntry> _playersOf(int side) {
    final players = _side.entries
        .where((e) => e.value == side)
        .map((e) => _byUid[e.key])
        .whereType<MatchPlayerEntry>()
        .toList();
    // Los mejores arriba: es como se lee un equipo.
    players.sort((a, b) => b.ovr.compareTo(a.ovr));
    return players;
  }

  @override
  Widget build(BuildContext context) {
    final teamA = widget.match.teamA;
    final teamB = widget.match.teamB;
    if (teamA == null || teamB == null) return const SizedBox.shrink();

    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.85,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('ARMAR LOS EQUIPOS',
                    style: AppTypography.headline(
                        size: 12,
                        weight: FontWeight.w800,
                        color: AppColors.textMuted,
                        letterSpacing: 1.2)),
                const SizedBox(height: 4),
                Text('Tocá a un jugador para pasarlo al otro equipo.',
                    style: AppTypography.body(size: 12, color: AppColors.textSecondary)),
              ],
            ),
          ),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _TeamColumn(team: teamA, players: _playersOf(0), onTap: _move)),
                Container(width: 1, color: Colors.white.withValues(alpha: 0.08)),
                Expanded(child: _TeamColumn(team: teamB, players: _playersOf(1), onTap: _move)),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: FilledButton(
                onPressed: !_dirty || _saving ? null : _save,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.voltNeon,
                  foregroundColor: AppColors.background,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                ),
                child: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child:
                            CircularProgressIndicator(strokeWidth: 2, color: AppColors.background))
                    : Text(_dirty ? 'Guardar equipos' : 'Sin cambios',
                        style: AppTypography.headline(
                            size: 14, weight: FontWeight.w800, color: AppColors.background)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _move(String uid) {
    setState(() => _side[uid] = _side[uid] == 0 ? 1 : 0);
  }
}

class _TeamColumn extends StatelessWidget {
  final MatchTeam team;
  final List<MatchPlayerEntry> players;
  final void Function(String uid) onTap;

  const _TeamColumn({required this.team, required this.players, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final totalOvr = players.fold<int>(0, (acc, p) => acc + p.ovr);
    final avg = players.isEmpty ? 0 : (totalOvr / players.length).round();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
          child: Column(
            children: [
              if (team.jersey != null) JerseyWidget(jersey: team.jersey!, size: 38),
              const SizedBox(height: 6),
              Text(team.name,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.headline(size: 13, weight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text('${players.length} · media $avg',
                  style: AppTypography.body(size: 10, color: AppColors.textMuted)),
            ],
          ),
        ),
        Expanded(
          child: players.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text('Sin jugadores',
                        textAlign: TextAlign.center,
                        style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  itemCount: players.length,
                  itemBuilder: (context, i) {
                    final p = players[i];
                    final photo = p.photoURL ?? '';
                    return InkWell(
                      onTap: () => onTap(p.uid),
                      borderRadius: AppRadii.chipAll,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 4),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 15,
                              backgroundColor: AppColors.card,
                              backgroundImage: photo.isNotEmpty ? NetworkImage(photo) : null,
                              child: photo.isEmpty
                                  ? Text(
                                      p.displayName.isEmpty
                                          ? '?'
                                          : p.displayName.substring(0, 1).toUpperCase(),
                                      style: AppTypography.headline(
                                          size: 11, weight: FontWeight.w800))
                                  : null,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(p.displayName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style:
                                      AppTypography.headline(size: 12, weight: FontWeight.w600)),
                            ),
                            if (p.ovr > 0)
                              Text('${p.ovr}',
                                  style: AppTypography.code(
                                      size: 11,
                                      weight: FontWeight.w800,
                                      color: AppColors.textMuted)),
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

/// Aviso de que un jugador quedó anotado en los dos equipos.
///
/// Port de la alerta inline de `match-detail-view.tsx`. Pasa de verdad en
/// partidos 'by_teams' cuando alguien está en los dos equipos del grupo, y
/// rompe las evaluaciones — por eso avisa y ofrece el arreglo en el mismo
/// lugar, en vez de sólo quejarse.
class DuplicatePlayersAlert extends StatelessWidget {
  final MatchModel match;

  const DuplicatePlayersAlert({super.key, required this.match});

  List<String> get _duplicates {
    final a = match.teamA;
    final b = match.teamB;
    if (a == null || b == null) return const [];
    final inA = a.players.map((p) => p.uid).toSet();
    return b.players.where((p) => inA.contains(p.uid)).map((p) => p.displayName).toList();
  }

  @override
  Widget build(BuildContext context) {
    final names = _duplicates;
    if (names.isEmpty) return const SizedBox.shrink();

    final isOne = names.length == 1;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: AppRadii.cardAll,
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.45)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.warning_amber_rounded, size: 20, color: AppColors.warning),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isOne
                      ? '${names.first} está en los dos equipos'
                      : '${names.length} jugadores están en los dos equipos',
                  style: AppTypography.headline(size: 13, weight: FontWeight.w800),
                ),
                const SizedBox(height: 3),
                Text(
                  isOne
                      ? 'Va a evaluarse a sí mismo y los puntajes van a salir mal.'
                      : '${names.join(', ')}. Las evaluaciones van a salir mal.',
                  style: AppTypography.body(size: 11.5, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 10),
                TextButton(
                  onPressed: () => EditTeamsSheet.show(context, match),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.warning,
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text('Revisar equipos',
                      style: AppTypography.headline(
                          size: 12, weight: FontWeight.w800, color: AppColors.warning)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
