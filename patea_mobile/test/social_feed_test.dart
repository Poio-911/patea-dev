import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/social_models.dart';
import 'package:patea_mobile/core/services/social_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/features/social/social_feed_screen.dart';

import 'goldens/arnes.dart';

class _SocialFake extends Fake implements SocialService {
  final reactions = <String>{};
  final comments = <String>[];

  @override
  Future<bool> toggleReaction({
    required String activityId,
    required String reaction,
  }) async {
    if (reactions.remove(reaction)) return false;
    return reactions.add(reaction);
  }

  @override
  Future<void> addComment({
    required String activityId,
    required String text,
  }) async {
    comments.add(text);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final theme in [AppTheme.darkTheme, AppTheme.lightTheme]) {
    testWidgets('Community actions and comments work in ${theme.brightness}', (
      tester,
    ) async {
      final service = _SocialFake();
      final post = SocialPostModel(
        id: 'post',
        type: 'post',
        userId: 'author',
        playerId: 'author',
        playerName: 'Jugador de prueba',
        text: 'Nos vemos en la cancha.',
        imageUrl: 'https://example.invalid/post.jpg',
        createdAt: DateTime(2026, 1, 1),
        commentCount: 1,
        metadata: const {
          'matchId': 'match',
          'matchTitle': 'Amistoso',
          'teamAName': 'Local',
          'teamBName': 'Visita',
          'teamAScore': 2,
          'teamBScore': 1,
          'mvpName': 'Jugador de prueba',
        },
        poll: const SocialPollModel(
          question: '¿Jugamos el viernes?',
          votes: {},
          options: [SocialPollOption(id: 'yes', text: 'Sí')],
        ),
      );
      final errors = await montarPantalla(
        tester,
        const SocialFeedScreen(),
        tema: theme,
        escala: 1.5,
        extraOverrides: [
          socialServiceProvider.overrideWithValue(service),
          groupSocialFeedStreamProvider.overrideWith(
            (ref) => Stream.value([post]),
          ),
          communitySocialFeedStreamProvider.overrideWith(
            (ref) => Stream.value([]),
          ),
          followingUidsStreamProvider.overrideWith((ref) => Stream.value({})),
          socialCommentsStreamProvider(post.id).overrideWith(
            (ref) => Stream.value([
              SocialCommentModel(
                id: 'comment',
                activityId: post.id,
                userId: 'author',
                userName: 'Nombre de jugador bastante largo',
                text: '¡Buen partido!',
                createdAt: post.createdAt,
              ),
            ]),
          ),
        ],
      );
      expect(errors, isEmpty);
      expect(find.text('0%'), findsNothing);

      final photo = find.byWidgetPredicate(
        (widget) => widget is GestureDetector && widget.onDoubleTap != null,
      );
      await tester.ensureVisible(photo);
      await tester.pump();
      for (var attempt = 0; attempt < 2; attempt++) {
        await tester.tap(photo);
        await tester.pump(const Duration(milliseconds: 50));
        await tester.tap(photo);
        await tester.pump(const Duration(milliseconds: 350));
        expect(service.reactions, {'🔥'});
      }

      final fire = find.byTooltip('Quitar reacción Fuego');
      await tester.ensureVisible(fire);
      await tester.pump();
      expect(find.text('🔥 1'), findsOneWidget);
      await tester.tap(fire);
      await tester.pump();
      expect(service.reactions, isEmpty);

      await tester.longPress(find.byTooltip('Reaccionar con Fuego'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(MenuItemButton, '👏  Aplausos'));
      await tester.pumpAndSettle();
      expect(service.reactions, {'👏'});

      final comments = find.text('Ver 1 comentario');
      await tester.ensureVisible(comments);
      await tester.pump();
      await tester.tap(comments);
      await tester.pumpAndSettle();
      expect(find.text('¡Buen partido!'), findsOneWidget);
      final send = find.byTooltip('Enviar comentario');
      expect(send, findsNothing);
      await tester.enterText(find.byType(TextField), 'Nos vemos el viernes.');
      tester.view.viewInsets = const FakeViewPadding(bottom: 900);
      await tester.pumpAndSettle();
      expect(send.hitTestable(), findsOneWidget);
      await tester.tap(send);
      await tester.pumpAndSettle();
      expect(service.comments, ['Nos vemos el viernes.']);
      expect(tester.takeException(), isNull);
    });
  }
}
