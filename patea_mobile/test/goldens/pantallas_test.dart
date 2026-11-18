/// Los goldens **por pantalla**, en los dos temas — el último punto abierto
/// del plan de estilos.
///
/// Cada pantalla se dibuja tres veces:
///
///  1. tema `game` a 1× → imagen,
///  2. tema `claro` a 1× → imagen,
///  3. los dos temas a **1,3× de escala de texto** → sin imagen, sólo la
///     comprobación de que no desborda.
///
/// La tercera no guarda golden a propósito. Duplicar las imágenes por escala
/// no agrega información: lo que interesa a 1,3× no es cómo queda sino **si
/// entra**, y un desborde de layout llega al test como excepción. Así son 26
/// imágenes en vez de 52, y la pasada de 1,3× cuesta casi nada.
///
/// Eso es lo que encuentra los `height:` fijos: un `SizedBox(height: 44)` con
/// una línea de texto adentro entra a 1× y revienta a 1,3×.
///
/// **Lo que estos goldens NO ven.** Los íconos de Material salen como
/// cuadraditos —su fuente no se carga en un test de widgets— y las fotos de
/// red no cargan, por eso el arnés usa jugadores sin foto. Ninguna de las dos
/// cosas cambia entre corridas, así que no producen falsos positivos.
///
/// Para regenerar después de un cambio a propósito:
/// `flutter test --update-goldens test/goldens`
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
library;

import 'package:patea_mobile/features/competitions/competition_hub_screen.dart';

import 'package:patea_mobile/features/competitions/competition_management.dart';
import 'package:patea_mobile/features/players/edit_profile_screen.dart';

import 'package:patea_mobile/features/groups/create_team_screen.dart';
import 'package:patea_mobile/features/groups/widgets/manage_roster_sheet.dart';

import 'package:patea_mobile/features/players/widgets/player_match_debrief.dart';

import 'package:patea_mobile/features/evaluations/evaluation_form_screen.dart';
import 'package:patea_mobile/core/widgets/patea_user_menu_sheet.dart';

import 'package:patea_mobile/features/dashboard/widgets/dashboard_match_hero.dart';

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show AssetManifest, rootBundle;
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/features/competitions/competitions_screen.dart';
import 'package:patea_mobile/features/dashboard/dashboard_screen.dart';
import 'package:patea_mobile/features/evaluations/evaluations_inbox_screen.dart';
import 'package:patea_mobile/features/explorar/explorar_screen.dart';
import 'package:patea_mobile/features/groups/groups_screen.dart';
import 'package:patea_mobile/features/groups/team_detail_screen.dart';
import 'package:patea_mobile/features/matches/match_detail_screen.dart';
import 'package:patea_mobile/features/matches/matches_screen.dart';
import 'package:patea_mobile/features/players/player_detail_screen.dart';
import 'package:patea_mobile/features/players/players_list_screen.dart';
import 'package:patea_mobile/features/social/leaderboard_screen.dart';
import 'package:patea_mobile/features/social/social_feed_screen.dart';

import 'package:patea_mobile/features/auth/login_screen.dart';
import 'package:patea_mobile/features/coach/ai_coach_screen.dart';
import 'package:patea_mobile/features/matches/create_match_screen.dart';
import 'package:patea_mobile/features/matches/live_match_screen.dart';
import 'package:patea_mobile/features/matches/match_chat_screen.dart';
import 'package:patea_mobile/features/matches/match_evaluate_screen.dart';
import 'package:patea_mobile/features/players/player_history_screen.dart';
import 'package:patea_mobile/features/players/player_progression_screen.dart';
import 'package:patea_mobile/features/splash/splash_screen.dart';
import 'arnes.dart';

/// Una pantalla y el nombre con el que se guarda su imagen.
typedef Caso = (String, Widget Function());

