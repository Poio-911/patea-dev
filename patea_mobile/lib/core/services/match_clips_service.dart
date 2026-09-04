import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'firestore_service.dart';

/// Un video corto colgado de un minuto del partido.
///
/// La idea es no competir con una transmisión: en fútbol amateur nadie
/// sostiene el teléfono una hora, pero el que está al costado sí filma veinte
/// segundos cuando pasa algo. Eso, además, sobrevive al partido — un stream
/// se mira una vez, el gol se mira veinte.
class MatchClip {
  final String id;

  /// Minuto del partido al que corresponde.
  final int minute;

  /// URL de descarga en Storage.
  final String url;

  /// Ruta dentro del bucket. Hace falta para poder borrarlo.
  final String storagePath;

  /// A quién le pasó lo que se ve. Opcional: un clip puede ser de la jugada,
  /// no de una persona.
  final String? playerId;
  final String? playerName;

  /// goal, card, save… el mismo vocabulario que los eventos. Opcional.
  final String? eventType;

  final String uploadedBy;
  final String uploaderName;
  final DateTime? createdAt;

  const MatchClip({
    required this.id,
    required this.minute,
    required this.url,
    required this.storagePath,
    required this.uploadedBy,
    required this.uploaderName,
    this.playerId,
    this.playerName,
    this.eventType,
    this.createdAt,
  });

  static MatchClip? fromDoc(QueryDocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    final url = data['url'];
    if (url is! String || url.isEmpty) return null;

    final created = data['createdAt'];
    return MatchClip(
      id: doc.id,
      minute: (data['minute'] as num?)?.toInt() ?? 0,
      url: url,
      storagePath: data['storagePath'] as String? ?? '',
      playerId: data['playerId'] as String?,
      playerName: data['playerName'] as String?,
      eventType: data['eventType'] as String?,
      uploadedBy: data['uploadedBy'] as String? ?? '',
      uploaderName: data['uploaderName'] as String? ?? '',
      createdAt: created is Timestamp ? created.toDate() : null,
    );
  }

  /// Cómo se anuncia el clip en una lista.
  String get label {
    if (playerName != null && playerName!.isNotEmpty) return playerName!;
    return 'Jugada';
  }
}

final matchClipsProvider =
    StreamProvider.family<List<MatchClip>, String>((ref, matchId) {
  // Sin sesión no se abre nada: un listener que sale sin token queda
  // muerto para siempre. Ver firestoreServiceProvider.
  if (ref.watch(currentUidProvider) == null) return const Stream.empty();

  return FirebaseFirestore.instance
      .collection('matches')
      .doc(matchId)
      .collection('clips')
      .snapshots()
      .map((snap) {
    final clips = snap.docs.map(MatchClip.fromDoc).whereType<MatchClip>().toList();
    // Por minuto, que es el orden en el que se jugó el partido.
    clips.sort((a, b) => a.minute.compareTo(b.minute));
    return clips;
  });
});

final matchClipsServiceProvider = Provider<MatchClipsService>((ref) => MatchClipsService());

class MatchClipsService {
  /// Tope de tamaño, en sintonía con `isValidClip()` de storage.rules. Se
  /// chequea acá también para no gastar la subida entera y que falle al final.
  static const int maxBytes = 40 * 1024 * 1024;

  /// Sube el video y deja su ficha en el partido.
  ///
  /// [onProgress] va de 0 a 1. La subida de un video por datos móviles no es
  /// instantánea: sin barra, la pantalla parece colgada.
  Future<void> upload({
    required String matchId,
    required File file,
    required int minute,
    required String uploaderName,
    String? playerId,
    String? playerName,
    String? eventType,
    void Function(double progress)? onProgress,
  }) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) throw Exception('No hay sesión activa.');

    final size = await file.length();
    if (size > maxBytes) {
      throw Exception('El video es muy pesado (${(size / 1024 / 1024).round()} MB). '
          'El máximo son ${maxBytes ~/ 1024 ~/ 1024} MB.');
    }

    final ext = file.path.split('.').last.toLowerCase();
    final contentType = switch (ext) {
      'mov' => 'video/quicktime',
      'webm' => 'video/webm',
      _ => 'video/mp4',
    };

    // El uid va en la ruta: así la regla de Storage puede dejar que cada uno
    // borre lo suyo y nada más.
    final clipId = '${DateTime.now().millisecondsSinceEpoch}';
    final storagePath = 'match-clips/$matchId/$uid/$clipId.$ext';
    final ref = FirebaseStorage.instance.ref(storagePath);

    final task = ref.putFile(file, SettableMetadata(contentType: contentType));
    if (onProgress != null) {
      task.snapshotEvents.listen((snap) {
        if (snap.totalBytes > 0) {
          onProgress(snap.bytesTransferred / snap.totalBytes);
        }
      });
    }
    await task;

    final url = await ref.getDownloadURL();

    await FirebaseFirestore.instance
        .collection('matches')
        .doc(matchId)
        .collection('clips')
        .doc(clipId)
        .set({
      'minute': minute,
      'url': url,
      'storagePath': storagePath,
      if (playerId != null) 'playerId': playerId,
      if (playerName != null) 'playerName': playerName,
      if (eventType != null) 'eventType': eventType,
      'uploadedBy': uid,
      'uploaderName': uploaderName,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  /// Borra el clip y su archivo.
  ///
  /// Primero la ficha: si el archivo quedara huérfano no se ve en ningún
  /// lado, mientras que una ficha sin archivo muestra un clip roto.
  Future<void> delete(String matchId, MatchClip clip) async {
    await FirebaseFirestore.instance
        .collection('matches')
        .doc(matchId)
        .collection('clips')
        .doc(clip.id)
        .delete();

    if (clip.storagePath.isEmpty) return;
    try {
      await FirebaseStorage.instance.ref(clip.storagePath).delete();
    } catch (_) {
      // El archivo puede no estar (borrado a mano, subida a medias). La
      // ficha ya no está, que es lo que se ve.
    }
  }
}
