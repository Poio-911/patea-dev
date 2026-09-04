import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/models/group_model.dart';
import '../../../core/models/player_model.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';

/// Una fila editable del plantel.
class RosterEntry {
  final PlayerModel player;
  int number;
  bool starter;
  bool included;

  RosterEntry({
    required this.player,
    required this.number,
    required this.starter,
    required this.included,
  });
}

/// Gestión del plantel de un equipo.
///
/// Port de `ManageRosterDialog` de la web, pero con los gestos del teléfono:
/// el estado titular/suplente se cambia tocando, y el número se edita en una
/// rueda en vez de un campo de texto donde se puede escribir cualquier cosa.
///
/// Arregla un bug real de la versión anterior: al guardar, la app mandaba
/// `{'number': i + 1, 'status': 'titular'}` para todos — le ponía número
/// secuencial a cada uno y **aplastaba a todos los suplentes**, aunque el
/// modelo y la base soportan la distinción.
class ManageRosterSheet extends StatefulWidget {
  final String teamName;
  final List<PlayerModel> groupPlayers;
  final List<TeamMemberEntry> current;

  const ManageRosterSheet({
    super.key,
    required this.teamName,
    required this.groupPlayers,
    required this.current,
  });

  @override
  State<ManageRosterSheet> createState() => _ManageRosterSheetState();
}

class _ManageRosterSheetState extends State<ManageRosterSheet> {
  late List<RosterEntry> _entries;

  @override
  void initState() {
    super.initState();
    _entries = widget.groupPlayers.map((p) {
      final member = widget.current.where((m) => m.playerId == p.id).firstOrNull;
      return RosterEntry(
        player: p,
        number: member?.number ?? 0,
        starter: (member?.status ?? 'titular') == 'titular',
        included: member != null,
      );
    }).toList()
      ..sort((a, b) {
        if (a.included != b.included) return a.included ? -1 : 1;
        if (a.number != b.number) {
          if (a.number == 0) return 1;
          if (b.number == 0) return -1;
          return a.number.compareTo(b.number);
        }
        return a.player.name.compareTo(b.player.name);
      });
  }

  /// Números repetidos entre los jugadores incluidos. El 0 significa "sin
  /// número" y puede repetirse.
  Set<int> get _duplicates {
    final counts = <int, int>{};
    for (final e in _entries) {
      if (!e.included || e.number == 0) continue;
      counts[e.number] = (counts[e.number] ?? 0) + 1;
    }
    return counts.entries.where((e) => e.value > 1).map((e) => e.key).toSet();
  }

  int get _starterCount => _entries.where((e) => e.included && e.starter).length;
  int get _subCount => _entries.where((e) => e.included && !e.starter).length;

  /// Reparte los números libres más bajos entre quienes no tienen.
  void _autoNumber() {
    HapticFeedback.selectionClick();
    final used = _entries
        .where((e) => e.included && e.number > 0)
        .map((e) => e.number)
        .toSet();
    var next = 1;
    setState(() {
      for (final e in _entries) {
        if (!e.included || e.number > 0) continue;
        while (used.contains(next)) {
          next++;
        }
        e.number = next;
        used.add(next);
      }
    });
  }