final List<Caso> _pantallas = [
  ('panel', () => const DashboardScreen()),
  (
    'panel_en_vivo',
    () => Scaffold(
      backgroundColor: Colors.transparent,
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: DashboardMatchHero(match: partidoDirigir, isLive: true),
        ),
      ),
    ),
  ),
  ('plantel', () => const PlayersListScreen()),
  ('partidos', () => const MatchesScreen()),
  ('partido_detalle', () => const MatchDetailScreen(matchId: idPartido)),
  ('competiciones', () => const CompetitionsScreen()),
  (
    'liga_detalle',
    () => const CompetitionHubScreen(collection: 'leagues', id: 'liga-1'),
  ),
  (
    'copa_detalle',
    () => const CompetitionHubScreen(collection: 'cups', id: 'copa-1'),
  ),
  (
    'crear_liga',
    () => const CreateCompetitionScreen(isCup: false, groupId: idGrupo),
  ),
  (
    'crear_copa',
    () => const CreateCompetitionScreen(isCup: true, groupId: idGrupo),
  ),
  ('editar_perfil', () => const EditProfileScreen(playerId: uidYo)),
  ('explorar', () => const ExplorarScreen()),
  ('evaluar_partido', () => const EvaluationFormScreen(matchId: idPartido)),
  (
    'menu_usuario',
    () => const Scaffold(
      backgroundColor: Colors.transparent,
      body: Align(
        alignment: Alignment.bottomCenter,
        child: PateaUserMenuSheet(),
      ),
    ),
  ),
  ('evaluaciones', () => const EvaluationsInboxScreen()),
  ('crear_equipo', () => const CreateTeamScreen(groupId: idGrupo)),
  (
    'gestionar_plantel',
    () => Scaffold(
      backgroundColor: Colors.transparent,
      body: ManageRosterSheet(
        teamName: equipos.first.name,
        groupPlayers: jugadores,
        current: equipos.first.members,
      ),
    ),
  ),
  ('grupos', () => const GroupsScreen()),
  ('equipo_detalle', () => const TeamDetailScreen(teamId: 'team-1')),
  (
    'perfil_devoluciones',
    () => const Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: EdgeInsets.all(18),
            child: PlayerMatchDebrief(playerId: 'feedback-review'),
          ),
        ),
      ),
    ),
  ),
  ('jugador_detalle', () => const PlayerDetailScreen(playerId: uidYo)),
  ('dirigir', () => LiveMatchScreen(matchId: partidoDirigir.id)),
  ('chat', () => MatchChatScreen(match: partidos.first)),
  ('tabla', () => const LeaderboardScreen()),
  ('entrenador', () => const AICoachScreen()),
  ('comunidad', () => const SocialFeedScreen()),
  ('splash', () => const SplashScreen()),
  ('login', () => const LoginScreen()),
  ('crear_partido', () => const CreateMatchScreen()),
  ('partido_evaluar', () => const MatchEvaluateScreen(matchId: 'match-3')),
  ('jugador_historial', () => const PlayerHistoryScreen(playerId: uidYo)),
  ('jugador_progresion', () => const PlayerProgressionScreen(playerId: uidYo)),
];

