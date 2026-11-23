import 'dart:async';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// ¿Hay internet de verdad? Se intenta resolver el servidor de la base de
/// datos: si responde, la app puede trabajar. No hace falta un plugin nativo.
Future<bool> defaultReachabilityCheck() async {
  try {
    final result = await InternetAddress.lookup(
      'firestore.googleapis.com',
    ).timeout(const Duration(seconds: 4));
    return result.isNotEmpty && result.first.rawAddress.isNotEmpty;
  } catch (_) {
    return false;
  }
}

/// Decide cuándo se considera que se cayó la conexión: recién después de dos
/// fallos seguidos, para que un tropiezo de la red no haga parpadear el aviso.
/// Un solo éxito alcanza para volver a estar en línea.
class ConnectionTracker {
  ConnectionTracker({this.failuresToGoOffline = 2});

  final int failuresToGoOffline;
  int _failures = 0;
  bool _online = true;

  bool get online => _online;

  /// Registra el resultado de una revisión y devuelve si se está en línea.
  bool record({required bool reachable}) {
    if (reachable) {
      _failures = 0;
      _online = true;
    } else {
      _failures++;
      if (_failures >= failuresToGoOffline) _online = false;
    }
    return _online;
  }
}

/// La revisión de conexión, reemplazable en pruebas.
final reachabilityCheckProvider = Provider<Future<bool> Function()>(
  (ref) => defaultReachabilityCheck,
);

/// `true` mientras hay conexión. Revisa cada tanto: seguido si está caída (para
/// avisar rápido cuando vuelve) y de a ratos largos si anda bien.
final onlineProvider = StreamProvider<bool>((ref) async* {
  final check = ref.watch(reachabilityCheckProvider);
  final tracker = ConnectionTracker();
  bool? last;
  while (true) {
    final online = tracker.record(reachable: await check());
    if (online != last) {
      last = online;
      yield online;
    }
    await Future<void>.delayed(
      online ? const Duration(seconds: 15) : const Duration(seconds: 4),
    );
  }
});
