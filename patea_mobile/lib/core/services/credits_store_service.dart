import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import 'callable_functions.dart';
import 'store_channel.dart';

/// Créditos que entrega cada producto de App Store Connect. Tiene que coincidir
/// con `CREDIT_PRODUCTS` en `functions/src/lib/iap.ts`: el servidor es quien
/// manda, esto solo ordena y rotula la tienda.
const kCreditProducts = <String, int>{
  'com.patea.app.credits_5': 5,
  'com.patea.app.credits_15': 15,
  'com.patea.app.credits_40': 40,
};

enum CreditsPurchaseStatus { idle, pending, validating, success, error }

@immutable
class CreditsPurchaseState {
  final CreditsPurchaseStatus status;
  final int creditsAdded;
  final String? message;
  const CreditsPurchaseState(
    this.status, {
    this.creditsAdded = 0,
    this.message,
  });
}

/// Compras de créditos de IA con StoreKit (solo en la versión de la App Store).
///
/// Flujo: se compra → Apple entrega la compra por `purchaseStream` → se la manda
/// al servidor (`redeemIapPurchase`), que la valida con Apple y suma los
/// créditos → recién ahí se cierra la transacción con `completePurchase`. Si el
/// servidor falla, la compra queda abierta y Apple la vuelve a entregar la
/// próxima vez, así nadie paga sin recibir sus créditos.
class CreditsStoreService {
  CreditsStoreService([InAppPurchase? iap])
    : _iap = iap ?? InAppPurchase.instance;

  final InAppPurchase _iap;
  StreamSubscription<List<PurchaseDetails>>? _sub;

  /// Estado de la última compra, para que la hoja de la tienda lo muestre.
  final state = ValueNotifier<CreditsPurchaseState>(
    const CreditsPurchaseState(CreditsPurchaseStatus.idle),
  );

  void start() {
    _sub ??= _iap.purchaseStream.listen(
      _onPurchases,
      onError: (Object e) => state.value = const CreditsPurchaseState(
        CreditsPurchaseStatus.error,
        message: 'No pudimos comunicarnos con la App Store.',
      ),
    );
  }

  Future<bool> get available => _iap.isAvailable();

  /// Productos de la tienda, de menor a mayor.
  Future<List<ProductDetails>> loadProducts() async {
    final response = await _iap.queryProductDetails(
      kCreditProducts.keys.toSet(),
    );
    final list = [...response.productDetails];
    list.sort(
      (a, b) =>
          (kCreditProducts[a.id] ?? 0).compareTo(kCreditProducts[b.id] ?? 0),
    );
    return list;
  }

  Future<void> buy(ProductDetails product) async {
    state.value = const CreditsPurchaseState(CreditsPurchaseStatus.pending);
    try {
      await _iap.buyConsumable(
        purchaseParam: PurchaseParam(productDetails: product),
      );
    } catch (_) {
      state.value = const CreditsPurchaseState(
        CreditsPurchaseStatus.error,
        message: 'No se pudo iniciar la compra.',
      );
    }
  }

  Future<void> _onPurchases(List<PurchaseDetails> purchases) async {
    for (final purchase in purchases) {
      switch (purchase.status) {
        case PurchaseStatus.pending:
          state.value = const CreditsPurchaseState(
            CreditsPurchaseStatus.pending,
          );
        case PurchaseStatus.canceled:
          state.value = const CreditsPurchaseState(CreditsPurchaseStatus.idle);
          if (purchase.pendingCompletePurchase) {
            await _iap.completePurchase(purchase);
          }
        case PurchaseStatus.error:
          state.value = CreditsPurchaseState(
            CreditsPurchaseStatus.error,
            message:
                purchase.error?.message ?? 'La compra no se pudo completar.',
          );
          if (purchase.pendingCompletePurchase) {
            await _iap.completePurchase(purchase);
          }
        case PurchaseStatus.purchased || PurchaseStatus.restored:
          await _redeem(purchase);
      }
    }
  }

  Future<void> _redeem(PurchaseDetails purchase) async {
    final transactionId = purchase.purchaseID;
    if (transactionId == null ||
        !kCreditProducts.containsKey(purchase.productID)) {
      if (purchase.pendingCompletePurchase)
        await _iap.completePurchase(purchase);
      return;
    }
    state.value = const CreditsPurchaseState(CreditsPurchaseStatus.validating);
    try {
      final result = await callFunction('redeemIapPurchase', {
        'transactionId': transactionId,
        'productId': purchase.productID,
      }, timeout: const Duration(seconds: 60));
      // Solo con los créditos ya entregados se cierra la transacción.
      if (purchase.pendingCompletePurchase)
        await _iap.completePurchase(purchase);
      final credits = (result['credits'] as num?)?.toInt() ?? 0;
      final already = result['alreadyRedeemed'] == true;
      state.value = CreditsPurchaseState(
        CreditsPurchaseStatus.success,
        creditsAdded: already ? 0 : credits,
      );
    } catch (_) {
      // No se completa: Apple la vuelve a entregar y se reintenta sola.
      state.value = const CreditsPurchaseState(
        CreditsPurchaseStatus.error,
        message:
            'Recibimos tu pago pero no pudimos confirmarlo todavía. Se va a reintentar solo cuando abras la app; no se pierde nada.',
      );
    }
  }

  void dispose() {
    _sub?.cancel();
    _sub = null;
    state.dispose();
  }
}

/// ¿Hay que mostrar las compras? Solo en un build de la App Store y con la
/// tienda disponible. En TestFlight y en desarrollo es siempre `false`.
final creditsStoreEnabledProvider = FutureProvider<bool>((ref) async {
  if (!await ref.watch(appStoreBuildProvider.future)) return false;
  try {
    return await InAppPurchase.instance.isAvailable();
  } catch (_) {
    return false;
  }
});

/// Servicio de compras. Solo se crea (y solo escucha el stream de StoreKit)
/// cuando [creditsStoreEnabledProvider] es verdadero; si no, no se toca StoreKit.
final creditsStoreServiceProvider = Provider<CreditsStoreService?>((ref) {
  final enabled = ref.watch(creditsStoreEnabledProvider).value ?? false;
  if (!enabled) return null;
  final service = CreditsStoreService()..start();
  ref.onDispose(service.dispose);
  return service;
});
