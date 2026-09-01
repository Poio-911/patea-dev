import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/group_service.dart';
import '../../core/services/auth_service.dart';

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

  void _recalcOvr() {
    setState(() {
      _ovr = ((_pac + _sho + _pas + _dri + _def + _phy) / 6.0).round();
    });
  }

  Future<void> _handleSave() async {
    if (_nameController.text.trim().isEmpty) return;

    final user = ref.read(authServiceProvider).currentUser;
    if (user == null) return;

    setState(() => _isLoading = true);

    try {
      await ref.read(groupServiceProvider).createManualPlayer(
        groupId: 'default_group',
        ownerUid: user.uid,
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('¡Jugador añadido al vestuario!'),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error al crear jugador: $e'),
            backgroundColor: AppColors.destructive,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: AppColors.card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'NUEVO JUGADOR',
                  style: AppTypography.headline(size: 18, weight: FontWeight.w800),
                ),
                Text(
                  'OVR $_ovr',
                  style: AppTypography.sportNumber(size: 22, color: AppColors.voltNeon),
                ),
              ],
            ),
            const SizedBox(height: 16),

            TextField(
              controller: _nameController,
              style: AppTypography.body(),
              decoration: const InputDecoration(
                labelText: 'Nombre o Apodo',
                prefixIcon: Icon(Icons.person, color: AppColors.voltNeon),
              ),
            ),
            const SizedBox(height: 16),

            Text('POSICIÓN', style: AppTypography.code(size: 11, color: AppColors.textMuted)),
            const SizedBox(height: 6),
            Row(
              children: ['DEL', 'MED', 'DEF', 'POR'].map((pos) {
                final isSelected = _position == pos;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2.0),
                    child: ChoiceChip(
                      label: Text(pos),
                      selected: isSelected,
                      onSelected: (_) => setState(() => _position = pos),
                      selectedColor: AppColors.getPositionColor(pos).withValues(alpha: 0.25),
                      labelStyle: AppTypography.headline(
                        size: 11,
                        color: isSelected ? AppColors.getPositionColor(pos) : AppColors.textSecondary,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            _buildAttrSlider('Velocidad (PAC)', _pac, (val) {
              _pac = val;
              _recalcOvr();
            }),
            _buildAttrSlider('Tiro (SHO)', _sho, (val) {
              _sho = val;
              _recalcOvr();
            }),
            _buildAttrSlider('Pase (PAS)', _pas, (val) {
              _pas = val;
              _recalcOvr();
            }),
            _buildAttrSlider('Regate (DRI)', _dri, (val) {
              _dri = val;
              _recalcOvr();
            }),
            _buildAttrSlider('Defensa (DEF)', _def, (val) {
              _def = val;
              _recalcOvr();
            }),
            _buildAttrSlider('Físico (PHY)', _phy, (val) {
              _phy = val;
              _recalcOvr();
            }),

            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _isLoading ? null : _handleSave,
              child: const Text('GUARDAR JUGADOR'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAttrSlider(String label, int value, ValueChanged<int> onChanged) {
    return Row(
      children: [
        SizedBox(
          width: 100,
          child: Text(label, style: AppTypography.code(size: 10, color: AppColors.textMuted)),
        ),
        Expanded(
          child: Slider(
            value: value.toDouble(),
            min: 40,
            max: 99,
            activeColor: AppColors.voltNeon,
            onChanged: (val) => onChanged(val.round()),
          ),
        ),
        Text('$value', style: AppTypography.sportNumber(size: 14)),
      ],
    );
  }
}
