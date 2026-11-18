import '../../core/widgets/patea_button_progress.dart';
import 'dart:io';
import '../../core/widgets/patea_card.dart';
import '../../core/theme/app_radii.dart';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models/player_model.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/profile_service.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/patea_states.dart';
import '../../core/widgets/player_card_widget.dart';
import 'crop_photo_screen.dart';
import 'portrait_studio_screen.dart';

/// Edición del perfil propio.
///
/// Toma los campos de `EditProfileDialog` de la web, pero no su forma: en vez
/// de un formulario dentro de un modal, la ficha y los campos se desplazan juntos
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
  final bool _generating = false;
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

  Future<void> _openPhotoSheet(int? credits) async {
    final player = ref.read(singlePlayerStreamProvider(widget.playerId)).value;
    if (player == null) return;
    final applied = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) =>
            PortraitStudioScreen(player: player, initialPhoto: _pickedPhoto),
      ),
    );
    if (mounted && applied == true) {
      setState(() {
        _pickedPhoto = null;
        _notice = 'Foto actualizada.';
        _error = null;
      });
    }
  }

  Future<void> _openCrop(PlayerModel player) async {
    if (player.photoUrl == null || player.photoUrl!.isEmpty) {
      setState(() => _error = 'Primero elegí una foto.');
      return;
    }
    if (_pickedPhoto != null) {
      setState(
        () => _error = 'Guardá la foto nueva antes de ajustar el encuadre.',
      );
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
    final initialIndex = initial >= 0 ? initial : 0;
    var selectedYear = years[initialIndex];
    final wheel = FixedExtentScrollController(initialItem: initialIndex);

    final chosen = await showModalBottomSheet<int>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => PateaCard(
        color: context.c.popover,
        radius: AppRadii.surfaceTop,
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 340,
            child: Column(
              children: [
                const SizedBox(height: 14),
                Text(
                  'Año de nacimiento',
                  style: AppTypography.headline(
                    size: 16,
                    weight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: ListWheelScrollView.useDelegate(
                    itemExtent: 46,
                    perspective: 0.004,
                    physics: const FixedExtentScrollPhysics(),
                    controller: wheel,
                    onSelectedItemChanged: (idx) {
                      selectedYear = years[idx];
                      HapticFeedback.selectionClick();
                    },
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
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(sheetContext),
                          child: const Text('Cancelar'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: () =>
                              Navigator.pop(sheetContext, selectedYear),
                          child: const Text('Confirmar'),
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
    wheel.dispose();

    if (chosen != null && mounted) setState(() => _birthYear = chosen);
  }

  Future<void> _save() async {
    if (_saving || _generating) return;
    FocusScope.of(context).unfocus();
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
        clearPreferredFoot: _foot == null,
        clearBirthYear: _birthYear == null,
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
        title: Text(
          'Editar perfil',
          style: AppTypography.headline(size: 20, weight: FontWeight.w700),
        ),
      ),
      bottomNavigationBar: playerAsync.value == null
          ? null
          : Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.viewInsetsOf(context).bottom,
              ),
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 10, 18, 12),
                  child: FilledButton.icon(
                    onPressed: _saving || _generating ? null : _save,
                    icon: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: PateaButtonProgress(),
                          )
                        : const Icon(Icons.check),
                    label: Text(_saving ? 'Guardando…' : 'Guardar cambios'),
                  ),
                ),
              ),
            ),
      body: playerAsync.when(
        loading: () => const PateaLoading(),
        error: (err, _) => PateaError(
          error: err,
          message: 'No pudimos cargar tu perfil.',
          onRetry: () =>
              ref.invalidate(singlePlayerStreamProvider(widget.playerId)),
        ),
        data: (player) {
          if (player == null) {
            return Center(
              child: Text(
                'No se encontró tu perfil.',
                style: AppTypography.body(color: context.c.textSecondary),
              ),
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

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Builder(
                          builder: (context) {
                            final cardW =
                                (MediaQuery.sizeOf(context).width * 0.36).clamp(
                                  132.0,
                                  152.0,
                                );
                            return SizedBox(
                              width: cardW,
                              height: cardW * 1.5,
                              child: PlayerCardWidget(
                                player: preview,
                                localPhoto: _pickedPhoto,
                                photoStyle: CardPhotoStyle.halfTop,
                              ),
                            );
                          },
                        ),
                        const SizedBox(width: 18),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Tu identidad en la cancha',
                                style: AppTypography.headline(size: 21),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Actualizá tu foto y tus datos. Los cambios se ven en tu ficha.',
                                style: AppTypography.body(
                                  size: 14,
                                  color: context.c.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 10,
                      runSpacing: 8,
                      children: [
                        OutlinedButton.icon(
                          onPressed: (_saving || _generating)
                              ? null
                              : () => _openPhotoSheet(
                                  player.cardGenerationCredits,
                                ),
                          icon: _generating
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: PateaButtonProgress(),
                                )
                              : const Icon(
                                  Icons.photo_camera_outlined,
                                  size: 18,
                                ),
                          label: Text(
                            _generating ? 'Generando…' : 'Cambiar foto',
                          ),
                        ),
                        OutlinedButton.icon(
                          onPressed: (_saving || _generating)
                              ? null
                              : () => _openCrop(player),
                          icon: const Icon(Icons.crop_free, size: 18),
                          label: const Text('Ajustar encuadre'),
                        ),
                      ],
                    ),
                    if (_pickedPhoto != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          'Foto nueva sin guardar',
                          style: AppTypography.body(
                            size: 12,
                            color: context.c.primary,
                          ),
                        ),
                      ),
                    if (_notice != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          _notice!,
                          style: AppTypography.body(
                            size: 12,
                            color: context.c.success,
                          ),
                        ),
                      ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      PateaCard(
                        color: context.c.destructive.withValues(alpha: 0.1),
                        radius: AppRadii.cardAll,
                        borderColor: context.c.destructive.withValues(
                          alpha: 0.3,
                        ),
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            Icon(
                              Icons.error_outline,
                              size: 16,
                              color: context.c.destructive,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _error!,
                                style: AppTypography.body(
                                  size: 12,
                                  color: context.c.destructive,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 6, 18, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
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
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final p in _positions)
                          _ChoiceChip(
                            label: p,
                            selected: _position == p,
                            color: context.c.positionColor(p),
                            onTap: _saving
                                ? () {}
                                : () {
                                    HapticFeedback.selectionClick();
                                    setState(() => _position = p);
                                  },
                          ),
                      ],
                    ),

                    const SizedBox(height: 20),
                    _Label('Pie hábil'),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final entry in _feet.entries)
                          _ChoiceChip(
                            label: entry.value,
                            selected: _foot == entry.key,
                            color: context.c.primary,
                            onTap: _saving
                                ? () {}
                                : () {
                                    HapticFeedback.selectionClick();
                                    setState(
                                      () => _foot = _foot == entry.key
                                          ? null
                                          : entry.key,
                                    );
                                  },
                          ),
                      ],
                    ),

                    const SizedBox(height: 20),
                    _Label('Año de nacimiento'),
                    InkWell(
                      onTap: _saving ? null : _openBirthYearPicker,
                      borderRadius: AppRadii.cardAll,
                      child: PateaCard(
                        color: context.c.card,
                        radius: AppRadii.cardAll,
                        borderColor: context.c.overlayLine,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 15,
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.cake_outlined,
                              size: 17,
                              color: context.c.textSecondary,
                            ),
                            const SizedBox(width: 10),
                            Text(
                              _birthYear != null
                                  ? '$_birthYear  ·  ${DateTime.now().year - _birthYear!} años'
                                  : 'Sin definir',
                              style: AppTypography.body(
                                size: 14,
                                color: _birthYear != null
                                    ? context.c.textPrimary
                                    : context.c.textSecondary,
                              ),
                            ),
                            const Spacer(),
                            if (_birthYear != null)
                              GestureDetector(
                                onTap: _saving
                                    ? null
                                    : () => setState(() => _birthYear = null),
                                child: Icon(
                                  Icons.close,
                                  size: 16,
                                  color: context.c.textSecondary,
                                ),
                              )
                            else
                              Icon(
                                Icons.chevron_right,
                                size: 18,
                                color: context.c.textSecondary,
                              ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 20),
                    _Label('Nacionalidad'),
                    _Field(
                      controller: _nationalityController,
                      hint: 'Uruguay',
                      maxLength: 40,
                    ),

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
                        style: AppTypography.body(
                          size: 12,
                          color: _bioController.text.characters.length > _maxBio
                              ? context.c.destructive
                              : context.c.textSecondary,
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
        text,
        style: AppTypography.body(
          size: 14,
          weight: FontWeight.w600,
          color: context.c.textSecondary,
        ),
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
    return PateaCard(
      color: context.c.card,
      radius: AppRadii.cardAll,
      borderColor: context.c.overlayLine,
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        maxLength: maxLength,
        onChanged: onChanged,
        style: TextStyle(color: context.c.textPrimary, fontSize: 14),
        decoration: InputDecoration(
          hintText: hint,
          counterText: '',
          hintStyle: AppTypography.body(
            size: 13,
            color: context.c.textSecondary,
          ),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 14,
          ),
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
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
        decoration: BoxDecoration(
          color: Colors.transparent,
          border: Border(
            bottom: BorderSide(
              color: selected ? color : context.c.overlayLine,
              width: selected ? 1.5 : 1,
            ),
          ),
        ),
        child: Text(
          label,
          style: AppTypography.body(
            size: 13,
            weight: FontWeight.w600,
            color: selected ? color : context.c.textSecondary,
          ),
        ),
      ),
    );
  }
}
