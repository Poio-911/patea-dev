import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/match_model.dart';
import '../../../core/services/location_service.dart';
import '../../../core/services/match_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_typography.dart';

/// Cuándo y dónde se juega, cuando todavía no está decidido.
///
/// Port de `date-voting.tsx` y `location-voting.tsx`. Aparece sólo mientras
/// el partido está en 'planning' o la votación sigue abierta.
///
/// Un partido creado sin fecha nace así, y el móvil ya lo dejaba crear con el
/// switch "definir después" — pero después no tenía con qué votarlo, así que
/// quedaba colgado esperando que alguien lo resolviera desde la web.
///
/// Las dos votaciones se comportan distinto, y es a propósito (viene de la
/// web): la de fecha deja marcar varios días, porque la pregunta real es
/// "¿cuándo podés?"; la de cancha es de voto único, porque se juega en una
/// sola.
class MatchPlanningView extends ConsumerWidget {
  final MatchModel match;
  final String? uid;

  const MatchPlanningView({super.key, required this.match, required this.uid});

  bool get _isVisible => match.status == 'planning' || match.isVotingOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!_isVisible) return const SizedBox.shrink();

    final isCaptain = uid != null && match.ownerUid == uid;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _DateVoting(match: match, uid: uid, isCaptain: isCaptain),
        if (match.locationProposals.isNotEmpty || isCaptain) ...[
          const SizedBox(height: 24),
          _LocationVoting(match: match, uid: uid, isCaptain: isCaptain),
        ],
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Fecha
// ---------------------------------------------------------------------------

class _DateVoting extends ConsumerStatefulWidget {
  final MatchModel match;
  final String? uid;
  final bool isCaptain;

  const _DateVoting({required this.match, required this.uid, required this.isCaptain});

  @override
  ConsumerState<_DateVoting> createState() => _DateVotingState();
}

class _DateVotingState extends ConsumerState<_DateVoting> {
  String? _busy;

  Future<void> _run(String key, Future<void> Function() action) async {
    setState(() => _busy = key);
    try {
      await action();
    } catch (e) {
      if (mounted) _snack(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _propose() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
      initialDate: now.add(const Duration(days: 1)),
    );
    if (date == null || !mounted) return;

    final time = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 21, minute: 0),
    );
    if (time == null) return;

    final hhmm = '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    await _run('propose', () async {
      await ref
          .read(matchServiceProvider)
          .proposeMatchDate(widget.match.id, date.toIso8601String(), hhmm);
    });
  }

  @override
  Widget build(BuildContext context) {
    // Más votada arriba: la lista es el resultado, no un formulario.
    final proposals = [...widget.match.dateProposals]
      ..sort((a, b) => b.votes.length.compareTo(a.votes.length));
    final leaderVotes = proposals.isEmpty ? 0 : proposals.first.votes.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Header(
          label: 'CUÁNDO SE JUEGA',
          actionLabel: widget.isCaptain ? 'Proponer' : null,
          busy: _busy == 'propose',
          onAction: _propose,
        ),
        const SizedBox(height: 12),
        if (proposals.isEmpty)
          Text(
            widget.isCaptain
                ? 'Proponé uno o más días y que el grupo marque cuándo puede.'
                : 'Todavía no hay días propuestos.',
            style: AppTypography.body(size: 12, color: AppColors.textMuted),
          )
        else
          for (final p in proposals)
            _ProposalRow(
              title: _formatDay(p.dateTime),
              subtitle: '${p.time} hs',
              votes: p.votes.length,
              voted: widget.uid != null && p.votes.contains(widget.uid),
              leading: p.votes.length == leaderVotes && leaderVotes > 0,
              busy: _busy == p.id,
              canConfirm: widget.isCaptain,
              onVote: widget.match.isVotingOpen
                  ? () => _run(p.id,
                      () => ref.read(matchServiceProvider).voteMatchDate(widget.match.id, p.id))
                  : null,
              onConfirm: () => _run(p.id,
                  () => ref.read(matchServiceProvider).confirmMatchDate(widget.match.id, p.id)),
            ),
      ],
    );
  }
}

/// Días y meses a mano, igual que `matches_screen.dart` y
/// `player_match_debrief.dart`. La app no inicializa los datos de locale de
/// `intl`, así que `DateFormat(..., 'es')` tira LocaleDataException en runtime
/// — cosa que el analizador no ve.
const _weekdays = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
];
const _months = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

