import 'package:flutter/material.dart';
import '../../../core/widgets/patea_card.dart';
import '../../../core/widgets/patea_button_progress.dart';
import '../../../core/widgets/patea_snack.dart';
import '../../../core/widgets/patea_avatar.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/match_model.dart';
import '../../../core/services/match_service.dart';
import '../../../core/services/firestore_service.dart';
import '../../../core/theme/patea_colors.dart';
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

  final bool allowRebalance;

  const EditTeamsSheet({
    super.key,
    required this.match,
    this.allowRebalance = false,
  });

  static Future<void> show(
    BuildContext context,
    MatchModel match, {
    VoidCallback? onRebalance,
  }) async {
    // Defensa en profundidad: los botones ya no se ofrecen en partidos entre
    // equipos, y el servidor lo rechaza igual. Si alguien llega hasta acá, el
    // editor no se abre: ahí los planteles son los de cada equipo.
    if (match.isTeamMatch) return;
    final rebalance = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceTop),
      builder: (_) =>
          EditTeamsSheet(match: match, allowRebalance: onRebalance != null),
    );
    if (rebalance == true && context.mounted) onRebalance?.call();
  }

  @override
  ConsumerState<EditTeamsSheet> createState() => _EditTeamsSheetState();
}

class _EditTeamsSheetState extends ConsumerState<EditTeamsSheet> {
  /// uid -> 0 (local) o 1 (visitante).
  late Map<String, int> _side;
  late Map<String, MatchPlayerEntry> _byUid;
  bool _saving = false;
  bool _recoveredPlayers = false;
  late final Map<String, int> _initialSide;

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
    for (final player in widget.match.players) {
      if (_side.containsKey(player.uid)) continue;
      final a = _side.values.where((side) => side == 0).length;
      final b = _side.length - a;
      _side[player.uid] = a <= b ? 0 : 1;
      _byUid[player.uid] = player;
      _recoveredPlayers = true;
    }
    _initialSide = Map.of(_side);
  }

  bool get _movedPlayers =>
      _side.entries.any((entry) => _initialSide[entry.key] != entry.value);

  bool get _dirty => _recoveredPlayers || _movedPlayers;

  Future<void> _save() async {
    if (_saving || _playersOf(0).isEmpty || _playersOf(1).isEmpty) return;
    if (ref.read(currentUidProvider) != widget.match.ownerUid) {
      PateaSnack.error(
        context,
        'Sólo el organizador puede cambiar los equipos.',
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await ref
          .read(matchServiceProvider)
          .updateMatchTeams(widget.match.id, _side);
      if (!mounted) return;
      final snack = PateaSnack.of(context);
      Navigator.pop(context);
      snack.info('Equipos actualizados.');
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      PateaSnack.error(context, '$e');
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
    final canEdit = ref.watch(currentUidProvider) == widget.match.ownerUid;
    final aPlayers = _playersOf(0);
    final bPlayers = _playersOf(1);
    double avg(List<MatchPlayerEntry> players) => players.isEmpty
        ? 0
        : players.fold<int>(0, (sum, p) => sum + p.ovr) / players.length;
    final difference = (avg(aPlayers) - avg(bPlayers)).abs();
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
                Text(
                  'Armar los equipos',
                  style: AppTypography.headline(
                    size: 14,
                    weight: FontWeight.w800,
                    color: context.c.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Diferencia de nivel medio: ${difference.toStringAsFixed(1)} OVR',
                  style: AppTypography.body(
                    size: 12,
                    color: context.c.textSecondary,
                  ),
                ),
                if ((aPlayers.length - bPlayers.length).abs() > 1)
                  Text(
                    'Los equipos tienen distinta cantidad de jugadores.',
                    style: AppTypography.body(
                      size: 12,
                      color: context.c.warningText,
                    ),
                  ),
                if (!canEdit)
                  Text(
                    'Sólo el organizador puede guardar cambios.',
                    style: AppTypography.body(
                      size: 12,
                      color: context.c.warningText,
                    ),
                  ),
                Text(
                  'Tocá a un jugador para pasarlo al otro equipo.',
                  style: AppTypography.body(
                    size: 12,
                    color: context.c.textSecondary,
                  ),
                ),
                if (widget.allowRebalance)
                  TextButton.icon(
                    onPressed: _saving || _movedPlayers
                        ? null
                        : () => Navigator.pop(context, true),
                    icon: const Icon(Icons.shuffle_rounded, size: 17),
                    label: const Text('Recalcular equilibrio'),
                  ),
              ],
            ),
          ),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _TeamColumn(
                    team: teamA,
                    players: _playersOf(0),
                    onTap: _move,
                  ),
                ),
                Container(width: 1, color: context.c.overlaySubtle),
                Expanded(
                  child: _TeamColumn(
                    team: teamB,
                    players: _playersOf(1),
                    onTap: _move,
                  ),
                ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: FilledButton(
                onPressed:
                    !_dirty ||
                        _saving ||
                        !canEdit ||
                        aPlayers.isEmpty ||
                        bPlayers.isEmpty
                    ? null
                    : _save,
                style: FilledButton.styleFrom(
                  backgroundColor: context.c.primary,
                  foregroundColor: context.c.onPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: const RoundedRectangleBorder(
                    borderRadius: AppRadii.cardAll,
                  ),
                ),
                child: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: PateaButtonProgress(),
                      )
                    : Text(
                        _dirty ? 'Guardar equipos' : 'Sin cambios',
                        style: AppTypography.headline(
                          size: 14,
                          weight: FontWeight.w800,
                          color:
                              (_saving ||
                                  !canEdit ||
                                  aPlayers.isEmpty ||
                                  bPlayers.isEmpty)
                              ? context.c.textSecondary
                              : context.c.onPrimary,
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _move(String uid) {
    if (_saving || ref.read(currentUidProvider) != widget.match.ownerUid) {
      return;
    }
    setState(() => _side[uid] = _side[uid] == 0 ? 1 : 0);
  }
}

class _TeamColumn extends StatelessWidget {
  final MatchTeam team;
  final List<MatchPlayerEntry> players;
  final void Function(String uid) onTap;

  const _TeamColumn({
    required this.team,
    required this.players,
    required this.onTap,
  });

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
              if (team.jersey != null)
                JerseyWidget(jersey: team.jersey!, size: 38),
              const SizedBox(height: 6),
              Text(
                team.name,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.headline(
                  size: 13,
                  weight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '${players.length} · media $avg',
                style: AppTypography.body(
                  size: 12,
                  color: context.c.textSecondary,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: players.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      'Sin jugadores',
                      textAlign: TextAlign.center,
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.textSecondary,
                      ),
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  itemCount: players.length,
                  itemBuilder: (context, i) {
                    final p = players[i];
                    final photo = p.photoURL ?? '';
                    final tierCol = p.ovr >= 85
                        ? context.c.eliteBorder
                        : p.ovr >= 75
                        ? context.c.goldBorder
                        : p.ovr >= 60
                        ? context.c.silverBorder
                        : context.c.bronzeBorder;
                    final posCol = context.c.positionColor(p.position);

                    return Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      child: InkWell(
                        onTap: () => onTap(p.uid),
                        borderRadius: AppRadii.cardAll,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            vertical: 6,
                            horizontal: 8,
                          ),
                          decoration: BoxDecoration(
                            color: context.c.cardSurface.withValues(alpha: 0.6),
                            borderRadius: AppRadii.cardAll,
                            border: Border.all(
                              color: context.c.border.withValues(alpha: 0.3),
                              width: 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                constraints: const BoxConstraints(
                                  minWidth: 28,
                                  minHeight: 28,
                                ),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: tierCol.withValues(alpha: 0.12),
                                  borderRadius: AppRadii.surfaceAll,
                                  border: Border.all(
                                    color: tierCol.withValues(alpha: 0.5),
                                    width: 1,
                                  ),
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  p.ovr > 0 ? '${p.ovr}' : '—',
                                  style: AppTypography.sportNumber(
                                    size: 12,
                                    color: context.c.ovrTextColor(p.ovr),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              PateaAvatar(
                                photoUrl: photo,
                                seed: p.displayName,
                                size: 24,
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      p.displayName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppTypography.headline(
                                        size: 12,
                                        weight: FontWeight.w700,
                                      ),
                                    ),
                                    if (p.position.isNotEmpty)
                                      Text(
                                        p.position,
                                        style: AppTypography.code(
                                          size: 12,
                                          weight: FontWeight.w700,
                                          color: posCol,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              Icon(
                                Icons.swap_horiz,
                                size: 15,
                                color: context.c.textSecondary.withValues(
                                  alpha: 0.6,
                                ),
                              ),
                            ],
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
    return b.players
        .where((p) => inA.contains(p.uid))
        .map((p) => p.displayName)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final names = _duplicates;
    if (names.isEmpty) return const SizedBox.shrink();

    final isOne = names.length == 1;
    return PateaCard(
      radius: AppRadii.cardAll,
      borderColor: context.c.warning.withValues(alpha: 0.45),
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.warning_amber_rounded,
            size: 20,
            color: context.c.warningText,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isOne
                      ? '${names.first} está en los dos equipos'
                      : '${names.length} jugadores están en los dos equipos',
                  style: AppTypography.headline(
                    size: 13,
                    weight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  isOne
                      ? 'Va a evaluarse a sí mismo y los puntajes van a salir mal.'
                      : '${names.join(', ')}. Las evaluaciones van a salir mal.',
                  style: AppTypography.body(
                    size: 12,
                    color: context.c.textSecondary,
                  ),
                ),
                const SizedBox(height: 10),
                TextButton(
                  onPressed: () => EditTeamsSheet.show(context, match),
                  style: TextButton.styleFrom(
                    foregroundColor: context.c.warningText,
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    'Revisar equipos',
                    style: AppTypography.headline(
                      size: 12,
                      weight: FontWeight.w800,
                      color: context.c.warningText,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
