import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/competition_model.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/features/competitions/cup_bracket_screen.dart';

class _UnusedFirestore extends Fake implements FirebaseFirestore {}

class _CupService extends FirestoreService {
  _CupService() : super(_UnusedFirestore());

  @override
  Stream<CompetitionModel?> getSingleCompetitionStream({
    required String id,
    required String collection,
  }) => Stream.value(
    CompetitionModel(
      id: id,
      name: 'Copa',
      type: 'cup',
      status: 'in_progress',
      ownerUid: 'owner',
      bracket: [
        BracketMatchModel(
          id: 'final',
          round: 'final',
          matchNumber: 1,
          team1Id: 'a',
          team2Id: 'b',
          team1Name: 'Equipo A',
          team2Name: 'Equipo B',
        ),
      ],
    ),
  );
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });
  for (final uid in ['owner', 'spectator']) {
    testWidgets('la edición de copa respeta propietario: $uid', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUidProvider.overrideWithValue(uid),
            firestoreServiceProvider.overrideWithValue(_CupService()),
          ],
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: const CupBracketScreen(cupId: 'cup'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Equipo A'));
      await tester.pumpAndSettle();
      expect(
        find.text('CARGAR RESULTADO'),
        uid == 'owner' ? findsOneWidget : findsNothing,
      );
      expect(tester.takeException(), isNull);
    });
  }
}
