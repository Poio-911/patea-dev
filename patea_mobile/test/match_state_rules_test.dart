import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/services/match_clips_service.dart';
import 'package:patea_mobile/core/services/match_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/utils/explore_filters.dart';
import 'package:patea_mobile/features/matches/match_detail_screen.dart';

import 'goldens/arnes.dart';

/// Lo que la app ofrece tiene que coincidir con la máquina de estados y las
/// reglas de plantel del servidor (docs/technical/REGLAS_POR_TIPO_DE_PARTIDO.md).
class FakeMatchService extends MatchService {
  final calls = <String>[];

  @override
  Future<void> startMatch(String matchId) async => calls.add('startMatch');

  @override
  Future<void> finishMatch(String matchId) async => calls.add('finishMatch');
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  MatchModel partido({
    required String type,
    String status = 'upcoming',
    String? owner = uidYo,
    List<String>? playerUids,
    int matchSize = 10,
    String? groupId,
    List<String> participantGroupIds = const [],
  }) => MatchModel(
    id: 'ms1',
    title: 'Los Galácticos vs La Furia Roja',
    date: '2099-03-10',
    time: '21:30',
    status: status,
    type: type,
    matchSize: matchSize,
    ownerUid: owner,
    groupId: groupId,
    participantGroupIds: participantGroupIds,
    playerUids: playerUids ?? partidos.first.playerUids,
    players: partidos.first.players,
    teamA: partidos.first.teamA,
    teamB: partidos.first.teamB,
    location: 'Cancha 5',
  );

  Future<void> abrir(
    WidgetTester tester,
    MatchModel match, {
    FakeMatchService? service,
  }) async {
    await montarPantalla(
      tester,
      const MatchDetailScreen(matchId: 'ms1'),
      tema: AppTheme.darkTheme,
      extraOverrides: [
        singleMatchStreamProvider(
          'ms1',
        ).overrideWith((ref) => Stream.value(match)),
        matchClipsProvider('ms1').overrideWith((ref) => Stream.value(const [])),
        if (service != null) matchServiceProvider.overrideWithValue(service),
      ],
    );
  }

  // ------------------------------------------------------------- modelo

  group('plantel fijo', () {
    MatchModel tipo(String type) => MatchModel(
      id: 'x',
      title: 't',
      date: '2099-01-01',
      status: 'upcoming',
      type: type,
    );

    test('entre equipos y competiciones tienen plantel fijo; el resto no', () {
      for (final type in [
        'by_teams',
        'intergroup_friendly',
        'league',
        'cup',
        'league_final',
      ]) {
        expect(tipo(type).hasFixedRoster, isTrue, reason: type);
      }
      for (final type in ['manual', 'collaborative']) {
        expect(tipo(type).hasFixedRoster, isFalse, reason: type);
      }
      expect(tipo('league').isCompetitionMatch, isTrue);
      expect(tipo('by_teams').isCompetitionMatch, isFalse);
    });

    test('"Falta uno" sólo se ofrece donde el plantel admite sueltos', () {
      final now = DateTime(2098, 1, 1);
      bool recluta(String type) => canRecruitFor(
        partido(type: type, matchSize: 14, playerUids: ['a']),
        uidYo,
        now,
      );

      expect(recluta('manual'), isTrue);
      expect(recluta('collaborative'), isTrue);
      for (final type in [
        'by_teams',
        'intergroup_friendly',
        'league',
        'cup',
        'league_final',
      ]) {
        expect(recluta(type), isFalse, reason: type);
      }
    });
  });

  // ------------------------------------------------------- darse de baja

