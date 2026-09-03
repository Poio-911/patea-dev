import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/models/player_model.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/profile_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/player_card_widget.dart';
import 'crop_photo_screen.dart';

/// Edición del perfil propio.
///
/// Toma los campos de `EditProfileDialog` de la web, pero no su forma: en vez
/// de un formulario dentro de un modal, la carta del jugador queda fija arriba
/// y se actualiza mientras editás — cambiás la posición y cambia el color de
/// la carta, cambiás la foto y la ves en la carta, no en un recuadro aparte.
///
/// La foto sale de la cámara o de la galería del teléfono. La web sólo puede
/// subir un archivo.
class EditProfileScreen extends ConsumerStatefulWidget {
  final String playerId;

  const EditProfileScreen({super.key, required this.playerId});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  static const _positions = ['DEL', 'MED', 'DEF', 'POR'];
  static const _feet = {
    'derecho': 'Derecho',
    'izquierdo': 'Izquierdo',
    'ambidiestro': 'Ambidiestro',
  };
  static const _maxBio = 160;
  static const _minBirthYear = 1950;

  final _nameController = TextEditingController();
  final _bioController = TextEditingController();
  final _nationalityController = TextEditingController();

  String _position = 'MED';
  String? _foot;
  int? _birthYear;
  File? _pickedPhoto;

  bool _initialised = false;
  bool _saving = false;
  bool _generating = false;
  String? _error;
  String? _notice;

  @override
  void dispose() {
    _nameController.dispose();
    _bioController.dispose();
    _nationalityController.dispose();
    super.dispose();
  }

  /// Se completa una sola vez: si se reasignara en cada build, escribir en un
  /// campo lo pisaría con el valor de Firestore en el siguiente snapshot.
  void _seed(PlayerModel player) {
    if (_initialised) return;
    _initialised = true;
    _nameController.text = player.name;
    _bioController.text = player.bio ?? '';
    _nationalityController.text = player.nationality ?? 'Uruguay';
    _position = player.position;
    _foot = player.preferredFoot;
    _birthYear = player.birthYear;
  }

  Future<void> _pickPhoto(ImageSource source) async {
    try {
      final picked = await ImagePicker().pickImage(
        source: source,
        // Se redimensiona en el teléfono antes de subir: una foto de cámara
        // moderna son varios MB y el límite de storage.rules es 5.
        maxWidth: 1080,
        maxHeight: 1080,
        imageQuality: 88,
      );
      if (picked == null) return;
      await HapticFeedback.selectionClick();
      setState(() => _pickedPhoto = File(picked.path));
    } catch (e) {
      if (mounted) setState(() => _error = 'No se pudo abrir la cámara o la galería.');
    }
  }

