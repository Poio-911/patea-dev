import 'package:flutter/material.dart';
import '../../core/theme/app_radii.dart';
import '../../core/widgets/patea_snack.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/player_service.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/utils/ovr_calculator.dart';

class CreatePlayerDialog extends ConsumerStatefulWidget {
  const CreatePlayerDialog({super.key});

  @override
  ConsumerState<CreatePlayerDialog> createState() => _CreatePlayerDialogState();
}

class _CreatePlayerDialogState extends ConsumerState<CreatePlayerDialog> {
  final _nameController = TextEditingController();
  String _position = 'DEL';
  int _ovr = 70;
  int _pac = 70;
  int _sho = 70;
  int _pas = 70;
  int _dri = 70;
  int _def = 70;
  int _phy = 70;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _recalcOvr();
  }

  void _recalcOvr() {
    setState(() {
      _ovr = OvrCalculator.computeOvr({
        'pac': _pac,
        'sho': _sho,
        'pas': _pas,
        'dri': _dri,
        'def': _def,
        'phy': _phy,
      }, _position);
    });
  }

  Future<void> _handleSave() async {
    if (_nameController.text.trim().isEmpty) {
      PateaSnack.error(context, 'Por favor ingresá un nombre para el jugador');
      return;
    }

    final user = ref.read(authServiceProvider).currentUser;
    if (user == null) return;

    setState(() => _isLoading = true);

    try {
      final groupId = await ref.read(activeGroupIdStreamProvider(user.uid).future);
      if (groupId == null) {
        throw Exception('No tenés un grupo activo. Elegí uno en "Mis Grupos" primero.');
      }

      await ref.read(playerServiceProvider).createManualPlayer(
        groupId: groupId,
        name: _nameController.text.trim(),
        position: _position,
        ovr: _ovr,
        pac: _pac,
        sho: _sho,
        pas: _pas,
        dri: _dri,
        def: _def,
        phy: _phy,
      );

      if (mounted) {
        PateaSnack.ok(context, '¡Jugador añadido al vestuario!');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        PateaSnack.error(context, 'Error al crear jugador: $e');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Color _getOvrColor(int val, PateaColors c) {
    if (val >= 85) return c.eliteBorder;
    if (val >= 75) return c.goldBorder;
    if (val >= 65) return c.brandVolt;
    return c.textSecondary;
  }
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isGk = _position == 'POR';
    final posColor = c.positionColor(_position);
    final ovrColor = _getOvrColor(_ovr, c);

    // Atributos y etiquetas según posición (GK vs Outfield)
    final List<Map<String, dynamic>> attrConfigs = isGk
        ? [
            {
              'key': 'dri',
              'label': 'Reflejos',
              'code': 'REF',
              'val': _dri,
              'isKey': true,
              'onChanged': (int v) { _dri = v; _recalcOvr(); },
            },
            {
              'key': 'def',
              'label': 'Estirada',
              'code': 'EST',
              'val': _def,
              'isKey': true,
              'onChanged': (int v) { _def = v; _recalcOvr(); },
            },
            {
              'key': 'sho',
              'label': 'Parada',
              'code': 'PAR',
              'val': _sho,
              'isKey': false,
              'onChanged': (int v) { _sho = v; _recalcOvr(); },
            },
            {
              'key': 'phy',
              'label': 'Posición',
              'code': 'POS',
              'val': _phy,
              'isKey': false,
              'onChanged': (int v) { _phy = v; _recalcOvr(); },
            },
            {
              'key': 'pas',
              'label': 'Saque',
              'code': 'SAQ',
              'val': _pas,
              'isKey': false,
              'onChanged': (int v) { _pas = v; _recalcOvr(); },
            },
            {
              'key': 'pac',
              'label': 'Velocidad',
              'code': 'VEL',
              'val': _pac,
              'isKey': false,
              'onChanged': (int v) { _pac = v; _recalcOvr(); },
            },
          ]
        : [
            {
              'key': 'pac',
              'label': 'Ritmo',
              'code': 'RIT',
              'val': _pac,
              'isKey': _position == 'DEL',
              'onChanged': (int v) { _pac = v; _recalcOvr(); },
            },
            {
              'key': 'sho',
              'label': 'Tiro',
              'code': 'TIR',
              'val': _sho,
              'isKey': _position == 'DEL',
              'onChanged': (int v) { _sho = v; _recalcOvr(); },
            },
            {
              'key': 'pas',
              'label': 'Pase',
              'code': 'PAS',
              'val': _pas,
              'isKey': _position == 'MED',
              'onChanged': (int v) { _pas = v; _recalcOvr(); },
            },
            {
              'key': 'dri',
              'label': 'Regate',
              'code': 'REG',
              'val': _dri,
              'isKey': _position == 'MED' || _position == 'DEL',
              'onChanged': (int v) { _dri = v; _recalcOvr(); },
            },
            {
              'key': 'def',
              'label': 'Defensa',
              'code': 'DEF',
              'val': _def,
              'isKey': _position == 'DEF',
              'onChanged': (int v) { _def = v; _recalcOvr(); },
            },
            {
              'key': 'phy',
              'label': 'Físico',
              'code': 'FIS',
              'val': _phy,
              'isKey': _position == 'DEF',
              'onChanged': (int v) { _phy = v; _recalcOvr(); },
            },
          ];

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 440),
        decoration: BoxDecoration(
          color: c.card,
          borderRadius: AppRadii.surfaceAll,
          border: Border.all(color: c.overlayLine, width: 1.2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.5),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: AppRadii.surfaceAll,
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header con OVR Badge
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: posColor.withValues(alpha: 0.15),
                            shape: BoxShape.circle,
                            border: Border.all(color: posColor.withValues(alpha: 0.4)),
                          ),
                          child: Icon(Icons.person_add_alt_1_rounded, size: 20, color: posColor),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'NUEVO JUGADOR',
                              style: AppTypography.headline(size: 16, weight: FontWeight.w800, letterSpacing: 0.5),
                            ),
                            Text(
                              'Añadí un jugador al plantel',
                              style: AppTypography.body(size: 11, color: c.textSecondary),
                            ),
                          ],
                        ),
                      ],
                    ),

                    // OVR Pill
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: ovrColor.withValues(alpha: 0.15),
                        borderRadius: AppRadii.pillAll,
                        border: Border.all(color: ovrColor.withValues(alpha: 0.6), width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: ovrColor.withValues(alpha: 0.25),
                            blurRadius: 8,
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'OVR',
                            style: AppTypography.code(size: 10, weight: FontWeight.w900, color: ovrColor),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            '$_ovr',
                            style: AppTypography.sportNumber(size: 20, color: c.textPrimary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),

                // Campo Nombre
                TextField(
                  controller: _nameController,
                  style: AppTypography.body(color: c.textPrimary, weight: FontWeight.w600),
                  decoration: InputDecoration(
                    labelText: 'Nombre o Apodo',
                    labelStyle: AppTypography.body(color: c.textSecondary, size: 13),
                    prefixIcon: Icon(Icons.badge_outlined, color: c.primary, size: 20),
                    filled: true,
                    fillColor: c.overlaySubtle,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: AppRadii.cardAll,
                      borderSide: BorderSide(color: c.overlayLine),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: AppRadii.cardAll,
                      borderSide: BorderSide(color: c.primary, width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Selector de Posición con Chips estilizados
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'POSICIÓN',
                      style: AppTypography.code(size: 11, weight: FontWeight.w800, color: c.textSecondary),
                    ),
                    Text(
                      isGk ? 'Guantes y reflejos 🧤' : 'Jugador de campo ⚽',
                      style: AppTypography.body(size: 10, color: c.textSecondary),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: ['DEL', 'MED', 'DEF', 'POR'].map((pos) {
                    final isSelected = _position == pos;
                    final chipPosColor = c.positionColor(pos);
                    return Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 3.0),
                        child: InkWell(
                          onTap: () {
                            setState(() {
                              _position = pos;
                              _recalcOvr();
                            });
                          },
                          borderRadius: AppRadii.cardAll,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? chipPosColor.withValues(alpha: 0.22)
                                  : c.overlaySubtle,
                              borderRadius: AppRadii.cardAll,
                              border: Border.all(
                                color: isSelected ? chipPosColor : c.overlayLine,
                                width: isSelected ? 1.5 : 1.0,
                              ),
                            ),
                            child: Center(
                              child: Text(
                                pos,
                                style: AppTypography.headline(
                                  size: 12,
                                  weight: FontWeight.w800,
                                  color: isSelected ? chipPosColor : c.textSecondary,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),

                // Separador de Atributos
                Row(
                  children: [
                    Expanded(child: Divider(color: c.overlayLine, height: 1)),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      child: Text(
                        isGk ? 'ATRIBUTOS DE ARQUERO' : 'ATRIBUTOS BASE',
                        style: AppTypography.code(
                          size: 10,
                          weight: FontWeight.w900,
                          color: c.textSecondary,
                        ),
                      ),
                    ),
                    Expanded(child: Divider(color: c.overlayLine, height: 1)),
                  ],
                ),
                const SizedBox(height: 10),

                // Sliders de Atributos
                ...attrConfigs.map((cfg) => _buildAttributeRow(
                  c: c,
                  label: cfg['label'] as String,
                  code: cfg['code'] as String,
                  value: cfg['val'] as int,
                  isKey: cfg['isKey'] as bool,
                  onChanged: cfg['onChanged'] as ValueChanged<int>,
                )),

                const SizedBox(height: 20),

                // Botón de Guardar
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleSave,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: c.primary,
                    foregroundColor: c.onPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                    elevation: 3,
                  ),
                  child: _isLoading
                      ? SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: c.onPrimary,
                          ),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.check_circle_outline_rounded, size: 18),
                            const SizedBox(width: 8),
                            Text(
                              'GUARDAR JUGADOR',
                              style: AppTypography.headline(
                                size: 13,
                                weight: FontWeight.w800,
                                letterSpacing: 0.6,
                              ),
                            ),
                          ],
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAttributeRow({
    required PateaColors c,
    required String label,
    required String code,
    required int value,
    required bool isKey,
    required ValueChanged<int> onChanged,
  }) {
    final valueColor = _getOvrColor(value, c);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3.0),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isKey ? c.primary.withValues(alpha: 0.06) : c.overlaySubtle,
          borderRadius: AppRadii.cardAll,
          border: Border.all(
            color: isKey ? c.primary.withValues(alpha: 0.3) : c.overlayLine.withValues(alpha: 0.5),
            width: isKey ? 1.0 : 0.6,
          ),
        ),
        child: Row(
          children: [
            // Badge con código (ej: REF, EST, RIT)
            Container(
              width: 34,
              padding: const EdgeInsets.symmetric(vertical: 2),
              decoration: BoxDecoration(
                color: isKey ? c.primary.withValues(alpha: 0.2) : c.overlayLine,
                borderRadius: AppRadii.hairAll,
              ),
              child: Center(
                child: Text(
                  code,
                  style: AppTypography.code(
                    size: 10,
                    weight: FontWeight.w900,
                    color: isKey ? c.primary : c.textPrimary,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),

            // Nombre completo del atributo
            SizedBox(
              width: 78,
              child: Text(
                label,
                style: AppTypography.body(
                  size: 11,
                  weight: isKey ? FontWeight.w700 : FontWeight.w500,
                  color: isKey ? c.textPrimary : c.textSecondary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),

            // Slider
            Expanded(
              child: SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 3.5,
                  activeTrackColor: isKey ? c.primary : c.textSecondary,
                  inactiveTrackColor: c.overlayLine,
                  thumbColor: isKey ? c.primary : c.textPrimary,
                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                  overlayShape: const RoundSliderOverlayShape(overlayRadius: 12),
                ),
                child: Slider(
                  value: value.toDouble(),
                  min: 40,
                  max: 99,
                  onChanged: (val) => onChanged(val.round()),
                ),
              ),
            ),

            // Valor numérico
            SizedBox(
              width: 28,
              child: Text(
                '$value',
                textAlign: TextAlign.end,
                style: AppTypography.sportNumber(
                  size: 15,
                  color: valueColor,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