  group('darse de baja', () {
    // El usuario juega pero no organiza.
    MatchModel jugando(String type) =>
        partido(type: type, owner: 'otro', playerUids: [uidYo, 'uid-2']);

    testWidgets('en un partido colaborativo se puede', (tester) async {
      await abrir(tester, jugando('collaborative'));
      expect(find.text('Anotado'), findsOneWidget);
      expect(find.text('Darme de baja'), findsOneWidget);
    });

    for (final type in ['by_teams', 'intergroup_friendly']) {
      testWidgets('en un partido $type no: el servidor lo rechaza', (
        tester,
      ) async {
        await abrir(tester, jugando(type));
        expect(
          find.text('Anotado'),
          findsOneWidget,
          reason: 'sigue viendo que está anotado',
        );
        expect(find.text('Darme de baja'), findsNothing);
        expect(
          find.text('No puedo ir'),
          findsOneWidget,
          reason: 'en su lugar avisa que no puede ir',
        );
      });
    }
  });

  // ------------------------------------------------------------- finalizar

  group('finalizar', () {
    testWidgets(
      'un partido que no empezó se inicia primero y después se finaliza',
      (tester) async {
        final service = FakeMatchService();
        await abrir(
          tester,
          partido(type: 'collaborative', status: 'upcoming'),
          service: service,
        );

        await tester.tap(find.text('Finalizar'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 200));

        expect(service.calls, ['startMatch', 'finishMatch']);
      },
    );

    testWidgets('un partido en vivo sólo se finaliza', (tester) async {
      final service = FakeMatchService();
      await abrir(
        tester,
        partido(type: 'collaborative', status: 'active'),
        service: service,
      );
      await tester.ensureVisible(find.text('Panel del organizador'));
      await tester.pump();
      await tester.tap(find.text('Panel del organizador'));
      await tester.pump(const Duration(milliseconds: 400));

      // En vivo el panel no ofrece "Finalizar Partido" (eso es de `upcoming`);
      // el cierre sale de la pantalla en vivo. Lo que no debe pasar es que
      // "Dirigir en vivo" inicie algo.
      expect(find.text('Dirigir en vivo'), findsOneWidget);
      expect(service.calls, isEmpty);
    });
  });

  // ----------------------------------------------------------------- clips

  group('clips', () {
    test('cupos: el primer libre, y a lo sumo 10 por persona', () {
      expect(nextClipSlot('u1', const []), 0);
      expect(nextClipSlot('u1', ['u1_0', 'u1_1']), 2);
      expect(nextClipSlot('u1', ['u1_1']), 0, reason: 'reutiliza el hueco');
      expect(
        nextClipSlot('u1', [for (var i = 0; i < 10; i++) 'u1_$i']),
        isNull,
        reason: 'diez clips: no hay cupo',
      );
    });

    test('los clips de otra persona no ocupan mis cupos', () {
      expect(nextClipSlot('u1', ['u2_0', 'u2_1', 'u1_5']), 0);
    });

    test('los clips anteriores a los cupos cuentan para el tope', () {
      final viejos = [for (var i = 0; i < 10; i++) '17000000000$i'];
      expect(nextClipSlot('u1', viejos), isNull);
      expect(nextClipSlot('u1', viejos.take(9)), 0);
    });

    testWidgets(
      'un miembro de un grupo que participa sube clips aunque no juegue',
      (tester) async {
        await abrir(
          tester,
          partido(
            type: 'intergroup_friendly',
            status: 'completed',
            owner: 'otro',
            playerUids: ['uid-2'],
            groupId: 'otro-grupo',
            participantGroupIds: ['otro-grupo', idGrupo],
          ),
        );
        await tester.ensureVisible(find.text('Clips'));
        expect(find.text('Subir'), findsOneWidget);
      },
    );

    testWidgets(
      'quien no es de ningún grupo del partido ni juega no ve "Subir"',
      (tester) async {
        await abrir(
          tester,
          partido(
            type: 'intergroup_friendly',
            status: 'completed',
            owner: 'otro',
            playerUids: ['uid-2'],
            groupId: 'otro-grupo',
            participantGroupIds: ['otro-grupo', 'tercer-grupo'],
          ),
        );
        expect(find.text('Subir'), findsNothing);
      },
    );
  });
}
