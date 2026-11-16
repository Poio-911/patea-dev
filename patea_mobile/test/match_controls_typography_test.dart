import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'goldens/arnes.dart' show resumirErrores;
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/services/auth_service.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/services/match_clips_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/features/matches/match_detail_screen.dart';
import 'package:patea_mobile/features/matches/widgets/join_requests_section.dart';

class _Owner extends Fake implements User {
  @override
  String get uid => 'owner';
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    AppTheme.lightTheme;
    AppTheme.darkTheme;
    for (final weight in [
      FontWeight.w400,
      FontWeight.w500,
      FontWeight.w600,
      FontWeight.w700,
    ]) {
      AppTypography.headline(weight: weight);
      AppTypography.code(weight: weight);
      AppTypography.body(weight: weight);
    }
    await GoogleFonts.pendingFonts();
  });
  for (final light in [false, true]) {
    testWidgets(
      'Dirigir y Finalizar son legibles a 1.3x en tema claro=$light',
      (tester) async {
        tester.view.physicalSize = const Size(1080, 2400);
        tester.view.devicePixelRatio = 3;
        addTearDown(tester.view.reset);
        final match = MatchModel(
          id: 'controls',
          title: 'Picado del sábado',
          date: '2099-12-01',
          time: '21:00',
          type: 'manual',
          status: 'upcoming',
          ownerUid: 'owner',
          matchSize: 4,
          players: [
            MatchPlayerEntry(
              uid: 'a',
              displayName: 'María Fernández',
              ovr: 75,
              position: 'MED',
            ),
            MatchPlayerEntry(
              uid: 'b',
              displayName: 'Nicolás Rodríguez',
              ovr: 73,
              position: 'DEF',
            ),
          ],
          playerUids: ['a', 'b'],
        );
        final errors = <FlutterErrorDetails>[];
        final previous = FlutterError.onError;
        FlutterError.onError = errors.add;
        try {
          await tester.pumpWidget(
            ProviderScope(
              overrides: [
                authStateProvider.overrideWith((ref) => Stream.value(_Owner())),
                currentUidProvider.overrideWithValue('owner'),
                singleMatchStreamProvider(
                  match.id,
                ).overrideWith((ref) => Stream.value(match)),
                matchClipsProvider(
                  match.id,
                ).overrideWith((ref) => Stream.value([])),
                matchJoinRequestsProvider(
                  match.id,
                ).overrideWith((ref) => Stream.value([])),
              ],
              child: MaterialApp(
                theme: light ? AppTheme.lightTheme : AppTheme.darkTheme,
                builder: (context, child) => MediaQuery(
                  data: MediaQuery.of(context).copyWith(
                    textScaler: TextScaler.linear(1.3),
                    disableAnimations: true,
                  ),
                  child: child!,
                ),
                home: MatchDetailScreen(matchId: match.id),
              ),
            ),
          );
          await tester.pump();
        } finally {
          FlutterError.onError = previous;
        }
        expect(errors, isEmpty, reason: resumirErrores(errors));
        for (final label in ['Dirigir', 'Finalizar']) {
          final finder = find.text(label);
          expect(finder, findsOneWidget);
          final style = tester.widget<Text>(finder).style!;
          expect(style.fontFamily, contains('SpaceGrotesk'));
          expect(style.fontSize, greaterThanOrEqualTo(14));
          final button = find.ancestor(
            of: finder,
            matching: find.byType(ElevatedButton),
          );
          expect(tester.getSize(button).height, greaterThanOrEqualTo(48));
        }
        expect(tester.takeException(), isNull);
      },
    );
  }
}
