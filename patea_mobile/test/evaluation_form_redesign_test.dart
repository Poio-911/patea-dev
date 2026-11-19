import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:patea_mobile/core/models/evaluation_models.dart';
import 'package:patea_mobile/core/models/player_model.dart';
import 'package:patea_mobile/core/services/evaluation_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/widgets/patea_card.dart';
import 'package:patea_mobile/core/widgets/patea_user_menu_sheet.dart';
import 'package:patea_mobile/features/evaluations/evaluation_form_screen.dart';
import 'package:patea_mobile/features/evaluations/evaluations_inbox_screen.dart';
import 'goldens/arnes.dart';

class EvaluationEditorFake extends Fake implements EvaluationService {
  int sends = 0;
  int? goals;
  List<PlayerEvaluationDraft>? sentDrafts;
  final submission = Completer<void>();
  @override
  Future<bool> hasSubmittedFor(String matchId, String uid) async => false;
  @override
  Future<List<EvaluationAssignmentModel>> getPendingAssignmentsForMatch(String matchId, String uid) async => [
    for (final p in jugadores.skip(1).take(2)) EvaluationAssignmentModel(id: p.id, matchId: matchId, evaluatorId: uid, subjectId: p.id, status: 'pending'),
  ];
  @override
  Future<List<PlayerModel>> getPlayersByIds(List<String> ids) async => jugadores.where((p) => ids.contains(p.id)).toList();
  @override
  Future<void> submitEvaluation({required String matchId, required int evaluatorGoals,
    required int evaluatorAssists, String? mvpVote, String? personalChronicle,
    required List<PlayerEvaluationDraft> evaluations}) {
    sends++; goals = evaluatorGoals; sentDrafts = evaluations; return submission.future;
  }
}

