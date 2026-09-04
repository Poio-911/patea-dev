import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Quién está mirando el partido ahora.
///
/// Cada persona escribe una fila en `matches/{id}/presence/{uid}` con la hora,
/// y la refresca cada [_heartbeat] mientras tenga la pantalla abierta. Nadie
/// avisa cuando se va —cerrar la app no dispara nada—, así que "estar
/// mirando" se define por la última señal: se cuentan las filas de los
/// últimos [_ttl].
///
/// El id del documento es el uid, así que una persona ocupa una sola fila y
/// el número no se puede inflar.
///
/// La regla de Firestore estaba limitada a `isMatchParticipant`, o sea que el
/// espectador —el único motivo por el que existe este contador— no podía
/// anotarse. Se abrió a cualquiera autenticado (firestore.rules).
const Duration _heartbeat = Duration(seconds: 45);
const Duration _ttl = Duration(minutes: 2);

class MatchPresence {
  final int watching;

  /// Si vos estás contado. Sirve para no mostrar "1 mirando" cuando ese 1 sos vos.
  final bool includesMe;

  const MatchPresence({required this.watching, required this.includesMe});

  static const none = MatchPresence(watching: 0, includesMe: false);

  /// Cuántos hay además de vos.
  int get others => includesMe ? watching - 1 : watching;
}

/// Marca presencia mientras esté vivo, y devuelve cuántos están mirando.
///
/// Se usa con `ref.watch`: Riverpod lo mantiene mientras la pantalla esté
/// montada y lo descarta al salir, que es exactamente el ciclo que queremos.
final matchPresenceProvider =
    StreamProvider.family.autoDispose<MatchPresence, String>((ref, matchId) {
  final uid = FirebaseAuth.instance.currentUser?.uid;
  final presence =
      FirebaseFirestore.instance.collection('matches').doc(matchId).collection('presence');

  Timer? timer;

  if (uid != null) {
    Future<void> beat() async {
      try {
        await presence.doc(uid).set({'lastSeen': FieldValue.serverTimestamp()});
      } catch (_) {
        // Que falle el heartbeat no puede romper la pantalla: se pierde el
        // contador, no el partido.
      }
    }

    beat();
    timer = Timer.periodic(_heartbeat, (_) => beat());
    ref.onDispose(() => timer?.cancel());
  }

  return presence.snapshots().map((snap) {
    final cutoff = DateTime.now().subtract(_ttl);
    var watching = 0;
    var includesMe = false;

    for (final doc in snap.docs) {
      final lastSeen = doc.data()['lastSeen'];
      // Un `serverTimestamp` recién escrito llega como null en el snapshot
      // local antes de confirmarse; ése es propio y cuenta igual.
      final seen = lastSeen is Timestamp ? lastSeen.toDate() : null;
      if (seen != null && seen.isBefore(cutoff)) continue;

      watching++;
      if (doc.id == uid) includesMe = true;
    }

    return MatchPresence(watching: watching, includesMe: includesMe);
  });
});
