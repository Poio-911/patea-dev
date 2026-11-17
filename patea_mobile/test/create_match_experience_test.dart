import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:patea_mobile/core/models/player_model.dart';
import 'package:patea_mobile/core/models/group_model.dart';
import 'package:patea_mobile/core/services/auth_service.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/services/match_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/core/widgets/player_select_card.dart';
import 'package:patea_mobile/features/matches/create_match_screen.dart';

class _User extends Fake implements User {
  @override
  String get uid => 'captain';
}

class _Auth extends Fake implements AuthService {
  @override
  User get currentUser => _User();
}

class _Matches extends Fake implements MatchService {
  final calls = <Invocation>[];
  final pending = Completer<String>();
  @override
  dynamic noSuchMethod(Invocation invocation) {
    if (invocation.memberName == #createMatch) {
      calls.add(invocation);
      return pending.future;
    }
    return super.noSuchMethod(invocation);
  }
}

final _players = List.generate(
  6,
  (i) => PlayerModel(
    id: 'player-$i',
    name: 'Jugador $i',
    position: 'MED',
    ovr: 70 + i,
    pac: 60,
    sho: 65,
    pas: 70,
    dri: 75,
    def: 55,
    phy: 80,
  ),
);

Future<void> _mount(WidgetTester tester, bool light, _Matches matches) async {
  tester.view.physicalSize = const Size(1080, 2700);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        activeGroupIdProvider.overrideWithValue(const AsyncData('group')),
        groupTeamsStreamProvider('group').overrideWith(
          (ref) => Stream.value([
            for (var i = 0; i < 3; i++)
              GroupTeamModel(
                id: 'team-$i',
                name: 'Equipo $i',
                groupId: 'group',
                jersey: JerseyModel(),
              ),
          ]),
        ),
        activeGroupPlayersProvider.overrideWith(
          (ref) => Stream.value(_players),
        ),
        authServiceProvider.overrideWithValue(_Auth()),
        matchServiceProvider.overrideWithValue(matches),
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en'), Locale('es', 'UY')],
        theme: light ? AppTheme.lightTheme : AppTheme.darkTheme,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: const TextScaler.linear(1.3),
            disableAnimations: true,
            alwaysUse24HourFormat: false,
          ),
          child: RepaintBoundary(
            key: const ValueKey('experience-capture'),
            child: child!,
          ),
        ),
        home: const CreateMatchScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> _capture(
  WidgetTester tester,
  int step,
  bool light, {
  String suffix = '',
}) async {
  if (!const bool.fromEnvironment('CAPTURE_CREATE_EXPERIENCE')) return;
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pumpAndSettle();
  final boundary = tester.renderObject<RenderRepaintBoundary>(
    find.byKey(const ValueKey('experience-capture')),
  );
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    final target = File(
      'build/typography-review/create-step-$step-${light ? 'light' : 'dark'}$suffix.png',
    );
    await target.parent.create(recursive: true);
    await target.writeAsBytes(bytes!.buffer.asUint8List());
    image.dispose();
  });
}

