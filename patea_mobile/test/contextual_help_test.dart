import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/widgets/patea_help_dialog.dart';
import 'package:patea_mobile/core/widgets/patea_page_header.dart';
import 'goldens/arnes.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  test('helpTopicForRoute mapea cada ruta principal a su guía contextual', () {
    expect(helpTopicForRoute('/'), HelpTopic.overview);
    expect(helpTopicForRoute(null), HelpTopic.overview);
    expect(helpTopicForRoute('/players'), HelpTopic.players);
    expect(helpTopicForRoute('/players/u1'), HelpTopic.players);
    expect(helpTopicForRoute('/profile'), HelpTopic.players);
    expect(helpTopicForRoute('/matches'), HelpTopic.matches);
    expect(helpTopicForRoute('/matches/m1'), HelpTopic.matches);
    expect(helpTopicForRoute('/evaluations'), HelpTopic.evaluations);
    expect(helpTopicForRoute('/competitions'), HelpTopic.competitions);
    expect(helpTopicForRoute('/explorar'), HelpTopic.explore);
    expect(helpTopicForRoute('/groups'), HelpTopic.groups);
    expect(helpTopicForRoute('/leaderboard'), HelpTopic.ranking);
    expect(helpTopicForRoute('/social'), HelpTopic.community);
  });

  testWidgets(
    'PateaPageHeader muestra el botón contextual aunque showCountRow sea false',
    (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          home: Scaffold(
            body: PateaPageHeader(
              title: 'Partidos',
              showCountRow: false,
              helpTooltip: 'Tipos y ciclo de partidos',
              onHelpTap: () => tapped = true,
            ),
          ),
        ),
      );
      await tester.pump();

      final btn = find.byTooltip('Tipos y ciclo de partidos');
      expect(btn, findsOneWidget);
      await tester.tap(btn);
      expect(tapped, isTrue);
    },
  );

  testWidgets(
    'Ayuda de Jugadores explica OVR, categorías y alterna Cancha vs Arquero',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => showContextualHelpSheet(
                  context,
                  topic: HelpTopic.players,
                ),
                child: const Text('Abrir ayuda jugadores'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Abrir ayuda jugadores'));
      await tester.pumpAndSettle();

      expect(find.text('Jugadores, OVR y atributos'), findsOneWidget);
      expect(find.text('70–79 PRO'), findsOneWidget);
      expect(find.text('90+ ELITE+'), findsOneWidget);
      expect(find.text('RIT'), findsOneWidget);
      expect(find.text('FIS'), findsOneWidget);

      final gkButton = find.text('Arquero (POR)');
      await tester.ensureVisible(gkButton);
      await tester.tap(gkButton);
      await tester.pumpAndSettle();

      expect(find.text('EST'), findsOneWidget);
      expect(find.text('SAQ'), findsOneWidget);
      expect(find.text('RIT'), findsNothing);
    },
  );

  testWidgets(
    'Ayuda de Partidos y Evaluaciones muestran tipos, plazos y puente al tour',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: Builder(
              builder: (context) => Column(
                children: [
                  ElevatedButton(
                    onPressed: () => showContextualHelpSheet(
                      context,
                      topic: HelpTopic.matches,
                    ),
                    child: const Text('Ayuda partidos'),
                  ),
                  ElevatedButton(
                    onPressed: () => showContextualHelpSheet(
                      context,
                      topic: HelpTopic.evaluations,
                    ),
                    child: const Text('Ayuda evaluaciones'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Ayuda partidos'));
      await tester.pumpAndSettle();
      expect(find.text('Tipos y ciclo de partidos'), findsOneWidget);
      expect(find.text('Amistoso'), findsOneWidget);
      expect(find.text('Colaborativo'), findsOneWidget);
      expect(find.text('Por Equipos'), findsOneWidget);
      expect(find.text('Inter-grupos'), findsOneWidget);

      await tester.tap(find.byTooltip('Cerrar ayuda'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Ayuda evaluaciones'));
      await tester.pumpAndSettle();
      expect(find.text('Evaluaciones y anonimato'), findsOneWidget);
      expect(find.text('Ventana de 72 horas'), findsOneWidget);
      expect(find.text('Anónimas + pestaña Solicitudes'), findsOneWidget);

      final tourBtn = find.text('Ver recorrido completo de Pateá');
      await tester.ensureVisible(tourBtn);
      await tester.tap(tourBtn);
      await tester.pumpAndSettle();

      expect(find.byType(PateaHelpDialog), findsOneWidget);
      expect(find.text('Tu grupo, tu punto de encuentro'), findsOneWidget);
    },
  );

  for (final theme in [AppTheme.darkTheme, AppTheme.lightTheme]) {
    for (final topic in [
      HelpTopic.players,
      HelpTopic.matches,
      HelpTopic.evaluations,
    ]) {
      testWidgets(
        'PateaSectionHelpSheet ${topic.name} entra a 320px y 1.3x ${theme.brightness}',
        (tester) async {
          final errors = await montarPantalla(
            tester,
            Scaffold(
              body: PateaSectionHelpSheet(
                topic: topic,
                onOpenFullTour: () {},
              ),
            ),
            tema: theme,
            escala: 1.3,
            tamano: const Size(960, 2400),
          );
          expect(errors, isEmpty);
          expect(tester.takeException(), isNull);
        },
      );
    }
  }
}
