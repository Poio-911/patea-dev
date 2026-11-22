import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// ¿Esta instalación viene de la App Store?
///
/// Las compras y los créditos son **solo para la versión de la tienda**. El
/// mismo binario se distribuye por TestFlight y después por la App Store, así
/// que no alcanza con una bandera de compilación: se pregunta en ejecución.
/// iOS lo resuelve mirando el recibo de la app (`receipt` en la tienda,
/// `sandboxReceipt` en TestFlight y en desarrollo). Ver `AppDelegate.swift`.
///
/// Si algo falla, o la plataforma no es iOS, la respuesta es **no**: ante la
/// duda no se muestra nada de compras. Android todavía no vende (se distribuye
/// por Firebase App Distribution, no por Google Play).
abstract final class StoreChannel {
  static const _channel = MethodChannel('patea/distribution');

  static Future<bool> isAppStoreBuild() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.iOS) return false;
    try {
      return await _channel.invokeMethod<String>('channel') == 'appstore';
    } catch (_) {
      return false;
    }
  }
}

final appStoreBuildProvider = FutureProvider<bool>(
  (ref) => StoreChannel.isAppStoreBuild(),
);
