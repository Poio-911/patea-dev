import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/match_service.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/ai_service.dart';
import '../../core/services/location_service.dart';
import '../../core/services/weather_service.dart';
import '../../core/models/player_model.dart';

/// Port de add-match-dialog.tsx (web): wizard de 3 pasos (2 si es
/// colaborativo). 'by_teams' (elegir 2 equipos de grupo ya armados) y las
/// "Canchas del Grupo" quedan deshabilitados hasta que exista la Sección 5
/// (Grupos/Equipos) y el dominio Venues del plan de migración.
class CreateMatchScreen extends ConsumerStatefulWidget {
  const CreateMatchScreen({super.key});

  @override
  ConsumerState<CreateMatchScreen> createState() => _CreateMatchScreenState();
}

const _matchSizes = [10, 14, 22]; // MatchSize en src/lib/types.ts
const _matchSizeLabels = {10: 'Fútbol 5', 14: 'Fútbol 7', 22: 'Fútbol 11'};
const _positions = ['DEL', 'MED', 'DEF', 'POR'];

IconData _weatherIcon(String icon) {
  switch (icon) {
    case 'Sun':
      return Icons.wb_sunny_rounded;
    case 'Cloud':
      return Icons.cloud_queue_rounded;
    case 'CloudRain':
      return Icons.grain_rounded;
    case 'CloudSnow':
      return Icons.ac_unit_rounded;
    case 'Wind':
      return Icons.air_rounded;
    case 'Zap':
      return Icons.bolt_rounded;
    case 'Cloudy':
    default:
      return Icons.cloud_rounded;
  }
}

class _CreateMatchScreenState extends ConsumerState<CreateMatchScreen> {
  int _step = 1;
  final _titleController = TextEditingController(text: 'Partido Amistoso');
  final _locationController = TextEditingController();

  // Paso 1
  bool _isPlanning = false;
  DateTime? _selectedDate = DateTime.now().add(const Duration(days: 1));
  TimeOfDay? _selectedTime = const TimeOfDay(hour: 21, minute: 0);
  LocationSuggestion? _selectedLocation;
  List<LocationSuggestion> _locationSuggestions = [];
  bool _searchingLocation = false;
  Timer? _locationDebounce;
  WeatherForecast? _weather;
  bool _loadingWeather = false;
  Timer? _weatherDebounce;

  // Paso 2
  int _matchSize = 10;
  String _selectedType = 'manual';
  bool _isPublic = false;

  // Paso 3
  String _playerSearch = '';
  String _positionFilter = 'all';
  final Set<String> _selectedPlayerIds = {};

  bool _isSubmitting = false;
  String? _aiStatus;

  final _locationService = LocationService();
  final _weatherService = WeatherService();

  @override
  void dispose() {
    _titleController.dispose();
    _locationController.dispose();
    _locationDebounce?.cancel();
    _weatherDebounce?.cancel();
    super.dispose();
  }

  void _onLocationChanged(String query) {
    _locationDebounce?.cancel();
    _locationDebounce = Timer(const Duration(milliseconds: 300), () async {
      if (query.trim().length < 3) {
        setState(() => _locationSuggestions = []);
        return;
      }
      setState(() => _searchingLocation = true);
      final results = await _locationService.suggest(query);
      if (!mounted) return;
      setState(() {
        _locationSuggestions = results;
        _searchingLocation = false;
      });
    });
  }

  void _selectLocation(LocationSuggestion loc) {
    setState(() {
      _selectedLocation = loc;
      _locationController.text = loc.label;
      _locationSuggestions = [];
    });
    _scheduleWeatherFetch();
  }

