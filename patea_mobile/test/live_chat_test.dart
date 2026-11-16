import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/services/match_chat_service.dart';
import 'package:patea_mobile/core/services/match_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/features/matches/live_match_screen.dart';
import 'package:patea_mobile/features/matches/match_chat_screen.dart';
import 'package:patea_mobile/features/matches/widgets/live_pitch_view.dart';
import 'package:patea_mobile/features/matches/widgets/event_logger_sheet.dart';
import 'goldens/arnes.dart';

class ChatFake extends Fake implements MatchChatService {
  final ids = <String>[];
  final names = <String>[];
  final texts = <String>[];
  final requests = <Completer<void>>[];
  int generated = 0;
  @override
  String newMessageId(String matchId) => 'message-${++generated}';
  @override
  Future<void> send({
    required String matchId,
    required String messageId,
    required String text,
    required String senderId,
    required String senderName,
    required String senderPhotoUrl,
  }) {
    ids.add(messageId);
    names.add(senderName);
    texts.add(text);
    final request = Completer<void>();
    requests.add(request);
    return request.future;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets(
    'Chat failure preserves draft; retry reuses message id; duplicate taps are blocked',
    (tester) async {
      final fake = ChatFake();
      final errors = await montarPantalla(
        tester,
        ProviderScope(
          overrides: [matchChatServiceProvider.overrideWithValue(fake)],
          child: MatchChatScreen(match: partidos.first),
        ),
        tema: AppTheme.lightTheme,
      );
      expect(errors, isEmpty);
      await tester.enterText(find.byType(TextField), '  Voy con pelota  ');
      await tester.pump();
      await tester.tap(find.byTooltip('Enviar mensaje'));
      await tester.pump();
      expect(fake.requests.length, 1);
      final send = tester.widget<IconButton>(
        find.byWidgetPredicate(
          (w) => w is IconButton && w.tooltip == 'Enviar mensaje',
        ),
      );
      expect(send.onPressed, isNull);
      fake.requests.first.completeError(StateError('network'));
      await tester.pump();
      expect(
        find.text('No se pudo enviar. Tu mensaje sigue acá.'),
        findsOneWidget,
      );
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        '  Voy con pelota  ',
      );
      await tester.tap(find.text('Reintentar'));
      await tester.pump();
      expect(fake.ids, ['message-1', 'message-1']);
      expect(fake.names, [jugadores.first.name, jugadores.first.name]);
      expect(fake.texts, ['Voy con pelota', 'Voy con pelota']);
      fake.requests.last.complete();
      await tester.pump();
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        isEmpty,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Closing chat during an in-flight send does not access a disposed controller',
    (tester) async {
      final fake = ChatFake();
      await montarPantalla(
        tester,
        ProviderScope(
          overrides: [matchChatServiceProvider.overrideWithValue(fake)],
          child: MatchChatScreen(match: partidos.first),
        ),
        tema: AppTheme.darkTheme,
      );
      await tester.enterText(find.byType(TextField), 'Hola');
      await tester.pump();
      await tester.tap(find.byTooltip('Enviar mensaje'));
      await tester.pump();
      await tester.pumpWidget(const SizedBox.shrink());
      fake.requests.single.complete();
      await tester.pump();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Spectators see the access explanation without opening a private message listener',
    (tester) async {
      var watched = false;
      final match = MatchModel(
        id: idPartido,
        title: 'Partido privado',
        date: '2026-09-12',
        time: '21:00',
        type: 'manual',
        status: 'upcoming',
        matchSize: 10,
        ownerUid: 'someone-else',
      );
      final errors = await montarPantalla(
        tester,
        ProviderScope(
          overrides: [
            singleMatchStreamProvider(
              idPartido,
            ).overrideWith((ref) => Stream.value(match)),
            matchChatMessagesProvider((
              matchId: idPartido,
              limit: 60,
            )).overrideWith((ref) {
              watched = true;
              return Stream.value(const []);
            }),
          ],
          child: MatchChatScreen(match: match),
        ),
        tema: AppTheme.lightTheme,
      );
      expect(errors, isEmpty);
      expect(watched, isFalse);
      expect(find.byType(TextField), findsNothing);
      expect(
        find.text(
          'El chat es para los participantes y el organizador del partido.',
        ),
        findsOneWidget,
      );
    },
  );

  for (final reduceMotion in [false, true]) {
    testWidgets(
      'New messages preserve reading position (reduced motion: $reduceMotion)',
      (tester) async {
        final stream = StreamController<List<MatchChatMessage>>.broadcast();
        addTearDown(stream.close);
        await montarPantalla(
          tester,
          ProviderScope(
            overrides: [
              matchChatMessagesProvider((
                matchId: idPartido,
                limit: 60,
              )).overrideWith((ref) => stream.stream),
            ],
            child: Builder(
              builder: (context) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(disableAnimations: reduceMotion),
                child: MatchChatScreen(match: partidos.first),
              ),
            ),
          ),
          tema: AppTheme.lightTheme,
        );
        final items = List.generate(
          30,
          (i) => MatchChatMessage(
            id: 'm$i',
            text:
                'Mensaje largo del equipo para probar la conversación y su desplazamiento $i',
            senderId: 'other',
            senderName: 'Mateo',
            createdAt: DateTime(2026, 9, 12, 20, 30 - i),
          ),
        );
        stream.add(items);
        await tester.pump();
        await tester.pump();
        final list = tester.widget<ListView>(
          find.byKey(const ValueKey('match-chat-messages')),
        );
        list.controller!.jumpTo(300);
        await tester.pump();
        stream.add([
          const MatchChatMessage(
            id: 'new',
            text: 'Llegué',
            senderId: 'other',
            senderName: 'Mateo',
          ),
          ...items,
        ]);
        await tester.pump();
        await tester.pump();
        expect(list.controller!.offset, 300);
        expect(find.text('Mensajes nuevos'), findsOneWidget);
        await tester.tap(find.text('Mensajes nuevos'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 220));
        expect(list.controller!.offset, 0);
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }

  testWidgets('Live controls remain visible when the pitch scrolls', (
    tester,
  ) async {
    addTearDown(() => tester.pumpWidget(const SizedBox.shrink()));
    final errors = await montarPantalla(
      tester,
      LiveMatchScreen(matchId: partidoDirigir.id),
      tema: AppTheme.lightTheme,
      escala: 1.3,
    );
    expect(errors, isEmpty);
    final before = tester.getRect(find.text('Gol'));
    await tester.drag(find.byType(ListView).first, const Offset(0, -650));
    await tester.pump();
    expect(tester.getRect(find.text('Gol')), before);
    expect(find.text('Pausar').hitTestable(), findsOneWidget);
    expect(find.byTooltip('Más eventos').hitTestable(), findsOneWidget);
  });

  testWidgets(
    'Player preview opens a goal form with that player already selected',
    (tester) async {
      addTearDown(() => tester.pumpWidget(const SizedBox.shrink()));
      await montarPantalla(
        tester,
        LiveMatchScreen(matchId: partidoDirigir.id),
        tema: AppTheme.darkTheme,
      );
      final target = find.byKey(ValueKey('pitch-player-$uidYo'));
      await tester.ensureVisible(target);
      await tester.pump();
      await tester.tap(target);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 350));
      await tester.tap(find.text('Registrar gol').hitTestable());
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 350));
      final form = tester.widget<EventLoggerSheet>(
        find.byType(EventLoggerSheet),
      );
      expect(form.initialPlayer!.uid, uidYo);
      expect(form.currentMinute, 12);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Pitch cards exclude own goals and keep dense rosters readable', (
    tester,
  ) async {
    final roster = List.generate(
      7,
      (i) => MatchPlayerEntry(
        uid: 'p$i',
        displayName: 'Jugador Apellido Largo $i',
        position: 'MED',
        ovr: 70 + i,
      ),
    );
    final match = MatchModel(
      id: 'dense',
      title: 'Dense',
      date: '2026-09-12',
      time: '21:00',
      type: 'manual',
      status: 'active',
      matchSize: 14,
      players: roster,
      teamA: MatchTeam(name: 'Equipo A', players: roster),
      teamB: MatchTeam(name: 'Equipo B', players: []),
      events: [
        MatchEvent(
          type: 'goal',
          playerId: 'p0',
          playerName: 'Jugador 0',
          minute: 1,
        ),
        MatchEvent(
          type: 'goal',
          playerId: 'p0',
          playerName: 'Jugador 0',
          minute: 2,
          goalType: 'own_goal',
        ),
      ],
    );
    final errors = await montarPantalla(
      tester,
      Scaffold(
        body: SingleChildScrollView(child: LivePitchView(match: match)),
      ),
      tema: AppTheme.lightTheme,
      escala: 1.3,
    );
    expect(errors, isEmpty);
    expect(find.text('⚽ 1'), findsOneWidget);
    expect(find.text('⚽ 2'), findsNothing);
    expect(find.byKey(const ValueKey('pitch-player-p6')), findsOneWidget);
  });
  testWidgets('The selected team B player records a goal for team B only', (
    tester,
  ) async {
    addTearDown(() => tester.pumpWidget(const SizedBox.shrink()));
    final fake = EventFake();
    final player = partidoDirigir.teamB!.players.first;
    await montarPantalla(
      tester,
      LiveMatchScreen(matchId: partidoDirigir.id),
      tema: AppTheme.lightTheme,
      extraOverrides: [matchServiceProvider.overrideWithValue(fake)],
    );
    final target = find.byKey(ValueKey('pitch-player-${player.uid}'));
    await tester.ensureVisible(target);
    await tester.pump();
    await tester.tap(target);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
    await tester.tap(find.text('Registrar gol').hitTestable());
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
    await tester.ensureVisible(find.text('Guardar'));
    await tester.pump();
    await tester.tap(find.text('Guardar'));
    await tester.pump();
    expect(fake.event!.playerId, player.uid);
    expect(fake.event!.teamId, kTeamBId);
    expect(fake.event!.minute, 12);
    expect(fake.a, partidoDirigir.teamA!.score);
    expect(fake.b, partidoDirigir.teamB!.score + 1);
  });

  testWidgets(
    'Chat read errors show recovery and the composer fits above a keyboard',
    (tester) async {
      final errors = await montarPantalla(
        tester,
        ProviderScope(
          overrides: [
            matchChatMessagesProvider((
              matchId: idPartido,
              limit: 60,
            )).overrideWith((ref) => Stream.error(StateError('offline'))),
          ],
          child: Builder(
            builder: (context) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(viewInsets: const EdgeInsets.only(bottom: 250)),
              child: MatchChatScreen(match: partidos.first),
            ),
          ),
        ),
        tema: AppTheme.lightTheme,
        escala: 1.3,
        tamano: const Size(1080, 2040),
      );
      expect(errors, isEmpty);
      expect(find.text('No pudimos cargar la conversación.'), findsOneWidget);
      expect(find.text('Reintentar').hitTestable(), findsOneWidget);
      expect(find.byType(TextField).hitTestable(), findsOneWidget);
      final composer = tester.getRect(find.byType(TextField));
      expect(composer.bottom, lessThan(430));
    },
  );
  testWidgets('The pitch is the main surface and all ten players fit above the control dock', (tester) async {
    addTearDown(() => tester.pumpWidget(const SizedBox.shrink()));
    final roster = List.generate(10, (i) => MatchPlayerEntry(
      uid: 'player-$i', displayName: 'Jugador $i', ovr: 60 + i,
      position: ['POR', 'DEF', 'MED', 'DEL', 'DEL'][i % 5]));
    final match = MatchModel(id: partidoDirigir.id, title: 'Cancha protagonista',
      date: '2026-11-16', time: '21:00', type: 'manual', status: 'active',
      matchSize: 10, ownerUid: uidYo, liveStatus: 'first_half', currentMinute: 12,
      players: roster,
      teamA: MatchTeam(name: 'Con chaleco', players: roster.take(5).toList()),
      teamB: MatchTeam(name: 'Sin chaleco', players: roster.skip(5).toList()));
    final errors = await montarPantalla(tester, ProviderScope(overrides: [
      singleMatchStreamProvider(match.id).overrideWith((ref) => Stream.value(match)),
    ], child: LiveMatchScreen(matchId: match.id)), tema: AppTheme.darkTheme);
    expect(errors, isEmpty);
    expect(tester.getSize(find.byType(LivePitchView)).height, greaterThan(400));
    final dock = tester.getRect(find.byKey(const ValueKey('live-control-dock')));
    for (final player in roster) {
      final item = find.byKey(ValueKey('pitch-player-${player.uid}'));
      expect(item.hitTestable(), findsOneWidget, reason: player.uid);
      expect(tester.getRect(item).bottom, lessThanOrEqualTo(dock.top));
    }
    expect(find.text('12:00'), findsOneWidget);
  });

}

class EventFake extends MatchService {
  MatchEvent? event;
  int? a, b;
  @override
  Future<void> recordLiveEvent({
    required String matchId,
    required MatchEvent event,
    int? teamAScore,
    int? teamBScore,
  }) async {
    this.event = event;
    a = teamAScore;
    b = teamBScore;
  }
}
