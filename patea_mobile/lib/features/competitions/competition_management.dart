import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:typed_data';
import '../../core/models/competition_model.dart';
import '../../core/services/competition_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/patea_background.dart';
import '../../core/widgets/patea_button_progress.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';
import '../../core/widgets/jersey_painter.dart';

String competitionError(Object e) => e
    .toString()
    .replaceFirst('Exception: ', '')
    .replaceFirst('Bad state: ', '')
    .replaceFirst('Invalid argument(s): ', '');

class CreateCompetitionScreen extends ConsumerStatefulWidget {
  final bool isCup;
  final String groupId;
  final CompetitionModel? competition;
  const CreateCompetitionScreen({
    super.key,
    required this.isCup,
    required this.groupId,
    this.competition,
  });
  @override
  ConsumerState<CreateCompetitionScreen> createState() =>
      _CompetitionEditorState();
}

class _CompetitionEditorState extends ConsumerState<CreateCompetitionScreen> {
  final _requestId = const Uuid().v4();
  final _name = TextEditingController(),
      _description = TextEditingController(),
      _venue = TextEditingController(),
      _address = TextEditingController();
  final _selected = <String>{};
  int _step = 0, _capacity = 16, _win = 3, _draw = 1;
  bool _saving = false, _public = false, _returnLeg = false;
  String _frequency = 'weekly', _time = '21:00', _date = '';
  String? _error;
  Uint8List? _logoBytes;
  String? _logoUrl;

