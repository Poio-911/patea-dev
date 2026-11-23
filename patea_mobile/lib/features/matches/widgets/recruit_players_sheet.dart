import 'package:flutter/material.dart';
import '../../../core/widgets/patea_button_progress.dart';
import '../../../core/widgets/patea_card.dart';
import '../../../core/widgets/patea_snack.dart';
import '../../../core/widgets/patea_states.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/coach_models.dart';
import '../../../core/services/ai_assist_service.dart';
import '../../../core/services/coach_service.dart';

import '../../../core/models/available_player_model.dart';
import '../../../core/models/match_model.dart';
import '../../../core/services/explore_service.dart';
import '../../../core/services/firestore_service.dart';
import '../../../core/theme/patea_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/player_select_card.dart';

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
  final TextEditingController _messageController = TextEditingController();
  bool _sending = false;

  /// Radio de búsqueda de agentes libres. La web arranca en 10 km.
  double _radiusKm = 10;
  List<AvailablePlayerModel>? _nearby;
  bool _searching = false;
  String? _searchError;

  /// Sugerencia del DT sobre la lista que se está viendo.
  bool _suggesting = false;
  List<RecruitRecommendation>? _recs;
  String? _suggestError;
  Map<String, String> _recNames = const {};

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

  /// Quiénes están a la vista en la pestaña actual: uid → nombre.
  Map<String, String> _visibleCandidates() {
    if (_tab == 1) {
      return {for (final p in _nearby ?? const <AvailablePlayerModel>[]) p.uid: p.displayName};
    }
    final players = ref.read(activeGroupPlayersProvider).value ?? const [];
    return {
      for (final p in players)
        if (!_alreadyIn.contains(p.id) && p.ownerUid == p.id) p.id: p.name,
    };
  }

  Future<void> _suggest() async {
    final names = _visibleCandidates();
    if (names.isEmpty || _suggesting) return;
    setState(() {
      _suggesting = true;
      _suggestError = null;
      _recs = null;
      _recNames = names;
    });
    try {
      final recs = await ref
          .read(aiAssistServiceProvider)
          .recommendRecruits(widget.match.id, names.keys.toList());
      if (mounted) setState(() => _recs = recs);
    } catch (e) {
      if (mounted) setState(() => _suggestError = coachErrorMessage(e));
    } finally {
      if (mounted) setState(() => _suggesting = false);
    }
  }

  /// El pedido al DT: un botón, y después lo que sugiere con su motivo.
  Widget _buildSuggestion() {
    final c = context.c;
    if (_suggesting) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
        child: Row(
          children: [
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: 10),
            Text(
              'El DT está mirando la lista…',
              style: AppTypography.body(size: 13, color: c.textSecondary),
            ),
          ],
        ),
      );
    }
    final recs = _recs;
    if (recs == null) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
        child: OutlinedButton.icon(
          onPressed: _suggest,
          style: OutlinedButton.styleFrom(
            foregroundColor: c.primary,
            side: BorderSide(color: c.primary.withValues(alpha: 0.45)),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          ),
          icon: const Icon(Icons.auto_awesome_outlined, size: 16),
          label: const Text('Que el DT sugiera'),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      child: PateaCard(
        padding: const EdgeInsets.all(14),
        color: c.cardSurface.withValues(alpha: 0.65),
        borderColor: c.primary.withValues(alpha: 0.35),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.auto_awesome_outlined, size: 14, color: c.primary),
                const SizedBox(width: 6),
                Text(
                  'LECTURA DEL DT',
                  style: AppTypography.code(
                    size: 10.5,
                    weight: FontWeight.w700,
                    color: c.primary,
                  ),
                ),
                const Spacer(),
                if (recs.isNotEmpty)
                  TextButton(
                    style: TextButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                    ),
                    onPressed: () => setState(
                      () => _selected.addAll(recs.map((r) => r.playerId)),
                    ),
                    child: Text(recs.length == 1 ? 'Elegir' : 'Elegir a todos'),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              recs.isEmpty
                  ? 'El DT no ve a nadie que encaje'
                  : 'Recomendados para este partido',
              style: AppTypography.headline(size: 14, weight: FontWeight.w700),
            ),
            for (final r in recs)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: '${_recNames[r.playerId] ?? 'Jugador'}: ',
                        style: AppTypography.body(size: 13, weight: FontWeight.w700),
                      ),
                      TextSpan(
                        text: r.reason,
                        style: AppTypography.body(size: 13, color: c.textSecondary),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _invite() async {
    if (_selected.isEmpty) return;
    setState(() => _sending = true);
    try {
      final sent = await ref
          .read(exploreServiceProvider)
          .sendMatchInvitations(
            matchId: widget.match.id,
            playerIds: _selected.toList(),
            message: _messageController.text,
          );
      if (!mounted) return;
      Navigator.pop(context);
      PateaSnack.info(context, sent == 1 ? 'Invitación enviada.' : '$sent invitaciones enviadas.');
    } catch (e) {
      if (!mounted) return;
      setState(() => _sending = false);
      PateaSnack.error(context, '$e');
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
                  Text('Falta gente',
                      style: AppTypography.headline(
                          size: 14,
                          weight: FontWeight.w800,
                          color: context.c.textPrimary)),
                  const SizedBox(height: 4),
                  Text(
                    spotsLeft == 1
                        ? 'Falta 1 jugador para completar el partido.'
                        : 'Faltan $spotsLeft jugadores para completar el partido.',
                    style: AppTypography.body(size: 13, color: context.c.textSecondary),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _Tab(
                        label: 'Del grupo',
                        selected: _tab == 0,
                        onTap: () => setState(() {
                          _tab = 0;
                          _recs = null;
                          _suggestError = null;
                        }),
                      ),
                      const SizedBox(width: 8),
                      _Tab(
                        label: 'Cerca de la cancha',
                        selected: _tab == 1,
                        onTap: () => setState(() {
                          _tab = 1;
                          _recs = null;
                          _suggestError = null;
                        }),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            _buildSuggestion(),
            if (_suggestError != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                child: Text(
                  _suggestError!,
                  style: AppTypography.body(size: 13, color: context.c.destructive),
                ),
              ),
            Expanded(child: _tab == 0 ? _buildGroupTab() : _buildNearbyTab()),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: _messageController,
                      maxLength: 300,
                      decoration: const InputDecoration(
                        labelText: 'Mensaje opcional',
                        hintText: 'Ej: Nos falta 1 hoy a las 21, ¿te sumás?',
                        counterText: '',
                        isDense: true,
                      ),
                    ),
                    const SizedBox(height: 10),
                    FilledButton(
                  onPressed: _selected.isEmpty || _sending ? null : _invite,
                  style: FilledButton.styleFrom(
                    backgroundColor: context.c.primary,
                    foregroundColor: context.c.onPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                  ),
                  child: _sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: PateaButtonProgress(),
                        )
                      : Text(
                          _selected.isEmpty
                              ? 'Elegí a quién invitar'
                              : _selected.length == 1
                                  ? 'Invitar a 1 jugador'
                                  : 'Invitar a ${_selected.length} jugadores',
                          style: AppTypography.headline(
                              size: 14,
                              weight: FontWeight.w800,
                              color: _selected.isEmpty || _sending
                                  ? context.c.textSecondary
                                  : context.c.onPrimary)),
                    ),
                  ],
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
      loading: () => const PateaLoading(),
      error: (e, _) => PateaError(
        error: e,
        message: 'No pudimos cargar los jugadores del grupo.',
        onRetry: () => ref.invalidate(activeGroupPlayersProvider),
      ),
      data: (players) {
        // Los que ya están en el partido no se invitan de nuevo. Y sólo tiene
        // sentido invitar a jugadores con cuenta: los manuales no reciben nada.
        final candidates = players
            .where((p) => !_alreadyIn.contains(p.id) && p.ownerUid == p.id)
            .toList();

        if (candidates.isEmpty) {
          return const PateaEmpty(
            icon: Icons.group_outlined,
            title: 'Plantel completo',
            hint:
                'Todos los jugadores del grupo con cuenta ya están en el partido.',
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          itemCount: candidates.length,
          itemBuilder: (context, i) {
            final p = candidates[i];
            return PlayerSelectCard(
              name: p.name,
              photoUrl: p.photoUrl,
              position: p.position,
              ovr: p.ovr,
              dense: true,
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
                      size: 13, weight: FontWeight.w800, color: context.c.primary)),
              Expanded(
                child: Slider(
                  value: _radiusKm,
                  min: 1,
                  max: 50,
                  divisions: 49,
                  activeColor: context.c.primary,
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
    if (_searchError != null) {
      return PateaEmpty(
        icon: Icons.wifi_off_outlined,
        title: 'Sin resultados',
        hint: _searchError!,
      );
    }
    if (_searching && _nearby == null) {
      return const PateaLoading();
    }

    final players = _nearby ?? const <AvailablePlayerModel>[];
    if (players.isEmpty) {
      return const PateaEmpty(
        icon: Icons.travel_explore_outlined,
        title: 'No hay jugadores libres en la zona',
        hint: 'Probá agrandando el radio.',
      );
    }

    return Stack(
      children: [
        ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          itemCount: players.length,
          itemBuilder: (context, i) {
            final p = players[i];
            return PlayerSelectCard(
              name: p.displayName,
              photoUrl: p.photoUrl,
              position: p.position,
              ovr: p.ovr,
              dense: true,
              subtitle: p.distanceKm == null
                  ? null
                  : '${p.distanceKm!.toStringAsFixed(p.distanceKm! < 10 ? 1 : 0)} km de distancia',
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
              child: PateaButtonProgress(),
            ),
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
      child: PateaCard(
               color: selected ? context.c.primary : Colors.transparent,
               radius: AppRadii.chipAll,
               borderColor: selected ? context.c.primary : context.c.overlayStrong,
               padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
               child: Text(label,
            style: AppTypography.headline(
                size: 12,
                weight: FontWeight.w700,
                color: selected ? context.c.background : context.c.textSecondary)),
             ),
    );
  }
}
