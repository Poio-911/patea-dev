import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../services/credits_store_service.dart';
import '../theme/app_radii.dart';
import '../theme/app_typography.dart';
import '../theme/patea_colors.dart';
import 'patea_card.dart';

/// Tienda de créditos de IA. Solo existe en la versión de la App Store: quien la
/// abre ya pasó por [creditsStoreEnabledProvider].
///
/// Devuelve cuántos créditos se sumaron durante la sesión, para que la pantalla
/// de origen actualice su contador sin esperar al servidor.
Future<int> showCreditsStoreSheet(BuildContext context) async {
  final added = await showModalBottomSheet<int>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const _CreditsStoreSheet(),
  );
  return added ?? 0;
}

class _CreditsStoreSheet extends ConsumerStatefulWidget {
  const _CreditsStoreSheet();

  @override
  ConsumerState<_CreditsStoreSheet> createState() => _CreditsStoreSheetState();
}

class _CreditsStoreSheetState extends ConsumerState<_CreditsStoreSheet> {
  late final Future<List<ProductDetails>> _products;
  CreditsStoreService? _service;
  int _added = 0;

  @override
  void initState() {
    super.initState();
    _service = ref.read(creditsStoreServiceProvider);
    _products = _service?.loadProducts() ?? Future.value(const []);
    _service?.state.addListener(_onState);
  }

  void _onState() {
    final s = _service?.state.value;
    if (s?.status == CreditsPurchaseStatus.success && s!.creditsAdded > 0) {
      _added += s.creditsAdded;
    }
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _service?.state.removeListener(_onState);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final service = _service;
    final status =
        service?.state.value ??
        const CreditsPurchaseState(CreditsPurchaseStatus.idle);
    final busy =
        status.status == CreditsPurchaseStatus.pending ||
        status.status == CreditsPurchaseStatus.validating;

    return PopScope(
      canPop: !busy,
      child: PateaCard(
        color: c.popover,
        radius: BorderRadius.vertical(top: Radius.circular(AppRadii.surface)),
        padding: EdgeInsets.fromLTRB(
          20,
          14,
          20,
          18 + MediaQuery.of(context).padding.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 5,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: c.textSecondary.withValues(alpha: 0.3),
                  borderRadius: AppRadii.hairAll,
                ),
              ),
            ),
            Text(
              'Créditos de IA',
              style: AppTypography.headline(size: 22, weight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            Text(
              'Cada generación de tu retrato usa 1 crédito. Los créditos comprados no vencen y se usan después de los gratuitos del mes.',
              style: AppTypography.body(size: 13, color: c.textSecondary),
            ),
            const SizedBox(height: 16),
            FutureBuilder<List<ProductDetails>>(
              future: _products,
              builder: (context, snap) {
                if (snap.connectionState != ConnectionState.done) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 28),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                final products = snap.data ?? const <ProductDetails>[];
                if (products.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    child: Text(
                      'Las compras no están disponibles en este momento. Probá más tarde.',
                      style: AppTypography.body(
                        size: 14,
                        color: c.textSecondary,
                      ),
                    ),
                  );
                }
                return Column(
                  children: [
                    for (final product in products)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _ProductTile(
                          product: product,
                          enabled: !busy && service != null,
                          onBuy: () => service!.buy(product),
                        ),
                      ),
                  ],
                );
              },
            ),
            if (busy)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Row(
                  children: [
                    const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        status.status == CreditsPurchaseStatus.validating
                            ? 'Confirmando tu compra…'
                            : 'Esperando a la App Store…',
                        style: AppTypography.body(
                          size: 13,
                          color: c.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (status.status == CreditsPurchaseStatus.success)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  status.creditsAdded > 0
                      ? '¡Listo! Sumaste ${status.creditsAdded} créditos.'
                      : 'Tu compra ya estaba confirmada.',
                  style: AppTypography.body(
                    size: 13,
                    weight: FontWeight.w700,
                    color: c.success,
                  ),
                ),
              ),
            if (status.status == CreditsPurchaseStatus.error)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  status.message ?? 'No se pudo completar la compra.',
                  style: AppTypography.body(size: 13, color: c.destructive),
                ),
              ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: busy ? null : () => Navigator.pop(context, _added),
                child: const Text('Cerrar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductTile extends StatelessWidget {
  final ProductDetails product;
  final bool enabled;
  final VoidCallback onBuy;
  const _ProductTile({
    required this.product,
    required this.enabled,
    required this.onBuy,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final credits = kCreditProducts[product.id] ?? 0;
    return Material(
      color: c.card,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadii.cardAll,
        side: BorderSide(color: c.border.withValues(alpha: 0.55)),
      ),
      child: InkWell(
        borderRadius: AppRadii.cardAll,
        onTap: enabled ? onBuy : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  '$credits créditos',
                  style: AppTypography.headline(
                    size: 17,
                    weight: FontWeight.w800,
                  ),
                ),
              ),
              Text(
                product.price,
                style: AppTypography.headline(
                  size: 16,
                  weight: FontWeight.w800,
                  color: c.primary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
