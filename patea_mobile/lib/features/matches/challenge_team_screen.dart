import '../groups/team_rivals_screen.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/group_model.dart';
import '../../core/models/group_permissions.dart';
import '../../core/models/team_challenge_model.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/group_service.dart';
import '../../core/services/team_challenge_service.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/utils/team_search_text.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';

/// Los equipos de [groupId] que el usuario puede usar para desafiar: los que
/// creó, o cualquiera si tiene permiso de editar equipos en el grupo. El mismo
/// criterio del servidor (`getTeamPermissionOrThrow`); acá sólo sirve para no
/// ofrecer lo que va a fallar.
List<GroupTeamModel> manageableTeams({
  required List<GroupTeamModel> teams,
  required String? uid,
  required GroupRole? role,
}) {
  if (uid == null) return const [];
  final canEditAll = hasPermission(role, GroupPermission.teamsEdit);
  return teams
      .where((t) => t.createdBy == uid || canEditAll)
      .toList(growable: false);
}

/// Busca un equipo rival de OTRO grupo y le manda un desafío.
///
/// - No lista equipos hasta que se escribe: con menos de
///   [kTeamSearchMinChars] letras muestra una guía y nada más.
/// - Busca mientras se escribe (con una pausa para no consultar en cada tecla),
///   por prefijo en cualquier palabra del nombre, y resalta lo que coincidió.
/// - Descarta las respuestas viejas: si se escribe rápido, manda la última.
class ChallengeTeamScreen extends ConsumerStatefulWidget {
  /// Equipo propio ya elegido (viene de la ficha del equipo). Si es null se
  /// elige acá.
  final String? teamId;

  /// Pausa antes de buscar. Se puede achicar en los tests.
  final Duration debounce;

  const ChallengeTeamScreen({
    super.key,
    this.teamId,
    this.debounce = const Duration(milliseconds: 350),
  });

  @override
  ConsumerState<ChallengeTeamScreen> createState() =>
      _ChallengeTeamScreenState();
}

