import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/match_model.dart';
import '../../../core/models/weather_advisory.dart';
import '../../../core/services/match_weather_provider.dart';
import '../../../core/theme/patea_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/patea_card.dart';

/// Venue + kickoff forecast. Saved historical weather is never a current alert.
class MatchWeatherAlert extends ConsumerStatefulWidget {
  final MatchModel match;
  final bool compact;
  final bool onPhoto;
  const MatchWeatherAlert({
    super.key,
    required this.match,
    this.compact = false,
    this.onPhoto = false,
  });

  @override
  ConsumerState<MatchWeatherAlert> createState() => _MatchWeatherAlertState();
}

class _MatchWeatherAlertState extends ConsumerState<MatchWeatherAlert>
    with WidgetsBindingObserver {
  MatchWeatherQuery? _query;
  bool _visible = false;
  bool _sheetOpen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final visible = TickerMode.valuesOf(context).enabled;
    if (visible && !_visible) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _query == null) return;
        final snapshot = ref.read(matchWeatherProvider(_query!)).asData?.value;
        if (snapshot != null &&
            DateTime.now().difference(snapshot.updatedAt) >=
                const Duration(minutes: 15)) {
          ref.invalidate(matchWeatherProvider(_query!));
        }
      });
    }
    _visible = visible;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_sheetOpen) return;
    final query = _query;
    if (state != AppLifecycleState.resumed || query == null) return;
    final snapshot = ref.read(matchWeatherProvider(query)).asData?.value;
    if (snapshot == null ||
        DateTime.now().difference(snapshot.updatedAt) >=
            const Duration(minutes: 15)) {
      ref.invalidate(matchWeatherProvider(query));
    }
  }

  @override
  Widget build(BuildContext context) {
    final match = widget.match;
    _query = null;
    final finished = {
      'completed',
      'evaluated',
      'cancelled',
    }.contains(match.status);
    if (finished) {
      final saved = match.weather;
      if (saved == null) return const SizedBox.shrink();
      if (widget.compact) {
        return _compactLine(
          context,
          '${saved.temperature}° · Clima registrado',
        );
      }
      return _surface(
        context,
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Clima registrado', style: AppTypography.headline(size: 15)),
            const SizedBox(height: 8),
            Text(
              '${saved.temperature}°C · ${saved.description ?? 'Pronóstico guardado'}',
              style: AppTypography.body(size: 14),
            ),
            const SizedBox(height: 6),
            Text(
              'Guardado con el partido. No es una consulta actual.',
              style: AppTypography.body(
                size: 12,
                color: context.c.textSecondary,
              ),
            ),
          ],
        ),
      );
    }
    final date = DateTime.tryParse(match.date);
    final parts = match.time?.split(':');
    final hour = parts == null ? null : int.tryParse(parts.first);
    final minute = parts == null || parts.length < 2
        ? null
        : int.tryParse(parts[1]);
    if (date == null ||
        hour == null ||
        minute == null ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59) {
      return _message(
        context,
        'Falta confirmar el horario',
        'El pronóstico aparecerá cuando el partido tenga fecha y hora.',
      );
    }
    final location = match.locationDetail;
    if (location == null ||
        (location.lat == 0 && location.lng == 0) ||
        !location.lat.isFinite ||
        !location.lng.isFinite ||
        location.lat.abs() > 90 ||
        location.lng.abs() > 180) {
      return _message(
        context,
        'Falta ubicar la cancha',
        'Confirmá una dirección con ubicación para consultar el clima del lugar.',
      );
    }
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(date.year, date.month, date.day);
    if (day.isBefore(today)) {
      return _message(
        context,
        'La fecha del partido ya pasó',
        'Actualizá la fecha si el encuentro fue reprogramado. No mostramos un pronóstico actual para un día pasado.',
      );
    }
    if (day.isAfter(DateTime(today.year, today.month, today.day + 15))) {
      return _message(
        context,
        'El clima se define más cerca',
        'El pronóstico alcanza los próximos 16 días. Volvé a consultar cuando se acerque la fecha.',
      );
    }
    final query = (
      lat: location.lat,
      lng: location.lng,
      kickoff: DateTime(date.year, date.month, date.day, hour, minute),
    );
    _query = query;
    final weather = ref.watch(matchWeatherProvider(query));
    return weather.when(
      skipLoadingOnRefresh: false,
      loading: () => _message(
        context,
        'Consultando el pronóstico',
        'Para la cancha y la hora del partido.',
        loading: true,
      ),
      error: (_, _) => _message(
        context,
        'No pudimos consultar el clima',
        'Revisá la conexión y volvé a intentar.',
        retry: () => ref.invalidate(matchWeatherProvider(query)),
      ),
      data: (snapshot) => _forecast(context, snapshot, query),
    );
  }

  Future<void> _openSheet() async {
    if (_sheetOpen) return;
    _sheetOpen = true;
    try {
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        showDragHandle: true,
        backgroundColor: context.c.background,
        builder: (sheetContext) => ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(sheetContext).height * .85,
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            child: MatchWeatherAlert(match: widget.match),
          ),
        ),
      );
    } finally {
      _sheetOpen = false;
    }
  }

  Widget _compactLine(
    BuildContext context,
    String text, {
    String? kind,
    bool loading = false,
    WeatherAdvisory? warning,
  }) {
    final ink = widget.onPhoto
        ? const Color(0xFFF4F7F6)
        : context.c.textPrimary;
    final muted = widget.onPhoto
        ? const Color(0xFFC3CDCA)
        : context.c.textSecondary;
    // Light theme still uses photographic ink over the shared dark cover.
    final caution = widget.onPhoto
        ? const Color(0xFFFFD56A)
        : Theme.of(context).brightness == Brightness.light
        ? context.c.textPrimary
        : context.c.warning;
    return Semantics(
      button: true,
      label: 'Ver detalle del clima',
      child: InkWell(
        key: const ValueKey('match-weather-inline'),
        onTap: _openSheet,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 32),
                child: Row(
                  children: [
                    if (loading)
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 1.5,
                          color: muted,
                        ),
                      )
                    else if (kind != null)
                      SizedBox(
                        width: 22,
                        height: 26,
                        child: FittedBox(child: _WeatherMotion(kind: kind)),
                      )
                    else
                      Icon(Icons.cloud_outlined, size: 16, color: muted),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        text,
                        style: AppTypography.body(
                          size: 12,
                          color: kind != null ? ink : muted,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Icon(Icons.expand_more_rounded, size: 17, color: muted),
                  ],
                ),
              ),
              if (warning != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4, bottom: 2),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        warning.level == WeatherAdvisoryLevel.danger
                            ? Icons.thunderstorm_outlined
                            : Icons.warning_amber_rounded,
                        size: 16,
                        color: caution,
                      ),
                      const SizedBox(width: 7),
                      Expanded(
                        child: Text(
                          '${warning.title} · Ver aviso',
                          style: AppTypography.body(
                            size: 12,
                            weight: FontWeight.w600,
                            color: caution,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _surface(BuildContext context, Widget child) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: PateaCard(
      key: const ValueKey('detail-weather'),
      color: context.c.card,
      padding: const EdgeInsets.all(16),
      child: child,
    ),
  );

  Widget _message(
    BuildContext context,
    String title,
    String body, {
    bool loading = false,
    VoidCallback? retry,
  }) {
    if (widget.compact) {
      final text = switch (title) {
        'Falta confirmar el horario' => 'Clima al confirmar horario',
        'Falta ubicar la cancha' => 'Clima al confirmar cancha',
        'El clima se define más cerca' =>
          'Clima disponible más cerca de la fecha',
        'No pudimos consultar el clima' => 'Clima no disponible · Ver detalle',
        'La fecha del partido ya pasó' => 'Clima · Revisar fecha del partido',
        _ => title,
      };
      return _compactLine(context, text, loading: loading);
    }
    return _surface(
      context,
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (loading)
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                Icon(
                  Icons.cloud_outlined,
                  size: 22,
                  color: context.c.textSecondary,
                ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(title, style: AppTypography.headline(size: 15)),
              ),
            ],
          ),
          const SizedBox(height: 9),
          Text(
            body,
            style: AppTypography.body(size: 13, color: context.c.textSecondary),
          ),
          if (retry != null)
            TextButton.icon(
              onPressed: retry,
              icon: const Icon(Icons.refresh),
              label: const Text('Reintentar clima'),
            ),
        ],
      ),
    );
  }

  Widget _forecast(
    BuildContext context,
    MatchWeatherSnapshot snapshot,
    MatchWeatherQuery query,
  ) {
    final weather = snapshot.forecast;
    final advisories = weatherAdvisories(weather);
    if (widget.compact) {
      final rain = weather.hasData('precipitation_probability')
          ? '${weather.precipitation}%'
          : 'sin dato';
      final wind = weather.hasData('wind_speed_10m')
          ? '${weather.windSpeed} km/h'
          : 'sin dato';
      return _compactLine(
        context,
        '${weather.temperature}° · Lluvia $rain · Viento $wind',
        kind: weather.icon,
        warning: advisories
            .where((a) => a.level != WeatherAdvisoryLevel.information)
            .firstOrNull,
      );
    }
    final time =
        '${query.kickoff.hour.toString().padLeft(2, '0')}:${query.kickoff.minute.toString().padLeft(2, '0')}';
    final updated =
        '${snapshot.updatedAt.hour.toString().padLeft(2, '0')}:${snapshot.updatedAt.minute.toString().padLeft(2, '0')}';
    String value(String field, String text) =>
        weather.hasData(field) ? text : 'Sin dato';
    return _surface(
      context,
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Clima para jugar',
                      style: AppTypography.headline(size: 17),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Para el inicio · $time hs',
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Actualizar clima',
                icon: const Icon(Icons.refresh_rounded),
                onPressed: () => ref.invalidate(matchWeatherProvider(query)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _WeatherMotion(kind: weather.icon),
              const SizedBox(width: 15),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${weather.temperature}°',
                      style: AppTypography.sportNumber(size: 34),
                    ),
                    Text(
                      weather.description,
                      style: AppTypography.body(size: 14),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      weather.hasData('apparent_temperature')
                          ? 'Sensación de ${weather.feelsLike}°C'
                          : 'Sensación térmica sin dato',
                      style: AppTypography.body(
                        size: 12,
                        color: context.c.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 26,
            runSpacing: 12,
            children: [
              _metric(
                context,
                'Lluvia',
                value('precipitation_probability', '${weather.precipitation}%'),
              ),
              _metric(
                context,
                'Viento',
                value('wind_speed_10m', '${weather.windSpeed} km/h'),
              ),
              _metric(
                context,
                'Índice UV',
                value(
                  'uv_index',
                  (weather.uvIndexExact ?? weather.uvIndex.toDouble())
                      .toStringAsFixed(1),
                ),
              ),
            ],
          ),
          if (advisories.isNotEmpty) ...[
            const SizedBox(height: 16),
            Divider(color: context.c.overlayLine, height: 1),
            const SizedBox(height: 14),
            _advisory(context, advisories.first),
            if (advisories.length > 1)
              Theme(
                data: Theme.of(
                  context,
                ).copyWith(dividerColor: Colors.transparent),
                child: ExpansionTile(
                  key: ValueKey(
                    'weather-advisories-${advisories.map((a) => a.code).join('-')}',
                  ),
                  tilePadding: EdgeInsets.zero,
                  childrenPadding: EdgeInsets.zero,
                  title: Text(
                    'También: ${advisories.skip(1).map((a) => a.title).join(' · ')}',
                    style: AppTypography.body(
                      size: 12,
                      weight: FontWeight.w600,
                    ),
                  ),
                  children: [
                    for (final advisory in advisories.skip(1))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: _advisory(context, advisory),
                      ),
                  ],
                ),
              ),
            const SizedBox(height: 8),
            Text(
              'Riesgos previstos. No reemplazan los avisos meteorológicos oficiales.',
              style: AppTypography.body(
                size: 11,
                color: context.c.textSecondary,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Text(
            'Open-Meteo · Actualizado $updated',
            style: AppTypography.body(size: 11, color: context.c.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _metric(BuildContext context, String title, String value) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [
      Text(
        title,
        style: AppTypography.body(size: 11, color: context.c.textSecondary),
      ),
      const SizedBox(height: 3),
      Text(value, style: AppTypography.body(size: 15, weight: FontWeight.w600)),
    ],
  );

  Widget _advisory(BuildContext context, WeatherAdvisory advisory) {
    final color = switch (advisory.level) {
      WeatherAdvisoryLevel.danger => context.c.destructive,
      WeatherAdvisoryLevel.caution => context.c.warning,
      WeatherAdvisoryLevel.information => context.c.info,
    };
    final icon = switch (advisory.code) {
      'storm' => Icons.thunderstorm_outlined,
      'uv' || 'heat' => Icons.wb_sunny_outlined,
      'wind' => Icons.air_rounded,
      _ => Icons.water_drop_outlined,
    };
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Icon(icon, size: 20, color: color),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                advisory.title,
                style: AppTypography.body(
                  size: 14,
                  weight: FontWeight.w700,
                  color: Theme.of(context).brightness == Brightness.light
                      ? context.c.textPrimary
                      : color,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                advisory.message,
                style: AppTypography.body(
                  size: 13,
                  color: context.c.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Confined motion: no glow or lightning flashes. TickerMode + lifecycle
/// stop ticking when this route is inactive or the app is in the background.
class _WeatherMotion extends StatefulWidget {
  final String kind;
  const _WeatherMotion({required this.kind});
  @override
  State<_WeatherMotion> createState() => _WeatherMotionState();
}

class _WeatherMotionState extends State<_WeatherMotion>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 16),
  );
  bool _foreground = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  void _sync() {
    final animate =
        _foreground &&
        TickerMode.valuesOf(context).enabled &&
        !MediaQuery.disableAnimationsOf(context);
    if (animate && !_controller.isAnimating) {
      _controller.repeat();
    } else if (!animate) {
      _controller.stop();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    _sync();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sunny = widget.kind == 'Sun';
    final rainy = {'CloudRain', 'CloudSnow'}.contains(widget.kind);
    return SizedBox(
      width: 56,
      height: 64,
      child: ExcludeSemantics(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            final phase = _controller.value * math.pi * 2;
            if (sunny) {
              return Transform.rotate(
                angle: phase,
                child: Icon(
                  Icons.wb_sunny_outlined,
                  size: 48,
                  color: context.c.warning,
                ),
              );
            }
            return Transform.translate(
              offset: Offset(math.sin(phase) * 2, 0),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Positioned(
                    top: 8,
                    child: Icon(
                      Icons.cloud_outlined,
                      size: 46,
                      color: context.c.info,
                    ),
                  ),
                  if (rainy)
                    Positioned(
                      top: 37 + math.sin(phase * 4) * 2,
                      child: Icon(
                        widget.kind == 'CloudSnow'
                            ? Icons.ac_unit
                            : Icons.grain,
                        size: 24,
                        color: context.c.info,
                      ),
                    ),
                  if (widget.kind == 'Zap')
                    Positioned(
                      top: 35,
                      child: Icon(
                        Icons.bolt,
                        size: 25,
                        color: context.c.warning,
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
