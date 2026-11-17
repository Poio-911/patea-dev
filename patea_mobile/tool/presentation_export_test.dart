import 'package:patea_mobile/core/services/match_result_service.dart';
import 'package:patea_mobile/core/widgets/patea_user_menu_sheet.dart';
import 'package:patea_mobile/features/competitions/competition_management.dart';
import 'package:patea_mobile/features/groups/create_team_screen.dart';
import 'package:patea_mobile/features/matches/widgets/match_clips_view.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/features/auth/login_screen.dart';
import 'package:patea_mobile/features/matches/widgets/match_planning_view.dart';
import 'package:patea_mobile/features/matches/widgets/match_story_view.dart';
import 'package:patea_mobile/core/services/player_profile_service.dart';
import 'package:patea_mobile/features/players/player_progression_screen.dart';
import 'package:patea_mobile/features/competitions/competition_hub_screen.dart';

import 'package:patea_mobile/features/players/edit_profile_screen.dart';

import 'package:patea_mobile/features/players/widgets/player_match_debrief.dart';

import 'package:patea_mobile/features/evaluations/evaluation_form_screen.dart';

import 'package:patea_mobile/features/dashboard/widgets/dashboard_match_hero.dart';

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show AssetManifest, rootBundle;
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
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

import 'package:patea_mobile/features/coach/ai_coach_screen.dart';

import 'package:patea_mobile/features/matches/live_match_screen.dart';
import 'package:patea_mobile/features/matches/match_chat_screen.dart';
import '../test/goldens/arnes.dart';

import 'package:patea_mobile/features/matches/create_match_screen.dart';
import 'package:flutter/services.dart' show FontLoader;