class _ChallengeTeamScreenState extends ConsumerState<ChallengeTeamScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;

  String? _myTeamId;
  String _query = '';
  List<TeamSearchResult> _results = const [];
  bool _searching = false;
  Object? _error;
  int _seq = 0;
  final Set<String> _sentTo = {};

  @override
  void initState() {
    super.initState();
    _myTeamId = widget.teamId;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    final text = value.trim();
    setState(() {
      _query = text;
      _error = null;
      if (text.length < kTeamSearchMinChars) {
        // Sin búsqueda no hay lista: se invalida lo que venía en camino.
        _seq++;
        _results = const [];
        _searching = false;
      }
    });
    if (text.length < kTeamSearchMinChars) return;
    _debounce = Timer(widget.debounce, _search);
  }

  Future<void> _search() async {
    final text = _query;
    if (text.length < kTeamSearchMinChars) return;
    final mine = _selectedTeam;
    final seq = ++_seq;
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final found = await ref
          .read(teamChallengeServiceProvider)
          .searchTeams(
            query: text,
            excludeTeamId: mine?.id,
            excludeGroupId: mine?.groupId,
          );
      // Llegó tarde: ya se escribió otra cosa.
      if (!mounted || seq != _seq) return;
      setState(() {
        _results = found;
        _searching = false;
      });
    } catch (e) {
      if (!mounted || seq != _seq) return;
      setState(() {
        _error = e;
        _searching = false;
      });
    }
  }

  GroupTeamModel? _selectedTeam;

  Future<void> _openChallenge(
    TeamSearchResult rival,
    GroupTeamModel mine,
  ) async {
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChallengeSheet(
        from: mine,
        to: rival,
        isRematch:
            ref
                .read(teamRivalsProvider((mine.id, false)))
                .asData
                ?.value
                .rivals
                .any((r) => r.id == rival.id && r.played > 0) ??
            false,
      ),
    );
    if (sent == true && mounted) {
      setState(() => _sentTo.add(rival.id));
      PateaSnack.ok(context, 'Desafío enviado a ${rival.name}.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(currentUidProvider);
    final groupId = ref.watch(activeGroupIdProvider).value;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'Buscar rival',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            tooltip: 'Desafíos recibidos',
            icon: const Icon(Icons.inbox_outlined),
            onPressed: () => context.push('/challenges'),
          ),
        ],
      ),
      body: groupId == null
          ? const PateaEmpty(
              icon: Icons.groups_outlined,
              title: 'Sin grupo activo',
              hint: 'Necesitás un grupo activo para desafiar a otro equipo.',
            )
          : _buildBody(context, uid, groupId),
    );
  }

  Widget _buildBody(BuildContext context, String? uid, String groupId) {
    final teamsAsync = ref.watch(groupTeamsStreamProvider(groupId));
    final role = ref.watch(myGroupRoleProvider(groupId)).value;

    return teamsAsync.when(
      loading: () => const PateaLoading(),
      error: (e, _) => PateaError(
        error: e,
        message: 'No se pudieron cargar tus equipos.',
        onRetry: () => ref.invalidate(groupTeamsStreamProvider(groupId)),
      ),
      data: (teams) {
        final mine = manageableTeams(
          teams: teams,
          uid: uid,
          role: role,
        ).where((t) => t.members.isNotEmpty).toList();
        if (mine.isEmpty) {
          return const PateaEmpty(
            icon: Icons.checkroom_outlined,
            title: 'No tenés un equipo para desafiar',
            hint:
                'Necesitás un equipo con jugadores que administres en tu grupo activo.',
          );
        }
        // El equipo elegido; si el que vino por parámetro ya no está, el primero.
        final selected = mine.firstWhere(
          (t) => t.id == _myTeamId,
          orElse: () => mine.first,
        );
        _selectedTeam = selected;
        _myTeamId = selected.id;

        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
          children: [
            if (mine.length > 1) ...[
              Text(
                'Tu equipo',
                style: AppTypography.headline(
                  size: 13,
                  color: context.c.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final team in mine)
                    ChoiceChip(
                      label: Text(team.name),
                      selected: team.id == selected.id,
                      onSelected: (_) {
                        setState(() => _myTeamId = team.id);
                        // Cambia a quién se excluye: se vuelve a buscar.
                        if (_query.length >= kTeamSearchMinChars) _search();
                      },
                    ),
                ],
              ),
              const SizedBox(height: 16),
            ] else
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Row(
                  children: [
                    JerseyWidget(jersey: selected.jersey, size: 34),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Desafiás con ${selected.name}',
                        style: AppTypography.body(
                          size: 14,
                          weight: FontWeight.w600,
                          color: context.c.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            TextField(
              controller: _controller,
              onChanged: _onChanged,
              textInputAction: TextInputAction.search,
              autocorrect: false,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search),
                hintText: 'Buscar equipo por nombre…',
                suffixIcon: _controller.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Borrar búsqueda',
                        icon: const Icon(Icons.close),
                        onPressed: () {
                          _controller.clear();
                          _onChanged('');
                        },
                      ),
              ),
            ),
            const SizedBox(height: 14),
            ..._buildResults(context, selected),
          ],
        );
      },
    );
  }

  List<Widget> _buildResults(BuildContext context, GroupTeamModel mine) {
    if (_query.length < kTeamSearchMinChars) {
      return [
        PateaCard(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.travel_explore, color: context.c.textSecondary),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Escribí al menos $kTeamSearchMinChars letras para buscar '
                  'equipos de otros grupos. No mostramos la lista completa.',
                  style: AppTypography.body(
                    size: 13,
                    color: context.c.textSecondary,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        TeamRivalsPanel(team: mine, limit: 5, preview: true),
      ];
    }
    if (_searching && _results.isEmpty) {
      return const [PateaLoading(height: 120)];
    }
    if (_error != null) {
      return [
        PateaError(
          error: _error,
          message: challengeErrorMessage(
            _error!,
            fallback: 'No se pudo buscar.',
          ),
          onRetry: _search,
          compact: true,
        ),
      ];
    }
    if (_results.isEmpty) {
      return [
        PateaEmpty(
          icon: Icons.search_off,
          title: 'Sin resultados para «$_query»',
          hint: 'Probá con otra parte del nombre.',
          compact: true,
        ),
      ];
    }

    final saved = {
      for (final rival
          in ref
                  .watch(teamRivalsProvider((mine.id, false)))
                  .asData
                  ?.value
                  .rivals ??
              [])
        rival.id: rival,
    };
    return [
      for (final team in _results) ...[
        _TeamResultTile(
          team: team,
          query: _query,
          sent:
              _sentTo.contains(team.id) ||
              saved[team.id]?.pendingChallenge == true,
          onChallenge: () => saved[team.id]?.upcomingMatchId != null
              ? context.push('/matches/${saved[team.id]!.upcomingMatchId}')
              : _openChallenge(team, mine),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            icon: Icon(
              saved.containsKey(team.id)
                  ? Icons.star_rounded
                  : Icons.star_outline_rounded,
              size: 18,
            ),
            label: Text(
              saved[team.id]?.played != null && saved[team.id]!.played > 0
                  ? 'Ya jugaron ${saved[team.id]!.played} veces'
                  : saved.containsKey(team.id)
                  ? 'Rival guardado'
                  : 'Guardar rival',
            ),
            onPressed: saved.containsKey(team.id)
                ? null
                : () async {
                    try {
                      await ref
                          .read(teamChallengeServiceProvider)
                          .setTeamRival(mine.id, team.id, save: true);
                      ref.invalidate(teamRivalsProvider);
                    } catch (e) {
                      if (context.mounted)
                        PateaSnack.error(context, challengeErrorMessage(e));
                    }
                  },
          ),
        ),
      ],
    ];
  }
}

