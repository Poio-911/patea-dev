import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/services/notifications_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';

void main() {
  group('NotificationsService.normalizeLink', () {
    test('permite rutas internas válidas y rechaza externas', () {
      expect(NotificationsService.normalizeLink('/matches/abc123'), '/matches/abc123');
      expect(NotificationsService.normalizeLink('/achievements'), '/achievements');
      expect(NotificationsService.normalizeLink(' /evaluations/m-1 '), '/evaluations/m-1');
      expect(NotificationsService.normalizeLink('/players/u1'), '/players/u1');
      expect(NotificationsService.normalizeLink('/'), '/');

      expect(NotificationsService.normalizeLink(null), isNull);
      expect(NotificationsService.normalizeLink(''), isNull);
      expect(NotificationsService.normalizeLink('https://evil.com/matches/1'), isNull);
      expect(NotificationsService.normalizeLink('//evil.com/matches/1'), isNull);
      expect(NotificationsService.normalizeLink('/unknown/route'), isNull);
    });
  });

  group('NotificationsService foreground banner', () {
    testWidgets('muestra banner interactivo en primer plano en Android', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          scaffoldMessengerKey: NotificationsService.messengerKey,
          home: const Scaffold(body: SizedBox()),
        ),
      );

      NotificationsService.handleForegroundMessage(
        RemoteMessage.fromMap(const {
          'notification': {
            'title': '⚽ ¡Te convocaron!',
            'body': 'Te sumaron al partido "Clásico"',
          },
          'data': {
            'type': 'match_invite',
            'link': '/matches/match-42',
          },
        }),
        platformOverride: TargetPlatform.android,
      );
      await tester.pump();

      expect(find.text('⚽ ¡Te convocaron!'), findsOneWidget);
      expect(find.text('Te sumaron al partido "Clásico"'), findsOneWidget);
      expect(find.text('Ver'), findsOneWidget);
    });

    testWidgets('no duplica banner Flutter en iOS si ya trae notificación nativa', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          scaffoldMessengerKey: NotificationsService.messengerKey,
          home: const Scaffold(body: SizedBox()),
        ),
      );

      NotificationsService.handleForegroundMessage(
        RemoteMessage.fromMap(const {
          'notification': {
            'title': '⏰ Recordatorio',
            'body': 'Tu partido empieza en ~2hs',
          },
          'data': {
            'type': 'match_reminder',
            'link': '/matches/match-42',
          },
        }),
        platformOverride: TargetPlatform.iOS,
      );
      await tester.pump();

      expect(find.text('⏰ Recordatorio'), findsNothing);
    });
  });
}
