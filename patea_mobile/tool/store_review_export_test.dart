// Genera la captura de la tienda de créditos para App Store Connect
// (campo «Captura de pantalla» de cada compra integrada).
//
// Usa el widget real de la app con productos de ejemplo; no toca ningún
// servicio externo. Se corre así, desde `patea_mobile`:
//
//   flutter test --no-pub --update-goldens tool/store_review_export_test.dart
//
// Sale en `build/store_review/credits_store.png` (1290×2796).
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader, rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:patea_mobile/core/services/credits_store_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/app_typography.dart';
import 'package:patea_mobile/core/widgets/credits_store_sheet.dart';

import '../test/goldens/arnes.dart';

class _FakeIap extends Fake implements InAppPurchase {}

class _FakeStore extends CreditsStoreService {
  _FakeStore() : super(_FakeIap());

  @override
  Future<List<ProductDetails>> loadProducts() async => [
    ProductDetails(
      id: 'com.patea.app.credits_5',
      title: '5 créditos de IA',
      description: '5 retratos con IA. No vencen.',
      price: r'$0.99',
      rawPrice: 0.99,
      currencyCode: 'USD',
    ),
    ProductDetails(
      id: 'com.patea.app.credits_15',
      title: '15 créditos de IA',
      description: '15 retratos con IA. No vencen.',
      price: r'$2.99',
      rawPrice: 2.99,
      currencyCode: 'USD',
    ),
    ProductDetails(
      id: 'com.patea.app.credits_40',
      title: '40 créditos de IA',
      description: '40 retratos con IA. No vencen.',
      price: r'$6.99',
      rawPrice: 6.99,
      currencyCode: 'USD',
    ),
  ];
}

/// Pantalla de fondo con la hoja de la tienda abierta.
class _Fondo extends StatefulWidget {
  const _Fondo();
  @override
  State<_Fondo> createState() => _FondoState();
}

class _FondoState extends State<_Fondo> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) showCreditsStoreSheet(context);
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Tu retrato')),
    body: const SizedBox.expand(),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    final material = FontLoader('MaterialIcons');
    material.addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await material.load();
    const pesos = [
      FontWeight.w400,
      FontWeight.w500,
      FontWeight.w600,
      FontWeight.w700,
    ];
    for (final p in pesos) {
      AppTypography.headline(weight: p);
      AppTypography.body(weight: p);
    }
    AppTypography.headline(weight: FontWeight.w800);
    AppTypography.body(weight: FontWeight.w800);
    await GoogleFonts.pendingFonts();
  });

  testWidgets('captura de la tienda de créditos', (tester) async {
    final errors = await montarPantalla(
      tester,
      const _Fondo(),
      tema: AppTheme.darkTheme,
      tamano: const Size(1290, 2796),
      extraOverrides: [
        creditsStoreServiceProvider.overrideWithValue(_FakeStore()),
      ],
    );
    expect(errors, isEmpty);
    for (var i = 0; i < 4; i++) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 150)),
      );
      await tester.pump(const Duration(milliseconds: 250));
    }
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../build/store_review/credits_store.png'),
    );
  });
}
