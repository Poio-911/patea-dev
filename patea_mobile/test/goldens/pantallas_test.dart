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
/// entra**, y un desborde de layout llega al test como excepción. Así son 24
/// imágenes en vez de 48, y la pasada de 1,3× cuesta casi nada.
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

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show AssetManifest, rootBundle;
import 'package:flutter_test/flutter_test.dart';
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

import 'arnes.dart';

/// Una pantalla y el nombre con el que se guarda su imagen.
typedef Caso = (String, Widget Function());

final List<Caso> _pantallas = [
  ('panel', () => const DashboardScreen()),
  ('plantel', () => const PlayersListScreen()),
  ('partidos', () => const MatchesScreen()),
  ('partido_detalle', () => const MatchDetailScreen(matchId: idPartido)),
  ('competiciones', () => const CompetitionsScreen()),
  ('explorar', () => const ExplorarScreen()),
  ('evaluaciones', () => const EvaluationsInboxScreen()),
  ('grupos', () => const GroupsScreen()),
  ('equipo_detalle', () => const TeamDetailScreen(teamId: 'team-1')),
  ('jugador_detalle', () => const PlayerDetailScreen(playerId: uidYo)),
  ('tabla', () => const LeaderboardScreen()),
  ('comunidad', () => const SocialFeedScreen()),
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
    const hasta700 = [FontWeight.w400, FontWeight.w500, FontWeight.w600, FontWeight.w700];
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
      if (!clave.endsWith('.jpg') && !clave.endsWith('.png')) continue;
      final listo = Completer<void>();
      void terminar() {
        if (!listo.isCompleted) listo.complete();
      }

      AssetImage(clave).resolve(ImageConfiguration.empty).addListener(
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
    SharedPreferences.setMockInitialValues({});
  });

  for (final (nombre, construir) in _pantallas) {
    for (final (tema, sufijo) in [
      (AppTheme.darkTheme, 'game'),
      (AppTheme.lightTheme, 'claro'),
    ]) {
      testWidgets('$nombre · $sufijo', (tester) async {
        final errores = await montarPantalla(tester, construir(), tema: tema);

        expect(errores, isEmpty, reason: '\n${resumirErrores(errores)}\n');
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile('pantalla_${nombre}_$sufijo.png'),
        );
      });
    }

    testWidgets('$nombre · entra a 1,3× de escala de texto', (tester) async {
      for (final (tema, cual) in [
        (AppTheme.darkTheme, 'game'),
        (AppTheme.lightTheme, 'claro'),
      ]) {
        final errores =
            await montarPantalla(tester, construir(), tema: tema, escala: 1.3);
        expect(errores, isEmpty,
            reason: '\n$nombre · $cual · 1,3×\n${resumirErrores(errores)}\n');
      }
    });
  }
}
