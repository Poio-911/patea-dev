import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/services/match_clips_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/features/matches/match_detail_screen.dart';
import 'package:patea_mobile/features/matches/widgets/edit_teams_sheet.dart';

import 'goldens/arnes.dart';

/// Panel del organizador y clips de un partido ENTRE EQUIPOS.
///
/// Ahí los planteles son los de cada equipo: no hay "equilibrar", "armar
/// equipos" ni nada que mueva jugadores de un equipo al otro. Y suben clips
/// los dos equipos, capitanes incluidos.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  MatchModel partido({
    required String type,
    String status = 'upcoming',
    String? owner = uidYo,
    List<String> captains = const [],
    List<String>? playerUids,
  }) => MatchModel(
    id: 'tm1',
    title: 'Los Galácticos vs La Furia Roja',
    // Lejos en el futuro: nada del test depende del reloj.
    date: '2099-03-10',
    time: '21:30',
    status: status,
    type: type,
    matchSize: 10,
    ownerUid: owner,
    captains: captains,
    playerUids: playerUids ?? partidos.first.playerUids,
    players: partidos.first.players,
    teamA: partidos.first.teamA,
    teamB: partidos.first.teamB,
    location: 'Cancha 5',
  );

  Future<void> abrir(WidgetTester tester, MatchModel match) async {
    await montarPantalla(
      tester,
      const MatchDetailScreen(matchId: 'tm1'),
      tema: AppTheme.darkTheme,
      extraOverrides: [
        singleMatchStreamProvider(
          'tm1',
        ).overrideWith((ref) => Stream.value(match)),
        matchClipsProvider('tm1').overrideWith((ref) => Stream.value(const [])),
      ],
    );
  }

  Future<void> abrirPanel(WidgetTester tester) async {
    final panel = find.text('Panel del organizador');
    await tester.ensureVisible(panel);
    await tester.pump();
    await tester.tap(panel);
    await tester.pump(const Duration(milliseconds: 400));
  }

  const loDeEquilibrar = [
    'Equilibrar equipos',
    'Recalcular equilibrio',
    'Armar equipos',
    'Falta uno',
  ];

  for (final type in ['intergroup_friendly', 'by_teams']) {
    testWidgets(
      '$type: el panel del organizador no tiene nada de equilibrar ni de mover jugadores',
      (tester) async {
        await abrir(tester, partido(type: type));
        await abrirPanel(tester);

        for (final texto in loDeEquilibrar) {
          expect(
            find.text(texto),
            findsNothing,
            reason: '"$texto" no va en un partido entre equipos',
          );
        }
        // Lo que sí corresponde sigue.
        expect(find.text('Reprogramar'), findsOneWidget);
        expect(find.text('Cambiar Cancha'), findsOneWidget);
        expect(find.text('Eliminar Partido'), findsOneWidget);
      },
    );
  }

  testWidgets(
    'control: en un partido armado por jugadores el equilibrio sí está',
    (tester) async {
      // Colaborativo y no 'manual': éste además lee solicitudes de Firestore.
      // Un partido que arma sus equipos por nivel es donde el equilibrio sí va.
      await abrir(tester, partido(type: 'collaborative'));
      await abrirPanel(tester);

      expect(find.text('Recalcular equilibrio'), findsOneWidget);
      expect(find.text('Armar equipos'), findsOneWidget);
    },
  );

  testWidgets(
    'un capitán gestiona fecha y cancha pero no puede borrar el partido',
    (tester) async {
      await abrir(
        tester,
        partido(
          type: 'intergroup_friendly',
          owner: 'otro-organizador',
          captains: [uidYo, 'otro-organizador'],
        ),
      );
      await abrirPanel(tester);

      expect(find.text('Reprogramar'), findsOneWidget);
      expect(find.text('Cambiar Cancha'), findsOneWidget);
      expect(find.text('Eliminar Partido'), findsNothing);
      for (final texto in loDeEquilibrar) {
        expect(find.text(texto), findsNothing);
      }
    },
  );

  testWidgets('un jugador cualquiera no ve el panel', (tester) async {
    await abrir(
      tester,
      partido(type: 'intergroup_friendly', owner: 'otro', captains: ['otro']),
    );
    expect(find.text('Panel del organizador'), findsNothing);
  });

  group('clips en un partido entre equipos', () {
    // Terminado: es cuando se muestran los clips.
    MatchModel jugado({
      required List<String> playerUids,
      List<String> captains = const [],
      String? owner,
    }) => partido(
      type: 'intergroup_friendly',
      status: 'completed',
      owner: owner,
      captains: captains,
      playerUids: playerUids,
    );

    testWidgets('un jugador del equipo que NO organiza también puede subir', (
      tester,
    ) async {
      // uidYo juega, pero el organizador y el capitán son del otro equipo.
      await abrir(
        tester,
        jugado(playerUids: [uidYo, 'uid-2'], owner: 'otro', captains: ['otro']),
      );
      await tester.ensureVisible(find.text('Clips'));
      expect(find.text('Subir'), findsOneWidget);
    });

    testWidgets('el capitán de un equipo puede subir aunque no juegue', (
      tester,
    ) async {
      await abrir(
        tester,
        jugado(
          playerUids: ['uid-2', 'uid-3'],
          owner: 'otro',
          captains: ['otro', uidYo],
        ),
      );
      await tester.ensureVisible(find.text('Clips'));
      expect(find.text('Subir'), findsOneWidget);
    });

    testWidgets('quien no participa no ve el botón de subir', (tester) async {
      await abrir(
        tester,
        jugado(
          playerUids: ['uid-2', 'uid-3'],
          owner: 'otro',
          captains: ['otro'],
        ),
      );
      expect(find.text('Subir'), findsNothing);
    });
  });

  testWidgets('el editor de equipos no se abre en un partido entre equipos', (
    tester,
  ) async {
    late BuildContext captured;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            captured = context;
            return const Scaffold(body: SizedBox());
          },
        ),
      ),
    );
    await EditTeamsSheet.show(captured, partido(type: 'intergroup_friendly'));
    await tester.pump();
    expect(find.byType(EditTeamsSheet), findsNothing);
  });
}