final presentationPlanning = MatchModel(
  id: 'presentation-planning',
  title: 'El partido del viernes',
  date: '',
  status: 'planning',
  type: 'manual',
  ownerUid: uidYo,
  groupId: idGrupo,
  matchSize: 10,
  isVotingOpen: true,
  dateProposals: [
    MatchDateProposal(
      id: 'd1',
      proposedBy: uidYo,
      date: '2026-11-20',
      time: '21:00',
      votes: [uidYo, 'uid-2', 'uid-3'],
      createdAt: '2026-11-17',
    ),
    MatchDateProposal(
      id: 'd2',
      proposedBy: 'uid-2',
      date: '2026-11-21',
      time: '20:00',
      votes: ['uid-2', 'uid-4'],
      createdAt: '2026-11-17',
    ),
  ],
);
final presentationStory = MatchModel(
  id: 'presentation-story',
  title: 'Clásico del Barrio',
  date: '2026-11-16',
  status: 'completed',
  type: 'manual',
  ownerUid: uidYo,
  players: partidos.first.players,
  playerUids: partidos.first.playerUids,
  teamA: partidos.first.teamA,
  teamB: partidos.first.teamB,
  hasFinalScore: true,
  chronicle: const MatchChronicle(
    headline: 'Una fecha para recordar',
    story:
        'Los Galácticos cerraron la jornada con un 4 a 2 ante La Furia Roja del Prado. El resultado quedó en la planilla; las jugadas, en la memoria del grupo. La fecha dejó goles, conversaciones y una nueva oportunidad para encontrarse en la cancha.',
    playerVoices: [
      (
        playerName: 'Santiago Fernández',
        quote: 'La próxima fecha ya se está armando.',
      ),
    ],
  ),
);
final presentationPublicMatch = MatchModel(
  id: 'presentation-public',
  title: 'Fútbol 5 en el Prado',
  date: '2032-11-21',
  time: '21:00',
  status: 'upcoming',
  type: 'collaborative',
  ownerUid: 'uid-2',
  matchSize: 10,
  location: 'Complejo del Prado',
  locationDetail: MatchLocationModel(
    name: 'Complejo del Prado',
    lat: -34.866,
    lng: -56.201,
  ),
  players: partidos.first.players.skip(1).take(6).toList(),
  playerUids: partidos.first.playerUids.skip(1).take(6).toList(),
);
final cases = <String, Widget>{
  'user_menu': const Scaffold(
    body: Align(alignment: Alignment.bottomCenter, child: PateaUserMenuSheet()),
  ),
  'create_team': const CreateTeamScreen(groupId: idGrupo),
  'create_league': const CreateCompetitionScreen(
    isCup: false,
    groupId: idGrupo,
  ),
  'availability': const ExplorarScreen(),
  'explore_player': const ExplorarScreen(),
  'explore_light': const ExplorarScreen(),
  'explore_player_light': const ExplorarScreen(),
  'clip_upload': Scaffold(
    appBar: AppBar(title: const Text('Clips del partido')),
    body: ClipCaptureSheet(match: partidos.first),
  ),
  'login': const LoginScreen(),
  'planning': Scaffold(
    backgroundColor: Colors.transparent,
    appBar: AppBar(title: const Text('Organizar el partido')),
    body: SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: MatchPlanningView(match: presentationPlanning, uid: uidYo),
      ),
    ),
  ),
  'story': Scaffold(
    backgroundColor: Colors.transparent,
    appBar: AppBar(title: const Text('La crónica de la fecha')),
    body: SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: MatchStoryView(
          match: presentationStory,
          part: MatchStoryPart.chronicle,
        ),
      ),
    ),
  ),

  'league_table': const CompetitionHubScreen(
    collection: 'leagues',
    id: 'liga-1',
  ),
  'cup_bracket': const CompetitionHubScreen(collection: 'cups', id: 'copa-1'),
  'explore_matches': const ExplorarScreen(),
  'progression': const PlayerProgressionScreen(playerId: uidYo),
  'panel': const DashboardScreen(),
  'panel_live': Scaffold(
    backgroundColor: Colors.transparent,
    body: SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: DashboardMatchHero(match: partidoDirigir, isLive: true),
      ),
    ),
  ),
  'players': const PlayersListScreen(),
  'profile': const PlayerDetailScreen(playerId: uidYo),
  'edit_profile': const EditProfileScreen(playerId: uidYo),
  'groups': const GroupsScreen(),
  'team': const TeamDetailScreen(teamId: 'team-1'),
  'create_match': const CreateMatchScreen(),
  'matches': const MatchesScreen(),
  'match_detail': const MatchDetailScreen(matchId: idPartido),
  'live': LiveMatchScreen(matchId: partidoDirigir.id),
  'chat': MatchChatScreen(match: partidos.first),
  'evaluations': const EvaluationsInboxScreen(),
  'evaluate': const EvaluationFormScreen(matchId: idPartido),
  'league': const CompetitionHubScreen(collection: 'leagues', id: 'liga-1'),
  'cup': const CompetitionHubScreen(collection: 'cups', id: 'copa-1'),
  'explore': const ExplorarScreen(),
  'ranking': const LeaderboardScreen(),
  'coach': const AICoachScreen(),
  'community': const SocialFeedScreen(),
  'feedback': const Scaffold(
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
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    // Las fuentes están empaquetadas; esto impide que un test sin red las
    // busque igual y termine comparando un golden dibujado en Roboto.
    GoogleFonts.config.allowRuntimeFetching = false;
    final material = FontLoader('MaterialIcons');
    material.addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await material.load();

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

  // This export harness runs with flutter test despite living under tool/.
  // ignore: invalid_use_of_visible_for_testing_member
  setUp(() => SharedPreferences.setMockInitialValues({'welcomeShown': true}));
  for (final item in cases.entries) {
    testWidgets('export ' + item.key, (tester) async {
      final errors = await montarPantalla(
        tester,
        item.value,
        tema: item.key.endsWith('_light') ? AppTheme.lightTheme : AppTheme.darkTheme,
        extraOverrides: [
          matchResultStatsProvider(
            presentationStory.id,
          ).overrideWith((ref) => Stream.value(MatchResultStats.empty)),
          publicMatchesStreamProvider.overrideWith(
            (ref) => Stream.value([presentationPublicMatch]),
          ),
          playerActivityProvider(
            uidYo,
          ).overrideWith((ref) async => [feedbackDePerfil]),
        ],
      );
      expect(errors, isEmpty);
      if (item.key == 'availability') {
        await tester.tap(find.text('Tu disponibilidad'));
        await tester.pump(const Duration(milliseconds: 400));
      }
      if (item.key.startsWith('explore_player')) {
        await tester.tap(find.text('Rodrigo Amarilla'));
        await tester.pump(const Duration(milliseconds: 400));
      }
      final tab = switch (item.key) {
        'league_table' => 'Tabla',
        'cup_bracket' => 'Cruces',
        'explore_matches' => 'Partidos',
        _ => null,
      };
      if (tab != null) {
        await tester.ensureVisible(find.text(tab).first);
        await tester.tap(find.text(tab).first);
        await tester.pump(const Duration(milliseconds: 350));
      }
      for (var frame = 0; frame < 3; frame++) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 140)),
        );
        await tester.pump(const Duration(milliseconds: 200));
      }
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('../build/presentation_capture/' + item.key + '.png'),
      );
    });
  }
}