void main() {
  // Los estilos se construyen al declarar las pantallas, antes de que corra
  // cualquier test, y `google_fonts` necesita el binding para leer el asset.
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    // Las fuentes están empaquetadas; esto impide que un test sin red las
    // busque igual y termine comparando un golden dibujado en Roboto.
    GoogleFonts.config.allowRuntimeFetching = false;

    // Y esto las carga **antes** del primer frame. `google_fonts` las lee del
    // bundle de forma asincrónica, pero adentro de un test el reloj es falso
    // y esos `Future` no avanzan durante los `pump`: el texto sale con la
    // fuente de prueba, que dibuja un cuadradito por glifo. Peor todavía, la
    // caché es global: la primera pantalla salía en cuadraditos y las
    // siguientes bien, así que el golden dependía del orden de los tests.
    // `setUpAll` sí corre con el reloj real.
    //
    // Los pesos van por familia y no todos a todas: pedir un peso que no está
    // empaquetado hace que `google_fonts` intente bajarlo y tire error. Space
    // Grotesk llega hasta 700 y Anton tiene un solo peso; los w800/w900 que
    // la app le pide a `headline` los resuelve el paquete contra el catálogo,
    // no contra el bundle.
    const hasta700 = [
      FontWeight.w400,
      FontWeight.w500,
      FontWeight.w600,
      FontWeight.w700,
    ];
    const hasta800 = [...hasta700, FontWeight.w800];
    for (final p in hasta700) {
      AppTypography.headline(weight: p);
      AppTypography.sportNumber(weight: p);
      AppTypography.editorial(weight: p);
    }
    for (final p in [...hasta800, FontWeight.w900, FontWeight.w300]) {
      AppTypography.body(weight: p);
    }
    for (final p in hasta800) {
      AppTypography.code(weight: p);
      AppTypography.condensed(weight: p);
    }
    AppTypography.jersey();
    await GoogleFonts.pendingFonts();

    // Y lo mismo con las fotos. Se decodifican con `Future` reales, así que
    // llegaban a la caché a destiempo: dos corridas seguidas del mismo test
    // daban imágenes distintas —una con la foto de cancha de fondo y otra
    // sin ella— y el 93 % de los píxeles cambiaba. Precargarlas acá, con el
    // reloj real, deja la caché lista antes del primer frame.
    //
    // Y hay que agrandarle el techo a la caché primero. Trece fotos de
    // 1080×2400 son ~130 MB decodificadas y el límite por defecto es 100:
    // entraban todas y después el propio uso iba expulsando algunas, así que
    // cuatro pantallas salían con foto o sin foto según el orden de la
    // corrida. Ese fue el segundo intento fallido de hacer esto determinista.
    PaintingBinding.instance.imageCache.maximumSizeBytes = 512 << 20;

    final manifiesto = await AssetManifest.loadFromAssetBundle(rootBundle);
    for (final clave in manifiesto.listAssets()) {
      if (clave.startsWith('assets/jerseys/') && clave.endsWith('.svg')) {
        // Cachear texto con reloj real: un Future cacheado dentro del primer
        // test conserva su zona de reloj falso y bloquea el tema siguiente.
        await rootBundle.loadString(clave);
        continue;
      }
      if (!clave.endsWith('.jpg') &&
          !clave.endsWith('.png') &&
          !clave.endsWith('.webp')) {
        continue;
      }
      final listo = Completer<void>();
      void terminar() {
        if (!listo.isCompleted) listo.complete();
      }

      AssetImage(clave)
          .resolve(ImageConfiguration.empty)
          .addListener(
            ImageStreamListener(
              (_, _) => terminar(),
              onError: (_, _) => terminar(),
            ),
          );
      await listo.future;
    }
  });

  setUp(() {
    // El Panel guarda la pestaña elegida en preferencias apenas se monta.
    SharedPreferences.setMockInitialValues({'welcomeShown': true});
  });

  for (final (nombre, construir) in _pantallas) {
    Widget construirParaPrueba() => (nombre == 'panel' || nombre == 'splash')
        ? Builder(
            builder: (context) => MediaQuery(
              data: MediaQuery.of(context).copyWith(disableAnimations: true),
              child: construir(),
            ),
          )
        : construir();
    for (final (tema, sufijo) in [
      (AppTheme.darkTheme, 'game'),
      (AppTheme.lightTheme, 'claro'),
    ]) {
      testWidgets('$nombre · $sufijo', (tester) async {
        if ([
          'panel',
          'grupos',
          'equipo_detalle',
          'crear_equipo',
          'gestionar_plantel',
        ].contains(nombre)) {
          // Cada tema monta un árbol nuevo: el motor SVG conserva estado de
          // decodificación si la segunda prueba reutiliza el árbol anterior.
          await tester.pumpWidget(const SizedBox.shrink());
          await tester.pump();
          svg.cache.clear();
        }
        final errores = await montarPantalla(
          tester,
          construirParaPrueba(),
          tema: tema,
        );

        if ([
          'panel',
          'grupos',
          'equipo_detalle',
          'crear_equipo',
          'gestionar_plantel',
        ].contains(nombre)) {
          // Bundle → SVG bytes → vector decode son etapas asincrónicas separadas.
          // Avanzar cada etapa antes de la captura evita camisetas intermitentes.
          for (var frame = 0; frame < 3; frame++) {
            await tester.runAsync(() async {
              for (final element in find.byType(SvgPicture).evaluate()) {
                await (element.widget as SvgPicture).bytesLoader.loadBytes(
                  element,
                );
              }
              await vg.waitForPendingDecodes();
            });
            await tester.pump();
          }
          await tester.pumpAndSettle();
        }
        expect(errores, isEmpty, reason: '\n${resumirErrores(errores)}\n');
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile('pantalla_${nombre}_$sufijo.png'),
        );
        if (nombre == 'dirigir')
          await tester.pumpWidget(const SizedBox.shrink());
      });
    }

    testWidgets('$nombre · entra a 1,3× de escala de texto', (tester) async {
      for (final (tema, cual) in [
        (AppTheme.darkTheme, 'game'),
        (AppTheme.lightTheme, 'claro'),
      ]) {
        final errores = await montarPantalla(
          tester,
          construir(),
          tema: tema,
          escala: 1.3,
        );
        expect(
          errores,
          isEmpty,
          reason: '\n$nombre · $cual · 1,3×\n${resumirErrores(errores)}\n',
        );
        if (nombre == 'dirigir')
          await tester.pumpWidget(const SizedBox.shrink());
      }
    });
  }
}
