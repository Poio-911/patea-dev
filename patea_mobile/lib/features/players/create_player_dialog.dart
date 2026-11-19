import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/player_model.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/player_service.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/utils/ovr_calculator.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_button_progress.dart';

/// Shared create/edit form. Contact details are fetched through an owner-only
/// callable and never stored in the publicly readable player document.
class CreatePlayerDialog extends ConsumerStatefulWidget {
  const CreatePlayerDialog({super.key, this.player});
  final PlayerModel? player;
  @override
  ConsumerState<CreatePlayerDialog> createState() => _CreatePlayerDialogState();
}

class _CreatePlayerDialogState extends ConsumerState<CreatePlayerDialog> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _form = GlobalKey<FormState>();
  late String _position;
  late Map<String, int> _attrs;
  bool _saving = false;
  bool _loading = false;
  bool _contactFailed = false;
  bool get _editing => widget.player != null;
  bool get _earnedStats => (widget.player?.stats.matchesPlayed ?? 0) > 0;
  int get _ovr => OvrCalculator.computeOvr(_attrs, _position);

  @override
  void initState() {
    super.initState();
    final p = widget.player;
    _name.text = p?.name ?? '';
    _position = p?.position ?? 'DEL';
    _attrs = {
      'pac': p?.pac ?? 70,
      'sho': p?.sho ?? 70,
      'pas': p?.pas ?? 70,
      'dri': p?.dri ?? 70,
      'def': p?.def ?? 70,
      'phy': p?.phy ?? 70,
    };
    if (p != null) _loadContact();
  }

  Future<void> _loadContact() async {
    setState(() {
      _loading = true;
      _contactFailed = false;
    });
    try {
      final contact = await ref
          .read(playerServiceProvider)
          .getManualContact(widget.player!.id);
      if (!mounted) return;
      _email.text = contact['email'] as String? ?? '';
      _phone.text = contact['phone'] as String? ?? '';
    } catch (_) {
      if (mounted) setState(() => _contactFailed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    final uid = ref.read(authServiceProvider).currentUser?.uid;
    if (uid == null) return;
    setState(() => _saving = true);
    try {
      final service = ref.read(playerServiceProvider);
      final data = <String, dynamic>{
        'name': _name.text.trim(),
        'position': _position,
        ..._attrs,
        'email': _email.text.trim(),
        'phone': _phone.text.trim(),
      };
      if (_editing) {
        await service.updateManualPlayer(widget.player!.id, data);
      } else {
        final groupId = await ref.read(activeGroupIdStreamProvider(uid).future);
        if (groupId == null)
          throw Exception('Elegí un grupo antes de añadir jugadores.');
        await service.saveManualPlayer({...data, 'groupId': groupId});
      }
      if (!mounted) return;
      PateaSnack.ok(
        context,
        _editing ? 'Jugador actualizado' : 'Jugador añadido al plantel',
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (mounted) PateaSnack.error(context, 'No se pudo guardar: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final labels = _position == 'POR'
        ? {
            'pac': 'Velocidad',
            'sho': 'Parada',
            'pas': 'Saque',
            'dri': 'Reflejos',
            'def': 'Estirada',
            'phy': 'Posición',
          }
        : {
            'pac': 'Ritmo',
            'sho': 'Tiro',
            'pas': 'Pase',
            'dri': 'Regate',
            'def': 'Defensa',
            'phy': 'Físico',
          };
    return Dialog(
      backgroundColor: c.card,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(22),
            child: Form(
              key: _form,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          _editing ? 'Editar jugador' : 'Sumar al plantel',
                          style: AppTypography.headline(
                            size: 22,
                            weight: FontWeight.w700,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Cerrar',
                        onPressed: _saving
                            ? null
                            : () => Navigator.pop(context),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                  Text(
                    'Sin cuenta, con lugar en el equipo.',
                    style: AppTypography.body(size: 13, color: c.textSecondary),
                  ),
                  const SizedBox(height: 24),
                  TextFormField(
                    controller: _name,
                    maxLength: 80,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                      labelText: 'Nombre o apodo',
                      counterText: '',
                    ),
                    validator: (v) => v == null || v.trim().isEmpty
                        ? 'Ingresá un nombre'
                        : null,
                  ),
                  const SizedBox(height: 22),
                  Text(
                    '¿Dónde juega?',
                    style: AppTypography.body(
                      size: 14,
                      weight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 10),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'POR', label: Text('POR')),
                      ButtonSegment(value: 'DEF', label: Text('DEF')),
                      ButtonSegment(value: 'MED', label: Text('MED')),
                      ButtonSegment(value: 'DEL', label: Text('DEL')),
                    ],
                    selected: {_position},
                    showSelectedIcon: false,
                    onSelectionChanged: _saving
                        ? null
                        : (v) => setState(() => _position = v.first),
                  ),
                  const SizedBox(height: 22),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.person_outline_rounded,
                        color: c.textSecondary,
                        size: 20,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Puede jugar y recibir evaluaciones aunque todavía no use Pateá.',
                          style: AppTypography.body(
                            size: 12,
                            color: c.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Divider(color: c.overlayLine),
                  if (_loading)
                    const Padding(
                      padding: EdgeInsets.all(12),
                      child: Center(child: PateaButtonProgress()),
                    ),
                  if (_contactFailed)
                    TextButton.icon(
                      onPressed: _loadContact,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Reintentar carga del contacto'),
                    ),
                  ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    childrenPadding: const EdgeInsets.only(bottom: 18),
                    shape: const Border(),
                    collapsedShape: const Border(),
                    title: Text(
                      'Vincular su futura cuenta',
                      style: AppTypography.body(
                        size: 14,
                        weight: FontWeight.w600,
                      ),
                    ),
                    subtitle: Text(
                      'Correo o teléfono · opcional',
                      style: AppTypography.body(
                        size: 12,
                        color: c.textSecondary,
                      ),
                    ),
                    children: [
                      Text(
                        'Si se registra con este contacto y lo verifica, le preguntaremos si es este jugador para recuperar su historial. Sólo vos podés ver y editar estos datos.',
                        style: AppTypography.body(
                          size: 12,
                          color: c.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _email,
                        enabled: !_loading && !_contactFailed,
                        keyboardType: TextInputType.emailAddress,
                        autocorrect: false,
                        decoration: const InputDecoration(
                          labelText: 'Correo electrónico',
                        ),
                        validator: (v) =>
                            v != null &&
                                v.trim().isNotEmpty &&
                                !RegExp(
                                  r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                                ).hasMatch(v.trim())
                            ? 'Revisá el correo'
                            : null,
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _phone,
                        enabled: !_loading && !_contactFailed,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(
                          labelText: 'Teléfono con código de país',
                          hintText: '+59899123456',
                        ),
                        validator: (v) =>
                            v != null &&
                                v.trim().isNotEmpty &&
                                !RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(
                                  v.replaceAll(RegExp(r'[\s().-]'), ''),
                                )
                            ? 'Usá + y el código de país'
                            : null,
                      ),
                    ],
                  ),
                  Divider(color: c.overlayLine),
                  ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    shape: const Border(),
                    collapsedShape: const Border(),
                    title: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _earnedStats
                                ? 'Atributos del jugador'
                                : 'Ajustar nivel inicial',
                            style: AppTypography.body(
                              size: 14,
                              weight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Text(
                          '$_ovr',
                          style: AppTypography.sportNumber(
                            size: 28,
                            color: c.textPrimary,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'OVR',
                          style: AppTypography.body(
                            size: 10,
                            color: c.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    subtitle: Text(
                      _earnedStats
                          ? 'Su nivel evoluciona con las evaluaciones'
                          : '6 atributos · podés dejarlos en 70',
                      style: AppTypography.body(
                        size: 12,
                        color: c.textSecondary,
                      ),
                    ),
                    children: [
                      for (final e in labels.entries)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      e.value,
                                      style: AppTypography.body(size: 13),
                                    ),
                                  ),
                                  Text(
                                    '${_attrs[e.key]}',
                                    style: AppTypography.body(
                                      size: 14,
                                      weight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                              Slider(
                                value: _attrs[e.key]!.toDouble(),
                                min: 20,
                                max: 99,
                                divisions: 79,
                                label: '${_attrs[e.key]}',
                                onChanged: _earnedStats || _saving
                                    ? null
                                    : (v) => setState(
                                        () => _attrs[e.key] = v.round(),
                                      ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _saving || _loading || _contactFailed
                        ? null
                        : _save,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                    ),
                    child: _saving
                        ? const PateaButtonProgress()
                        : Text(_editing ? 'Guardar cambios' : 'Añadir jugador'),
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