String _formatDay(DateTime? d) {
  if (d == null) return 'Sin fecha';
  return '${_weekdays[d.weekday - 1]} ${d.day} de ${_months[d.month - 1]}';
}

// ---------------------------------------------------------------------------
// Cancha
// ---------------------------------------------------------------------------

class _LocationVoting extends ConsumerStatefulWidget {
  final MatchModel match;
  final String? uid;
  final bool isCaptain;

  const _LocationVoting({required this.match, required this.uid, required this.isCaptain});

  @override
  ConsumerState<_LocationVoting> createState() => _LocationVotingState();
}

class _LocationVotingState extends ConsumerState<_LocationVoting> {
  String? _busy;

  Future<void> _run(String key, Future<void> Function() action) async {
    setState(() => _busy = key);
    try {
      await action();
    } catch (e) {
      if (mounted) _snack(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _propose() async {
    final picked = await showModalBottomSheet<LocationSuggestion>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceTop),
      builder: (_) => const _LocationSearchSheet(),
    );
    if (picked == null) return;

    await _run('propose', () async {
      await ref.read(matchServiceProvider).proposeMatchLocation(widget.match.id, {
        // El nombre corto es la primera parte de lo que devuelve Nominatim;
        // el resto es la dirección.
        'name': picked.label.split(',').first.trim(),
        'address': picked.label,
        'lat': picked.lat,
        'lng': picked.lng,
        'placeId': picked.placeId,
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final proposals = [...widget.match.locationProposals]
      ..sort((a, b) => b.votes.length.compareTo(a.votes.length));
    final leaderVotes = proposals.isEmpty ? 0 : proposals.first.votes.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Header(
          label: 'DÓNDE SE JUEGA',
          actionLabel: widget.isCaptain ? 'Proponer' : null,
          busy: _busy == 'propose',
          onAction: _propose,
        ),
        const SizedBox(height: 12),
        if (proposals.isEmpty)
          Text(
            widget.isCaptain
                ? 'Proponé canchas para que el grupo elija una.'
                : 'Todavía no hay canchas propuestas.',
            style: AppTypography.body(size: 12, color: AppColors.textMuted),
          )
        else
          for (final p in proposals)
            _ProposalRow(
              title: p.location.name,
              subtitle: p.location.address,
              votes: p.votes.length,
              voted: widget.uid != null && p.votes.contains(widget.uid),
              leading: p.votes.length == leaderVotes && leaderVotes > 0,
              busy: _busy == p.id,
              canConfirm: widget.isCaptain,
              onVote: widget.match.isVotingOpen
                  ? () => _run(p.id,
                      () => ref.read(matchServiceProvider).voteMatchLocation(widget.match.id, p.id))
                  : null,
              onConfirm: () => _run(p.id,
                  () => ref.read(matchServiceProvider).confirmMatchLocation(widget.match.id, p.id)),
            ),
      ],
    );
  }
}

/// Buscador de canchas. Mismo Nominatim que el wizard de armar partido.
class _LocationSearchSheet extends StatefulWidget {
  const _LocationSearchSheet();

  @override
  State<_LocationSearchSheet> createState() => _LocationSearchSheetState();
}

class _LocationSearchSheetState extends State<_LocationSearchSheet> {
  final _service = LocationService();
  final _controller = TextEditingController();
  Timer? _debounce;
  List<LocationSuggestion> _results = const [];
  bool _searching = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    // Nominatim es un servicio gratuito: no se le pega en cada tecla.
    _debounce = Timer(const Duration(milliseconds: 450), () async {
      if (value.trim().length < 3) {
        setState(() => _results = const []);
        return;
      }
      setState(() => _searching = true);
      try {
        final results = await _service.suggest(value);
        if (mounted) setState(() => _results = results);
      } catch (_) {
        if (mounted) setState(() => _results = const []);
      } finally {
        if (mounted) setState(() => _searching = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('PROPONER CANCHA',
              style: AppTypography.headline(
                  size: 12,
                  weight: FontWeight.w800,
                  color: AppColors.textMuted,
                  letterSpacing: 1.2)),
          const SizedBox(height: 14),
          TextField(
            controller: _controller,
            autofocus: true,
            onChanged: _onChanged,
            style: AppTypography.body(size: 14),
            decoration: InputDecoration(
              hintText: 'Nombre de la cancha o dirección',
              prefixIcon: const Icon(Icons.search_rounded, size: 20),
              suffixIcon: _searching
                  ? const Padding(
                      padding: EdgeInsets.all(14),
                      child: SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: AppColors.voltNeon)),
                    )
                  : null,
            ),
          ),
          const SizedBox(height: 12),
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 280),
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final r in _results)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.place_outlined, size: 20, color: AppColors.textMuted),
                    title: Text(r.label.split(',').first.trim(),
                        style: AppTypography.headline(size: 14, weight: FontWeight.w700)),
                    subtitle: Text(r.label,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                    onTap: () => Navigator.pop(context, r),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Piezas compartidas
// ---------------------------------------------------------------------------

class _Header extends StatelessWidget {
  final String label;
  final String? actionLabel;
  final bool busy;
  final VoidCallback onAction;

  const _Header({
    required this.label,
    required this.actionLabel,
    required this.busy,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(label,
              style: AppTypography.headline(
                  size: 11,
                  weight: FontWeight.w800,
                  color: AppColors.textMuted,
                  letterSpacing: 1.2)),
        ),
        if (actionLabel != null)
          TextButton.icon(
            onPressed: busy ? null : onAction,
            icon: busy
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.voltNeon))
                : const Icon(Icons.add_rounded, size: 16),
            label: Text(actionLabel!,
                style: AppTypography.headline(
                    size: 12, weight: FontWeight.w700, color: AppColors.voltNeon)),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.voltNeon,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
      ],
    );
  }
}

class _ProposalRow extends StatelessWidget {
  final String title;
  final String subtitle;
  final int votes;
  final bool voted;