class _TeamResultTile extends StatelessWidget {
  final TeamSearchResult team;
  final String query;
  final bool sent;
  final VoidCallback onChallenge;

  const _TeamResultTile({
    required this.team,
    required this.query,
    required this.sent,
    required this.onChallenge,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final base = AppTypography.headline(
      size: 15,
      weight: FontWeight.w700,
      color: c.textPrimary,
    );
    final detail = [
      if (team.groupName.isNotEmpty) team.groupName,
      '${team.memberCount} jugador${team.memberCount == 1 ? '' : 'es'}',
    ].join(' · ');

    return Semantics(
      button: true,
      label: 'Equipo ${team.name}',
      child: InkWell(
        onTap: sent ? null : onChallenge,
        borderRadius: AppRadii.cardAll,
        child: PateaCard(
          radius: AppRadii.cardAll,
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          borderColor: c.overlayLine,
          child: Row(
            children: [
              JerseyWidget(jersey: team.jersey, size: 44),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        children: highlightSearchMatch(
                          team.name,
                          query,
                          base: base,
                          highlight: base.copyWith(
                            color: c.primary,
                            backgroundColor: c.primary.withValues(alpha: 0.14),
                          ),
                        ),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      detail,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(
                        size: 12,
                        color: c.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              sent
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check, size: 16, color: c.textSecondary),
                        const SizedBox(width: 4),
                        Text(
                          'Enviado',
                          style: AppTypography.body(
                            size: 12,
                            weight: FontWeight.w600,
                            color: c.textSecondary,
                          ),
                        ),
                      ],
                    )
                  : OutlinedButton(
                      onPressed: onChallenge,
                      child: const Text('Desafiar'),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Hoja para armar y enviar el desafío: mensaje, y fecha/hora/cancha si ya se
/// tiene una idea. Todo es opcional; sin fecha, los capitanes la votan después.
class ChallengeSheet extends ConsumerStatefulWidget {
  final GroupTeamModel from;
  final TeamSearchResult to;
  final bool isRematch;

  const ChallengeSheet({
    super.key,
    required this.from,
    required this.to,
    this.isRematch = false,
  });

  @override
  ConsumerState<ChallengeSheet> createState() => _ChallengeSheetState();
}

class _ChallengeSheetState extends ConsumerState<ChallengeSheet> {
  final _message = TextEditingController();
  final _venue = TextEditingController();
  DateTime? _date;
  TimeOfDay? _time;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.isRematch) _message.text = '¿Revancha?';
  }

  @override
  void dispose() {
    _message.dispose();
    _venue.dispose();
    super.dispose();
  }

  String _two(int n) => n.toString().padLeft(2, '0');

  /// Una fecha sin hora (o al revés) no sirve: se manda las dos o ninguna.
  bool get _incompleteProposal => (_date == null) != (_time == null);

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date ?? now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null && mounted) setState(() => _date = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _time ?? const TimeOfDay(hour: 20, minute: 0),
    );
    if (picked != null && mounted) setState(() => _time = picked);
  }

  Future<void> _send() async {
    if (_sending || _incompleteProposal) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref
          .read(teamChallengeServiceProvider)
          .challengeTeam(
            fromTeamId: widget.from.id,
            toTeamId: widget.to.id,
            message: _message.text,
            date: _date == null
                ? null
                : '${_date!.year}-${_two(_date!.month)}-${_two(_date!.day)}',
            time: _time == null
                ? null
                : '${_two(_time!.hour)}:${_two(_time!.minute)}',
            locationName: _venue.text,
          );
      ref.invalidate(teamRivalsProvider);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _sending = false;
          _error = challengeErrorMessage(
            e,
            fallback: 'No se pudo enviar el desafío. Intentá de nuevo.',
          );
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      decoration: BoxDecoration(
        color: c.popover,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppRadii.surface),
        ),
      ),
      padding: EdgeInsets.fromLTRB(
        20,
        16,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  JerseyWidget(jersey: widget.from.jersey, size: 52),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: Text(
                      'VS',
                      style: AppTypography.headline(
                        size: 16,
                        weight: FontWeight.w800,
                        color: c.textSecondary,
                      ),
                    ),
                  ),
                  JerseyWidget(jersey: widget.to.jersey, size: 52),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                '${widget.from.name} vs ${widget.to.name}',
                textAlign: TextAlign.center,
                style: AppTypography.headline(
                  size: 18,
                  weight: FontWeight.w700,
                ),
              ),
              if (widget.to.groupName.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    'Grupo ${widget.to.groupName}',
                    textAlign: TextAlign.center,
                    style: AppTypography.body(size: 12, color: c.textSecondary),
                  ),
                ),
              const SizedBox(height: 16),
              TextField(
                controller: _message,
                maxLength: 200,
                maxLines: 2,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Mensaje (opcional)',
                  hintText: 'Ej. ¿Jugamos el sábado a la tarde?',
                ),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _sending ? null : _pickDate,
                      icon: const Icon(Icons.calendar_today_outlined, size: 16),
                      label: Text(
                        _date == null
                            ? 'Fecha'
                            : '${_two(_date!.day)}/${_two(_date!.month)}/${_date!.year}',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _sending ? null : _pickTime,
                      icon: const Icon(Icons.schedule, size: 16),
                      label: Text(
                        _time == null
                            ? 'Hora'
                            : '${_two(_time!.hour)}:${_two(_time!.minute)}',
                      ),
                    ),
                  ),
                ],
              ),
              if (_incompleteProposal)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    'Elegí fecha y hora, o dejá las dos sin definir.',
                    style: AppTypography.body(size: 12, color: c.destructive),
                  ),
                ),
              const SizedBox(height: 10),
              TextField(
                controller: _venue,
                maxLength: 80,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Cancha (opcional)',
                  counterText: '',
                ),
              ),
              Text(
                'Sin fecha ni cancha, los capitanes la definen votando cuando acepten.',
                style: AppTypography.body(size: 12, color: c.textSecondary),
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(
                  _error!,
                  style: AppTypography.body(size: 13, color: c.destructive),
                ),
              ],
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _sending || _incompleteProposal ? null : _send,
                child: _sending
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: PateaButtonProgress(),
                      )
                    : const Text('Enviar desafío'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