  Future<void> _pickLogo() async {
    try {
      final file = await ImagePicker().pickImage(source: ImageSource.gallery);
      if (file == null || !mounted) return;
      if (await file.length() > 5 * 1024 * 1024) {
        throw const FormatException('Elegí un logo de hasta 5 MB.');
      }
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      if (bytes.length < 8 ||
          !(bytes[0] == 0xff && bytes[1] == 0xd8 ||
              bytes[0] == 0x89 &&
                  bytes[1] == 0x50 &&
                  bytes[2] == 0x4e &&
                  bytes[3] == 0x47)) {
        throw const FormatException('Elegí un archivo PNG o JPG.');
      }
      setState(() {
        _logoBytes = bytes;
        _logoUrl = null;
        _error = null;
      });
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = e is FormatException
              ? e.message
              : 'No pudimos abrir esa imagen.',
        );
      }
    }
  }

  @override
  void initState() {
    super.initState();
    final c = widget.competition;
    _capacity = c?.maxTeams ?? (widget.isCup ? 32 : 16);
    _name.text = c?.name ?? '';
    _description.text = c?.description ?? '';
    _venue.text = c?.defaultLocation['name']?.toString() ?? '';
    _address.text = c?.defaultLocation['address']?.toString() ?? '';
    _public = c?.isPublic ?? false;
    _returnLeg = c?.format == 'double_round_robin';
    _frequency = c?.matchFrequency ?? 'weekly';
    _time = c?.matchTime ?? '21:00';
    _date = c?.startDate?.split('T').first ?? '';
    _selected.addAll(c?.teamIds ?? []);
    _win = (c?.rules['pointsForWin'] as num?)?.toInt() ?? 3;
    _draw = (c?.rules['pointsForDraw'] as num?)?.toInt() ?? 1;
  }

  @override
  void dispose() {
    for (final c in [_name, _description, _venue, _address]) {
      c.dispose();
    }
    super.dispose();
  }

  Map<String, dynamic> get _data => {
    'name': _name.text.trim(),
    if (_logoUrl != null) 'logoUrl': _logoUrl,
    'description': _description.text.trim(),
    'groupId': widget.groupId,
    'teams': _selected.toList(),
    'isPublic': _public,
    'format': _returnLeg ? 'double_round_robin' : 'round_robin',
    'maxTeams': _capacity,
    'startDate': _date,
    'matchTime': _time,
    'matchFrequency': _frequency,
    'rules': {'pointsForWin': _win, 'pointsForDraw': _draw},
    'defaultLocation': {
      if (_venue.text.trim() == widget.competition?.defaultLocation['name'] &&
          _address.text.trim() ==
              widget.competition?.defaultLocation['address'])
        ...widget.competition!.defaultLocation
      else ...{
        'lat': 0,
        'lng': 0,
        'placeId': '',
      },
      'name': _venue.text.trim(),
      'address': _address.text.trim(),
    },
  };
  bool _valid() {
    String? error;
    if (_step == 0 && _name.text.trim().length < 3) {
      error = 'El nombre necesita al menos tres caracteres.';
    }
    if (_step == 1 && (!_public && _selected.length < 2)) {
      error = 'Elegí al menos dos equipos, o abrí las inscripciones.';
    }
    if (_step > 0 && _selected.length > _capacity) {
      error = 'El cupo es menor que la cantidad de equipos seleccionados.';
    }
    if (_step == 2 && !widget.isCup && _draw >= _win) {
      error = 'Ganar debe sumar más puntos que empatar.';
    }
    setState(() => _error = error);
    return error == null;
  }

  Future<void> _next() async {
    if (_saving || !_valid()) return;
    FocusScope.of(context).unfocus();
    if (_step < 2) {
      setState(() => _step++);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final service = ref.read(competitionServiceProvider),
          collection = widget.isCup ? 'cups' : 'leagues';
      if (_logoBytes case final bytes? when _logoUrl == null) {
        final uid = ref.read(currentUidProvider);
        if (uid == null || uid.isEmpty)
          throw StateError('Volvé a iniciar sesión.');
        _logoUrl = await service.uploadLeagueLogo(
          groupId: widget.groupId,
          uid: uid,
          uploadId: _requestId,
          bytes: bytes,
        );
      }
      if (widget.competition != null) {
        await service.command(
          collection,
          widget.competition!.id,
          'configure',
          _data,
        );
        if (mounted) Navigator.pop(context, true);
      } else {
        final id = await service.create(
          collection: collection,
          requestId: _requestId,
          data: _data,
        );
        if (mounted) Navigator.pop(context, id);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = competitionError(e);
        });
      }
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now(),
        old = DateTime.tryParse(_date),
        initial = old != null && old.isAfter(now)
            ? old
            : now.add(const Duration(days: 7));
    final day = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: now,
      lastDate: DateTime(now.year + 3),
    );
    if (day != null && mounted) {
      setState(
        () => _date =
            '${day.year}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}',
      );
    }
  }

  List<Widget> _entryControls() => [
    SwitchListTile(
      contentPadding: EdgeInsets.zero,
      value: _public,
      onChanged: _saving ? null : (v) => setState(() => _public = v),
      title: const Text('Abrir inscripciones'),
      subtitle: const Text(
        'Otros equipos pueden postularse. Vos aprobás quién participa.',
      ),
    ),
    const SizedBox(height: 12),
    DropdownButtonFormField<int>(
      initialValue: _capacity,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Cupo de equipos'),
      items: [
        for (final n in ({
          ...List.generate((widget.isCup ? 32 : 16) - 1, (i) => i + 2),
          _capacity,
        }.toList()..sort()))
          DropdownMenuItem(value: n, child: Text('$n equipos')),
      ],
      onChanged: _saving ? null : (v) => setState(() => _capacity = v!),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final group = ref.watch(groupTeamsStreamProvider(widget.groupId));
    return PopScope<dynamic>(
      canPop: !_saving && _step == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && !_saving && _step > 0) {
          setState(() {
            _step--;
            _error = null;
          });
        }
      },
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          leading: _step > 0
              ? IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: _saving
                      ? null
                      : () => setState(() {
                          _step--;
                          _error = null;
                        }),
                )
              : null,
          title: Text(
            widget.competition != null
                ? 'Configurar torneo'
                : widget.isCup
                ? 'Crear copa'
                : 'Crear liga',
            style: AppTypography.headline(size: 20),
          ),
        ),
        body: PateaBackground(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
                child: Column(
                  children: [
                    Row(
                      children: [
                        for (var i = 0; i < 3; i++)
                          Expanded(
                            child: Text(
                              ['Identidad', 'Equipos', 'Calendario'][i],
                              style: AppTypography.body(
                                size: 13,
                                weight: _step == i
                                    ? FontWeight.w700
                                    : FontWeight.w400,
                                color: _step == i
                                    ? context.c.primary
                                    : context.c.textSecondary,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    LinearProgressIndicator(
                      value: (_step + 1) / 3,
                      minHeight: 3,
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  key: ValueKey(_step),
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                  children: [
                    if (_step == 0) ...[
                      Text(
                        widget.isCup
                            ? 'Un torneo con identidad propia'
                            : 'Identidad y formato',
                        style: AppTypography.headline(size: 24),
                      ),
                      const SizedBox(height: 18),
                      TextField(
                        controller: _name,
                        maxLength: 80,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(
                          labelText: 'Nombre del torneo',
                        ),
                        enabled: !_saving,
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _description,
                        maxLength: 500,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: 'Descripción y acuerdos del torneo',
                        ),
                        enabled: !_saving,
                      ),
                      if (widget.isCup) ...[
                        ..._entryControls(),
                      ] else ...[
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: _logoBytes != null
                              ? Image.memory(
                                  _logoBytes!,
                                  width: 40,
                                  height: 40,
                                  fit: BoxFit.contain,
                                )
                              : widget.competition?.logoUrl?.isNotEmpty == true
                              ? Image.network(
                                  widget.competition!.logoUrl!,
                                  width: 40,
                                  height: 40,
                                  fit: BoxFit.contain,
                                  errorBuilder: (_, _, _) =>
                                      const Icon(Icons.image_outlined),
                                )
                              : const Icon(Icons.image_outlined),
                          title: const Text('Logo de la liga (opcional)'),
                          subtitle: const Text('PNG o JPG de hasta 5 MB'),
                          trailing: _logoBytes == null
                              ? const Icon(Icons.chevron_right)
                              : IconButton(
                                  tooltip: 'Quitar imagen seleccionada',
                                  onPressed: _saving
                                      ? null
                                      : () {
                                          setState(() {
                                            _logoBytes = null;
                                            _logoUrl = null;
                                          });
                                        },
                                  icon: const Icon(Icons.close),
                                ),
                          onTap: _saving ? null : _pickLogo,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Formato',
                          style: AppTypography.headline(size: 18),
                        ),
                        RadioGroup<bool>(
                          groupValue: _returnLeg,
                          onChanged: (value) {
                            if (value != null)
                              setState(() => _returnLeg = value);
                          },
                          child: Column(
                            children: [
                              RadioListTile<bool>(
                                contentPadding: EdgeInsets.zero,
                                value: false,
                                enabled: !_saving,
                                title: const Text('Una vuelta'),
                                subtitle: const Text(
                                  'Cada equipo juega una vez contra cada rival.',
                                ),
                              ),
                              RadioListTile<bool>(
                                contentPadding: EdgeInsets.zero,
                                value: true,
                                enabled: !_saving,
                                title: const Text('Ida y vuelta'),
                                subtitle: const Text(
                                  'Cada equipo juega dos veces contra cada rival.',
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                    if (_step == 1) ...[
                      Text(
                        widget.isCup
                            ? 'Los equipos hacen el torneo'
                            : 'Equipos e inscripciones',
                        style: AppTypography.headline(size: 24),
                      ),
                      const SizedBox(height: 8),
                      if (!widget.isCup) ...[
                        ..._entryControls(),
                        const SizedBox(height: 12),
                      ],
                      Text(
                        _public
                            ? 'Podés empezar sin equipos y aprobar solicitudes más adelante.'
                            : 'Elegí los equipos de tu grupo.',
                        style: AppTypography.body(
                          size: 14,
                          color: context.c.textSecondary,
                        ),
                      ),
                      if (widget.isCup)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Text(
                            'Para sortear la copa se necesitan 2, 4, 8, 16 o 32 equipos.',
                          ),
                        ),
                      Text(
                        '${_selected.length} de $_capacity equipos',
                        style: AppTypography.body(
                          size: 15,
                          weight: FontWeight.w600,
                        ),
                      ),
                      group.when(
                        loading: () => const PateaLoading(),
                        error: (e, _) => PateaError(error: e),
                        data: (teams) => Column(
                          children: [
                            for (final team in teams)
                              CheckboxListTile(
                                contentPadding: EdgeInsets.zero,
                                secondary: JerseyWidget(
                                  jersey: team.jersey,
                                  size: 36,
                                ),
                                title: Text(
                                  team.name,
                                  style: AppTypography.body(size: 16),
                                ),
                                subtitle: Text(
                                  '${team.members.length} jugadores',
                                ),
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
                            for (final id in _selected.where(
                              (id) => !teams.any((t) => t.id == id),
                            ))
                              ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: const Icon(Icons.public),
                                title: Text(
                                  widget.competition?.teamSnapshots[id]?['name']
                                          ?.toString() ??
                                      'Equipo externo',
                                ),
                                subtitle: const Text(
                                  'Participante de otro grupo',
                                ),
                                trailing: IconButton(
                                  tooltip: 'Retirar del borrador',
                                  icon: const Icon(Icons.remove_circle_outline),
                                  onPressed: _saving
                                      ? null
                                      : () => setState(
                                          () => _selected.remove(id),
                                        ),
                                ),
                              ),
                            if (teams.isEmpty)
                              const Padding(
                                padding: EdgeInsets.all(16),
                                child: Text(
                                  'Creá equipos desde Gestionar grupos, o abrí las inscripciones.',
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                    if (_step == 2) ...[
                      Text(
                        'La primera fecha, a tu ritmo',
                        style: AppTypography.headline(size: 24),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Podés dejar el inicio por definir y programarlo al comenzar.',
                        style: AppTypography.body(
                          size: 14,
                          color: context.c.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 16),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.calendar_today_outlined),
                        title: Text(
                          _date.isEmpty ? 'Inicio por definir' : _date,
                        ),
                        onTap: _saving ? null : _pickDate,
                        trailing: _date.isNotEmpty
                            ? IconButton(
                                tooltip: 'Quitar fecha',
                                icon: const Icon(Icons.close),
                                onPressed: () => setState(() => _date = ''),
                              )
                            : const Icon(Icons.chevron_right),
                      ),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.schedule),
                        title: Text(_time),
                        onTap: _saving
                            ? null
                            : () async {
                                final raw = _time.split(':');
                                final t = await showTimePicker(
                                  context: context,
                                  initialTime: TimeOfDay(
                                    hour: int.tryParse(raw[0]) ?? 21,
                                    minute: int.tryParse(raw.last) ?? 0,
                                  ),
                                );
                                if (t != null && mounted) {
                                  setState(
                                    () => _time =
                                        '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}',
                                  );
                                }
                              },
                      ),
                      if (!widget.isCup) ...[
                        DropdownButtonFormField<String>(
                          initialValue: _frequency,
                          decoration: const InputDecoration(
                            labelText: 'Frecuencia de las jornadas',
                          ),
                          items: const [
                            DropdownMenuItem(
                              value: 'weekly',
                              child: Text('Cada semana'),
                            ),
                            DropdownMenuItem(
                              value: 'biweekly',
                              child: Text('Cada dos semanas'),
                            ),
                          ],
                          onChanged: _saving
                              ? null
                              : (v) => setState(() => _frequency = v!),
                        ),
                      ],
                      const SizedBox(height: 20),
                      TextField(
                        controller: _venue,
                        decoration: const InputDecoration(
                          labelText: 'Cancha o sede',
                        ),
                        enabled: !_saving,
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _address,
                        decoration: const InputDecoration(
                          labelText: 'Dirección de referencia',
                        ),
                        enabled: !_saving,
                      ),
                      if (!widget.isCup)
                        ExpansionTile(
                          tilePadding: EdgeInsets.zero,
                          title: const Text('Reglas de puntuación'),
                          subtitle: Text(
                            '$_win por victoria · $_draw por empate',
                          ),
                          children: [
                            Wrap(
                              spacing: 16,
                              runSpacing: 12,
                              children: [
                                SizedBox(
                                  width: 125,
                                  child: DropdownButtonFormField<int>(
                                    initialValue: _win,
                                    decoration: const InputDecoration(
                                      labelText: 'Victoria',
                                    ),
                                    items: [
                                      for (var i = 1; i <= 10; i++)
                                        DropdownMenuItem(
                                          value: i,
                                          child: Text('$i'),
                                        ),
                                    ],
                                    onChanged: _saving
                                        ? null
                                        : (v) => setState(() => _win = v!),
                                  ),
                                ),
                                SizedBox(
                                  width: 125,
                                  child: DropdownButtonFormField<int>(
                                    initialValue: _draw,
                                    decoration: const InputDecoration(
                                      labelText: 'Al empatar',
                                    ),
                                    items: [
                                      for (var i = 0; i < 10; i++)
                                        DropdownMenuItem(
                                          value: i,
                                          child: Text('$i'),
                                        ),
                                    ],
                                    onChanged: _saving
                                        ? null
                                        : (v) => setState(() => _draw = v!),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                    ],
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Text(
                          _error!,
                          style: AppTypography.body(
                            size: 14,
                            color: context.c.destructive,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        bottomNavigationBar: Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  if (_step > 0) ...[
                    OutlinedButton(
                      onPressed: _saving
                          ? null
                          : () => setState(() {
                              _step--;
                              _error = null;
                            }),
                      child: const Text('Atrás'),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _saving ? null : _next,
                      icon: _saving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: PateaButtonProgress(),
                            )
                          : Icon(
                              _step == 2 ? Icons.check : Icons.arrow_forward,
                            ),
                      label: Text(
                        _saving
                            ? 'Guardando…'
                            : _step < 2
                            ? 'Continuar'
                            : widget.competition != null
                            ? 'Guardar cambios'
                            : _public
                            ? 'Abrir inscripciones'
                            : 'Guardar torneo',
                      ),
                    ),
                  ),
                ],
              ),
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
  CompetitionModel comp,
) async {
  final accepted = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('¿Eliminar ${comp.name}?'),
      content: const Text(
        'Se eliminará este borrador y sus solicitudes. Si ya tiene partidos, se debe archivar para conservar el historial.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Eliminar borrador'),
        ),
      ],
    ),
  );
  if (accepted != true) return false;
  try {
    await ref
        .read(competitionServiceProvider)
        .command(
          comp.type == 'cup' ? 'cups' : 'leagues',
          comp.id,
          'deleteDraft',
        );
    return true;
  } catch (e) {
    if (context.mounted) PateaSnack.error(context, competitionError(e));
    return false;
  }
}
