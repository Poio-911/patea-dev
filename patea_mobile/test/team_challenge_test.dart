import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/group_model.dart';
import 'package:patea_mobile/core/models/group_permissions.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/models/team_challenge_model.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/services/team_challenge_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/utils/explore_filters.dart';
import 'package:patea_mobile/core/utils/team_search_text.dart';
import 'package:patea_mobile/features/matches/challenge_team_screen.dart';
import 'package:patea_mobile/features/matches/team_challenges_screen.dart';

import 'goldens/arnes.dart';

/// Servicio falso: guarda cada llamada y deja que el test decida cuándo y con
/// qué responde la búsqueda.
class FakeChallengeService extends TeamChallengeService {
  final searches = <Map<String, String?>>[];
  final challenges = <Map<String, String?>>[];
  final responses = <Map<String, Object?>>[];
  final searchCompleters = <Completer<List<TeamSearchResult>>>[];
  List<TeamSearchResult> Function(String query)? onSearch;
  Object? challengeError;
  List<TeamChallenge> incoming = const [];

  @override
  Future<List<TeamSearchResult>> searchTeams({
    required String query,
    String? excludeTeamId,
    String? excludeGroupId,
  }) {
    // Igual que el servicio real: con menos de 2 letras no se llama.
    if (query.trim().length < kTeamSearchMinChars) {
      return Future.value(const []);
    }
    searches.add({
      'query': query.trim(),
      'excludeTeamId': excludeTeamId,
      'excludeGroupId': excludeGroupId,
    });
    final handler = onSearch;
    if (handler != null) return Future.value(handler(query.trim()));
    final completer = Completer<List<TeamSearchResult>>();
    searchCompleters.add(completer);
    return completer.future;
  }

  @override
  Future<String> challengeTeam({
    required String fromTeamId,
    required String toTeamId,
    String message = '',
    String? title,
    String? date,
    String? time,
    String? locationName,
    Map<String, dynamic>? location,
    Map<String, dynamic>? weather,
    bool isPublic = false,
    String? matchId,
  }) async {
    if (challengeError != null) throw challengeError!;
    challenges.add({
      'from': fromTeamId,
      'to': toTeamId,
      'message': message,
      'date': date,
      'time': time,
      'venue': locationName ?? location?['name'],
      'matchId': matchId,
    });
    return matchId ?? 'challenge_inv-1';
  }

  @override
  Future<String?> respondTeamChallenge({
    required String toTeamId,
    required String invitationId,
    required bool accepted,
  }) async {
    responses.add({'to': toTeamId, 'id': invitationId, 'accepted': accepted});
    return accepted ? 'match-new' : null;
  }

  @override
  Future<List<TeamChallenge>> getMyTeamChallenges() async => incoming;
}

