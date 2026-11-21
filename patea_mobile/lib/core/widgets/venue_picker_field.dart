import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../models/venue_model.dart';
import '../services/firestore_service.dart';
import '../services/group_service.dart';
import '../services/location_service.dart';
import '../theme/app_radii.dart';
import '../theme/patea_colors.dart';
import 'patea_snack.dart';

/// Selector reutilizable de cancha/lugar con:
/// - Canchas ya usadas por el grupo (`venues/` en Firestore, $0 de API)
/// - Filtro de país configurable (por defecto el país del grupo o dispositivo)
/// - Autocomplete con Google Places API (New) via Cloud Function + fallback OSM
/// - Resolución de foto de referencia de Google Maps (cacheada en Storage)
/// - Carga/edición de foto propia por miembros del grupo
class VenuePickerField extends ConsumerStatefulWidget {
  final String? groupId;
  final String? defaultCountryCode;
  final LocationSuggestion? selected;
  final ValueChanged<LocationSuggestion?> onChanged;
  final String labelText;
  final String hintText;
  final LocationService? locationService;

  const VenuePickerField({
    super.key,
    this.groupId,
    this.defaultCountryCode,
    required this.selected,
    required this.onChanged,
    this.labelText = 'Cancha / Lugar',
    this.hintText = 'Buscá por nombre de cancha o dirección...',
    this.locationService,
  });

  @override
  ConsumerState<VenuePickerField> createState() => _VenuePickerFieldState();
}

class _VenuePickerFieldState extends ConsumerState<VenuePickerField> {
  final _controller = TextEditingController();
  late final LocationService _locationService;
  Timer? _debounce;
  String? _sessionToken;
  String? _countryCode;
  bool _countryInitialized = false;
  bool _searching = false;
  bool _resolving = false;
  bool _uploadingPhoto = false;
  List<LocationSuggestion> _suggestions = const [];

  @override
  void initState() {
    super.initState();
    _locationService = widget.locationService ?? LocationService();
    _countryCode = LocationService.defaultCountryCode(
      groupCountryCode: widget.defaultCountryCode,
    );
    _countryInitialized = widget.defaultCountryCode != null;
    if (widget.selected != null) {
      _controller.text = widget.selected!.name.isNotEmpty
          ? widget.selected!.name
          : widget.selected!.label;
    }
  }

  @override
  void didUpdateWidget(covariant VenuePickerField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_countryInitialized &&
        widget.defaultCountryCode != null &&
        widget.defaultCountryCode != oldWidget.defaultCountryCode) {
      _countryCode = LocationService.defaultCountryCode(
        groupCountryCode: widget.defaultCountryCode,
      );
      _countryInitialized = true;
    }
    if (widget.selected?.label != oldWidget.selected?.label &&
        widget.selected != null) {
      final nextText = widget.selected!.name.isNotEmpty
          ? widget.selected!.name
          : widget.selected!.label;
      if (_controller.text != nextText) {
        _controller.text = nextText;
      }
    } else if (widget.selected == null && oldWidget.selected != null) {
      _controller.clear();
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    final trimmed = value.trim();
    if (trimmed.length < 3) {
      setState(() {
        _suggestions = const [];
        _searching = false;
      });
      return;
    }

    _sessionToken ??= LocationService.createSessionToken();
    setState(() => _searching = true);
    _debounce = Timer(const Duration(milliseconds: 380), () async {
      try {
        final results = await _locationService.suggest(
          trimmed,
          countryCode: _countryCode,
          sessionToken: _sessionToken,
        );
        if (!mounted) return;
        setState(() {
          _suggestions = results;
          _searching = false;
        });
      } catch (_) {
        if (!mounted) return;
        setState(() => _searching = false);
      }
    });
  }

  Future<void> _selectSuggestion(LocationSuggestion suggestion) async {
    setState(() {
      _suggestions = const [];
      _resolving = true;
    });

    final token = _sessionToken;
    _sessionToken = null;

    final resolved = await _locationService.resolvePlace(
      suggestion,
      sessionToken: token,
      groupId: widget.groupId,
    );

    if (!mounted) return;
    _controller.text = resolved.name.isNotEmpty ? resolved.name : resolved.label;
    setState(() => _resolving = false);
    widget.onChanged(resolved);
  }

  void _selectGroupVenue(VenueModel venue) {
    _debounce?.cancel();
    _sessionToken = null;
    final suggestion = venue.toSuggestion();
    _controller.text = venue.name;
    setState(() {
      _suggestions = const [];
      _searching = false;
    });
    widget.onChanged(suggestion);
  }

  void _clearSelection() {
    _debounce?.cancel();
    _sessionToken = null;
    _controller.clear();
    setState(() {
      _suggestions = const [];
      _searching = false;
    });
    widget.onChanged(null);
  }