  void _scheduleWeatherFetch() {
    _weatherDebounce?.cancel();
    if (_isPlanning || _selectedLocation == null || _selectedDate == null || _selectedTime == null) {
      setState(() => _weather = null);
      return;
    }
    _weatherDebounce = Timer(const Duration(seconds: 1), () async {
      setState(() {
        _loadingWeather = true;
        _weather = null;
      });
      try {
        final dt = DateTime(
          _selectedDate!.year,
          _selectedDate!.month,
          _selectedDate!.day,
          _selectedTime!.hour,
          _selectedTime!.minute,
        );
        final forecast = await _weatherService.getForecast(
          lat: _selectedLocation!.lat,
          lng: _selectedLocation!.lng,
          dateTime: dt,
        );
        if (!mounted) return;
        setState(() => _weather = forecast);
      } catch (_) {
        if (!mounted) return;
        setState(() => _weather = null);
      } finally {
        if (mounted) setState(() => _loadingWeather = false);
      }
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
      _scheduleWeatherFetch();
    }
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(context: context, initialTime: _selectedTime ?? const TimeOfDay(hour: 21, minute: 0));
    if (picked != null) {
      setState(() => _selectedTime = picked);
      _scheduleWeatherFetch();
    }
  }

  bool get _canGoToStep2 {
    if (_titleController.text.trim().length < 3) return false;
    if (_selectedLocation == null) return false;
    if (!_isPlanning && (_selectedDate == null || _selectedTime == null)) return false;
    return true;
  }

  void _goNext() {
    if (_step == 1 && !_canGoToStep2) return;
    if (_step == 2 && _selectedType == 'collaborative') {
      _handleCreate(const []);
      return;
    }
    setState(() => _step += 1);
  }

  Future<void> _handleCreate(List<PlayerModel> allPlayers) async {
    final user = ref.read(authServiceProvider).currentUser;
    if (user == null) return;

    setState(() {
      _isSubmitting = true;
      _aiStatus = null;
    });

    try {
      final dateIso = _isPlanning || _selectedDate == null ? '' : _selectedDate!.toIso8601String();
      final timeStr = _isPlanning || _selectedTime == null
          ? ''
          : '${_selectedTime!.hour.toString().padLeft(2, '0')}:${_selectedTime!.minute.toString().padLeft(2, '0')}';

      List<Map<String, dynamic>> players = const [];
      List<String> playerUids = const [];
      List<dynamic> teams = const [];

      if (_selectedType == 'manual') {
        final selected = allPlayers.where((p) => _selectedPlayerIds.contains(p.id)).toList();
        players = selected
            .map((p) => {
                  'uid': p.id,
                  'displayName': p.name,
                  'ovr': p.ovr,
                  'position': p.position,
                  'photoURL': p.photoUrl ?? '',
                })
            .toList();
        playerUids = selected.map((p) => p.id).toList();

        // Igual que la web: solo se arman equipos por IA si el plantel
        // elegido completa exactamente el tamaño del partido.
        if (selected.length == _matchSize) {
          setState(() => _aiStatus = 'Armando equipos parejos con IA...');
          try {
            final result = await ref.read(aiServiceProvider).generateBalancedTeams(selected);
            teams = result['teams'] as List<dynamic>? ?? const [];
          } catch (e) {
            if (!mounted) return;
            setState(() => _aiStatus = 'La IA no pudo armar los equipos, se crea sin equipos.');
            await Future.delayed(const Duration(seconds: 2));
          }
        }
      }
      // 'collaborative': arranca sin jugadores, se suman después con joinMatch.

      await ref
          .read(matchServiceProvider)
          .createMatch(
            title: _titleController.text.trim(),
            type: _selectedType,
            ownerUid: user.uid,
            matchSize: _matchSize,
            date: dateIso,
            time: timeStr,
            locationName: _selectedLocation?.label ?? _locationController.text.trim(),
            locationAddress: _selectedLocation?.label ?? '',
            locationLat: _selectedLocation?.lat ?? 0,
            locationLng: _selectedLocation?.lng ?? 0,
            locationPlaceId: _selectedLocation?.placeId ?? '',
            isPublic: _isPublic,
            players: players,
            playerUids: playerUids,
            teams: teams,
          )
          .timeout(const Duration(seconds: 20));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('¡Partido creado!'), backgroundColor: AppColors.success),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al crear partido: $e'), backgroundColor: AppColors.destructive),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final playersAsync = ref.watch(activeGroupPlayersProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('ARMAR PARTIDO', style: AppTypography.headline(size: 18, weight: FontWeight.w800)),
        leading: _step > 1
            ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => setState(() => _step -= 1))
            : null,
      ),
      body: Column(
        children: [
          _StepIndicator(step: _step, totalSteps: _selectedType == 'collaborative' ? 2 : 3),
          Expanded(
            child: playersAsync.when(
              data: (allPlayers) => _buildStepBody(allPlayers),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
            ),
          ),
          _buildFooter(playersAsync.value ?? const []),
        ],
      ),
    );
  }

  Widget _buildStepBody(List<PlayerModel> allPlayers) {
    switch (_step) {
      case 1:
        return _buildStep1();
      case 2:
        return _buildStep2();
      default:
        return _buildStep3(allPlayers);
    }
  }

  Widget _buildFooter(List<PlayerModel> allPlayers) {
    final selectedCount = _selectedPlayerIds.length;
    final canSubmitStep3 = _selectedType != 'manual' || selectedCount >= (_matchSize / 2).ceil();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: AppColors.border.withValues(alpha: 0.3)))),
      child: Row(
        children: [
          if (_step > 1)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: OutlinedButton(
                onPressed: _isSubmitting ? null : () => setState(() => _step -= 1),
                child: const Text('Atrás'),
              ),
            ),
          Expanded(
            child: ElevatedButton(
              onPressed: _isSubmitting
                  ? null
                  : _step < 3
                      ? (_step == 1 ? (_canGoToStep2 ? _goNext : null) : _goNext)
                      : (canSubmitStep3 ? () => _handleCreate(allPlayers) : null),
              child: _isSubmitting
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2))
                  : Text(_step < 3 && !(_step == 2 && _selectedType == 'collaborative')
                      ? 'Siguiente'
                      : 'CREAR PARTIDO'),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Paso 1: detalles
  // ---------------------------------------------------------------------
  Widget _buildStep1() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _titleController,
            onChanged: (_) => setState(() {}),
            style: AppTypography.body(),
            decoration: const InputDecoration(
              labelText: 'Título del Partido',
              prefixIcon: Icon(Icons.sports_soccer, color: AppColors.voltNeon),
            ),
          ),
          const SizedBox(height: 16),

          Text('UBICACIÓN', style: AppTypography.headline(size: 13, color: AppColors.textMuted)),
          const SizedBox(height: 8),
          TextField(
            controller: _locationController,
            onChanged: (v) {
              if (_selectedLocation != null && v != _selectedLocation!.label) {
                _selectedLocation = null;
              }
              _onLocationChanged(v);
            },
            style: AppTypography.body(),
            decoration: InputDecoration(
              hintText: 'Buscá la dirección de la cancha...',
              prefixIcon: const Icon(Icons.location_on, color: AppColors.voltNeon),
              suffixIcon: _searchingLocation
                  ? const Padding(
                      padding: EdgeInsets.all(14),
                      child: SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                    )
                  : (_selectedLocation != null ? const Icon(Icons.check_circle, color: AppColors.success) : null),
            ),
          ),
          if (_locationSuggestions.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 4),
              decoration: BoxDecoration(
                color: AppColors.cardSurface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: _locationSuggestions
                    .map((s) => ListTile(
                          dense: true,
                          leading: const Icon(Icons.place_outlined, size: 18, color: AppColors.textMuted),
                          title: Text(s.label, style: AppTypography.body(size: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
                          onTap: () => _selectLocation(s),
                        ))
                    .toList(),
              ),
            ),

          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.voltNeon.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.voltNeon.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Definir horario por votación', style: AppTypography.body(size: 13, weight: FontWeight.w700, color: AppColors.textPrimary)),
                      Text('Elegí esta opción si todavía no saben la fecha u hora.', style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                    ],
                  ),
                ),
                Switch(
                  value: _isPlanning,
                  activeTrackColor: AppColors.voltNeon,
                  onChanged: (v) {
                    setState(() => _isPlanning = v);
                    _scheduleWeatherFetch();
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          Opacity(
            opacity: _isPlanning ? 0.4 : 1,
            child: IgnorePointer(
              ignoring: _isPlanning,
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _pickDate,
                      icon: const Icon(Icons.calendar_today, size: 16),
                      label: Text(_selectedDate == null
                          ? 'Fecha'
                          : '${_selectedDate!.day}/${_selectedDate!.month}/${_selectedDate!.year}'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _pickTime,
                      icon: const Icon(Icons.access_time, size: 16),
                      label: Text(_selectedTime == null ? 'Hora' : _selectedTime!.format(context)),
                    ),
                  ),
                ],
              ),
            ),
          ),

          if (!_isPlanning) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              constraints: const BoxConstraints(minHeight: 60),
              decoration: BoxDecoration(color: AppColors.cardSurface, borderRadius: BorderRadius.circular(10)),
              child: Center(
                child: _loadingWeather
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const SizedBox(height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                          const SizedBox(width: 10),
                          Text('Viendo el pronóstico...', style: AppTypography.body(size: 12, color: AppColors.textMuted)),
                        ],
                      )
                    : _weather != null
                        ? Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(_weatherIcon(_weather!.icon), color: AppColors.voltNeon, size: 26),
                              const SizedBox(width: 10),
                              Text('${_weather!.temperature}°C', style: AppTypography.sportNumber(size: 18)),
                              const SizedBox(width: 10),
                              Flexible(child: Text(_weather!.description, style: AppTypography.body(size: 12))),
                            ],
                          )
                        : Text(
                            'Poné fecha y lugar para ver el pronóstico.',
                            style: AppTypography.body(size: 12, color: AppColors.textMuted),
                            textAlign: TextAlign.center,
                          ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Paso 2: formato
  // ---------------------------------------------------------------------
  Widget _buildStep2() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('TAMAÑO DEL PARTIDO', style: AppTypography.headline(size: 13, color: AppColors.textMuted)),
          const SizedBox(height: 8),
          Row(
            children: _matchSizes.map((size) {
              final isSelected = _matchSize == size;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(_matchSizeLabels[size]!),
                    selected: isSelected,
                    onSelected: (_) => setState(() {
                      _matchSize = size;
                      _selectedPlayerIds.clear();
                    }),
                    selectedColor: AppColors.voltNeon.withValues(alpha: 0.25),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 24),

          Text('TIPO DE PARTIDO', style: AppTypography.headline(size: 13, color: AppColors.textMuted)),
          const SizedBox(height: 4),
          Text(
            'Manual: elegís vos, la IA arma los equipos. Colaborativo: los jugadores se apuntan solos.',
            style: AppTypography.body(size: 11, color: AppColors.textMuted),
          ),
          const SizedBox(height: 8),
          _TypeOption(
            icon: Icons.how_to_reg,
            label: 'Manual (con IA)',
            selected: _selectedType == 'manual',
            onTap: () => setState(() => _selectedType = 'manual'),
          ),
          const SizedBox(height: 8),
          _TypeOption(
            icon: Icons.groups,
            label: 'Colaborativo',
            selected: _selectedType == 'collaborative',
            onTap: () => setState(() => _selectedType = 'collaborative'),
          ),
          const SizedBox(height: 8),
          _TypeOption(
            icon: Icons.checkroom,
            label: 'Por Equipos',
            selected: false,
            enabled: false,
            trailing: 'Próximamente',
            onTap: () {},
          ),
          const SizedBox(height: 24),

          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.cardSurface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                const Icon(Icons.public, color: AppColors.textMuted),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Hacer Partido Público', style: AppTypography.body(size: 13, weight: FontWeight.w700, color: AppColors.textPrimary)),
                      Text('Permite que jugadores de afuera se sumen.', style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                    ],
                  ),
                ),
                Switch(value: _isPublic, activeTrackColor: AppColors.voltNeon, onChanged: (v) => setState(() => _isPublic = v)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Paso 3: participantes
  // ---------------------------------------------------------------------
  Widget _buildStep3(List<PlayerModel> allPlayers) {
    final filtered = allPlayers.where((p) {
      final matchesName = p.name.toLowerCase().contains(_playerSearch.toLowerCase());
      final matchesPosition = _positionFilter == 'all' || p.position == _positionFilter;
      return matchesName && matchesPosition;
    }).toList();

    final selectedPlayers = allPlayers.where((p) => _selectedPlayerIds.contains(p.id)).toList();
    final missingPositions = _positions.where((pos) => !selectedPlayers.any((p) => p.position == pos)).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('JUGADORES', style: AppTypography.headline(size: 13, color: AppColors.textMuted)),
                  Text(
                    '${_selectedPlayerIds.length} / $_matchSize',
                    style: AppTypography.headline(
                      size: 13,
                      color: _selectedPlayerIds.length == _matchSize ? AppColors.voltNeon : AppColors.textMuted,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: (_selectedPlayerIds.length / _matchSize).clamp(0, 1),
                  minHeight: 6,
                  backgroundColor: AppColors.cardSurface,
                  color: AppColors.voltNeon,
                ),
              ),
              if (_selectedPlayerIds.isNotEmpty && missingPositions.isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    '⚠️ Sin ${missingPositions.map((p) => p == 'POR' ? 'arqueros' : p == 'DEF' ? 'defensores' : p == 'MED' ? 'mediocampistas' : 'delanteros').join(', ')} seleccionados.',
                    style: AppTypography.body(size: 11, color: AppColors.warning),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              TextField(
                onChanged: (v) => setState(() => _playerSearch = v),
                style: AppTypography.body(size: 13),
                decoration: const InputDecoration(
                  hintText: 'Buscar jugador...',
                  prefixIcon: Icon(Icons.search, size: 20),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 8),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: ['all', ...(_positions)].map((pos) {
                    final isSelected = _positionFilter == pos;
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        label: Text(pos == 'all' ? 'Todos' : pos),
                        selected: isSelected,
                        onSelected: (_) => setState(() => _positionFilter = pos),
                        selectedColor: AppColors.voltNeon.withValues(alpha: 0.25),
                        labelStyle: AppTypography.body(size: 12),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Text('Selección rápida: ', style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                  TextButton(
                    onPressed: _selectedPlayerIds.length >= _matchSize
                        ? null
                        : () {
                            final needed = _matchSize - _selectedPlayerIds.length;
                            final available = allPlayers.where((p) => !_selectedPlayerIds.contains(p.id)).toList()
                              ..sort((a, b) => b.ovr.compareTo(a.ovr));
                            setState(() {
                              for (final p in available.take(needed)) {
                                _selectedPlayerIds.add(p.id);
                              }
                            });
                          },
                    child: const Text('Completar con mejores', style: TextStyle(fontSize: 12)),
                  ),
                  TextButton(
                    onPressed: _selectedPlayerIds.isEmpty ? null : () => setState(() => _selectedPlayerIds.clear()),
                    child: const Text('Limpiar', style: TextStyle(fontSize: 12)),
                  ),
                ],
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: filtered.isEmpty
              ? Center(child: Text('No se encontraron jugadores.', style: AppTypography.body(color: AppColors.textMuted)))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final p = filtered[index];
                    final isSelected = _selectedPlayerIds.contains(p.id);
                    return _PlayerSelectRow(
                      player: p,
                      selected: isSelected,
                      onTap: () {
                        if (!isSelected && _selectedPlayerIds.length >= _matchSize) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('No podés seleccionar más de $_matchSize jugadores.')),
                          );
                          return;
                        }
                        setState(() {
                          if (isSelected) {
                            _selectedPlayerIds.remove(p.id);
                          } else {
                            _selectedPlayerIds.add(p.id);
                          }
                        });
                      },
                    );
                  },
                ),
        ),
        if (_aiStatus != null)
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text(_aiStatus!, textAlign: TextAlign.center, style: AppTypography.body(size: 12, color: AppColors.voltNeon)),
          ),
      ],
    );
  }
}

