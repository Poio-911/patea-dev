import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/available_player_model.dart';
import '../../../core/models/match_model.dart';
import '../../../core/services/explore_service.dart';
import '../../../core/services/firestore_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_typography.dart';

/// Conseguir gente para un partido al que le faltan jugadores.
///
/// Port de `AvailablePlayersSection` + `RecruitmentDialog` +
/// `InvitePlayerDialog`. En la web son tres componentes y dos diálogos
/// anidados; acá es una sola hoja con dos pestañas, porque la pregunta del
/// organizador es una sola —"me falta uno, ¿a quién llamo?"— y la respuesta
/// puede estar en el grupo o afuera.
///
/// Las dos pestañas terminan en la misma llamada (`sendMatchInvitations`);
/// lo único que cambia es de dónde sale la lista.
class RecruitPlayersSheet extends ConsumerStatefulWidget {
  final MatchModel match;

  const RecruitPlayersSheet({super.key, required this.match});

  static Future<void> show(BuildContext context, MatchModel match) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceTop),
      builder: (_) => RecruitPlayersSheet(match: match),
    );
  }

  @override
  ConsumerState<RecruitPlayersSheet> createState() => _RecruitPlayersSheetState();
}

class _RecruitPlayersSheetState extends ConsumerState<RecruitPlayersSheet> {
  int _tab = 0;
  final Set<String> _selected = {};
  bool _sending = false;

  /// Radio de búsqueda de agentes libres. La web arranca en 10 km.
  double _radiusKm = 10;
  List<AvailablePlayerModel>? _nearby;
  bool _searching = false;
  String? _searchError;

  @override
  void initState() {
    super.initState();
    _search();
  }

  Set<String> get _alreadyIn => {
        ...widget.match.playerUids,
        ...widget.match.pendingPlayerUids,
        if (widget.match.ownerUid != null) widget.match.ownerUid!,
      };

  Future<void> _search() async {
    final loc = widget.match.locationDetail;
    if (loc == null || (loc.lat == 0 && loc.lng == 0)) {
      setState(() => _searchError = 'El partido no tiene una cancha con ubicación.');
      return;
    }

    setState(() {
      _searching = true;
      _searchError = null;
    });
    try {
      final players = await ref.read(exploreServiceProvider).getAvailableLocalPlayers(
            lat: loc.lat,
            lng: loc.lng,
            radiusInKm: _radiusKm,
            matchPlayerUids: widget.match.playerUids,
          );
      if (mounted) {
        setState(() => _nearby =
            players.where((p) => !_alreadyIn.contains(p.uid) && !p.isCurrentUser).toList());
      }
    } catch (e) {
      if (mounted) setState(() => _searchError = '$e');
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _invite() async {
    if (_selected.isEmpty) return;
    setState(() => _sending = true);
    try {
      final sent = await ref
          .read(exploreServiceProvider)
          .sendMatchInvitations(matchId: widget.match.id, playerIds: _selected.toList());
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(sent == 1 ? 'Invitación enviada.' : '$sent invitaciones enviadas.'),
      ));
    } catch (e) {
      if (!mounted) return;
      setState(() => _sending = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('$e'),
        backgroundColor: AppColors.destructive,
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final spotsLeft = widget.match.matchSize - widget.match.players.length;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.82,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('FALTA GENTE',
                      style: AppTypography.headline(
                          size: 12,
                          weight: FontWeight.w800,
                          color: AppColors.textMuted,
                          letterSpacing: 1.2)),
                  const SizedBox(height: 4),
                  Text(
                    spotsLeft == 1
                        ? 'Falta 1 jugador para completar el partido.'
                        : 'Faltan $spotsLeft jugadores para completar el partido.',
                    style: AppTypography.body(size: 13, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _Tab(
                        label: 'Del grupo',
                        selected: _tab == 0,
                        onTap: () => setState(() => _tab = 0),
                      ),
                      const SizedBox(width: 8),
                      _Tab(
                        label: 'Cerca de la cancha',
                        selected: _tab == 1,
                        onTap: () => setState(() => _tab = 1),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Expanded(child: _tab == 0 ? _buildGroupTab() : _buildNearbyTab()),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: FilledButton(
                  onPressed: _selected.isEmpty || _sending ? null : _invite,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.voltNeon,
                    foregroundColor: AppColors.background,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                  ),
                  child: _sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: AppColors.background))
                      : Text(
                          _selected.isEmpty
                              ? 'Elegí a quién invitar'
                              : _selected.length == 1
                                  ? 'Invitar a 1 jugador'
                                  : 'Invitar a ${_selected.length} jugadores',
                          style: AppTypography.headline(
                              size: 14,
                              weight: FontWeight.w800,
                              color: AppColors.background)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGroupTab() {
    final playersAsync = ref.watch(activeGroupPlayersProvider);

    return playersAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.voltNeon)),
      error: (e, _) => _Empty(text: 'No se pudieron cargar los jugadores del grupo.\n$e'),
      data: (players) {
        // Los que ya están en el partido no se invitan de nuevo. Y sólo tiene
        // sentido invitar a jugadores con cuenta: los manuales no reciben nada.
        final candidates = players
            .where((p) => !_alreadyIn.contains(p.id) && p.ownerUid == p.id)
            .toList();

        if (candidates.isEmpty) {
          return const _Empty(
              text: 'Todos los jugadores del grupo con cuenta ya están en el partido.');
        }

        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          itemCount: candidates.length,
          itemBuilder: (context, i) {
            final p = candidates[i];
            return _PlayerRow(
              name: p.name,
              photoUrl: p.photoUrl,
              position: p.position,
              ovr: p.ovr,
              selected: _selected.contains(p.id),
              onTap: () => setState(() =>
                  _selected.contains(p.id) ? _selected.remove(p.id) : _selected.add(p.id)),
            );
          },
        );
      },
    );
  }

  Widget _buildNearbyTab() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Text('${_radiusKm.round()} km',
                  style: AppTypography.code(
                      size: 13, weight: FontWeight.w800, color: AppColors.voltNeon)),
              Expanded(
                child: Slider(
                  value: _radiusKm,
                  min: 1,
                  max: 50,
                  divisions: 49,
                  activeColor: AppColors.voltNeon,
                  onChanged: (v) => setState(() => _radiusKm = v),
                  // Se busca al soltar, no en cada pixel del slider.
                  onChangeEnd: (_) => _search(),
                ),
              ),
            ],
          ),
        ),
        Expanded(child: _buildNearbyList()),
      ],
    );
  }

  Widget _buildNearbyList() {
    if (_searchError != null) return _Empty(text: _searchError!);
    if (_searching && _nearby == null) {
      return const Center(child: CircularProgressIndicator(color: AppColors.voltNeon));
    }

    final players = _nearby ?? const <AvailablePlayerModel>[];
    if (players.isEmpty) {
      return const _Empty(
          text: 'No hay jugadores libres en la zona. Probá agrandando el radio.');
    }

    return Stack(
      children: [
        ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          itemCount: players.length,
          itemBuilder: (context, i) {
            final p = players[i];
            return _PlayerRow(
              name: p.displayName,
              photoUrl: p.photoUrl,
              position: p.position,
              ovr: p.ovr,
              trailing: p.distanceKm == null
                  ? null
                  : '${p.distanceKm!.toStringAsFixed(p.distanceKm! < 10 ? 1 : 0)} km',
              selected: _selected.contains(p.uid),
              onTap: () => setState(() =>
                  _selected.contains(p.uid) ? _selected.remove(p.uid) : _selected.add(p.uid)),
            );
          },
        ),
        if (_searching)
          const Positioned(
            top: 8,
            right: 24,
            child: SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.voltNeon)),
          ),
      ],
    );
  }
}

