import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:patea_mobile/core/models/group_model.dart';
import 'package:patea_mobile/core/services/group_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/widgets/patea_card.dart';
import 'package:patea_mobile/features/groups/create_team_screen.dart';
import 'package:patea_mobile/features/groups/groups_screen.dart';
import 'package:patea_mobile/features/groups/team_detail_screen.dart';
import 'package:patea_mobile/features/groups/jersey_designer.dart';
import 'package:patea_mobile/features/groups/widgets/manage_roster_sheet.dart';
import 'goldens/arnes.dart';

class CreateTeamFake extends Fake implements GroupService {
  int sends = 0;
  String? name;
  List<Map<String, dynamic>>? members;
  final response = Completer<String>();
  @override
  Future<String> createTeam({
    required String groupId,
    required String name,
    required Map<String, dynamic> jersey,
    required List<Map<String, dynamic>> members,
  }) {
    sends++;
    this.name = name;
    this.members = members;
    return response.future;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;
  setUp(() => SharedPreferences.setMockInitialValues({}));
  Future<void> tap(WidgetTester tester, Finder target) async {
    await tester.ensureVisible(target);
    await tester.pump();
    await tester.tap(target);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
  }

  testWidgets(
    'Jersey selection has the intended border and colors preserve the other channel',
    (tester) async {
      var jersey = JerseyModel(
        primaryColor: '#2563EB',
        secondaryColor: '#FFFFFF',
      );
      final errors = await montarPantalla(
        tester,
        Scaffold(
          body: SingleChildScrollView(
            child: StatefulBuilder(
              builder: (context, setState) => Padding(
                padding: const EdgeInsets.all(18),
                child: JerseyDesigner(
                  value: jersey,
                  onChanged: (value) => setState(() => jersey = value),
                ),
              ),
            ),
          ),
        ),
        tema: AppTheme.darkTheme,
      );
      expect(errors, isEmpty);
      final first = find.byWidgetPredicate(
        (w) => w is Semantics && w.properties.label == 'Diseño de camiseta 1',
      );
      final card = tester.widget<PateaCard>(
        find.descendant(of: first, matching: find.byType(PateaCard)),
      );
      expect(card.borderWidth, 2);
      expect(card.width, isNull);
      await tap(
        tester,
        find.byWidgetPredicate(
          (w) => w is Semantics && w.properties.label == 'Diseño de camiseta 2',
        ),
      );
      expect(jersey.pattern, 'vertical');
      await tap(tester, find.text('2. Colores'));
      await tap(tester, find.text('Secundario'));
      await tap(tester, find.byTooltip('Rojo'));
      expect(jersey.primaryColor, '#2563EB');
      expect(jersey.secondaryColor, '#DC2626');
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'Creation preserves selection across steps and submits the same membership contract once',
    (tester) async {
      final service = CreateTeamFake();
      final errors = await montarPantalla(
        tester,
        ProviderScope(
          overrides: [groupServiceProvider.overrideWithValue(service)],
          child: const CreateTeamScreen(groupId: idGrupo),
        ),
        tema: AppTheme.lightTheme,
      );
      expect(errors, isEmpty);
      await tester.enterText(find.byType(TextField), '  Equipo del barrio  ');
      await tester.pump();
      await tap(tester, find.text('Elegir jugadores'));
      await tap(tester, find.byType(CheckboxListTile).first);
      await tap(tester, find.text('Atrás'));
      await tap(tester, find.text('Elegir jugadores'));
      expect(
        tester
            .widget<CheckboxListTile>(find.byType(CheckboxListTile).first)
            .value,
        isTrue,
      );
      await tap(tester, find.widgetWithText(ElevatedButton, 'Crear equipo'));
      expect(service.sends, 1);
      expect(service.name, 'Equipo del barrio');
      expect(service.members, [
        {'playerId': jugadores.first.id, 'number': 1, 'status': 'titular'},
      ]);
      await tester.pumpWidget(const SizedBox.shrink());
      service.response.complete('new-team');
      await tester.pump();
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'Roster controls preserve substitutes and numbers when returned',
    (tester) async {
      List<Map<String, dynamic>>? result;
      final errors = await montarPantalla(
        tester,
        Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () async {
                result = await showModalBottomSheet<List<Map<String, dynamic>>>(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => ManageRosterSheet(
                    teamName: 'Equipo del barrio',
                    groupPlayers: jugadores.take(3).toList(),
                    current: [
                      TeamMemberEntry(
                        playerId: jugadores[0].id,
                        number: 5,
                        status: 'titular',
                      ),
                      TeamMemberEntry(
                        playerId: jugadores[1].id,
                        number: 6,
                        status: 'suplente',
                      ),
                    ],
                  ),
                );
              },
              child: const Text('Abrir plantel'),
            ),
          ),
        ),
        tema: AppTheme.darkTheme,
      );
      expect(errors, isEmpty);
      await tap(tester, find.text('Abrir plantel'));
      await tap(tester, find.text('Titular').first);
      await tap(tester, find.text('Dorsal 5'));
      final wheel = tester.widget<ListWheelScrollView>(
        find.byType(ListWheelScrollView),
      );
      (wheel.controller! as FixedExtentScrollController).jumpToItem(9);
      await tester.pump();
      await tap(tester, find.text('9'));
      await tap(tester, find.text('Guardar plantel'));
      expect(result!.length, 2);
      expect(result!.singleWhere((m) => m['playerId'] == jugadores[0].id), {
        'playerId': jugadores[0].id,
        'number': 9,
        'status': 'suplente',
      });
      expect(
        result!.singleWhere((m) => m['playerId'] == jugadores[1].id)['number'],
        6,
      );
      expect(
        result!.singleWhere((m) => m['playerId'] == jugadores[1].id)['status'],
        'suplente',
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('Invitation code stays complete and copies the actual value', (
    tester,
  ) async {
    String? copied;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'Clipboard.setData') {
          copied = (call.arguments as Map)['text'] as String;
        }
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );
    final errors = await montarPantalla(
      tester,
      const GroupsScreen(),
      tema: AppTheme.lightTheme,
    );
    expect(errors, isEmpty);
    expect(find.text(grupo.inviteCode), findsOneWidget);
    await tap(tester, find.byTooltip('Copiar código de invitación'));
    expect(copied, grupo.inviteCode);
    expect(tester.takeException(), isNull);
  });
  for (final theme in [AppTheme.darkTheme, AppTheme.lightTheme]) {
    testWidgets(
      'Groups and team detail fit 320px at 1.3x ${theme.brightness}',
      (tester) async {
        for (final screen in [
          const GroupsScreen(),
          const TeamDetailScreen(teamId: 'team-1'),
        ]) {
          final errors = await montarPantalla(
            tester,
            screen,
            tema: theme,
            escala: 1.3,
            tamano: const Size(960, 2400),
          );
          expect(errors, isEmpty);
          expect(tester.takeException(), isNull);
          await tester.pumpWidget(const SizedBox.shrink());
        }
      },
    );
    testWidgets(
      'Creation and roster controls fit 320px at 1.3x ${theme.brightness}',
      (tester) async {
        final errors = await montarPantalla(
          tester,
          const CreateTeamScreen(groupId: idGrupo),
          tema: theme,
          escala: 1.3,
          tamano: const Size(960, 2400),
        );
        expect(errors, isEmpty);
        await tester.enterText(find.byType(TextField), 'Equipo');
        await tester.pump();
        await tap(tester, find.text('Elegir jugadores'));
        await tap(tester, find.byType(CheckboxListTile).first);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
        final rosterErrors = await montarPantalla(
          tester,
          Scaffold(
            body: ManageRosterSheet(
              teamName: 'Los jugadores del miércoles a la noche',
              groupPlayers: jugadores,
              current: equipos.first.members,
            ),
          ),
          tema: theme,
          escala: 1.3,
          tamano: const Size(960, 2400),
        );
        expect(rosterErrors, isEmpty);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