  void _openPhotoSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        decoration: const BoxDecoration(
          color: Color(0xFF141B27),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 48,
                height: 5,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: AppColors.textMuted.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              _SheetAction(
                icon: Icons.photo_camera_outlined,
                label: 'Sacar una foto',
                onTap: () {
                  Navigator.pop(sheetContext);
                  _pickPhoto(ImageSource.camera);
                },
              ),
              const SizedBox(height: 8),
              _SheetAction(
                icon: Icons.photo_library_outlined,
                label: 'Elegir de la galería',
                onTap: () {
                  Navigator.pop(sheetContext);
                  _pickPhoto(ImageSource.gallery);
                },
              ),
              const SizedBox(height: 8),
              _SheetAction(
                icon: Icons.auto_awesome_outlined,
                label: 'Generar con IA',
                subtitle: 'Convierte tu foto en un retrato de estudio. Usa 1 crédito.',
                onTap: () {
                  Navigator.pop(sheetContext);
                  _generateWithAi();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _generateWithAi() async {
    setState(() {
      _generating = true;
      _error = null;
      _notice = null;
    });
    try {
      final res = await ref.read(profileServiceProvider).generateAiPhoto();
      await HapticFeedback.mediumImpact();
      if (!mounted) return;
      setState(() {
        _generating = false;
        // La foto nueva ya quedó guardada del lado servidor; el stream del
        // jugador la trae solo. Se limpia la local para no taparla.
        _pickedPhoto = null;
        _notice = res.creditsRemaining != null
            ? 'Foto generada. Te ${res.creditsRemaining == 1 ? 'queda' : 'quedan'} ${res.creditsRemaining} crédito${res.creditsRemaining == 1 ? '' : 's'}.'
            : 'Foto generada.';
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _generating = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  Future<void> _openCrop(PlayerModel player) async {
    if (player.photoUrl == null || player.photoUrl!.isEmpty) {
      setState(() => _error = 'Primero elegí una foto.');
      return;
    }
    if (_pickedPhoto != null) {
      setState(() => _error = 'Guardá la foto nueva antes de ajustar el encuadre.');
      return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute<bool>(
        builder: (_) => CropPhotoScreen(
          photoUrl: player.photoUrl!,
          initialX: player.cropX,
          initialY: player.cropY,
          initialZoom: player.cropZoom,
        ),
      ),
    );
  }

  Future<void> _openBirthYearPicker() async {
    final maxYear = DateTime.now().year - 5;
    final years = [for (var y = maxYear; y >= _minBirthYear; y--) y];
    final initial = years.indexOf(_birthYear ?? 1995);

    final chosen = await showModalBottomSheet<int>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => Container(
        height: 320,
        decoration: const BoxDecoration(
          color: Color(0xFF141B27),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 14),
            Text('Año de nacimiento',
                style: AppTypography.headline(size: 15, weight: FontWeight.w700)),
            const SizedBox(height: 10),
            Expanded(
              child: ListWheelScrollView.useDelegate(
                itemExtent: 46,
                perspective: 0.004,
                physics: const FixedExtentScrollPhysics(),
                controller: FixedExtentScrollController(
                  initialItem: initial >= 0 ? initial : 0,
                ),
                onSelectedItemChanged: (_) => HapticFeedback.selectionClick(),
                childDelegate: ListWheelChildBuilderDelegate(
                  childCount: years.length,
                  builder: (context, i) => Center(
                    child: GestureDetector(
                      onTap: () => Navigator.pop(sheetContext, years[i]),
                      child: Text(
                        '${years[i]}',
                        style: AppTypography.sportNumber(size: 24),
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

    if (chosen != null) setState(() => _birthYear = chosen);
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    if (name.length < 3) {
      setState(() => _error = 'El nombre debe tener al menos 3 caracteres.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final service = ref.read(profileServiceProvider);

      String? photoUrl;
      if (_pickedPhoto != null) {
        photoUrl = await service.uploadProfilePhoto(_pickedPhoto!);
      }

      await service.updateProfile(
        displayName: name,
        photoUrl: photoUrl,
        position: _position,
        preferredFoot: _foot,
        bio: _bioController.text.trim(),
        birthYear: _birthYear,
        nationality: _nationalityController.text.trim(),
      );

      await HapticFeedback.mediumImpact();
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final playerAsync = ref.watch(singlePlayerStreamProvider(widget.playerId));

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text('EDITAR PERFIL',
            style: AppTypography.headline(size: 16, weight: FontWeight.w700)),
      ),
      body: playerAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.voltNeon)),
        error: (err, _) => Center(
          child: Text('Error: $err', style: AppTypography.body(color: AppColors.textMuted)),
        ),
        data: (player) {
          if (player == null) {
            return Center(
              child: Text('No se encontró tu perfil.',
                  style: AppTypography.body(color: AppColors.textMuted)),
            );
          }
          _seed(player);

          // La carta se dibuja con lo que hay en el formulario, no con lo que
          // hay en Firestore: eso es lo que la hace un preview en vivo.
          final preview = PlayerModel(
            id: player.id,
            name: _nameController.text.trim().isEmpty
                ? player.name
                : _nameController.text.trim(),
            position: _position,
            ovr: player.ovr,
            pac: player.pac,
            sho: player.sho,
            pas: player.pas,
            dri: player.dri,
            def: player.def,
            phy: player.phy,
            photoUrl: player.photoUrl,
            ownerUid: player.ownerUid,
            groupId: player.groupId,
            cropX: player.cropX,
            cropY: player.cropY,
            cropZoom: player.cropZoom,
            stats: player.stats,
          );

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // La carta se dibuja a su tamaño natural y se escala con
                    // FittedBox. Meterla en una caja chica la desbordaba: el
                    // contenido interno (avatar y grilla de atributos) tiene
                    // medidas fijas y no entra a 128 px de ancho.
                    SizedBox(
                      width: 130,
                      height: 190,
                      child: FittedBox(
                        fit: BoxFit.contain,
                        child: SizedBox(
                          width: 260,
                          height: 380,
                          child: PlayerCardWidget(
                            player: preview,
                            localPhoto: _pickedPhoto,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 8),
                          Text('Así te ven',
                              style: AppTypography.headline(size: 13, weight: FontWeight.w700)),
                          const SizedBox(height: 4),
                          Text(
                            'La carta se actualiza mientras editás.',
                            style: AppTypography.body(size: 11, color: AppColors.textMuted, height: 1.4),
                          ),
                          const SizedBox(height: 12),
                          OutlinedButton.icon(
                            onPressed: (_saving || _generating) ? null : _openPhotoSheet,
                            icon: _generating
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: AppColors.voltNeon),
                                  )
                                : const Icon(Icons.photo_camera_outlined, size: 16),
                            label: Text(
                              _generating ? 'Generando…' : 'Cambiar foto',
                              style: AppTypography.body(size: 12, weight: FontWeight.w600),
                            ),
                          ),
                          const SizedBox(height: 6),
                          OutlinedButton.icon(
                            onPressed: (_saving || _generating) ? null : () => _openCrop(player),
                            icon: const Icon(Icons.crop_free, size: 16),
                            label: Text(
                              'Ajustar encuadre',
                              style: AppTypography.body(size: 12, weight: FontWeight.w600),
                            ),
                          ),
                          if (_pickedPhoto != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(
                                'Foto nueva sin guardar',
                                style: AppTypography.code(size: 9, color: AppColors.voltNeon),
                              ),
                            ),
                          if (_notice != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(
                                _notice!,
                                style: AppTypography.code(size: 9, color: AppColors.success),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(18, 6, 18, 32),
                  children: [
                    _Label('Nombre o apodo'),
                    _Field(
                      controller: _nameController,
                      hint: 'Tu nombre en la cancha',
                      maxLength: 40,
                      onChanged: (_) => setState(() {}),
                    ),

                    const SizedBox(height: 20),
                    _Label('Posición'),
                    Row(
                      children: [
                        for (final p in _positions) ...[
                          Expanded(
                            child: _ChoiceChip(
                              label: p,
                              selected: _position == p,
                              color: AppColors.getPositionColor(p),
                              onTap: () {
                                HapticFeedback.selectionClick();
                                setState(() => _position = p);
                              },
                            ),
                          ),
                          if (p != _positions.last) const SizedBox(width: 8),
                        ],
                      ],
                    ),

                    const SizedBox(height: 20),
                    _Label('Pie hábil'),
                    Row(
                      children: [
                        for (final entry in _feet.entries) ...[
                          Expanded(
                            child: _ChoiceChip(
                              label: entry.value,
                              selected: _foot == entry.key,
                              color: AppColors.voltNeon,
                              onTap: () {
                                HapticFeedback.selectionClick();
                                setState(() => _foot = _foot == entry.key ? null : entry.key);
                              },
                            ),
                          ),
                          if (entry.key != _feet.keys.last) const SizedBox(width: 8),
                        ],
                      ],
                    ),

                    const SizedBox(height: 20),
                    _Label('Año de nacimiento'),
                    InkWell(
                      onTap: _saving ? null : _openBirthYearPicker,
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
                        decoration: BoxDecoration(
                          color: const Color(0xFF141A24),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.cake_outlined, size: 17, color: AppColors.textMuted),
                            const SizedBox(width: 10),
                            Text(
                              _birthYear != null
                                  ? '$_birthYear  ·  ${DateTime.now().year - _birthYear!} años'
                                  : 'Sin definir',
                              style: AppTypography.body(
                                size: 14,
                                color: _birthYear != null
                                    ? AppColors.textPrimary
                                    : AppColors.textMuted,
                              ),
                            ),
                            const Spacer(),
                            if (_birthYear != null)
                              GestureDetector(
                                onTap: () => setState(() => _birthYear = null),
                                child: Icon(Icons.close, size: 16, color: AppColors.textMuted),
                              )
                            else
                              Icon(Icons.chevron_right, size: 18, color: AppColors.textMuted),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 20),
                    _Label('Nacionalidad'),
                    _Field(controller: _nationalityController, hint: 'Uruguay', maxLength: 40),

                    const SizedBox(height: 20),
                    _Label('Bio'),
                    _Field(
                      controller: _bioController,
                      hint: 'Contá algo tuyo en pocas palabras',
                      maxLength: _maxBio,
                      maxLines: 3,
                      onChanged: (_) => setState(() {}),
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: Text(
                        '${_bioController.text.characters.length}/$_maxBio',
                        style: AppTypography.code(
                          size: 10,
                          color: _bioController.text.characters.length > _maxBio
                              ? AppColors.destructive
                              : AppColors.textMuted,
                        ),
                      ),
                    ),

                    if (_error != null) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.destructive.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.destructive.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.error_outline, size: 16, color: AppColors.destructive),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(_error!,
                                  style: AppTypography.body(size: 12, color: AppColors.destructive)),
                            ),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: 26),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _saving ? null : _save,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.voltNeon,
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        icon: _saving
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                              )
                            : const Icon(Icons.check, size: 18),
                        label: Text(
                          _saving ? 'Guardando…' : 'Guardar cambios',
                          style: AppTypography.headline(
                            size: 14,
                            weight: FontWeight.w700,
                            color: Colors.black,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Label extends StatelessWidget {
  final String text;

  const _Label(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text.toUpperCase(),
        style: AppTypography.code(size: 10, color: AppColors.textMuted),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final int maxLength;
  final int maxLines;
  final ValueChanged<String>? onChanged;

  const _Field({
    required this.controller,
    required this.hint,
    required this.maxLength,
    this.maxLines = 1,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF141A24),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
      ),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        maxLength: maxLength,
        onChanged: onChanged,
        style: const TextStyle(color: Colors.white, fontSize: 14),
        decoration: InputDecoration(
          hintText: hint,
          counterText: '',
          hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 13),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        ),
      ),
    );
  }
}

class _ChoiceChip extends StatelessWidget {
  final String label;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  const _ChoiceChip({
    required this.label,
    required this.selected,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        padding: const EdgeInsets.symmetric(vertical: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.16) : const Color(0xFF141A24),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? color : Colors.white.withValues(alpha: 0.12),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.headline(
            size: 11,
            weight: selected ? FontWeight.w800 : FontWeight.w600,
            color: selected ? color : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}

class _SheetAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;

  const _SheetAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.cardSurface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 20, color: AppColors.voltNeon),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: AppTypography.headline(size: 15, weight: FontWeight.w600)),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(subtitle!,
                        style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