class _Tab extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _Tab({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.chipAll,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.voltNeon : Colors.transparent,
          borderRadius: AppRadii.chipAll,
          border: Border.all(
            color: selected ? AppColors.voltNeon : Colors.white.withValues(alpha: 0.18),
          ),
        ),
        child: Text(label,
            style: AppTypography.headline(
                size: 12,
                weight: FontWeight.w700,
                color: selected ? AppColors.background : AppColors.textSecondary)),
      ),
    );
  }
}

class _PlayerRow extends StatelessWidget {
  final String name;
  final String? photoUrl;
  final String position;
  final int ovr;
  final String? trailing;
  final bool selected;
  final VoidCallback onTap;

  const _PlayerRow({
    required this.name,
    required this.photoUrl,
    required this.position,
    required this.ovr,
    this.trailing,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final photo = photoUrl ?? '';
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Row(
          children: [
            CircleAvatar(
              radius: 20,
              backgroundColor: AppColors.card,
              backgroundImage: photo.isNotEmpty ? NetworkImage(photo) : null,
              child: photo.isEmpty
                  ? Text(name.isEmpty ? '?' : name.substring(0, 1).toUpperCase(),
                      style: AppTypography.headline(size: 14, weight: FontWeight.w800))
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.headline(size: 14, weight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(
                    [position, if (ovr > 0) 'OVR $ovr', if (trailing != null) trailing!]
                        .where((s) => s.isNotEmpty)
                        .join('  ·  '),
                    style: AppTypography.body(size: 11, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
            Icon(
              selected ? Icons.check_circle_rounded : Icons.circle_outlined,
              size: 22,
              color: selected ? AppColors.voltNeon : AppColors.textMuted.withValues(alpha: 0.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  final String text;

  const _Empty({required this.text});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: AppTypography.body(size: 13, color: AppColors.textMuted),
        ),
      ),
    );
  }
}
