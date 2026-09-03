import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'callable_functions.dart';

final profileServiceProvider = Provider<ProfileService>((ref) => ProfileService());

/// Escrituras del perfil propio.
///
/// La foto se sube directo a Storage desde el cliente (storage.rules permite
/// escribir en `profile-images/{uid}/**` sólo al dueño) y después se manda la
/// URL a la Cloud Function, que es la única que puede tocar `users` y
/// `players`.
class ProfileService {
  /// Sube la foto y devuelve su URL de descarga.
  ///
  /// El nombre lleva timestamp para que la URL cambie: si se reusara el mismo
  /// path, la foto vieja seguiría viéndose por el caché de imágenes hasta que
  /// se venciera.
  Future<String> uploadProfilePhoto(File file) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) throw Exception('No hay sesión activa.');

    final ext = file.path.split('.').last.toLowerCase();
    final contentType = switch (ext) {
      'png' => 'image/png',
      'webp' => 'image/webp',
      _ => 'image/jpeg',
    };

    final ref = FirebaseStorage.instance
        .ref('profile-images/$uid/profile_${DateTime.now().millisecondsSinceEpoch}.$ext');

    await ref.putFile(file, SettableMetadata(contentType: contentType));
    return ref.getDownloadURL();
  }

  /// Guarda los campos del perfil. Sólo se mandan los que cambiaron.
  Future<void> updateProfile({
    String? displayName,
    String? photoUrl,
    String? position,
    String? preferredFoot,
    String? bio,
    int? birthYear,
    String? nationality,
    String? phoneNumber,
  }) async {
    final data = <String, dynamic>{};
    if (displayName != null) data['displayName'] = displayName;
    if (photoUrl != null) data['photoUrl'] = photoUrl;
    if (position != null) data['position'] = position;
    if (preferredFoot != null) data['preferredFoot'] = preferredFoot;
    if (bio != null) data['bio'] = bio;
    if (birthYear != null) data['birthYear'] = birthYear;
    if (nationality != null) data['nationality'] = nationality;
    if (phoneNumber != null) data['phoneNumber'] = phoneNumber;

    if (data.isEmpty) return;

    await callFunction('updateProfile', data, timeout: const Duration(seconds: 30));
  }
}
