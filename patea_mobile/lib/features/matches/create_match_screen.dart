import '../../core/widgets/patea_button_progress.dart';
import 'package:uuid/uuid.dart';
import 'dart:async';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_snack.dart';
import '../../core/widgets/patea_states.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/match_service.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/location_service.dart';
import '../../core/services/weather_service.dart';
import '../../core/models/player_model.dart';
import '../../core/theme/app_radii.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/player_select_card.dart';
import '../../core/utils/clock.dart';

/// Port de add-match-dialog.tsx (web): wizard de 3 pasos (2 si es
/// colaborativo).
///
/// Los tres tipos de amistoso andan: 'manual' (elegís el plantel y el sistema equilibra
/// los equipos), 'collaborative' (arranca vacío y la gente se anota) y
/// 'by_teams' (dos equipos ya armados del grupo). Este último estuvo mucho
/// tiempo en gris con un "Próximamente" porque todavía no existían
/// Grupos/Equipos en el móvil, y encima la Cloud Function lo rechazaba de
/// entrada; las dos cosas ya están.
///
/// Las "Canchas del Grupo" siguen pendientes: falta el dominio Venues.
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
  DateTime? _selectedDate;
  TimeOfDay? _selectedTime = const TimeOfDay(hour: 21, minute: 0);
  LocationSuggestion? _selectedLocation;
  List<LocationSuggestion> _locationSuggestions = [];
  bool _searchingLocation = false;
  Timer? _locationDebounce;
  WeatherForecast? _weather;
  bool _loadingWeather = false;
  Timer? _weatherDebounce;
  int _weatherRequestId = 0;
  String? _weatherError;
  bool _weatherOutsideRange = false;

  // Paso 2
  int _matchSize = 10;
  String _selectedType = 'manual';
  bool _isPublic = false;

  // Paso 3
  String _playerSearch = '';
  String _positionFilter = 'all';
  final Set<String> _selectedPlayerIds = {};

  /// Para 'by_teams': los dos equipos que se enfrentan, en orden de elección.
  final List<String> _selectedTeamIds = [];

  bool _isSubmitting = false;
  final String _createRequestId = const Uuid().v4();
  String? _aiStatus;

  final _locationService = LocationService();
  final _weatherService = WeatherService();

  @override
  void initState() {
    super.initState();
    _selectedDate = ref.read(clockProvider)().add(const Duration(days: 1));
  }

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
    final requestId = ++_weatherRequestId;
    setState(() {
      _weather = null;
      _loadingWeather = false;
      _weatherError = null;
      _weatherOutsideRange = false;
    });
    if (_isPlanning ||
        _selectedLocation == null ||
        _selectedDate == null ||
        _selectedTime == null) {
      return;
    }
    final location = _selectedLocation!;
    final date = _selectedDate!;
    final time = _selectedTime!;
    final now = ref.read(clockProvider)();
    final lastDay = DateTime(now.year, now.month, now.day + 15);
    if (DateTime(date.year, date.month, date.day).isAfter(lastDay)) {
      setState(() => _weatherOutsideRange = true);
      return;
    }
    setState(() => _loadingWeather = true);
    _weatherDebounce = Timer(const Duration(seconds: 1), () async {
      try {
        final dt = DateTime(
          date.year,
          date.month,
          date.day,
          time.hour,
          time.minute,
        );
        final forecast = await _weatherService.getForecast(
          lat: location.lat,
          lng: location.lng,
          dateTime: dt,
        );
        if (!mounted || requestId != _weatherRequestId) return;
        setState(() => _weather = forecast);
      } catch (_) {
        if (!mounted || requestId != _weatherRequestId) return;
        setState(
          () =>
              _weatherError = 'No pudimos consultar el clima. Probá de nuevo.',
        );
      } finally {
        if (mounted && requestId == _weatherRequestId) {
          setState(() => _loadingWeather = false);
        }
      }
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      locale: const Locale('es'),
      initialDate: _selectedDate ?? ref.read(clockProvider)().add(const Duration(days: 1)),
      firstDate: ref.read(clockProvider)(),
      lastDate: ref.read(clockProvider)().add(const Duration(days: 365)),
    );
    if (picked != null && mounted) {
      setState(() => _selectedDate = picked);
      _scheduleWeatherFetch();
    }
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime ?? const TimeOfDay(hour: 21, minute: 0),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );
    if (picked != null && mounted) {
      setState(() => _selectedTime = picked);
      _scheduleWeatherFetch();
    }
  }

  bool get _canGoToStep2 {
    if (_titleController.text.trim().length < 3) return false;
    if (_selectedLocation == null) return false;
    if (!_isPlanning && (_selectedDate == null || _selectedTime == null)) {
      return false;
    }
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
    if (_isSubmitting) return;
    final user = ref.read(authServiceProvider).currentUser;
    if (user == null) return;
    if (!_canGoToStep2) {
      PateaSnack.error(
        context,
        'Completá el nombre, la cancha y la fecha del partido.',
      );
      return;
    }
    if (!_isPlanning) {
      final kickoff = DateTime(
        _selectedDate!.year,
        _selectedDate!.month,
        _selectedDate!.day,
        _selectedTime!.hour,
        _selectedTime!.minute,
      );
      if (!kickoff.isAfter(ref.read(clockProvider)())) {
        PateaSnack.error(context, 'Elegí una fecha y hora futuras.');
        return;
      }
    }
    if (_selectedType == 'manual' &&
        (_selectedPlayerIds.length < (_matchSize / 2).ceil() ||
            _selectedPlayerIds.length > _matchSize ||
            _selectedPlayerIds.any(
              (id) => !allPlayers.any((p) => p.id == id),
            ))) {
      PateaSnack.error(
        context,
        'Revisá el plantel: elegí jugadores disponibles entre medio cupo y el cupo completo.',
      );
      return;
    }
    if (_selectedType == 'by_teams' && _selectedTeamIds.toSet().length != 2) {
      PateaSnack.error(context, 'Elegí dos equipos diferentes.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _aiStatus = null;
    });

    try {
      final dateIso = _isPlanning || _selectedDate == null
          ? ''
          : _selectedDate!.toIso8601String();
      final timeStr = _isPlanning || _selectedTime == null
          ? ''
          : '${_selectedTime!.hour.toString().padLeft(2, '0')}:${_selectedTime!.minute.toString().padLeft(2, '0')}';

      List<Map<String, dynamic>> players = const [];
      List<String> playerUids = const [];
      List<dynamic> teams = const [];

      if (_selectedType == 'manual') {
        final selected = allPlayers
            .where((p) => _selectedPlayerIds.contains(p.id))
            .toList();
        players = selected
            .map(
              (p) => {
                'uid': p.id,
                'displayName': p.name,
                'ovr': p.ovr,
                'position': p.position,
                'photoURL': p.photoUrl ?? '',
              },
            )
            .toList();
        playerUids = selected.map((p) => p.id).toList();

        if (selected.length == _matchSize) {
          setState(
            () => _aiStatus = 'Equilibrando equipos por nivel y posiciones…',
          );
        }
      }
      // 'collaborative': arranca sin jugadores, se suman después con joinMatch.
      // 'by_teams': sólo van los ids; el plantel y las camisetas los arma el
      // servidor leyendo `teams/`, para que nadie pueda inventar un equipo
      // desde el cliente.

      await ref
          .read(matchServiceProvider)
          .createMatch(
            requestId: _createRequestId,
            title: _titleController.text.trim(),
            type: _selectedType,
            ownerUid: user.uid,
            matchSize: _matchSize,
            date: dateIso,
            time: timeStr,
            locationName:
                _selectedLocation?.label ?? _locationController.text.trim(),
            locationAddress: _selectedLocation?.label ?? '',
            locationLat: _selectedLocation?.lat ?? 0,
            locationLng: _selectedLocation?.lng ?? 0,
            locationPlaceId: _selectedLocation?.placeId ?? '',
            isPublic: _isPublic,
            players: players,
            playerUids: playerUids,
            teams: teams,
            selectedTeams: _selectedType == 'by_teams'
                ? _selectedTeamIds
                : const [],
            // El pronóstico se consultaba para mostrarlo en el wizard y se
            // perdía al crear: el partido nacía sin clima.
            weather: _weather == null
                ? null
                : {
                    'description': _weather!.description,
                    'icon': _weather!.icon,
                    'temperature': _weather!.temperature,
                    'feelsLike': _weather!.feelsLike,
                    'humidity': _weather!.humidity,
                    'windSpeed': _weather!.windSpeed,
                    'precipitation': _weather!.precipitation,
                    'uvIndex': _weather!.uvIndex,
                  },
          );

      if (mounted) {
        PateaSnack.ok(context, '¡Partido creado!');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        PateaSnack.error(context, 'Error al crear partido: $e');
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _aiStatus = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final playersAsync = ref.watch(activeGroupPlayersProvider);

    return PopScope<dynamic>(
      canPop: !_isSubmitting && _step == 1,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && !_isSubmitting && _step > 1) {
          setState(() => _step -= 1);
        }
      },
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          title: Text(
            'Armar partido',
            style: AppTypography.headline(size: 20, weight: FontWeight.w700),
          ),
          leading: _step > 1
              ? IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: _isSubmitting
                      ? null
                      : () => setState(() => _step -= 1),
                )
              : null,
        ),
        body: Column(
          children: [
            _StepIndicator(
              step: _step,
              totalSteps: _selectedType == 'collaborative' ? 2 : 3,
            ),
            Expanded(
              child: AbsorbPointer(
                absorbing: _isSubmitting,
                child: AnimatedSwitcher(
                  duration: MediaQuery.disableAnimationsOf(context)
                      ? Duration.zero
                      : const Duration(milliseconds: 160),
                  child: KeyedSubtree(
                    key: ValueKey('create-match-step-$_step'),
                    child: _buildStepBody(playersAsync),
                  ),
                ),
              ),
            ),
            _buildFooter(playersAsync.value ?? const []),
          ],
        ),
      ),
    );
  }

  Widget _buildStepBody(AsyncValue<List<PlayerModel>> playersAsync) {
    switch (_step) {
      case 1:
        return _buildStep1();
      case 2:
        return _buildStep2();
      default:
        if (_selectedType == 'by_teams') return _buildTeamPicker();
        return playersAsync.when(
          data: _buildStep3,
          loading: () => const PateaLoading(),
          error: (e, _) => PateaError(
            error: e,
            message: 'No se pudieron cargar los jugadores.',
            onRetry: () => ref.invalidate(activeGroupPlayersProvider),
          ),
        );
    }
  }

  Widget _buildFooter(List<PlayerModel> allPlayers) {
    final selectedCount = _selectedPlayerIds.length;
    final canSubmitStep3 = _selectedType == 'by_teams'
        ? _selectedTeamIds.length == 2
        : _selectedType != 'manual' || selectedCount >= (_matchSize / 2).ceil();

    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        12 + MediaQuery.paddingOf(context).bottom,
      ),
      decoration: BoxDecoration(
        color: context.c.card,
        border: Border(
          top: BorderSide(color: context.c.border.withValues(alpha: 0.3)),
        ),
      ),
      child: Row(
        children: [
          if (_step > 1)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: OutlinedButton(
                onPressed: _isSubmitting
                    ? null
                    : () => setState(() => _step -= 1),
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
                  ? Semantics(
                      label: 'Creando partido',
                      liveRegion: true,
                      child: SizedBox(
                        height: 20,
                        width: 20,
                        child: const PateaButtonProgress(),
                      ),
                    )
                  : Text(
                      _step < 3 &&
                              !(_step == 2 && _selectedType == 'collaborative')
                          ? 'Continuar'
                          : 'Crear partido',
                    ),
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
          Text(
            'Empezá por la cancha y decidí cómo van a acordar el horario.',
            style: AppTypography.body(size: 14, color: context.c.textSecondary),
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _titleController,
            onChanged: (_) => setState(() {}),
            style: AppTypography.body(color: context.c.textPrimary),
            decoration: InputDecoration(
              labelText: 'Nombre del partido',
              filled: true,
              fillColor: context.c.card,
              prefixIcon: Icon(
                Icons.sports_soccer,
                color: context.c.textSecondary,
              ),
            ),
          ),
          const SizedBox(height: 16),

          Text(
            'Cancha',
            style: AppTypography.headline(
              size: 13,
              color: context.c.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _locationController,
            onChanged: (v) {
              if (_selectedLocation != null && v != _selectedLocation!.label) {
                _selectedLocation = null;
              }
              setState(() {});
              _onLocationChanged(v);
              _scheduleWeatherFetch();
            },
            style: AppTypography.body(color: context.c.textPrimary),
            decoration: InputDecoration(
              labelText: 'Dirección de la cancha',
              hintText: 'Buscá y elegí una dirección',
              filled: true,
              fillColor: context.c.card,
              prefixIcon: Icon(
                Icons.location_on,
                color: context.c.textSecondary,
              ),
              suffixIcon: _searchingLocation
                  ? const Padding(
                      padding: EdgeInsets.all(14),
                      child: SizedBox(
                        height: 16,
                        width: 16,
                        child: PateaButtonProgress(),
                      ),
                    )
                  : (_selectedLocation != null
                        ? Icon(Icons.check_circle, color: context.c.success)
                        : null),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              _selectedLocation == null
                  ? 'Elegí una dirección de la lista para confirmar la cancha.'
                  : 'Cancha confirmada',
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
          ),
          if (_locationSuggestions.isNotEmpty)
            PateaCard(
              color: context.c.cardSurface,
              radius: AppRadii.cardAll,
              borderColor: context.c.border,
              margin: const EdgeInsets.only(top: 4),
              child: Column(
                children: _locationSuggestions
                    .map(
                      (s) => ListTile(
                        dense: true,
                        leading: Icon(
                          Icons.place_outlined,
                          size: 18,
                          color: context.c.textSecondary,
                        ),
                        title: Text(
                          s.label,
                          style: AppTypography.body(
                            color: context.c.textSecondary,
                            size: 13,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        onTap: () => _selectLocation(s),
                      ),
                    )
                    .toList(),
              ),
            ),

          const SizedBox(height: 20),
          Text(
            'Horario',
            style: AppTypography.headline(
              size: 18,
              color: context.c.textPrimary,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _scheduleOption(
                  key: const ValueKey('horario-definido'),
                  icon: Icons.event_available_outlined,
                  label: 'Ya tengo horario',
                  selected: !_isPlanning,
                  planning: false,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _scheduleOption(
                  key: const ValueKey('horario-grupo'),
                  icon: Icons.how_to_vote_outlined,
                  label: 'Consultar al grupo',
                  selected: _isPlanning,
                  planning: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            _isPlanning
                ? 'Después de crear el partido, podrán proponer y votar fechas.'
                : 'Elegí el día y la hora del partido.',
            style: AppTypography.body(size: 13, color: context.c.textSecondary),
          ),
          const SizedBox(height: 16),
          if (!_isPlanning) ...[
            _dateTimeField(
              'Fecha del partido',
              _selectedDate == null
                  ? 'Elegir fecha'
                  : '${_selectedDate!.day.toString().padLeft(2, '0')}/${_selectedDate!.month.toString().padLeft(2, '0')}/${_selectedDate!.year}',
              Icons.calendar_today_outlined,
              _pickDate,
            ),
            const SizedBox(height: 10),
            _dateTimeField(
              'Hora de inicio',
              _selectedTime == null
                  ? 'Elegir hora'
                  : '${_selectedTime!.hour.toString().padLeft(2, '0')}:${_selectedTime!.minute.toString().padLeft(2, '0')}',
              Icons.schedule_outlined,
              _pickTime,
            ),
          ],

          const SizedBox(height: 16),
          _weatherPanel(),
        ],
      ),
    );
  }

  Widget _weatherPanel() {
    final forecast = _weather;
    final message = _isPlanning
        ? 'El clima aparecerá cuando confirmes la cancha y el horario.'
        : _selectedLocation == null
        ? 'Elegí una dirección de la lista para ver el clima de la cancha.'
        : _selectedDate == null || _selectedTime == null
        ? 'Elegí fecha y hora para consultar el pronóstico.'
        : _weatherOutsideRange
        ? 'El pronóstico llega hasta los próximos 16 días. Consultalo más cerca de la fecha.'
        : _weatherError;
    return PateaCard(
      key: const ValueKey('match-weather'),
      color: context.c.cardSurface,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Clima para el partido',
            style: AppTypography.headline(size: 14),
          ),
          const SizedBox(height: 10),
          if (_loadingWeather)
            Row(
              children: [
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: PateaButtonProgress(),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Consultando el pronóstico…',
                    style: AppTypography.body(size: 13),
                  ),
                ),
              ],
            )
          else if (forecast != null) ...[
            Row(
              children: [
                Icon(
                  _weatherIcon(forecast.icon),
                  color: context.c.primary,
                  size: 28,
                ),
                const SizedBox(width: 10),
                Text(
                  '${forecast.temperature}°C',
                  style: AppTypography.sportNumber(size: 23),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    forecast.description,
                    style: AppTypography.body(size: 13),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Lluvia ${forecast.precipitation}% · Viento ${forecast.windSpeed} km/h',
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              'Para el lugar y la hora elegidos · Open-Meteo',
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
          ] else
            Text(
              message ?? 'Completá lugar, fecha y hora para ver el pronóstico.',
              style: AppTypography.body(
                size: 13,
                color: context.c.textSecondary,
              ),
            ),
          if (_weatherError != null)
            TextButton.icon(
              onPressed: _scheduleWeatherFetch,
              icon: const Icon(Icons.refresh),
              label: const Text('Reintentar clima'),
            ),
        ],
      ),
    );
  }

  Widget _scheduleOption({
    required Key key,
    required IconData icon,
    required String label,
    required bool selected,
    required bool planning,
  }) {
    final labelHeight = (MediaQuery.textScalerOf(context).scale(14) * 1.25 * 2)
        .ceilToDouble();
    return Semantics(
      key: key,
      selected: selected,
      button: true,
      child: Material(
        color: selected ? context.c.cardSurface : context.c.card,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.cardAll,
          side: BorderSide(
            color: selected ? context.c.primary : context.c.border,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () {
            setState(() => _isPlanning = planning);
            _scheduleWeatherFetch();
          },
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                Icon(
                  icon,
                  size: 22,
                  color: selected ? context.c.primary : context.c.textSecondary,
                ),
                const SizedBox(height: 6),
                SizedBox(
                  height: labelHeight,
                  child: Center(
                    child: Text(
                      label,
                      maxLines: 2,
                      textAlign: TextAlign.center,
                      style: AppTypography.action(
                        size: 14,
                        color: context.c.textPrimary,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _dateTimeField(
    String label,
    String value,
    IconData icon,
    VoidCallback onTap,
  ) {
    return Semantics(
      button: true,
      label: '$label: $value',
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.cardAll,
        child: InputDecorator(
          decoration: InputDecoration(
            labelText: label,
            filled: true,
            fillColor: context.c.card,
            prefixIcon: Icon(icon, color: context.c.textSecondary),
            suffixIcon: const Icon(Icons.expand_more),
          ),
          child: Text(
            value,
            style: AppTypography.body(size: 16, color: context.c.textPrimary),
          ),
        ),
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
          Text(
            'Formato',
            style: AppTypography.headline(
              size: 13,
              color: context.c.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _matchSizes
                .map(
                  (size) => ChoiceChip(
                    label: Text(_matchSizeLabels[size]!),
                    selected: _matchSize == size,
                    checkmarkColor: context.c.primary,
                    selectedColor: context.c.cardSurface,
                    backgroundColor: context.c.card,
                    side: BorderSide(
                      color: _matchSize == size
                          ? context.c.primary
                          : context.c.border,
                    ),
                    labelStyle: AppTypography.action(
                      size: 14,
                      color: context.c.textPrimary,
                    ),
                    onSelected: (_) => setState(() {
                      _matchSize = size;
                      _selectedPlayerIds.clear();
                    }),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 24),

          Text(
            'Cómo se arma el plantel',
            style: AppTypography.headline(
              size: 13,
              color: context.c.textSecondary,
            ),
          ),
          const SizedBox(height: 4),
          const SizedBox(height: 8),
          _TypeOption(
            icon: Icons.how_to_reg,
            label: 'Elegir jugadores',
            description:
                'Convocás el plantel y equilibramos nivel, posiciones y arqueros.',
            selected: _selectedType == 'manual',
            onTap: () => setState(() => _selectedType = 'manual'),
          ),
          const SizedBox(height: 8),
          _TypeOption(
            icon: Icons.groups,
            label: 'Inscripción abierta',
            description: 'El partido empieza vacío y cada jugador se anota.',
            selected: _selectedType == 'collaborative',
            onTap: () => setState(() => _selectedType = 'collaborative'),
          ),
          const SizedBox(height: 8),
          _TypeOption(
            icon: Icons.checkroom,
            label: 'Enfrentar dos equipos',
            description:
                'Elegís dos equipos del grupo, con sus planteles y camisetas.',
            selected: _selectedType == 'by_teams',
            onTap: () => setState(() => _selectedType = 'by_teams'),
          ),
          const SizedBox(height: 8),
          // No es un tipo más de este asistente: el partido nace cuando el otro
          // equipo acepta, así que lleva a su propia pantalla.
          _TypeOption(
            icon: Icons.handshake_outlined,
            label: 'Desafiar a otro equipo',
            description:
                'Buscá un equipo de otro grupo y mandale el desafío. Si acepta, se crea el partido.',
            selected: false,
            onTap: () => context.push('/challenge'),
          ),
          const SizedBox(height: 24),

          Text(
            'Quién puede sumarse',
            style: AppTypography.headline(
              size: 18,
              color: context.c.textPrimary,
            ),
          ),
          const SizedBox(height: 10),
          _TypeOption(
            icon: Icons.lock_outline,
            label: 'Sólo el grupo',
            description: 'Mantené la convocatoria dentro de tu grupo.',
            selected: !_isPublic,
            onTap: () => setState(() => _isPublic = false),
          ),
          const SizedBox(height: 8),
          _TypeOption(
            icon: Icons.public,
            label: 'Público',
            description:
                'También pueden sumarse jugadores de afuera del grupo.',
            selected: _isPublic,
            onTap: () => setState(() => _isPublic = true),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Paso 3: participantes
  // ---------------------------------------------------------------------
  /// Elegir los dos equipos que se enfrentan.
  Widget _buildTeamPicker() {
    final groupId = ref.watch(activeGroupIdProvider).value;

    if (groupId == null) {
      return const PateaEmpty(
        icon: Icons.groups_outlined,
        title: 'Sin grupo activo',
        hint: 'Necesitás un grupo activo para armar un partido entre equipos.',
      );
    }

    final teamsAsync = ref.watch(groupTeamsStreamProvider(groupId));

    return teamsAsync.when(
      loading: () => const PateaLoading(),
      error: (e, _) => PateaError(
        error: e,
        message: 'No se pudieron cargar los equipos.',
        onRetry: () => ref.invalidate(groupTeamsStreamProvider(groupId)),
      ),
      data: (teams) {
        if (teams.length < 2) {
          return PateaEmpty(
            icon: Icons.checkroom_outlined,
            title: teams.isEmpty ? 'Faltan equipos' : 'Falta un equipo más',
            hint: teams.isEmpty
                ? 'El grupo todavía no tiene equipos armados.'
                : 'Hace falta al menos un equipo más para armar un partido.',
          );
        }

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Elegí los dos equipos',
              style: AppTypography.headline(
                size: 13,
                color: context.c.textSecondary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Elegí dos equipos. El primero que toques es el local.',
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
            const SizedBox(height: 16),
            for (final team in teams)
              Builder(
                builder: (context) {
                  final index = _selectedTeamIds.indexOf(team.id);
                  final selected = index >= 0;
                  final full = _selectedTeamIds.length >= 2 && !selected;

                  return Opacity(
                    opacity: full ? 0.4 : 1,
                    child: InkWell(
                      onTap: full
                          ? null
                          : () => setState(() {
                              if (selected) {
                                _selectedTeamIds.remove(team.id);
                              } else {
                                _selectedTeamIds.add(team.id);
                              }
                            }),
                      borderRadius: AppRadii.cardAll,
                      child: PateaCard(
                        radius: AppRadii.cardAll,
                        borderColor: selected
                            ? context.c.primary
                            : context.c.overlayLine,
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            JerseyWidget(jersey: team.jersey, size: 44),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    team.name,
                                    style: AppTypography.headline(
                                      size: 15,
                                      weight: FontWeight.w800,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    team.members.isEmpty
                                        ? 'Sin jugadores'
                                        : '${team.members.length} jugadores',
                                    style: AppTypography.body(
                                      size: 12,
                                      color: context.c.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (selected)
                              Text(
                                index == 0 ? 'Local' : 'Visitante',
                                style: AppTypography.headline(
                                  size: 12,
                                  weight: FontWeight.w800,
                                  color: context.c.primary,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
          ],
        );
      },
    );
  }

  Widget _buildStep3(List<PlayerModel> allPlayers) {
    final filtered = allPlayers.where((p) {
      final matchesName = p.name.toLowerCase().contains(
        _playerSearch.toLowerCase(),
      );
      final matchesPosition =
          _positionFilter == 'all' || p.position == _positionFilter;
      return matchesName && matchesPosition;
    }).toList();

    final selectedPlayers = allPlayers
        .where((p) => _selectedPlayerIds.contains(p.id))
        .toList();
    final missingPositions = _positions
        .where((pos) => !selectedPlayers.any((p) => p.position == pos))
        .toList();

    final porCount = selectedPlayers.where((p) => p.position == 'POR').length;
    final defCount = selectedPlayers.where((p) => p.position == 'DEF').length;
    final medCount = selectedPlayers.where((p) => p.position == 'MED').length;
    final delCount = selectedPlayers.where((p) => p.position == 'DEL').length;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Plantel convocado',
                    style: AppTypography.code(
                      size: 12,
                      weight: FontWeight.w800,
                      color: context.c.textSecondary,
                    ),
                  ),
                  Text(
                    '${_selectedPlayerIds.length} / $_matchSize',
                    style: AppTypography.sportNumber(
                      size: 16,
                      color: _selectedPlayerIds.length == _matchSize
                          ? context.c.primary
                          : context.c.textSecondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: AppRadii.hairAll,
                child: LinearProgressIndicator(
                  value: (_selectedPlayerIds.length / _matchSize).clamp(0, 1),
                  minHeight: 6,
                  backgroundColor: context.c.cardSurface,
                  color: context.c.primary,
                ),
              ),
              const SizedBox(height: 10),

              // Balance de Posiciones Seleccionadas
              Row(
                children: [
                  _PositionCountChip(
                    label: 'POR',
                    count: porCount,
                    color: context.c.posPor,
                  ),
                  const SizedBox(width: 6),
                  _PositionCountChip(
                    label: 'DEF',
                    count: defCount,
                    color: context.c.posDef,
                  ),
                  const SizedBox(width: 6),
                  _PositionCountChip(
                    label: 'MED',
                    count: medCount,
                    color: context.c.posMed,
                  ),
                  const SizedBox(width: 6),
                  _PositionCountChip(
                    label: 'DEL',
                    count: delCount,
                    color: context.c.posDel,
                  ),
                ],
              ),

              if (_selectedPlayerIds.isNotEmpty &&
                  missingPositions.isNotEmpty) ...[
                const SizedBox(height: 8),
                PateaCard(
                  color: context.c.cardSurface,
                  radius: AppRadii.chipAll,
                  borderColor: context.c.border,
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  child: Text(
                    'Revisá los puestos: faltan arqueros o posiciones clave.',
                    style: AppTypography.body(
                      size: 12,
                      color: context.c.textSecondary,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 10),
              TextField(
                onChanged: (v) => setState(() => _playerSearch = v),
                style: AppTypography.body(
                  color: context.c.textPrimary,
                  size: 13,
                ),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: context.c.card,
                  hintText: 'Buscar jugador por nombre...',
                  prefixIcon: const Icon(Icons.search, size: 18),
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
                        onSelected: (_) =>
                            setState(() => _positionFilter = pos),
                        checkmarkColor: context.c.primary,
                        selectedColor: context.c.cardSurface,
                        backgroundColor: context.c.card,
                        side: BorderSide(
                          color: isSelected
                              ? context.c.primary
                              : context.c.border,
                        ),
                        labelStyle: AppTypography.body(
                          color: context.c.textPrimary,
                          size: 12,
                          weight: FontWeight.w600,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                alignment: WrapAlignment.spaceBetween,
                children: [
                  TextButton.icon(
                    onPressed: _selectedPlayerIds.length >= _matchSize
                        ? null
                        : () {
                            final needed =
                                _matchSize - _selectedPlayerIds.length;
                            final available =
                                allPlayers
                                    .where(
                                      (p) => !_selectedPlayerIds.contains(p.id),
                                    )
                                    .toList()
                                  ..sort((a, b) => b.ovr.compareTo(a.ovr));
                            setState(() {
                              for (final p in available.take(needed)) {
                                _selectedPlayerIds.add(p.id);
                              }
                            });
                          },
                    icon: const Icon(Icons.flash_on, size: 15),
                    label: Text(
                      'Completar con mejores',
                      style: AppTypography.action(size: 14),
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _selectedPlayerIds.isEmpty
                        ? null
                        : () => setState(() => _selectedPlayerIds.clear()),
                    icon: const Icon(Icons.clear_all, size: 15),
                    label: Text(
                      'Limpiar',
                      style: AppTypography.action(size: 14),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: filtered.isEmpty
              ? Center(
                  child: Text(
                    'No se encontraron jugadores.',
                    style: AppTypography.body(color: context.c.textSecondary),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final p = filtered[index];
                    final isSelected = _selectedPlayerIds.contains(p.id);
                    return PlayerSelectCard(
                      name: p.name,
                      photoUrl: p.photoUrl,
                      position: p.position,
                      ovr: p.ovr,
                      subtitle: p.isManual ? 'Manual' : null,
                      selected: isSelected,
                      disabled:
                          !isSelected &&
                          _selectedPlayerIds.length >= _matchSize,
                      stats: {
                        'pac': p.pac,
                        'sho': p.sho,
                        'pas': p.pas,
                        'dri': p.dri,
                        'def': p.def,
                        'phy': p.phy,
                        'ref': p.stats.saves > 0 ? 80 : p.pac,
                        'est': p.def,
                        'par': p.sho,
                      },
                      onTap: () {
                        if (!isSelected &&
                            _selectedPlayerIds.length >= _matchSize) {
                          PateaSnack.info(
                            context,
                            'Ya completaste los $_matchSize jugadores convocados.',
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
            child: Text(
              _aiStatus!,
              textAlign: TextAlign.center,
              style: AppTypography.body(size: 12, color: context.c.primary),
            ),
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
    final label = switch (step) {
      1 => 'Cancha y horario',
      2 => 'Formato y convocatoria',
      _ => 'Participantes',
    };
    return Semantics(
      label: 'Paso $step de $totalSteps: $label',
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Paso $step de $totalSteps · $label',
              style: AppTypography.body(
                size: 13,
                weight: FontWeight.w600,
                color: context.c.textSecondary,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: List.generate(
                totalSteps,
                (i) => Expanded(
                  child: Container(
                    margin: EdgeInsets.only(right: i < totalSteps - 1 ? 6 : 0),
                    height: 3,
                    decoration: BoxDecoration(
                      color: i < step ? context.c.primary : context.c.border,
                      borderRadius: AppRadii.hairAll,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TypeOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? description;
  final bool selected;
  final VoidCallback onTap;

  const _TypeOption({
    this.description,
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      child: Material(
        color: selected ? context.c.cardSurface : context.c.card,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.cardAll,
          side: BorderSide(
            color: selected ? context.c.primary : context.c.border,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 22,
                  color: selected ? context.c.primary : context.c.textSecondary,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: AppTypography.action(
                          size: 15,
                          color: context.c.textPrimary,
                        ),
                      ),
                      if (description != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          description!,
                          style: AppTypography.body(
                            size: 13,
                            color: context.c.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Icon(
                  selected
                      ? Icons.radio_button_checked
                      : Icons.radio_button_off,
                  size: 22,
                  color: selected ? context.c.primary : context.c.textSecondary,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PositionCountChip extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _PositionCountChip({
    required this.label,
    required this.count,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 4),
        decoration: BoxDecoration(
          color: context.c.cardSurface,
          borderRadius: AppRadii.surfaceAll,
          border: Border.all(color: context.c.border, width: 1),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: AppTypography.code(
                size: 12,
                weight: FontWeight.w800,
                color: color,
              ),
            ),
            Text(
              '$count',
              style: AppTypography.sportNumber(
                size: 13,
                color: count > 0
                    ? context.c.textPrimary
                    : context.c.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
