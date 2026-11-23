import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:patea_mobile/features/competitions/competitions_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:patea_mobile/core/services/profile_service.dart';
import 'package:patea_mobile/core/services/competition_service.dart';
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

class TournamentFake extends CompetitionServiceFake {
  int sends = 0;
  List<String>? ids;
  Map<String, dynamic>? payload;
  @override
  Future<String> create({
    required String collection,
    required String requestId,
    required Map<String, dynamic> data,
  }) async {
    sends++;
    ids = List<String>.from(data['teams']);
    payload = data;
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
        extraOverrides: [competitionServiceProvider.overrideWithValue(fake)],
      );
      expect(errors, isEmpty);
      await tester.enterText(find.byType(TextField).first, 'Copa del barrio');
      tester.testTextInput.hide();
      await tester.tap(find.text('Continuar'));
      await tester.pump();
      final checks = find.byType(CheckboxListTile);
      for (var i = 0; i < 2; i++) {
        await tester.ensureVisible(checks.at(i));
        await tester.tap(checks.at(i));
        await tester.pump();
      }
      await tester.tap(find.text('Continuar'));
      await tester.pump();
      await tester.tap(find.text('Guardar torneo'));
      await tester.pump(const Duration(milliseconds: 350));
      expect(fake.sends, 1);
      expect(fake.ids!.length, 2);
      await tester.ensureVisible(find.text('Error de prueba recuperable'));
      expect(find.text('Error de prueba recuperable'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('copa solo ofrece los cupos que admite el sorteo', (
    tester,
  ) async {
    final errors = await montarPantalla(
      tester,
      const CreateCompetitionScreen(isCup: true, groupId: idGrupo),
      tema: AppTheme.darkTheme,
      extraOverrides: [
        competitionServiceProvider.overrideWithValue(TournamentFake()),
      ],
    );
    expect(errors, isEmpty);
    final capacity = find.byType(DropdownButtonFormField<int>);
    await tester.ensureVisible(capacity);
    await tester.pump();
    await tester.tap(capacity);
    await tester.pumpAndSettle();
    expect(find.text('6 equipos'), findsNothing);
    expect(find.text('8 equipos').hitTestable(), findsOneWidget);
    await tester.tap(find.text('8 equipos').hitTestable());
    await tester.pumpAndSettle();
    expect(find.text('8 equipos'), findsOneWidget);
  });

  testWidgets('liga elige formato primero y guarda sin fecha', (tester) async {
    final fake = TournamentFake();
    final errors = await montarPantalla(
      tester,
      const CreateCompetitionScreen(isCup: false, groupId: idGrupo),
      tema: AppTheme.darkTheme,
      extraOverrides: [competitionServiceProvider.overrideWithValue(fake)],
    );
    expect(errors, isEmpty);
    expect(find.text('Logo de la liga (opcional)'), findsOneWidget);
    expect(find.text('Una vuelta'), findsOneWidget);
    expect(find.text('Abrir inscripciones'), findsNothing);
    await tester.enterText(find.byType(TextField).first, 'Liga del barrio');
    tester.testTextInput.hide();
    await tester.tap(find.text('Ida y vuelta'));
    await tester.pump();
    await tester.tap(find.text('Continuar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Abrir inscripciones'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continuar'));
    await tester.pumpAndSettle();

    expect(find.text('Inicio por definir'), findsOneWidget);
    expect(find.text('Ida y vuelta'), findsNothing);
    final rules = find.text('Reglas de puntuación');
    await tester.scrollUntilVisible(
      rules,
      150,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Victoria'), findsNothing);
    await tester.tap(rules);
    await tester.pumpAndSettle();
    expect(find.text('Victoria'), findsOneWidget);
    await tester.tap(find.text('Abrir inscripciones'));
    await tester.pumpAndSettle();
    expect(fake.payload?['format'], 'double_round_robin');
    expect(fake.payload?['isPublic'], true);
    expect(fake.payload?['startDate'], '');
    expect(fake.payload?['rules'], {'pointsForWin': 3, 'pointsForDraw': 1});
  });

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
    final button = tester.getRect(find.text('Crear liga'));
    final navigation = tester.getRect(find.text('Navegación de prueba'));
    expect(button.bottom, lessThanOrEqualTo(navigation.top));
    expect(find.byType(FloatingActionButton), findsNothing);
    await tester.tap(find.text('Crear liga'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
    expect(find.byType(CreateCompetitionScreen), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
