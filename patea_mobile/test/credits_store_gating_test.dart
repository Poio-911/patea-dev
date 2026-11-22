import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/player_model.dart';
import 'package:patea_mobile/core/services/credits_store_service.dart';
import 'package:patea_mobile/core/services/store_channel.dart';

/// Las compras y los créditos son solo para la versión de la App Store.
/// En TestFlight, en desarrollo y en Android todo tiene que quedar igual.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  tearDown(() {
    debugDefaultTargetPlatformOverride = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(const MethodChannel('patea/distribution'), null);
  });

  void channelAnswers(String? answer) {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('patea/distribution'),
          (call) async => answer,
        );
  }

  test('en Android nunca es versión de tienda, aunque el canal conteste "appstore"', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    channelAnswers('appstore');
    expect(await StoreChannel.isAppStoreBuild(), isFalse);
  });

  test('en iOS desde TestFlight o desarrollo no es versión de tienda', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    channelAnswers('other');
    expect(await StoreChannel.isAppStoreBuild(), isFalse);
  });

  test('en iOS desde la App Store sí lo es', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    channelAnswers('appstore');
    expect(await StoreChannel.isAppStoreBuild(), isTrue);
  });

  test('si el canal nativo falla, se asume que NO es de la tienda', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    // Sin handler: MissingPluginException.
    expect(await StoreChannel.isAppStoreBuild(), isFalse);
  });

  test('en TestFlight las compras quedan deshabilitadas y no se crea el servicio', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    channelAnswers('other');
    final container = ProviderContainer();
    addTearDown(container.dispose);
    expect(await container.read(creditsStoreEnabledProvider.future), isFalse);
    expect(container.read(creditsStoreServiceProvider), isNull);
  });

  test('el catálogo de la app coincide con el del servidor', () {
    expect(kCreditProducts, {
      'com.patea.app.credits_5': 5,
      'com.patea.app.credits_15': 15,
      'com.patea.app.credits_40': 40,
    });
  });

  test('los créditos comprados se suman a los gratuitos', () {
    final player = PlayerModel.fromFirestore({
      'name': 'Ana',
      'cardGenerationCredits': 2,
      'purchasedCredits': 5,
    }, 'p1');
    expect(player.totalCredits, 7);
    final unlimited = PlayerModel.fromFirestore({'name': 'Beto', 'purchasedCredits': 5}, 'p2');
    expect(unlimited.totalCredits, isNull);
  });
}
