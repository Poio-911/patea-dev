import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/models/weather_advisory.dart';
import 'package:patea_mobile/core/services/match_weather_provider.dart';
import 'package:patea_mobile/core/services/weather_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/features/matches/widgets/weather_alert.dart';

WeatherForecast forecast({
  int code = 0,
  double uv = 1,
  int temperature = 23,
  int feelsLike = 24,
  int rain = 0,
  int wind = 10,
  Set<String>? fields,
}) => WeatherForecast(
  description: code == 95 ? 'Tormenta' : 'Despejado',
  icon: code == 95 ? 'Zap' : 'Sun',
  temperature: temperature,
  humidity: 60,
  windSpeed: wind,
  precipitation: rain,
  uvIndex: uv.round(),
  uvIndexExact: uv,
  feelsLike: feelsLike,
  conditions: '',
  recommendation: '',
  weatherCode: code,
  availableFields:
      fields ??
      const {
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'precipitation_probability',
        'weather_code',
        'wind_speed_10m',
        'uv_index',
      },
);

class _Weather extends WeatherService {
  final Future<WeatherForecast> Function() result;
  int calls = 0;
  _Weather(this.result);
  @override
  Future<WeatherForecast> getForecast({
    required double lat,
    required double lng,
    required DateTime dateTime,
  }) {
    calls++;
    return result();
  }
}

MatchModel match({
  int days = 1,
  String status = 'upcoming',
  String? time = '14:00',
  double lat = -34.9,
  MatchWeatherModel? saved,
}) {
  final day = DateTime.now()
      .add(Duration(days: days))
      .toIso8601String()
      .split('T')
      .first;
  return MatchModel(
    id: 'weather-review',
    title: 'Partido de prueba',
    date: day,
    time: time,
    status: status,
    type: 'manual',
    ownerUid: 'captain',
    locationDetail: MatchLocationModel(name: 'Cancha', lat: lat, lng: -56.1),
    weather: saved,
  );
}

Future<void> _mount(
  WidgetTester tester,
  MatchModel value,
  _Weather weather, {
  bool light = false,
  double scale = 1.3,
  bool animate = false,
}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [weatherServiceProvider.overrideWithValue(weather)],
      child: MaterialApp(
        theme: light ? AppTheme.lightTheme : AppTheme.darkTheme,
        debugShowCheckedModeBanner: false,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            disableAnimations: !animate,
            textScaler: TextScaler.linear(scale),
          ),
          child: RepaintBoundary(
            key: const ValueKey('weather-capture'),
            child: child!,
          ),
        ),
        home: Scaffold(
          appBar: AppBar(title: const Text('Detalle del partido')),
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: MatchWeatherAlert(match: value),
          ),
        ),
      ),
    ),
  );
  if (animate) {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
  } else {
    await tester.pumpAndSettle();
  }
}