  Future<void> _pickCountry() async {
    final picked = await showModalBottomSheet<String?>(
      context: context,
      backgroundColor: context.c.card,
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceTop),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: ctx.c.border,
                  borderRadius: AppRadii.hairAll,
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
                child: Row(
                  children: [
                    Icon(Icons.public, size: 20, color: ctx.c.primary),
                    const SizedBox(width: 8),
                    Text(
                      'Filtrar búsqueda por país',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: ctx.c.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: kSupportedCountries.length,
                  itemBuilder: (ctx, i) {
                    final option = kSupportedCountries[i];
                    final selected = option.code == _countryCode;
                    return ListTile(
                      leading: Text(
                        option.flag,
                        style: const TextStyle(fontSize: 22),
                      ),
                      title: Text(
                        option.name,
                        style: TextStyle(
                          color: ctx.c.textPrimary,
                          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                        ),
                      ),
                      trailing: selected
                          ? Icon(Icons.check_circle, color: ctx.c.primary)
                          : null,
                      onTap: () => Navigator.of(ctx).pop(option.code ?? ''),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );

    if (picked == null || !mounted) return;
    final nextCode = picked.isEmpty ? null : picked;
    setState(() {
      _countryCode = nextCode;
      _countryInitialized = true;
    });
    if (_controller.text.trim().length >= 3) {
      _onQueryChanged(_controller.text);
    }
  }

  Future<void> _uploadVenuePhoto(VenueModel venue) async {
    final groupId = widget.groupId;
    if (groupId == null || groupId.isEmpty) return;

    final picker = ImagePicker();
    final xfile = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1280,
      imageQuality: 85,
    );
    if (xfile == null || !mounted) return;

    setState(() => _uploadingPhoto = true);
    try {
      final photoUrl = await _locationService.uploadCustomVenuePhoto(
        groupId: groupId,
        venueId: venue.id,
        file: File(xfile.path),
      );
      await ref.read(groupServiceProvider).updateGroupVenue(
            groupId: groupId,
            venueId: venue.id,
            photoUrl: photoUrl,
          );

      if (!mounted) return;
      if (widget.selected != null &&
          (widget.selected!.placeId == venue.placeId ||
              widget.selected!.name.toLowerCase() == venue.name.toLowerCase())) {
        widget.onChanged(widget.selected!.copyWith(photoUrl: photoUrl));
      }
      PateaSnack.ok(context, 'Foto de ${venue.name} actualizada');
    } catch (e) {
      if (mounted) {
        PateaSnack.error(context, 'No se pudo subir la foto: $e');
      }
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final groupId = widget.groupId;
    final venuesAsync = (groupId != null && groupId.isNotEmpty)
        ? ref.watch(groupVenuesStreamProvider(groupId))
        : const AsyncValue<List<VenueModel>>.data([]);
    final venues = venuesAsync.value ?? const <VenueModel>[];
    final country = findCountryOption(_countryCode);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (venues.isNotEmpty) ...[
          Row(
            children: [
              Icon(Icons.stadium_outlined, size: 15, color: context.c.primary),
              const SizedBox(width: 6),
              Text(
                'Canchas del grupo',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: context.c.textSecondary,
                ),
              ),
              const Spacer(),
              Text(
                'Toca para reutilizar',
                style: TextStyle(
                  fontSize: 11,
                  color: context.c.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 118,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: venues.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final v = venues[index];
                final isSelected = widget.selected != null &&
                    ((v.placeId.isNotEmpty &&
                            v.placeId == widget.selected!.placeId) ||
                        (v.name.toLowerCase() ==
                            widget.selected!.name.toLowerCase()));
                return _GroupVenueCard(
                  venue: v,
                  selected: isSelected,
                  uploading: _uploadingPhoto && isSelected,
                  onTap: () => _selectGroupVenue(v),
                  onUploadPhoto: () => _uploadVenuePhoto(v),
                );
              },
            ),
          ),
          const SizedBox(height: 12),
        ],

        // Campo de búsqueda + selector rápido de país
        TextField(
          controller: _controller,
          onChanged: _onQueryChanged,
          decoration: InputDecoration(
            labelText: widget.labelText,
            hintText: widget.hintText,
            prefixIcon: const Icon(Icons.location_on_outlined),
            suffixIcon: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_searching || _resolving)
                  const Padding(
                    padding: EdgeInsets.only(right: 6),
                    child: SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                if (_controller.text.isNotEmpty)
                  IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    tooltip: 'Limpiar',
                    onPressed: _clearSelection,
                  ),
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: InkWell(
                    onTap: _pickCountry,
                    borderRadius: AppRadii.pillAll,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: context.c.cardSurface,
                        borderRadius: AppRadii.pillAll,
                        border: Border.all(color: context.c.border),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(country.flag, style: const TextStyle(fontSize: 13)),
                          const SizedBox(width: 4),
                          Text(
                            country.code ?? 'ALL',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: context.c.textPrimary,
                            ),
                          ),
                          Icon(
                            Icons.arrow_drop_down,
                            size: 16,
                            color: context.c.textSecondary,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        if (_suggestions.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: 6),
            decoration: BoxDecoration(
              color: context.c.cardSurface,
              borderRadius: AppRadii.cardAll,
              border: Border.all(color: context.c.border),
            ),
            child: Column(
              children: _suggestions.map((s) {
                return ListTile(
                  dense: true,
                  leading: Icon(
                    s.placeId.startsWith('osm:')
                        ? Icons.place_outlined
                        : Icons.stadium_outlined,
                    size: 18,
                    color: context.c.primary,
                  ),
                  title: Text(
                    s.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: context.c.textPrimary,
                    ),
                  ),
                  subtitle: s.address.isNotEmpty && s.address != s.name
                      ? Text(
                          s.address,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            color: context.c.textSecondary,
                          ),
                        )
                      : null,
                  onTap: () => _selectSuggestion(s),
                );
              }).toList(),
            ),
          ),

        if (widget.selected != null) ...[
          const SizedBox(height: 10),
          _SelectedVenuePreview(
            suggestion: widget.selected!,
            onClear: _clearSelection,
          ),
        ],
      ],
    );
  }
}

class _GroupVenueCard extends StatelessWidget {
  final VenueModel venue;
  final bool selected;
  final bool uploading;
  final VoidCallback onTap;
  final VoidCallback onUploadPhoto;

