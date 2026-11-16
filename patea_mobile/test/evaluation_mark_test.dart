import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/widgets/patea_evaluation_mark.dart';

void main() {
  testWidgets('confirmación sólo se anima cuando se solicita y respeta movimiento reducido', (tester) async {
    for (final reduced in [false, true]) {
      await tester.pumpWidget(MaterialApp(home: MediaQuery(
        data: MediaQueryData(disableAnimations: reduced),
        child: const Scaffold(body: PateaEvaluationMark(animate: true)),
      )));
      expect(find.byType(TweenAnimationBuilder<double>), reduced ? findsNothing : findsOneWidget);
      await tester.pump(const Duration(milliseconds: 450));
      expect(tester.takeException(), isNull);
      expect(tester.binding.transientCallbackCount, 0);
    }
  });

  testWidgets('estado todo al día permanece estático', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: PateaEvaluationMark())));
    expect(find.byType(TweenAnimationBuilder<double>), findsNothing);
    expect(find.byIcon(Icons.sports_soccer_outlined), findsOneWidget);
    expect(find.byIcon(Icons.check_circle), findsOneWidget);
  });
}
