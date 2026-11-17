import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:patea_mobile/features/competitions/competitions_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:patea_mobile/core/services/profile_service.dart';
import 'package:patea_mobile/core/services/tournament_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/features/competitions/competition_management.dart';
import 'package:patea_mobile/features/players/edit_profile_screen.dart';
import 'goldens/arnes.dart';

class ProfileFake extends Fake implements ProfileService {
  int sends = 0;
  String? name;
  String? position;
  @override
  Future<void> updateProfile({
    String? displayName,
    String? photoUrl,
    String? position,
    String? preferredFoot,
    String? bio,
    int? birthYear,
    String? nationality,
    String? phoneNumber,
    bool clearPreferredFoot = false,
    bool clearBirthYear = false,
  }) async {
    sends++;
    name = displayName;
    this.position = position;
  }
}

class TournamentFake extends Fake implements TournamentService {
  int sends = 0;
  List<String>? ids;
  @override
  Future<String> createCompetition({
    required bool isCup,
    required String name,
    required String groupId,
    required List<String> teamIds,
    bool homeAndAway = false,
  }) async {
    sends++;
    ids = teamIds;
    throw StateError('Error de prueba recuperable');
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;
  setUp(() => SharedPreferences.setMockInitialValues({}));
  for (final claro in [false, true]) {
    testWidgets(
      'perfil a 320px y texto 130%, guardar permanece visible ($claro)',
      (tester) async {
        final fake = ProfileFake();
        final errors = await montarPantalla(
          tester,
          const EditProfileScreen(playerId: uidYo),
          tema: claro ? AppTheme.lightTheme : AppTheme.darkTheme,
          tamano: const Size(960, 2400),
          escala: 1.3,
          extraOverrides: [profileServiceProvider.overrideWithValue(fake)],
        );
        expect(errors, isEmpty);
        expect(find.text('Tu identidad en la cancha'), findsOneWidget);
        expect(find.text('Guardar cambios').hitTestable(), findsOneWidget);
        final field = find.byType(TextField).first;
        await tester.ensureVisible(field);
        await tester.enterText(field, 'Nombre actualizado');
        tester.testTextInput.hide();
        await tester.pump();
        await tester.tap(find.text('Guardar cambios'));
        await tester.pump(const Duration(milliseconds: 350));
        expect(fake.sends, 1);
        expect(fake.name, 'Nombre actualizado');
        expect(tester.takeException(), isNull);
      },
    );
    testWidgets('creación muestra selección y error recuperable ($claro)', (
      tester,
    ) async {
      final fake = TournamentFake();
      final errors = await montarPantalla(
        tester,
        const CreateCompetitionScreen(isCup: true, groupId: idGrupo),
        tema: claro ? AppTheme.lightTheme : AppTheme.darkTheme,
        tamano: const Size(960, 2400),
        escala: 1.3,
        extraOverrides: [tournamentServiceProvider.overrideWithValue(fake)],
      );
      expect(errors, isEmpty);
      await tester.enterText(find.byType(TextField), 'Copa del barrio');
      tester.testTextInput.hide();
      final checks = find.byType(Checkbox);
      await tester.ensureVisible(checks.first);
      await tester.tap(checks.first);
      await tester.pump();
      await tester.tap(find.widgetWithText(FilledButton, 'Crear copa'));
      await tester.pump(const Duration(milliseconds: 350));
      expect(fake.sends, 1);
      expect(fake.ids!.length, 1);
      await tester.ensureVisible(find.text('Error de prueba recuperable'));
      expect(find.text('Error de prueba recuperable'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('crear torneo queda por encima de la navegación del shell', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ...overridesDelArnes(),
          activeGroupIdProvider.overrideWithValue(
            const AsyncValue.data(idGrupo),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.darkTheme,
          home: const Scaffold(
            extendBody: true,
            body: CompetitionsScreen(),
            bottomNavigationBar: SizedBox(
              height: 80,
              child: Text('Navegación de prueba'),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    final button = tester.getRect(find.byType(FloatingActionButton));
    final navigation = tester.getRect(find.text('Navegación de prueba'));
    expect(button.bottom, lessThanOrEqualTo(navigation.top));
    await tester.tap(find.text('Crear liga'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
    expect(find.byType(CreateCompetitionScreen), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