TeamSearchResult rival(
  String id,
  String name, {
  String group = 'Los del Sur',
}) => TeamSearchResult(
  id: id,
  name: name,
  jersey: JerseyModel(),
  groupId: 'g-$id',
  groupName: group,
  memberCount: 8,
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  // ------------------------------------------------------------- resaltado

  group('texto de búsqueda', () {
    test('plegar tildes conserva el largo, así el resaltado no se desfasa', () {
      const text = 'Peñarol Galácticos Ñandú';
      expect(foldSearchText(text).length, text.length);
      expect(foldSearchText(text), 'penarol galacticos nandu');
    });

    List<String> marked(String text, String query) {
      const base = TextStyle(fontWeight: FontWeight.w400);
      const hi = TextStyle(fontWeight: FontWeight.w900);
      return highlightSearchMatch(
        text,
        query,
        base: base,
        highlight: hi,
      ).where((s) => s.style == hi).map((s) => s.text!).toList();
    }

    test('resalta el comienzo de cada palabra que coincide', () {
      expect(marked('Los Galácticos', 'gal'), ['Gal']);
      expect(marked('Los Galácticos', 'los gal'), ['Los', 'Gal']);
      expect(marked('Los Galácticos', 'galáct'), ['Galáct']); // con tilde
      expect(marked('Los Galácticos', 'GALACT'), ['Galáct']); // sin tilde
    });

    test('no resalta lo que no es prefijo de una palabra', () {
      expect(marked('Los Galácticos', 'actic'), isEmpty);
      expect(marked('Los Galácticos', 'xyz'), isEmpty);
      expect(marked('Los Galácticos', ''), isEmpty);
    });

    test('el texto completo se conserva siempre', () {
      const base = TextStyle();
      final spans = highlightSearchMatch(
        'Los Galácticos',
        'gal',
        base: base,
        highlight: const TextStyle(fontWeight: FontWeight.bold),
      );
      expect(spans.map((s) => s.text).join(), 'Los Galácticos');
    });
  });

  // ---------------------------------------------------------- modelo y lista

  group('partidos entre equipos', () {
    MatchModel match(Map<String, dynamic> data) => MatchModel.fromFirestore({
      'title': 'x',
      'date': '2099-01-01',
      'time': '20:00',
      ...data,
    }, 'm1');

    test('lee capitanes y grupos participantes', () {
      final m = match({
        'type': 'intergroup_friendly',
        'ownerUid': 'o',
        'captains': ['capA', 'capB'],
        'participantGroupIds': ['g1', 'g2'],
        'participantTeamIds': ['t1', 't2'],
      });
      expect(m.isTeamMatch, isTrue);
      expect(m.captains, ['capA', 'capB']);
      expect(m.participantGroupIds, ['g1', 'g2']);
      expect(m.participantTeamIds, ['t1', 't2']);
    });

    test('organizador o capitán gestionan; el resto no', () {
      final m = match({
        'ownerUid': 'o',
        'captains': ['cap'],
      });
      expect(m.isManagedBy('o'), isTrue);
      expect(m.isManagedBy('cap'), isTrue);
      expect(m.isManagedBy('jugador'), isFalse);
      expect(m.isManagedBy(null), isFalse);
    });

    test('sólo by_teams e intergroup_friendly son partidos de equipos', () {
      for (final type in ['by_teams', 'intergroup_friendly']) {
        expect(match({'type': type}).isTeamMatch, isTrue, reason: type);
      }
      for (final type in ['manual', 'collaborative', 'league', 'cup']) {
        expect(match({'type': type}).isTeamMatch, isFalse, reason: type);
      }
    });

    test('Explorar no ofrece anotarse a un partido entre equipos', () {
      final now = DateTime(2098, 6, 1);
      Map<String, dynamic> base(String type) => {
        'type': type,
        'status': 'upcoming',
        'ownerUid': 'otro',
        'matchSize': 10,
        'isPublic': true,
      };
      expect(
        isPublicDiscoveryMatch(match(base('collaborative')), 'yo', now),
        isTrue,
      );
      expect(
        isPublicDiscoveryMatch(match(base('by_teams')), 'yo', now),
        isFalse,
      );
      expect(
        isPublicDiscoveryMatch(match(base('intergroup_friendly')), 'yo', now),
        isFalse,
      );
    });

    MatchModel dated(String id, String date) => MatchModel.fromFirestore({
      'title': id,
      'date': date,
      'status': 'upcoming',
    }, id);

    test(
      'la lista del grupo suma los partidos compartidos, sin repetir y del más nuevo al más viejo',
      () async {
        final primary = Stream.value([
          dated('a', '2026-03-01'),
          dated('b', '2026-01-01'),
        ]);
        final secondary = Stream.value([
          dated('b', '2026-01-01'),
          dated('c', '2026-02-01'),
        ]);
        final lists = await mergeMatchLists(
          primary,
          secondary,
        ).take(2).toList();
        // La primera emisión no espera al segundo origen; la última tiene todo.
        expect(lists.last.map((m) => m.id), ['a', 'c', 'b']);
      },
    );

    test(
      'si falla la consulta de compartidos, la lista del grupo sigue',
      () async {
        final secondary = Stream<List<MatchModel>>.error(
          StateError('falta el índice'),
        );
        final primary = Stream.value([dated('a', '2026-03-01')]);
        final first = await mergeMatchLists(primary, secondary).first;
        expect(first.map((m) => m.id), ['a']);
      },
    );

    test('respeta el límite', () async {
      final many = [
        for (var i = 0; i < 6; i++) dated('p$i', '2026-01-0${i + 1}'),
      ];
      final out = await mergeMatchLists(
        Stream.value(many),
        Stream.value(const []),
        limit: 3,
      ).last;
      expect(out.length, 3);
      expect(out.first.id, 'p5');
    });
  });

  test(
    'equipos que puedo usar para desafiar: los míos, o todos si puedo editar',
    () {
      final mine = GroupTeamModel(
        id: 'a',
        name: 'A',
        jersey: JerseyModel(),
        createdBy: 'yo',
      );
      final other = GroupTeamModel(
        id: 'b',
        name: 'B',
        jersey: JerseyModel(),
        createdBy: 'otro',
      );
      List<String> ids(GroupRole? role, {String? uid = 'yo'}) =>
          manageableTeams(
            teams: [mine, other],
            uid: uid,
            role: role,
          ).map((t) => t.id).toList();

      expect(ids(GroupRole.member), ['a']);
      expect(ids(GroupRole.moderator), ['a', 'b']);
      expect(ids(GroupRole.admin), ['a', 'b']);
      expect(ids(null), ['a']);
      expect(ids(GroupRole.admin, uid: null), isEmpty);
    },
  );

  // --------------------------------------------------------- pantalla buscar

  group('buscar rival', () {
    Future<FakeChallengeService> abrir(
      WidgetTester tester, {
      void Function(FakeChallengeService)? prepare,
      ThemeData? tema,
    }) async {
      final service = FakeChallengeService();
      prepare?.call(service);
      final errores = await montarPantalla(
        tester,
        const ChallengeTeamScreen(debounce: Duration(milliseconds: 10)),
        tema: tema ?? AppTheme.darkTheme,
        extraOverrides: [
          teamChallengeServiceProvider.overrideWithValue(service),
        ],
      );
      expect(errores, isEmpty);
      return service;
    }

    Future<void> escribir(WidgetTester tester, String text) async {
      await tester.enterText(find.byType(TextField), text);
      await tester.pump(const Duration(milliseconds: 30)); // pasa la pausa
      await tester.pump();
    }

    testWidgets('no lista ningún equipo hasta que se escribe', (tester) async {
      final service = await abrir(tester);
      expect(find.textContaining('Escribí al menos 2 letras'), findsOneWidget);
      expect(find.text('Desafiar'), findsNothing);
      expect(service.searches, isEmpty, reason: 'no se consulta sin texto');
    });

    testWidgets('con una sola letra tampoco busca ni lista', (tester) async {
      final service = await abrir(tester);
      await escribir(tester, 'g');
      expect(service.searches, isEmpty);
      expect(find.textContaining('Escribí al menos 2 letras'), findsOneWidget);
    });

    testWidgets(
      'con 2 letras busca, excluye mi equipo y mi grupo, y muestra el resultado',
      (tester) async {
        final service = await abrir(
          tester,
          prepare: (s) =>
              s.onSearch = (q) => [rival('r1', 'Los Galácticos del Sur')],
        );
        await escribir(tester, 'ga');

        expect(service.searches, hasLength(1));
        expect(service.searches.single['query'], 'ga');
        expect(service.searches.single['excludeTeamId'], 'team-1');
        expect(service.searches.single['excludeGroupId'], idGrupo);
        expect(
          find.textContaining('Los Galácticos del Sur', findRichText: true),
          findsOneWidget,
        );
        expect(
          find.textContaining('Los del Sur · 8 jugadores'),
          findsOneWidget,
        );
        expect(find.text('Desafiar'), findsOneWidget);
      },
    );

    testWidgets('escribir rápido busca una sola vez, con lo último', (
      tester,
    ) async {
      final service = await abrir(
        tester,
        prepare: (s) => s.onSearch = (q) => [rival('r1', 'Galaxia')],
      );
      await tester.enterText(find.byType(TextField), 'ga');
      await tester.pump(const Duration(milliseconds: 3));
      await tester.enterText(find.byType(TextField), 'gal');
      await tester.pump(const Duration(milliseconds: 3));
      await tester.enterText(find.byType(TextField), 'gala');
      await tester.pump(const Duration(milliseconds: 30));
      await tester.pump();
      expect(service.searches.map((s) => s['query']), ['gala']);
    });

    testWidgets('una respuesta vieja no pisa a la nueva', (tester) async {
      final service = await abrir(tester);
      await escribir(tester, 'ga'); // llamada 1 (queda colgada)
      await escribir(tester, 'gal'); // llamada 2
      expect(service.searchCompleters, hasLength(2));

      // Responde primero la nueva, y después llega tarde la vieja.
      service.searchCompleters[1].complete([rival('nuevo', 'Galaxia Norte')]);
      await tester.pump();
      service.searchCompleters[0].complete([rival('viejo', 'Gambeta FC')]);
      await tester.pump();

      expect(
        find.textContaining('Galaxia Norte', findRichText: true),
        findsOneWidget,
      );
      expect(
        find.textContaining('Gambeta FC', findRichText: true),
        findsNothing,
      );
    });

    testWidgets('borrar el texto limpia la lista', (tester) async {
      await abrir(
        tester,
        prepare: (s) => s.onSearch = (q) => [rival('r1', 'Galaxia')],
      );
      await escribir(tester, 'ga');
      expect(find.text('Desafiar'), findsOneWidget);
      await escribir(tester, '');
      expect(find.text('Desafiar'), findsNothing);
      expect(find.textContaining('Escribí al menos 2 letras'), findsOneWidget);
    });

    testWidgets('sin resultados lo dice', (tester) async {
      await abrir(tester, prepare: (s) => s.onSearch = (q) => const []);
      await escribir(tester, 'zzz');
      expect(find.textContaining('Sin resultados'), findsOneWidget);
    });

    testWidgets(
      'desafiar manda mi equipo, el rival y el mensaje, y queda como enviado',
      (tester) async {
        final service = await abrir(
          tester,
          prepare: (s) => s.onSearch = (q) => [rival('r1', 'Galaxia Norte')],
        );
        await escribir(tester, 'ga');

        await tester.tap(find.text('Desafiar'));
        await tester.pumpAndSettle();
        expect(find.text('Enviar desafío'), findsOneWidget);
        await tester.enterText(
          find.widgetWithText(TextField, 'Mensaje (opcional)'),
          '¿Jugamos el sábado?',
        );
        await tester.pump();
        await tester.tap(find.text('Enviar desafío'));
        await tester.pumpAndSettle();

        expect(service.challenges, hasLength(1));
        expect(service.challenges.single['from'], 'team-1');
        expect(service.challenges.single['to'], 'r1');
        expect(service.challenges.single['message'], '¿Jugamos el sábado?');
        expect(service.challenges.single['date'], isNull);
        expect(find.text('Enviado'), findsOneWidget);
        expect(find.text('Desafiar'), findsNothing);
      },
    );

    testWidgets(
      'si el servidor lo rechaza, el error se ve en la hoja y no se pierde',
      (tester) async {
        final service = await abrir(
          tester,
          prepare: (s) {
            s.onSearch = (q) => [rival('r1', 'Galaxia Norte')];
            s.challengeError = Exception(
              'Ya le enviaste un desafío a este equipo.',
            );
          },
        );
        await escribir(tester, 'ga');
        await tester.tap(find.text('Desafiar'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Enviar desafío'));
        await tester.pumpAndSettle();

        expect(
          find.text('Ya le enviaste un desafío a este equipo.'),
          findsOneWidget,
        );
        expect(
          find.text('Enviar desafío'),
          findsOneWidget,
          reason: 'la hoja sigue abierta',
        );
        expect(service.challenges, isEmpty);
      },
    );

    testWidgets('en tema claro también se ve completo', (tester) async {
      await abrir(
        tester,
        tema: AppTheme.lightTheme,
        prepare: (s) => s.onSearch = (q) => [rival('r1', 'Galaxia')],
      );
      await escribir(tester, 'ga');
      expect(find.text('Desafiar'), findsOneWidget);
    });
  });

  // ------------------------------------------------------------- recibidos

  group('desafíos recibidos', () {
    TeamChallenge challenge({String id = 'c1', bool proposal = false}) =>
        TeamChallenge(
          id: id,
          toTeamId: 'team-1',
          toTeamName: 'Los Galácticos',
          fromTeamId: 'r1',
          fromTeamName: 'Galaxia Norte',
          fromTeamJersey: JerseyModel(),
          fromGroupName: 'Los del Norte',
          message: '¿Jugamos?',
          proposedDate: proposal ? '2099-05-10' : '',
          proposedTime: proposal ? '20:30' : '',
          proposedLocationName: proposal ? 'Cancha 5' : '',
        );

    Future<void> abrir(
      WidgetTester tester,
      FakeChallengeService service,
    ) async {
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (_, _) => const Scaffold(body: TeamChallengesScreen()),
          ),
          GoRoute(
            path: '/challenge',
            builder: (_, _) => const Scaffold(body: Text('buscar')),
          ),
          GoRoute(
            path: '/matches/:id',
            builder: (_, s) =>
                Scaffold(body: Text('detalle ${s.pathParameters['id']}')),
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            teamChallengeServiceProvider.overrideWithValue(service),
            currentUidProvider.overrideWithValue(uidYo),
          ],
          child: MaterialApp.router(
            theme: AppTheme.darkTheme,
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('sin desafíos, lo dice y ofrece buscar rival', (tester) async {
      await abrir(tester, FakeChallengeService());
      expect(find.text('No tenés desafíos pendientes'), findsOneWidget);
      await tester.tap(find.text('Buscar rival'));
      await tester.pumpAndSettle();
      expect(find.text('buscar'), findsOneWidget);
    });

    testWidgets('muestra quién desafía, el mensaje y la propuesta', (
      tester,
    ) async {
      final service = FakeChallengeService()
        ..incoming = [challenge(proposal: true)];
      await abrir(tester, service);
      expect(find.text('Galaxia Norte'), findsOneWidget);
      expect(find.textContaining('Los del Norte'), findsOneWidget);
      expect(find.textContaining('¿Jugamos?'), findsOneWidget);
      expect(
        find.textContaining('10/05/2099 · 20:30 hs · Cancha 5'),
        findsOneWidget,
      );
    });

    testWidgets('sin propuesta avisa que la definen los capitanes', (
      tester,
    ) async {
      final service = FakeChallengeService()..incoming = [challenge()];
      await abrir(tester, service);
      expect(
        find.textContaining('a definir entre los capitanes'),
        findsOneWidget,
      );
    });

    testWidgets('aceptar crea el partido y abre su detalle', (tester) async {
      final service = FakeChallengeService()..incoming = [challenge()];
      await abrir(tester, service);
      await tester.tap(find.text('Aceptar'));
      await tester.pumpAndSettle();

      expect(service.responses, [
        {'to': 'team-1', 'id': 'c1', 'accepted': true},
      ]);
      expect(find.text('detalle match-new'), findsOneWidget);
    });

    testWidgets('rechazar no abre ningún partido', (tester) async {
      final service = FakeChallengeService()..incoming = [challenge()];
      await abrir(tester, service);
      await tester.tap(find.text('Rechazar'));
      await tester.pumpAndSettle();

      expect(service.responses.single['accepted'], false);
      expect(find.textContaining('detalle'), findsNothing);
      expect(find.text('Desafío rechazado.'), findsOneWidget);
    });
  });

  group('partido creado con desafío pendiente o rechazado', () {
    test('MatchModel conserva campos de desafío y lugar completo', () {
      final m = MatchModel.fromFirestore({
        'title': '19 De Abril vs Huracán',
        'type': 'intergroup_friendly',
        'status': 'planning',
        'date': '2026-11-22',
        'time': '20:00',
        'groupId': 'g-1',
        'participantGroupIds': ['g-1', 'g-2'],
        'participantTeamIds': ['t-1', 't-2'],
        'challengeStatus': 'pending',
        'challengeInvitationId': 'inv-1',
        'challengeFromTeamId': 't-1',
        'challengeToTeamId': 't-2',
        'challengeFromTeamName': '19 De Abril',
        'challengeToTeamName': 'Huracán',
        'challengeMessage': '¿Jugamos el domingo?',
        'location': {
          'name': 'Complejo Parque',
          'address': 'Av. Italia 4500',
          'lat': -34.89,
          'lng': -56.12,
          'placeId': 'place-123',
        },
      }, 'm-1');

      expect(m.challengeStatus, 'pending');
      expect(m.challengeInvitationId, 'inv-1');
      expect(m.challengeFromTeamId, 't-1');
      expect(m.challengeToTeamId, 't-2');
      expect(m.challengeMessage, '¿Jugamos el domingo?');
      expect(m.location, 'Complejo Parque');
      expect(m.locationDetail?.address, 'Av. Italia 4500');
      expect(m.locationDetail?.placeId, 'place-123');
      expect(m.participantGroupIds, ['g-1', 'g-2']);
    });

    test('TeamChallenge parsea matchId del partido ya creado', () {
      final c = TeamChallenge.fromMap({
        'id': 'inv-1',
        'toTeamId': 't-2',
        'fromTeamId': 't-1',
        'fromTeamName': '19 De Abril',
        'matchId': 'challenge_inv-1',
      });
      expect(c.matchId, 'challenge_inv-1');
    });
  });
}
