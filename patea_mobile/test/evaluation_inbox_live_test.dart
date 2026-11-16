import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:patea_mobile/core/models/evaluation_models.dart';
import 'package:patea_mobile/core/services/evaluation_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/features/evaluations/evaluations_inbox_screen.dart';
import 'goldens/arnes.dart';

class NoFirestore extends Fake implements FirebaseFirestore {}
class LiveInboxFake extends EvaluationService {
  LiveInboxFake() : super(NoFirestore());
  final changes = StreamController<void>.broadcast();
  List<EvaluationInboxItem> items = [];
  final users = <String>[];
  @override
  Stream<void> watchAssignmentChanges(String uid) { users.add(uid); return changes.stream; }
  @override
  Future<List<EvaluationInboxItem>> loadInboxItems(String uid) async => items;
}
EvaluationInboxItem pending() => EvaluationInboxItem(matchId: 'new-match',
  matchTitle: 'Partido recién terminado', matchDate: '2026-11-16', isSubmitted: false,
  assignedPlayers: [AssignedPlayerInfo(id: 'ana', name: 'Ana', photoURL: '', position: 'DEL')]);

void main() {
  setUp(() { GoogleFonts.config.allowRuntimeFetching = false; SharedPreferences.setMockInitialValues({}); });
  test('A previously empty mounted provider receives new assignments and history without invalidation', () async {
    final service = LiveInboxFake();
    final container = ProviderContainer(overrides: [evaluationServiceProvider.overrideWithValue(service)]);
    final subscription = container.listen(evaluationInboxItemsProvider('briseida'), (previous, next) {});
    addTearDown(() async { subscription.close(); container.dispose(); await service.changes.close(); });
    service.changes.add(null);
    expect(await container.read(evaluationInboxItemsProvider('briseida').future), isEmpty);
    service.items = [pending()]; service.changes.add(null);
    await Future<void>.delayed(Duration.zero);
    expect(container.read(evaluationInboxItemsProvider('briseida')).value!.single.matchId, 'new-match');
    service.items = [EvaluationInboxItem(matchId: 'new-match', matchTitle: 'Partido recién terminado', matchDate: '2026-11-16', isSubmitted: true)];
    service.changes.add(null); await Future<void>.delayed(Duration.zero);
    expect(container.read(evaluationInboxItemsProvider('briseida')).value!.single.isSubmitted, isTrue);
    expect(service.users, ['briseida']);
  });
  testWidgets('The empty screen updates while open when the finished match arrives', (tester) async {
    final updates = StreamController<List<EvaluationInboxItem>>();
    addTearDown(updates.close);
    final errors = await montarPantalla(tester, ProviderScope(overrides: [
      evaluationInboxItemsProvider(uidYo).overrideWith((ref) => updates.stream),
    ], child: const EvaluationsInboxScreen()), tema: AppTheme.darkTheme);
    expect(errors, isEmpty);
    updates.add([]); await tester.pump();
    expect(find.text('¡Todo al día!'), findsOneWidget);
    final scroll = tester.widget<SingleChildScrollView>(find.ancestor(of: find.text('¡Todo al día!'), matching: find.byType(SingleChildScrollView)).first);
    expect(scroll.physics, isA<AlwaysScrollableScrollPhysics>());
    updates.add([pending()]); await tester.pump();
    expect(find.text('Partido recién terminado'), findsOneWidget);
    expect(find.text('¡Todo al día!'), findsNothing);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });
  testWidgets('Pull to refresh works through the empty tab viewport', (tester) async {
    var reads = 0;
    final errors = await montarPantalla(tester, ProviderScope(overrides: [
      evaluationInboxItemsProvider(uidYo).overrideWith((ref) { reads++; return Stream.value([]); }),
    ], child: const EvaluationsInboxScreen()), tema: AppTheme.darkTheme);
    expect(errors, isEmpty);
    expect(reads, 1);
    await tester.drag(find.text('¡Todo al día!'), const Offset(0, 420));
    await tester.pump(); await tester.pump(const Duration(seconds: 1));
    expect(reads, greaterThan(1));
    await tester.pumpWidget(const SizedBox.shrink());
  });

}