  Future<void> _pickNumber(RosterEntry entry) async {
    final chosen = await showModalBottomSheet<int>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: 300,
        decoration: const BoxDecoration(
          color: Color(0xFF141B27),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 14),
            Text('Número de ${entry.player.name}',
                style: AppTypography.headline(size: 15, weight: FontWeight.w700)),
            const SizedBox(height: 8),
            Expanded(
              child: ListWheelScrollView.useDelegate(
                itemExtent: 46,
                perspective: 0.004,
                physics: const FixedExtentScrollPhysics(),
                controller: FixedExtentScrollController(initialItem: entry.number),
                onSelectedItemChanged: (_) => HapticFeedback.selectionClick(),
                childDelegate: ListWheelChildBuilderDelegate(
                  childCount: 100,
                  builder: (context, i) => Center(
                    child: GestureDetector(
                      onTap: () => Navigator.pop(ctx, i),
                      child: Text(
                        i == 0 ? 'sin número' : '$i',
                        style: AppTypography.sportNumber(
                          size: i == 0 ? 16 : 24,
                          color: i == 0 ? AppColors.textMuted : AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
    if (chosen != null) setState(() => entry.number = chosen);
  }

  void _save() {
    final members = _entries
        .where((e) => e.included)
        .map((e) => {
              'playerId': e.player.id,
              'number': e.number,
              // Acá estaba el bug: antes iba 'titular' fijo para todos.
              'status': e.starter ? 'titular' : 'suplente',
            })
        .toList();
    Navigator.pop(context, members);
  }

  @override
  Widget build(BuildContext context) {
    final dups = _duplicates;

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF141B27),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 48,
              height: 5,
              decoration: BoxDecoration(
                color: AppColors.textMuted.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Plantel',
                            style: AppTypography.headline(size: 19, weight: FontWeight.w800)),
                        Text(
                          '$_starterCount ${_starterCount == 1 ? 'titular' : 'titulares'} · $_subCount ${_subCount == 1 ? 'suplente' : 'suplentes'}',
                          style: AppTypography.body(size: 12, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _autoNumber,
                    icon: const Icon(Icons.auto_fix_high, size: 15),
                    label: Text('Autonumerar',
                        style: AppTypography.body(size: 12, weight: FontWeight.w600)),
                    style: TextButton.styleFrom(foregroundColor: AppColors.voltNeon),
                  ),
                ],
              ),
            ),

            if (dups.isNotEmpty)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                decoration: BoxDecoration(
                  color: AppColors.warning.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Text(
                  'Números repetidos: ${(dups.toList()..sort()).join(', ')}',
                  style: AppTypography.body(size: 12, color: AppColors.warning),
                ),
              ),

            Expanded(
              child: ListView.separated(
                controller: scrollController,
                padding: const EdgeInsets.fromLTRB(14, 4, 14, 16),
                itemCount: _entries.length,
                separatorBuilder: (_, _) => const SizedBox(height: 4),
                itemBuilder: (context, i) => _RosterRow(
                  entry: _entries[i],
                  duplicated: _entries[i].included &&
                      _entries[i].number > 0 &&
                      dups.contains(_entries[i].number),
                  onToggleIncluded: () => setState(() {
                    HapticFeedback.selectionClick();
                    _entries[i].included = !_entries[i].included;
                  }),
                  onToggleStarter: () => setState(() {
                    HapticFeedback.selectionClick();
                    _entries[i].starter = !_entries[i].starter;
                  }),
                  onPickNumber: () => _pickNumber(_entries[i]),
                ),
              ),
            ),

            Padding(
              padding: EdgeInsets.fromLTRB(
                  20, 6, 20, 16 + MediaQuery.of(context).padding.bottom),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.voltNeon,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text('Guardar plantel',
                      style: AppTypography.headline(
                          size: 14, weight: FontWeight.w700, color: Colors.black)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RosterRow extends StatelessWidget {
  final RosterEntry entry;
  final bool duplicated;
  final VoidCallback onToggleIncluded;
  final VoidCallback onToggleStarter;
  final VoidCallback onPickNumber;

  const _RosterRow({
    required this.entry,
    required this.duplicated,
    required this.onToggleIncluded,
    required this.onToggleStarter,
    required this.onPickNumber,
  });

  @override
  Widget build(BuildContext context) {
    final inTeam = entry.included;

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 150),
      opacity: inTeam ? 1 : 0.45,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFF0F141D),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            // Dentro / fuera del equipo.
            GestureDetector(
              onTap: onToggleIncluded,
              child: Icon(
                inTeam ? Icons.check_circle : Icons.add_circle_outline,
                size: 21,
                color: inTeam ? AppColors.voltNeon : AppColors.textMuted,
              ),
            ),
            const SizedBox(width: 11),

            Expanded(
              child: Text(
                entry.player.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.body(size: 13, weight: FontWeight.w600),
              ),
            ),

            if (inTeam) ...[
              // Titular o suplente, tocando.
              GestureDetector(
                onTap: onToggleStarter,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: entry.starter
                        ? AppColors.voltNeon.withValues(alpha: 0.16)
                        : Colors.white.withValues(alpha: 0.07),
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: Text(
                    entry.starter ? 'TITULAR' : 'SUPLENTE',
                    style: AppTypography.code(
                      size: 9,
                      weight: FontWeight.w700,
                      color: entry.starter ? AppColors.voltNeon : AppColors.textMuted,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 9),

              // Número.
              GestureDetector(
                onTap: onPickNumber,
                child: Container(
                  width: 38,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: duplicated
                        ? AppColors.warning.withValues(alpha: 0.18)
                        : Colors.white.withValues(alpha: 0.07),
                    borderRadius: BorderRadius.circular(7),
                    border: duplicated
                        ? Border.all(color: AppColors.warning.withValues(alpha: 0.7))
                        : null,
                  ),
                  child: Text(
                    entry.number == 0 ? '—' : '${entry.number}',
                    style: AppTypography.sportNumber(
                      size: 14,
                      color: entry.number == 0 ? AppColors.textMuted : AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