void main() {
  setUp(() { GoogleFonts.config.allowRuntimeFetching = false; SharedPreferences.setMockInitialValues({}); });
  Future<void> mount(WidgetTester tester, EvaluationEditorFake service, {ThemeData? theme, double scale = 1, Size size = const Size(1080, 2400)}) async {
    final errors = await montarPantalla(tester, ProviderScope(overrides: [evaluationServiceProvider.overrideWithValue(service)],
      child: const EvaluationFormScreen(matchId: idPartido)), tema: theme ?? AppTheme.darkTheme, escala: scale, tamano: size);
    expect(errors, isEmpty);
    await tester.pump();
    addTearDown(() => tester.pumpWidget(const SizedBox.shrink()));
  }
  Future<void> tap(WidgetTester tester, Finder target) async {
    await tester.ensureVisible(target); await tester.pump(); await tester.tap(target);
    await tester.pump(); await tester.pump(const Duration(milliseconds: 350));
  }
  testWidgets('MVP is one selector; statistics keep limits and review cancels without sending', (tester) async {
    final service = EvaluationEditorFake(); await mount(tester, service);
    expect(find.byType(ChoiceChip), findsNothing);
    await tap(tester, find.byTooltip('Sumar Goles'));
    await tap(tester, find.text('Revisar y enviar'));
    expect(find.text('Revisá tu devolución'), findsOneWidget);
    expect(find.text('Tu partido: 1 goles · 0 asistencias'), findsOneWidget);
    expect(service.sends, 0);
    await tap(tester, find.text('Seguir editando'));
    expect(service.sends, 0);
    await tap(tester, find.text('Revisar y enviar'));
    await tap(tester, find.text('Enviar evaluaciones'));
    expect(service.sends, 1);
    expect(service.goals, 1);
    expect(service.sentDrafts!.length, 2);
    expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Enviando…')).onPressed, isNull);
    await tester.pumpWidget(const SizedBox.shrink()); service.submission.complete(); await tester.pump();
    expect(tester.takeException(), isNull);
  });
  testWidgets('Tags remain selected after switching mode; minimum is validated before review', (tester) async {
    final service = EvaluationEditorFake(); await mount(tester, service);
    await tester.drag(find.byType(ListView).first, const Offset(0, -500)); await tester.pump();
    await tap(tester, find.text('Etiquetas').first);
    expect(find.text('Lo que aportó'), findsWidgets);
    await tap(tester, find.text('Revisar y enviar'));
    expect(find.text('Revisá tu devolución'), findsNothing);
    expect(service.sends, 0);
    await tap(tester, find.byType(CheckboxListTile).first);
    expect(tester.widget<CheckboxListTile>(find.byType(CheckboxListTile).first).value, isTrue);
    await tap(tester, find.text('Nota').first);
    await tap(tester, find.text('Etiquetas').first);
    expect(tester.widget<CheckboxListTile>(find.byType(CheckboxListTile).first).value, isTrue);
    expect(tester.takeException(), isNull);
  });
  for (final theme in [AppTheme.darkTheme, AppTheme.lightTheme]) {
    testWidgets('Whole editor fits narrow 320px at 1.3x ${theme.brightness}', (tester) async {
      await mount(tester, EvaluationEditorFake(), theme: theme, scale: 1.3, size: const Size(960, 2400));
      await tap(tester, find.byTooltip('Sumar Asistencias'));
      await tester.drag(find.byType(ListView).first, const Offset(0, -550)); await tester.pump();
      await tap(tester, find.text('Etiquetas').first);
      await tester.drag(find.byType(ListView).first, const Offset(0, -600)); await tester.pump();
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('Menu OVR is typography without a card around the number', (tester) async {
    final errors = await montarPantalla(tester, const Scaffold(body: PateaUserMenuSheet()), tema: AppTheme.darkTheme, escala: 1.3);
    expect(errors, isEmpty);
    expect(find.text('OVR'), findsOneWidget);
    expect(find.ancestor(of: find.text('${jugadores.first.ovr}'), matching: find.byType(PateaCard)), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Personal chronicle remains usable with the keyboard and footer stays out of the way', (tester) async {
    await mount(tester, EvaluationEditorFake(), scale: 1.3);
    await tap(tester, find.text('¿Cómo lo viviste?'));
    await tester.enterText(find.byType(TextField), 'Buen partido con el grupo');
    tester.view.viewInsets = const FakeViewPadding(bottom: 900);
    await tester.pump();
    expect(find.text('Revisar y enviar'), findsNothing);
    expect(find.text('Buen partido con el grupo'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Assigned names fit the inbox at 320px and 1.3x without badges', (tester) async {
    const name = 'Juan Ignacio Rodríguez Etchegaray del Prado';
    final item = EvaluationInboxItem(matchId: 'long-name', matchTitle: 'Partido del grupo', matchDate: '2026-11-16', isSubmitted: false,
      assignedPlayers: [AssignedPlayerInfo(id: 'player', name: name, photoURL: '', position: 'MED')]);
    final errors = await montarPantalla(tester, ProviderScope(overrides: [
      evaluationInboxItemsProvider(uidYo).overrideWith((ref) => Stream.value([item])),
    ], child: const EvaluationsInboxScreen()), tema: AppTheme.lightTheme, escala: 1.3, tamano: const Size(960, 2400));
    expect(errors, isEmpty);
    expect(find.text(name), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Unified impact preview updates live in Nota and enforces 3-5 cap in Etiquetas', (tester) async {
    final service = EvaluationEditorFake();
    await mount(tester, service);

    await tester.drag(find.byType(ListView).first, const Offset(0, -550));
    await tester.pumpAndSettle();

    // En Nota (por defecto 5/10), ya se muestra el bloque unificado Impacto estimado.
    expect(find.text('Impacto estimado'), findsWidgets);
    expect(find.textContaining('Sin cambio'), findsWidgets);
    expect(find.text('5 · Neutro'), findsWidgets);

    // Subir el primer slider a 10/10 debe actualizar el OVR estimado y chips en vivo.
    final firstSlider = find.byType(Slider).first;
    await tester.ensureVisible(firstSlider);
    await tester.pump();
    final sliderBox = tester.getRect(firstSlider);
    await tester.tapAt(Offset(sliderBox.right - 6, sliderBox.center.dy));
    await tester.pumpAndSettle();
    expect(find.textContaining('→'), findsWidgets);

    // Cambiar a Etiquetas: debe mostrar contador 0 / 5 y bloquear a partir de 5.
    await tap(tester, find.text('Etiquetas').first);
    expect(find.text('0 / 5'), findsOneWidget);

    for (var i = 0; i < 5; i++) {
      final tile = find.byType(CheckboxListTile).at(i);
      await tap(tester, tile);
    }
    expect(find.text('5 / 5'), findsOneWidget);

    // La 6ª etiqueta no seleccionada queda deshabilitada para respetar el tope de 5.
    final sixthTile = tester.widget<CheckboxListTile>(find.byType(CheckboxListTile).at(5));
    expect(sixthTile.value, isFalse);
    expect(sixthTile.onChanged, isNull);

    // Cambiar a Reseña (Escribir y Audio) mantiene el bloque unificado Impacto estimado.
    await tap(tester, find.text('Reseña').first);
    expect(find.text('Impacto estimado'), findsWidgets);
    await tap(tester, find.text('Audio').first);
    expect(find.text('Impacto estimado'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

}