Future<void> _location(WidgetTester tester) async {
  await tester.enterText(find.byType(TextField).at(1), 'Cancha');
  await tester.pump(const Duration(milliseconds: 350));
  await tester.pumpAndSettle();
  await _tap(tester, find.text('Cancha de prueba'));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final icons = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
    GoogleFonts.config.allowRuntimeFetching = false;
    AppTheme.lightTheme;
    AppTheme.darkTheme;
    for (final weight in [
      FontWeight.w400,
      FontWeight.w500,
      FontWeight.w600,
      FontWeight.w700,
      FontWeight.w800,
    ]) {
      AppTypography.headline(weight: weight);
      AppTypography.body(weight: weight);
      AppTypography.code(weight: weight);
    }
    await GoogleFonts.pendingFonts();
    for (var i = 1; i <= 4; i++) {
      final ready = Completer<void>();
      AssetImage('assets/avatars/player$i.png')
          .resolve(ImageConfiguration.empty)
          .addListener(
            ImageStreamListener(
              (_, _) {
                if (!ready.isCompleted) ready.complete();
              },
              onError: (_, _) {
                if (!ready.isCompleted) ready.complete();
              },
            ),
          );
      await ready.future;
    }
  });
  for (final light in [false, true]) {
    testWidgets(
      'weather stays visible and retries a failed forecast, light=$light',
      (tester) async {
        var weatherCalls = 0;
        await http.runWithClient(
          () async {
            await _mount(tester, light, _Matches());
            expect(find.text('Clima para el partido'), findsOneWidget);
            await _location(tester);
            await tester.pump(const Duration(seconds: 1));
            await tester.pumpAndSettle();
            await _tap(tester, find.text('Reintentar clima'));
            await tester.pump(const Duration(seconds: 1));
            await tester.pumpAndSettle();
            expect(find.text('23°C'), findsOneWidget);
            expect(find.text('Lluvia 30% · Viento 12 km/h'), findsOneWidget);
            await tester.enterText(
              find.byType(TextField).at(1),
              'Otra dirección',
            );
            await tester.pump();
            expect(find.text('23°C'), findsNothing);
            expect(
              find.text(
                'Elegí una dirección de la lista para ver el clima de la cancha.',
              ),
              findsOneWidget,
            );
            await tester.pumpWidget(const SizedBox.shrink());
          },
          () => MockClient((request) async {
            if (request.url.host.contains('nominatim')) {
              return http.Response(
                '[{"display_name":"Cancha de prueba","lat":"-34.8","lon":"-56.1","osm_type":"way","osm_id":1}]',
                200,
              );
            }
            weatherCalls++;
            if (weatherCalls == 1) return http.Response('{}', 503);
            return http.Response(
              jsonEncode({
                'hourly': {
                  'time': List.filled(
                    24,
                    '${request.url.queryParameters['start_date']}T21:00',
                  ),
                  'temperature_2m': List.filled(24, 23),
                  'precipitation_probability': List.filled(24, 30),
                  'wind_speed_10m': List.filled(24, 12),
                },
              }),
              200,
            );
          }),
        );
      },
    );
    testWidgets('late forecast cannot replace a cleared location, light=$light', (
      tester,
    ) async {
      final pendingWeather = Completer<http.Response>();
      await http.runWithClient(
        () async {
          await _mount(tester, light, _Matches());
          await _location(tester);
          await tester.pump(const Duration(seconds: 1));
          await tester.enterText(
            find.byType(TextField).at(1),
            'Otra dirección',
          );
          pendingWeather.complete(
            http.Response(
              jsonEncode({
                'hourly': {
                  'time': List.filled(
                    24,
                    '${DateTime.now().add(const Duration(days: 1)).toIso8601String().split('T').first}T21:00',
                  ),
                  'temperature_2m': List.filled(24, 29),
                },
              }),
              200,
            ),
          );
          await tester.pump();
          expect(find.text('29°C'), findsNothing);
          expect(
            find.text(
              'Elegí una dirección de la lista para ver el clima de la cancha.',
            ),
            findsOneWidget,
          );
          await tester.pumpWidget(const SizedBox.shrink());
        },
        () => MockClient((request) async {
          if (request.url.host.contains('nominatim')) {
            return http.Response(
              '[{"display_name":"Cancha de prueba","lat":"-34.8","lon":"-56.1","osm_type":"way","osm_id":1}]',
              200,
            );
          }
          return pendingWeather.future;
        }),
      );
    });
    testWidgets(
      'teams require two different choices and preserve home order, light=$light',
      (tester) async {
        await http.runWithClient(
          () async {
            final matches = _Matches();
            await _mount(tester, light, matches);
            await _tap(tester, find.byKey(const ValueKey('horario-grupo')));
            await _location(tester);
            await _tap(tester, find.text('Continuar'));
            await _tap(tester, find.text('Enfrentar dos equipos'));
            await _tap(tester, find.text('Continuar'));
            final submit = find.byType(ElevatedButton);
            expect(tester.widget<ElevatedButton>(submit).onPressed, isNull);
            await _tap(tester, find.text('Equipo 1'));
            expect(tester.widget<ElevatedButton>(submit).onPressed, isNull);
            await _tap(tester, find.text('Equipo 0'));
            expect(tester.widget<ElevatedButton>(submit).onPressed, isNotNull);
            // A third selection cannot replace the two already chosen teams.
            await _tap(tester, find.text('Equipo 2'));
            await tester.tap(find.text('Crear partido'));
            await tester.pump();
            expect(matches.calls, hasLength(1));
            expect(matches.calls.single.namedArguments[#selectedTeams], [
              'team-1',
              'team-0',
            ]);
            expect(matches.calls.single.namedArguments[#type], 'by_teams');
            expect(tester.takeException(), isNull);
            await tester.pumpWidget(const SizedBox.shrink());
          },
          () => MockClient(
            (request) async => http.Response(
              '[{"display_name":"Cancha de prueba","lat":"-34.8","lon":"-56.1","osm_type":"way","osm_id":1}]',
              200,
            ),
          ),
        );
      },
    );
    testWidgets(
      'schedule choices preserve date and roster without creating, light=$light',
      (tester) async {
        await http.runWithClient(
          () async {
            final matches = _Matches();
            await _mount(tester, light, matches);
            expect(find.text('21:00'), findsOneWidget);
            final tomorrow = DateTime.now().add(const Duration(days: 1));
            final date =
                '${tomorrow.day.toString().padLeft(2, '0')}/${tomorrow.month.toString().padLeft(2, '0')}/${tomorrow.year}';
            expect(find.text(date), findsOneWidget);
            await _capture(tester, 1, light);
            await tester.ensureVisible(find.text('21:00'));
            await _capture(tester, 1, light, suffix: '-schedule');
            await _tap(tester, find.text('21:00'));
            expect(find.byType(TimePickerDialog), findsOneWidget);
            final pickerContext = tester.element(find.byType(TimePickerDialog));
            expect(MediaQuery.alwaysUse24HourFormatOf(pickerContext), isTrue);
            await _tap(tester, find.text('Cancel'));
            expect(find.text('21:00'), findsOneWidget);
            await _tap(tester, find.text(date));
            expect(find.byType(DatePickerDialog), findsOneWidget);
            expect(
              Localizations.localeOf(
                tester.element(find.byType(DatePickerDialog)),
              ).languageCode,
              'es',
            );
            expect(tester.takeException(), isNull);
            await _tap(tester, find.text('Cancelar'));
            expect(find.text(date), findsOneWidget);
            await _location(tester);
            await _tap(tester, find.text('Continuar'));
            expect(matches.calls, isEmpty);
            await _capture(tester, 2, light);
            await _tap(tester, find.text('Continuar'));
            await _capture(tester, 3, light);
            await _tap(tester, find.text('Jugador 0'));
            await _tap(tester, find.text('Atrás'));
            await _tap(tester, find.text('Atrás'));
            await _tap(tester, find.byKey(const ValueKey('horario-grupo')));
            await _tap(tester, find.byKey(const ValueKey('horario-definido')));
            expect(find.text(date), findsOneWidget);
            expect(find.text('21:00'), findsOneWidget);
            await _tap(tester, find.text('Continuar'));
            await _tap(tester, find.text('Continuar'));
            expect(
              tester
                  .widgetList<PlayerSelectCard>(find.byType(PlayerSelectCard))
                  .singleWhere((card) => card.name == 'Jugador 0')
                  .selected,
              isTrue,
            );
            expect(matches.calls, isEmpty);
            expect(tester.takeException(), isNull);
            await tester.pumpWidget(const SizedBox.shrink());
          },
          () => MockClient(
            (request) async => request.url.host.contains('nominatim')
                ? http.Response(
                    '[{"display_name":"Cancha de prueba","lat":"-34.8","lon":"-56.1","osm_type":"way","osm_id":1}]',
                    200,
                  )
                : http.Response('{}', 503),
          ),
        );
      },
    );
    testWidgets(
      'planning sends empty schedule once and locks while busy, light=$light',
      (tester) async {
        await http.runWithClient(
          () async {
            final matches = _Matches();
            await _mount(tester, light, matches);
            await _tap(tester, find.byKey(const ValueKey('horario-grupo')));
            await _location(tester);
            expect(matches.calls, isEmpty);
            await _tap(tester, find.text('Continuar'));
            await _tap(tester, find.text('Inscripción abierta'));
            expect(matches.calls, isEmpty);
            await tester.tap(find.text('Crear partido'));
            await tester.pump();
            expect(matches.calls, hasLength(1));
            final args = matches.calls.single.namedArguments;
            expect(args[#date], '');
            expect(args[#time], '');
            expect(args[#type], 'collaborative');
            expect(args[#locationName], 'Cancha de prueba');
            expect(args[#requestId], isNotEmpty);
            expect(
              tester
                  .widget<ElevatedButton>(find.byType(ElevatedButton))
                  .onPressed,
              isNull,
            );
            expect(
              tester.widget<PopScope>(find.byType(PopScope)).canPop,
              isFalse,
            );
            expect(
              tester
                  .widget<AbsorbPointer>(find.byType(AbsorbPointer).last)
                  .absorbing,
              isTrue,
            );
            expect(tester.takeException(), isNull);
            await tester.pumpWidget(const SizedBox.shrink());
          },
          () => MockClient(
            (request) async => http.Response(
              '[{"display_name":"Cancha de prueba","lat":"-34.8","lon":"-56.1","osm_type":"way","osm_id":1}]',
              200,
            ),
          ),
        );
      },
    );
  }
}
