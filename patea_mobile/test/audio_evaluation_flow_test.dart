import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/evaluation_models.dart';
import 'package:patea_mobile/core/models/player_activity_models.dart';
import 'package:patea_mobile/core/models/player_model.dart';
import 'package:patea_mobile/core/services/evaluation_service.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/services/player_profile_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/features/evaluations/evaluation_form_screen.dart';
import 'package:patea_mobile/features/evaluations/widgets/evaluation_audio_player.dart';
import 'package:patea_mobile/features/players/widgets/player_match_debrief.dart';
import 'goldens/arnes.dart';

class _FakeEvaluationService extends Fake implements EvaluationService {
  final List<String> requestedRevealIds = [];

  @override
  Future<bool> hasSubmittedFor(String matchId, String evaluatorId) async => false;

  @override
  Future<List<EvaluationAssignmentModel>> getPendingAssignmentsForMatch(
    String matchId,
    String evaluatorId,
  ) async => [
    EvaluationAssignmentModel(
      id: 'assign-1',
      matchId: matchId,
      evaluatorId: evaluatorId,
      subjectId: jugadores.first.id,
      status: 'pending',
    ),
  ];

  @override
  Future<List<PlayerModel>> getPlayersByIds(List<String> ids) async =>
      jugadores.where((p) => ids.contains(p.id)).toList();

  @override
  Future<void> requestIdentityReveal(String evaluationId) async {
    requestedRevealIds.add(evaluationId);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  test('PlayerEvaluationDraft y PeerEvaluation serializan y parsean reseñas por audio', () {
    final draft = PlayerEvaluationDraft(
      assignmentId: 'a1',
      subjectId: 'p1',
      displayName: 'Facundo',
      photoURL: '',
      position: 'DEL',
      tagPool: const [],
      evaluationType: 'text',
      reviewMode: 'audio',
      uploadedAudioPath: 'evaluation-audios/m1/u1/a1.m4a',
      audioDurationSec: 22,
    );
    final map = draft.toSubmissionMap();
    expect(map['evaluationType'], 'text');
    expect(map['audioPath'], 'evaluation-audios/m1/u1/a1.m4a');
    expect(map['audioDurationSec'], 22);
    expect(map.containsKey('textDescription'), isFalse);

    final anonAudioEval = PeerEvaluation.fromMap({
      'id': 'ev-anon',
      'evaluatorId': 'anonymous',
      'isAnonymous': true,
      'hasAudio': true,
      'audioDurationSec': 22,
      'aiSummary': 'Gran partido por banda.',
    });
    expect(anonAudioEval.type, EvalType.text);
    expect(anonAudioEval.hasAudio, isTrue);
    expect(anonAudioEval.audioDurationSec, 22);
    expect(anonAudioEval.textDescription, isNull);
  });

  testWidgets(
    'PlayerMatchDebrief protege audio anónimo, permite pedir revelación y desbloquea audio + Ver texto al revelarse',
    (tester) async {
      final fakeService = _FakeEvaluationService();
      final feedback = [
        MatchFeedback(
          matchId: 'm1',
          title: 'Amistoso del jueves',
          date: '2026-11-18T21:00:00Z',
          peerEvaluations: const [
            PeerEvaluation(
              id: 'ev-anon',
              evaluatorId: 'anonymous',
              isAnonymous: true,
              hasAudio: true,
              audioDurationSec: 22,
              aiSummary: 'Muy firme en la marca y salió jugando limpio.',
            ),
            PeerEvaluation(
              id: 'ev-revealed',
              evaluatorId: 'u-lucas',
              evaluatorDisplayName: 'Lucas',
              identityRevealed: true,
              hasAudio: true,
              audioDurationSec: 17,
              aiSummary: 'Gran precisión en los pases filtrados.',
              textDescription: 'La rompiste hoy, metiste dos pases gol tremendos.',
            ),
          ],
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUidProvider.overrideWithValue('me-1'),
            evaluationServiceProvider.overrideWithValue(fakeService),
            playerActivityProvider('me-1').overrideWith((_) async => feedback),
          ],
          child: MaterialApp(
            theme: AppTheme.darkTheme,
            home: const Scaffold(
              body: SingleChildScrollView(
                padding: EdgeInsets.all(16),
                child: PlayerMatchDebrief(playerId: 'me-1', compact: false),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Anónima: muestra aviso de audio protegido y botón de solicitud
      expect(
        find.text('Nota de voz (0:22) protegida por anonimato'),
        findsOneWidget,
      );
      expect(
        find.text('Pedir saber quién fue y escuchar audio'),
        findsOneWidget,
      );

      // Revelada: muestra reproductor inline + botón Ver texto (transcripción oculta inicialmente)
      expect(find.byType(EvaluationAudioPlayer), findsOneWidget);
      expect(find.text('Lucas'), findsOneWidget);
      expect(find.text('Ver texto'), findsOneWidget);
      expect(
        find.textContaining('metiste dos pases gol tremendos'),
        findsNothing,
      );

      // Tocar Ver texto despliega la transcripción
      await tester.ensureVisible(find.text('Ver texto'));
      await tester.tap(find.text('Ver texto'));
      await tester.pumpAndSettle();
      expect(
        find.text('«La rompiste hoy, metiste dos pases gol tremendos.»'),
        findsOneWidget,
      );
      expect(find.text('Ocultar texto'), findsOneWidget);

      // Pedir revelar identidad dispara el servicio
      final revealBtn = find.text('Pedir saber quién fue y escuchar audio');
      await tester.ensureVisible(revealBtn);
      await tester.tap(revealBtn);
      await tester.pumpAndSettle();
      expect(fakeService.requestedRevealIds, ['ev-anon']);
    },
  );

  for (final theme in [AppTheme.darkTheme, AppTheme.lightTheme]) {
    testWidgets(
      'EvaluationFormScreen permite elegir Escribir o Audio en Reseña sin desbordar a 1.3x ${theme.brightness}',
      (tester) async {
        final fakeService = _FakeEvaluationService();
        final errors = await montarPantalla(
          tester,
          ProviderScope(
            overrides: [
              evaluationServiceProvider.overrideWithValue(fakeService),
            ],
            child: const EvaluationFormScreen(matchId: idPartido),
          ),
          tema: theme,
          escala: 1.3,
          tamano: const Size(960, 2400),
        );
        expect(errors, isEmpty);

        final resenaTab = find.text('Reseña');
        await tester.scrollUntilVisible(
          resenaTab,
          250,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.drag(find.byType(ListView), const Offset(0, -280));
        await tester.pumpAndSettle();
        await tester.tap(resenaTab);
        await tester.pumpAndSettle();

        expect(find.text('Escribir'), findsOneWidget);
        expect(find.text('Audio'), findsOneWidget);

        await tester.ensureVisible(find.text('Audio'));
        await tester.tap(find.text('Audio'));
        await tester.pumpAndSettle();

        expect(find.text('Grabar nota de voz'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
