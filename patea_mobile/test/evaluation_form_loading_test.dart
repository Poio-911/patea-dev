import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/evaluation_models.dart';
import 'package:patea_mobile/core/models/player_model.dart';
import 'package:patea_mobile/core/services/auth_service.dart';
import 'package:patea_mobile/core/services/evaluation_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/features/evaluations/evaluation_form_screen.dart';

class _User implements User {
  @override
  String get uid => 'evaluator';
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Auth implements AuthService {
  _Auth(this.currentUser);
  @override
  final User? currentUser;
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Evaluations implements EvaluationService {
  int attempts = 0;
  bool failFirst = false;
  Completer<bool>? pending;

  @override
  Future<bool> hasSubmittedFor(String matchId, String evaluatorId) async {
    attempts++;
    if (failFirst && attempts == 1) throw Exception('offline');
    return pending == null ? false : pending!.future;
  }

  @override
  Future<List<EvaluationAssignmentModel>> getPendingAssignmentsForMatch(
    String matchId,
    String evaluatorId,
  ) async => [];

  @override
  Future<List<PlayerModel>> getPlayersByIds(List<String> ids) async => [];

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<void> _mount(
  WidgetTester tester,
  _Evaluations service, {
  bool signedIn = true,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authServiceProvider.overrideWithValue(_Auth(signedIn ? _User() : null)),
        evaluationServiceProvider.overrideWithValue(service),
      ],
      child: MaterialApp(
        theme: AppTheme.darkTheme,
        home: const EvaluationFormScreen(matchId: 'match'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('un fallo de carga permite reintentar y recuperar la pantalla', (
    tester,
  ) async {
    final service = _Evaluations()..failFirst = true;
    await _mount(tester, service);
    expect(find.text('No se pudo cargar'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();
    expect(find.text('Sin evaluaciones pendientes'), findsOneWidget);
    expect(service.attempts, 2);
  });

  testWidgets('sin sesión termina la carga y explica cómo continuar', (
    tester,
  ) async {
    final service = _Evaluations();
    await _mount(tester, service, signedIn: false);
    expect(find.textContaining('Debés iniciar sesión'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(service.attempts, 0);
  });

  testWidgets('salir durante la carga no actualiza una pantalla desmontada', (
    tester,
  ) async {
    final completion = Completer<bool>();
    final service = _Evaluations()..pending = completion;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authServiceProvider.overrideWithValue(_Auth(_User())),
          evaluationServiceProvider.overrideWithValue(service),
        ],
        child: MaterialApp(
          theme: AppTheme.darkTheme,
          home: const EvaluationFormScreen(matchId: 'match'),
        ),
      ),
    );
    await tester.pumpWidget(const SizedBox());
    completion.complete(true);
    await tester.pump();
    expect(tester.takeException(), isNull);
  });
}