  /// Va ganando. Se marca con la barra, no con un color de fondo: la fila
  /// tiene que seguir leyéndose como una opción más.
  final bool leading;
  final bool busy;
  final bool canConfirm;
  final VoidCallback? onVote;
  final VoidCallback onConfirm;

  const _ProposalRow({
    required this.title,
    required this.subtitle,
    required this.votes,
    required this.voted,
    required this.leading,
    required this.busy,
    required this.canConfirm,
    required this.onVote,
    required this.onConfirm,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 3,
            height: 38,
            margin: const EdgeInsets.only(right: 12),
            decoration: BoxDecoration(
              color: leading ? AppColors.voltNeon : Colors.white.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.headline(size: 14, weight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(
                  votes == 0
                      ? subtitle
                      : '$subtitle  ·  $votes ${votes == 1 ? 'voto' : 'votos'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body(size: 11, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          if (busy)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.voltNeon)),
            )
          else ...[
            if (canConfirm) ...[
              _IconAction(
                icon: Icons.check_rounded,
                color: AppColors.success,
                tooltip: 'Elegir esta',
                onTap: onConfirm,
              ),
              const SizedBox(width: 8),
            ],
            _VoteButton(voted: voted, onTap: onVote),
          ],
        ],
      ),
    );
  }
}

class _VoteButton extends StatelessWidget {
  final bool voted;
  final VoidCallback? onTap;

  const _VoteButton({required this.voted, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.chipAll,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: voted ? AppColors.voltNeon : Colors.transparent,
          borderRadius: AppRadii.chipAll,
          border: Border.all(
            color: voted ? AppColors.voltNeon : Colors.white.withValues(alpha: 0.2),
          ),
        ),
        child: Icon(
          voted ? Icons.thumb_up_rounded : Icons.thumb_up_outlined,
          size: 16,
          color: voted ? AppColors.background : AppColors.textSecondary,
        ),
      ),
    );
  }
}

class _IconAction extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String tooltip;
  final VoidCallback onTap;

  const _IconAction({
    required this.icon,
    required this.color,
    required this.tooltip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.chipAll,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: AppRadii.chipAll,
            border: Border.all(color: color.withValues(alpha: 0.4)),
          ),
          child: Icon(icon, size: 16, color: color),
        ),
      ),
    );
  }
}

void _snack(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Text(message),
    backgroundColor: error ? AppColors.destructive : null,
  ));
}
