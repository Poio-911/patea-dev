import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/services/match_result_service.dart';
import 'package:patea_mobile/features/matches/widgets/match_story_view.dart';

/// La revista del partido, con contenido real.
///
/// El unico partido con cronica de la base es de otro grupo, asi que no se
/// puede abrir desde la cuenta con la que se prueba en el emulador. El texto
/// de aca esta copiado tal cual de ese documento (2138 caracteres de relato y
/// 9 voces) porque los largos reales son justamente lo que rompe layouts: un
/// titular de dos renglones, una capitular y un carrusel de citas.
void main() {
  setUpAll(() {
    // Sin esto el test intenta bajar las fuentes por red.
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  const chronicle = MatchChronicle(
    headline: 'En Espacio Prado, el \'19 de Abril\' pintó el David y la \'Banda del MVP\' mordió el polvo de la derrota',
    story: 'La tarde caía sobre Espacio Prado, y con ella, la épica de un nuevo clásico barrial. No fue un partido, fue una declaración de principios, un choque de estilos donde la rústica poesía del \'19 de Abril\' se impuso a la lírica (a veces confusa) de la \'Banda del MVP\'. Desde el pitazo inicial, se mascó la tensión. Un duelo táctico donde cada pelota dividida era una batalla por la supervivencia futbolística. Como sentenció José P. más tarde, con la sabiduría del estratega: "Hoy el mediocampo fue una batalla, pero logramos imponer nuestro ritmo".\n\nPero no todo fue control y armonía para José P., el mediocampista de la \'Banda del MVP\'. Si bien demostró su visión con un cambio de frente magistral, también coqueteó con el desastre, regalando un pase al rival que casi termina en gol. Así es el fútbol, maestro: una de cal y otra de arena. Mientras tanto, Liroy, el titiritero del mediocampo, movía los hilos con pasión, robando pelotas y lanzando ataques, aunque a veces se olvidaba de las obligaciones defensivas. Su entrega fue innegable, como un Quijote moderno batallando contra gigantes imaginarios. Corazón y garra, le sobraron al ñeri, aunque, como él mismo admitió, el partido fue trabado y se enfocó en mantener la posición. \n\nEn el fondo, Tester Real 4 se fajó como un gladiador romano. Achicó con valentía, ganando duelos clave, aunque su audacia a veces lo dejaba mal parado. No obstante, se puso el equipo al hombro, arengando a sus compañeros y sacrificando su lucimiento personal. Pero hasta el más pintado tiene su talón de Aquiles. Una pelota fácil se le escurrió entre los dedos, obligándolo a una recuperación desesperada. Un error que, como el mismo Tester Real 4 confesaría después, le costó caro en el marcador.\n\nEl \'19 de Abril\' se plantó con solidez, aprovechando cada error y cada grieta en la defensa rival. No fueron más vistosos, pero sí más efectivos. Un triunfo que, como diría Galeano, no se explica solo con la táctica, sino con el alma. El fútbol, al fin y al cabo, es un estado de ánimo, una pasión desbordada que se vive en cada rincón de Espacio Prado. Y hoy, la alegría fue toda para el \'19 de Abril\'.',
    playerVoices: [
      (playerName: 'Tester Real 1', quote: 'Físicamente me sentí un escalón arriba hoy, pude ganar varios duelos individuales.'),
      (playerName: 'Tester Real 4', quote: 'Partido trabado. Me enfoqué en mantener la posición y no regalar la pelota.'),
      (playerName: 'José P.', quote: 'Hoy el mediocampo fue una batalla, pero logramos imponer nuestro ritmo.'),
      (playerName: 'Clemente', quote: 'Pocos goles pero mucha táctica. Me gustó el despliegue de mis compañeros.'),
      (playerName: 'Santiago López', quote: 'Un partido muy intenso, me sentí bien físicamente y creo que aporté fluidez al juego.'),
      (playerName: 'Liroy', quote: 'Partido trabado. Me enfoqué en mantener la posición y no regalar la pelota.'),
      (playerName: 'Tester Real 3', quote: 'Buen ambiente en la cancha. Siento que el equipo está conectando mejor cada semana.'),
      (playerName: 'Tester Real 5', quote: 'Lindo partido para jugar, hubo mucha rotación y eso me favoreció.'),
      (playerName: 'Tester Real 2', quote: 'Un poco frustrado con el resultado, pero en lo personal me sentí con confianza.'),
    ],
  );

  final match = MatchModel(
    id: 'sSTA1Tgv9pj18TJhUkWO',
    title: 'Equipo 1-1 vs 19 de Abril',
    date: '2026-03-07',
    status: 'evaluated',
    type: 'manual',
    hasFinalScore: true,
    teamA: MatchTeam(name: 'Equipo 1-1', playerIds: [], players: [], score: 3),
    teamB: MatchTeam(name: '19 de Abril', playerIds: [], players: [], score: 6),
    chronicle: chronicle,
  );

  testWidgets('la revista entra sin desbordes con una cronica real',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2424);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          matchResultStatsProvider(match.id)
              .overrideWith((ref) => Stream.value(MatchResultStats.empty)),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: MatchStoryView(match: match),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    // Un RenderFlex desbordado llega aca como excepcion.
    expect(tester.takeException(), isNull);

    // Y que efectivamente haya dibujado el contenido, no una tarjeta vacia.
    expect(find.text('3 - 6'), findsOneWidget);
    expect(find.text('VOCES DEL VESTUARIO'), findsOneWidget);
  });
}