class _StepIndicator extends StatelessWidget {
  final int step;
  final int totalSteps;

  const _StepIndicator({required this.step, required this.totalSteps});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: Row(
        children: List.generate(totalSteps, (i) {
          final isActive = i < step;
          return Expanded(
            child: Container(
              margin: EdgeInsets.only(right: i < totalSteps - 1 ? 6 : 0),
              height: 4,
              decoration: BoxDecoration(
                color: isActive ? AppColors.voltNeon : AppColors.cardSurface,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _TypeOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final bool enabled;
  final String? trailing;
  final VoidCallback onTap;

  const _TypeOption({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.enabled = true,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.4,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: selected ? AppColors.voltNeon.withValues(alpha: 0.12) : AppColors.cardSurface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: selected ? AppColors.voltNeon : AppColors.border),
          ),
          child: Row(
            children: [
              Icon(icon, size: 20, color: selected ? AppColors.voltNeon : AppColors.textMuted),
              const SizedBox(width: 12),
              Expanded(
                child: Text(label, style: AppTypography.body(size: 13, weight: FontWeight.w700, color: AppColors.textPrimary)),
              ),
              if (trailing != null)
                Text(trailing!, style: AppTypography.body(size: 11, color: AppColors.textMuted)),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlayerSelectRow extends StatelessWidget {
  final PlayerModel player;
  final bool selected;
  final VoidCallback onTap;

  const _PlayerSelectRow({required this.player, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.voltNeon.withValues(alpha: 0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? AppColors.voltNeon : AppColors.border.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: AppColors.cardSurface,
              backgroundImage: player.photoUrl != null && player.photoUrl!.isNotEmpty ? NetworkImage(player.photoUrl!) : null,
              child: player.photoUrl == null || player.photoUrl!.isEmpty
                  ? Text(player.name.isNotEmpty ? player.name[0].toUpperCase() : '?', style: AppTypography.body(size: 13, weight: FontWeight.w700))
                  : null,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(player.name, style: AppTypography.body(size: 13, weight: FontWeight.w700, color: AppColors.textPrimary), overflow: TextOverflow.ellipsis),
                  Row(
                    children: [
                      Text(
                        player.position,
                        style: AppTypography.code(size: 11, weight: FontWeight.w700, color: AppColors.getPositionColor(player.position)),
                      ),
                      const SizedBox(width: 8),
                      Text('OVR ${player.ovr}', style: AppTypography.body(size: 11, color: AppColors.textMuted)),
                    ],
                  ),
                ],
              ),
            ),
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: selected ? AppColors.voltNeon : Colors.transparent,
                borderRadius: BorderRadius.circular(5),
                border: Border.all(color: selected ? AppColors.voltNeon : AppColors.textMuted),
              ),
              child: selected ? const Icon(Icons.check, size: 16, color: Colors.black) : null,
            ),
          ],
        ),
      ),
    );
  }
}
