import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/services/match_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/features/matches/widgets/match_cost_card.dart';

import 'goldens/arnes.dart';

class _CostService extends Fake implements MatchService {
  _CostService(this.cost);

  final ValueNotifier<MatchCost?> cost;

  @override
  Future<void> setCost(
    String matchId, {
    required double total,
    required String currency,
  }) async {
    cost.value = MatchCost(total: total, currency: currency);
  }
}

void main() {
  testWidgets('Saving a cost leaves the payment list folded', (tester) async {
    final cost = ValueNotifier<MatchCost?>(null);
    addTearDown(cost.dispose);

    final errors = await montarPantalla(
      tester,
      Scaffold(
        body: ValueListenableBuilder(
          valueListenable: cost,
          builder: (context, value, _) => MatchCostCard(
            match: MatchModel(
              id: 'test-match',
              title: 'Amistoso',
              type: 'manual',
              status: 'upcoming',
              date: '2099-10-10',
              cost: value,
              playerUids: const [uidYo],
            ),
            uid: uidYo,
            isManager: true,
          ),
        ),
      ),
      tema: AppTheme.darkTheme,
      extraOverrides: [
        matchServiceProvider.overrideWithValue(_CostService(cost)),
      ],
    );
    expect(errors, isEmpty);

    Future<void> saveFrom(Finder action, String total) async {
      await tester.tap(action);
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), total);
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();
    }

    await saveFrom(find.text('Este partido'), '4800');
    expect(find.textContaining('0 de 1 pagaron'), findsOneWidget);
    expect(find.byType(Switch), findsNothing);

    await tester.tap(find.text('Ver pagos'));
    await tester.pumpAndSettle();
    expect(find.byType(Switch), findsOneWidget);

    await tester.tap(find.text('Ocultar pagos'));
    await tester.pumpAndSettle();
    expect(find.byType(Switch), findsNothing);

    await tester.tap(find.text('Ver pagos'));
    await tester.pumpAndSettle();
    await saveFrom(find.byTooltip('Cambiar el costo'), '5000');
    expect(cost.value?.total, 5000);
    expect(find.text('Ver pagos'), findsOneWidget);
    expect(find.byType(Switch), findsNothing);
  });
}
