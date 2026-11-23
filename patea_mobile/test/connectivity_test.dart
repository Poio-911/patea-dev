import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/services/connectivity_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/widgets/offline_banner.dart';

void main() {
  test('se considera sin conexión recién al segundo fallo seguido', () {
    final t = ConnectionTracker();
    expect(t.online, isTrue);
    expect(t.record(reachable: false), isTrue, reason: 'un tropiezo no alcanza');
    expect(t.record(reachable: false), isFalse);
    expect(t.record(reachable: false), isFalse);
    expect(t.record(reachable: true), isTrue, reason: 'un éxito alcanza para volver');
  });

  test('un fallo suelto entre éxitos no cuenta', () {
    final t = ConnectionTracker();
    t.record(reachable: false);
    t.record(reachable: true);
    expect(t.record(reachable: false), isTrue);
  });

  test('el umbral se puede cambiar', () {
    final t = ConnectionTracker(failuresToGoOffline: 1);
    expect(t.record(reachable: false), isFalse);
  });

  Future<void> pump(WidgetTester tester, {required bool offline, required bool restored}) =>
      tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          home: Scaffold(
            body: Stack(children: [
              Positioned(
                top: 0, left: 0, right: 0,
                child: OfflineBannerView(offline: offline, restored: restored),
              ),
            ]),
          ),
        ),
      );

  testWidgets('el aviso dice cada cosa en su momento y se oculta', (tester) async {
    await pump(tester, offline: false, restored: false);
    expect(find.textContaining('Sin conexión'), findsNothing);
    expect(find.text('Conexión restaurada'), findsNothing);

    await pump(tester, offline: true, restored: false);
    await tester.pumpAndSettle();
    expect(find.textContaining('Sin conexión'), findsOneWidget);

    await pump(tester, offline: false, restored: true);
    await tester.pumpAndSettle();
    expect(find.text('Conexión restaurada'), findsOneWidget);
    expect(find.textContaining('Sin conexión'), findsNothing);

    await pump(tester, offline: false, restored: false);
    await tester.pumpAndSettle();
    expect(find.text('Conexión restaurada'), findsNothing);
  });
}
