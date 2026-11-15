import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/services/player_profile_service.dart';

void main() {
  test('sin sesión no carga evaluaciones ni necesita Firebase', () async {
    final container = ProviderContainer(
      overrides: [currentUidProvider.overrideWithValue(null)],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(
      playerActivityProvider('player'),
      (_, _) {},
    );
    addTearDown(subscription.close);
    expect(
      await container.read(playerActivityProvider('player').future),
      isEmpty,
    );
  });

  test('al abandonar el perfil descarta el historial almacenado', () async {
    final container = ProviderContainer(
      overrides: [currentUidProvider.overrideWithValue(null)],
    );
    addTearDown(container.dispose);
    final provider = playerActivityProvider('player');
    final subscription = container.listen(provider, (_, _) {});
    await container.read(provider.future);
    expect(container.exists(provider), isTrue);
    subscription.close();
    await container.pump();
    expect(container.exists(provider), isFalse);
  });
}