  const _GroupVenueCard({
    required this.venue,
    required this.selected,
    required this.uploading,
    required this.onTap,
    required this.onUploadPhoto,
  });

  @override
  Widget build(BuildContext context) {
    final hasPhoto = venue.photoUrl != null && venue.photoUrl!.isNotEmpty;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 152,
        decoration: BoxDecoration(
          color: selected
              ? context.c.primary.withValues(alpha: 0.14)
              : context.c.cardSurface,
          borderRadius: AppRadii.cardAll,
          border: Border.all(
            color: selected ? context.c.primary : context.c.border,
            width: selected ? 1.5 : 1,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 64,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (hasPhoto)
                    Image.network(
                      venue.photoUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const _VenuePlaceholder(),
                    )
                  else
                    const _VenuePlaceholder(),
                  Positioned(
                    top: 4,
                    left: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: context.c.card.withValues(alpha: 0.85),
                        borderRadius: AppRadii.pillAll,
                      ),
                      child: Text(
                        '${venue.usageCount}x',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: context.c.textPrimary,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 4,
                    right: 4,
                    child: InkWell(
                      onTap: uploading ? null : onUploadPhoto,
                      borderRadius: AppRadii.pillAll,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: context.c.card.withValues(alpha: 0.85),
                          shape: BoxShape.circle,
                        ),
                        child: uploading
                            ? const SizedBox(
                                width: 12,
                                height: 12,
                                child: CircularProgressIndicator(strokeWidth: 1.8),
                              )
                            : Icon(
                                Icons.add_a_photo_outlined,
                                size: 13,
                                color: context.c.textPrimary,
                              ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    venue.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: context.c.textPrimary,
                    ),
                  ),
                  if (venue.address.isNotEmpty)
                    Text(
                      venue.address,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 10,
                        color: context.c.textSecondary,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VenuePlaceholder extends StatelessWidget {
  const _VenuePlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: context.c.card,
      child: Center(
        child: Icon(
          Icons.stadium_outlined,
          size: 26,
          color: context.c.textSecondary,
        ),
      ),
    );
  }
}

class _SelectedVenuePreview extends StatelessWidget {
  final LocationSuggestion suggestion;
  final VoidCallback onClear;

  const _SelectedVenuePreview({
    required this.suggestion,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    final hasPhoto =
        suggestion.photoUrl != null && suggestion.photoUrl!.isNotEmpty;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: context.c.cardSurface,
        borderRadius: AppRadii.cardAll,
        border: Border.all(color: context.c.primary.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: AppRadii.chipAll,
            child: SizedBox(
              width: 52,
              height: 52,
              child: hasPhoto
                  ? Image.network(
                      suggestion.photoUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const _VenuePlaceholder(),
                    )
                  : const _VenuePlaceholder(),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  suggestion.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: context.c.textPrimary,
                  ),
                ),
                if (suggestion.address.isNotEmpty)
                  Text(
                    suggestion.address,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      color: context.c.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.close, size: 18, color: context.c.textSecondary),
            onPressed: onClear,
            tooltip: 'Quitar cancha',
          ),
        ],
      ),
    );
  }
}