Future<void> capture(WidgetTester tester, String name) async {
  if (!const bool.fromEnvironment('CAPTURE_MATCH_WEATHER')) return;
  final boundary = tester.renderObject<RenderRepaintBoundary>(
    find.byKey(const ValueKey('weather-capture')),
  );
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    final output = File('build/weather-review/$name.png');
    await output.parent.create(recursive: true);
    await output.writeAsBytes(bytes!.buffer.asUint8List());
    image.dispose();
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    final icons = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
    for (final weight in [
      FontWeight.w400,
      FontWeight.w600,
      FontWeight.w700,
      FontWeight.w800,
    ]) {
      AppTypography.headline(weight: weight);
      AppTypography.body(weight: weight);
      AppTypography.sportNumber(weight: weight);
    }
    await GoogleFonts.pendingFonts();
  });

  test('storm outranks simultaneous UV, heat, wind and rain', () {
    final list = weatherAdvisories(
      forecast(
        code: 95,
        uv: 9,
        temperature: 32,
        feelsLike: 34,
        rain: 80,
        wind: 40,
      ),
    );
    expect(list.first.code, 'storm');
    expect(list.map((a) => a.code).toSet(), {
      'storm',
      'uv',
      'heat',
      'wind',
      'rain',
    });
  });
  test('UV thresholds use unrounded data; rain alone is not a storm', () {
    expect(weatherAdvisories(forecast(uv: 2.9)), isEmpty);
    expect(weatherAdvisories(forecast(uv: 3)).single.title, 'Protección solar');
    expect(weatherAdvisories(forecast(uv: 7.6)).single.title, 'UV alto');
    expect(weatherAdvisories(forecast(uv: 8)).single.title, 'UV muy alto');
    expect(weatherAdvisories(forecast(uv: 11)).single.title, 'UV extremo');
    expect(weatherAdvisories(forecast(rain: 100)).single.code, 'rain');
  });
  test('unknown fields do not create risk assessments', () {
    expect(
      weatherAdvisories(
        forecast(
          uv: 9,
          rain: 80,
          wind: 50,
          feelsLike: 40,
          fields: {'temperature_2m'},
        ),
      ),
      isEmpty,
    );
  });
  test('service preserves missing fields and raw UV', () async {
    await http.runWithClient(
      () async {
        final result = await WeatherService().getForecast(
          lat: -34.9,
          lng: -56.1,
          dateTime: DateTime(2026, 11, 18, 14),
        );
        expect(result.uvIndexExact, 7.6);
        expect(result.hasData('wind_speed_10m'), isFalse);
        expect(result.description, 'Condición no informada');
      },
      () => MockClient(
        (request) async => http.Response(
          jsonEncode({
            'hourly': {
              'time': List.filled(24, '2026-11-18T14:00'),
              'temperature_2m': List.filled(24, 23),
              'uv_index': List.filled(24, 7.6),
            },
          }),
          200,
        ),
      ),
    );
  });
  test(
    'service rejects missing temperature instead of fabricating 20 degrees',
    () async {
      await http.runWithClient(
        () async {
          await expectLater(
            WeatherService().getForecast(
              lat: -34.9,
              lng: -56.1,
              dateTime: DateTime(2026, 11, 18, 14),
            ),
            throwsException,
          );
        },
        () => MockClient(
          (request) async => http.Response(
            jsonEncode({
              'hourly': {'time': List.filled(24, '2026-11-18T14:00')},
            }),
            200,
          ),
        ),
      );
    },
  );
  test(
    'provider reuses a query, but a changed venue requests its own forecast',
    () async {
      final weather = _Weather(() async => forecast());
      final container = ProviderContainer(
        overrides: [weatherServiceProvider.overrideWithValue(weather)],
      );
      addTearDown(container.dispose);
      final query = (
        lat: -34.9,
        lng: -56.1,
        kickoff: DateTime(2026, 11, 18, 14),
      );
      await container.read(matchWeatherProvider(query).future);
      await container.read(matchWeatherProvider(query).future);
      expect(weather.calls, 1);
      await container.read(
        matchWeatherProvider((
          lat: -34.8,
          lng: query.lng,
          kickoff: query.kickoff,
        )).future,
      );
      expect(weather.calls, 2);
    },
  );

  testWidgets('weather motion pauses in background and resumes with the app', (
    tester,
  ) async {
    await _mount(
      tester,
      match(),
      _Weather(() async => forecast()),
      animate: true,
    );
    final rotation = find
        .ancestor(
          of: find.byIcon(Icons.wb_sunny_outlined),
          matching: find.byType(Transform),
        )
        .first;
    Matrix4 matrix() => tester.widget<Transform>(rotation).transform.clone();
    final first = matrix();
    await tester.pump(const Duration(seconds: 2));
    expect(matrix(), isNot(first));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    final paused = matrix();
    await tester.pump(const Duration(seconds: 2));
    expect(matrix(), paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    expect(matrix(), isNot(paused));
    await tester.pumpWidget(const SizedBox.shrink());
  });
  for (final light in [false, true]) {
    testWidgets(
      'detail renders combined risks without overflow, light=$light',
      (tester) async {
        await _mount(
          tester,
          match(),
          _Weather(
            () async => forecast(
              code: 95,
              uv: 9,
              temperature: 32,
              feelsLike: 34,
              rain: 80,
            ),
          ),
          light: light,
        );
        expect(find.text('Clima para jugar'), findsOneWidget);
        expect(find.text('Tormenta prevista'), findsOneWidget);
        expect(find.textContaining('También:'), findsOneWidget);
        await capture(tester, light ? 'storm-light' : 'storm-game');
        await tester.tap(find.textContaining('También:'));
        await tester.pumpAndSettle();
        expect(find.text('UV muy alto'), findsOneWidget);
        expect(find.text('Calor para tener en cuenta'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
    testWidgets('sunlight panel stays readable at text 2x, light=$light', (
      tester,
    ) async {
      await _mount(
        tester,
        match(),
        _Weather(() async => forecast(uv: 8)),
        light: light,
        scale: 2,
      );
      expect(find.text('UV muy alto'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
    testWidgets('missing metrics are shown as missing, light=$light', (
      tester,
    ) async {
      await _mount(
        tester,
        match(),
        _Weather(() async => forecast(fields: {'temperature_2m'})),
        light: light,
      );
      expect(find.text('Sin dato'), findsNWidgets(3));
      expect(find.text('Protección solar'), findsNothing);
    });
    testWidgets('error offers an effective retry, light=$light', (
      tester,
    ) async {
      var attempts = 0;
      final service = _Weather(() async {
        if (++attempts == 1) throw Exception('offline');
        return forecast();
      });
      await _mount(tester, match(), service, light: light);
      await tester.tap(find.text('Reintentar clima'));
      await tester.pumpAndSettle();
      expect(find.text('Clima para jugar'), findsOneWidget);
      expect(service.calls, 2);
    });
  }
  testWidgets(
    'unscheduled, distant and historical matches never query current weather',
    (tester) async {
      final service = _Weather(() async => forecast());
      await _mount(tester, match(time: null), service);
      expect(find.text('Falta confirmar el horario'), findsOneWidget);
      await _mount(tester, match(days: 30), service);
      expect(find.text('El clima se define más cerca'), findsOneWidget);
      await _mount(
        tester,
        match(
          status: 'completed',
          saved: MatchWeatherModel(temperature: 20, description: 'Nublado'),
        ),
        service,
      );
      expect(find.text('Clima registrado'), findsOneWidget);
      expect(find.text('Tormenta prevista'), findsNothing);
      expect(service.calls, 0);
    },
  );
}
