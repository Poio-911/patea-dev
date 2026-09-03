import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// Registro de tokens FCM y recepción de notificaciones push.
///
/// Contexto: el backend ya mandaba push desde tres funciones
/// (`sendMatchReminders`, `onInvitationCreate`, `onMatchCreate`) pero del lado
/// móvil no había NADA que las recibiera — `firebase_messaging` estaba en el
/// pubspec sin importarse en ningún archivo, no existía `google-services.json`
/// y faltaba el plugin de Gradle. Todo eso se estaba enviando al vacío.
///
/// Dónde se guarda el token (importante):
/// las funciones leían un campo array `fcmTokens` DENTRO del documento
/// `users/{uid}`, que tiene lectura abierta a cualquier autenticado. O sea,
/// los tokens de push de cualquiera eran legibles por cualquiera. Las reglas
/// ya protegían una subcolección `users/{uid}/fcmTokens` que nadie usaba.
/// Ahora el token va a esa subcolección, que es la que las reglas cubren.
class NotificationsService {
  static final _messaging = FirebaseMessaging.instance;
  static StreamSubscription<String>? _tokenRefreshSub;
  static StreamSubscription<User?>? _authSub;

  static Future<void> initialize() async {
    try {
      await FirebaseMessaging.instance.setAutoInitEnabled(true);

      // El token sólo se puede guardar con sesión iniciada, y hay que
      // volver a guardarlo cuando cambia de usuario.
      _authSub = FirebaseAuth.instance.authStateChanges().listen((user) {
        if (user != null) {
          _registerFor(user.uid);
        }
      });

      _tokenRefreshSub = _messaging.onTokenRefresh.listen((token) {
        final uid = FirebaseAuth.instance.currentUser?.uid;
        if (uid != null) _saveToken(uid, token);
      });

      // Mensajes con la app en primer plano.
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        if (kDebugMode) {
          debugPrint('[FCM] primer plano: ${message.notification?.title}');
        }
      });
    } catch (e, s) {
      FirebaseCrashlytics.instance
          .recordError(e, s, reason: 'NotificationsService.initialize');
    }
  }

  /// Pide permiso de notificaciones y guarda el token del dispositivo.
  ///
  /// En Android 13+ el permiso es explícito; en versiones anteriores se
  /// concede solo. Conviene llamarlo desde un momento con contexto (por
  /// ejemplo al entrar a un partido) y no de golpe en el primer arranque.
  static Future<bool> requestPermission() async {
    try {
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      final granted =
          settings.authorizationStatus == AuthorizationStatus.authorized ||
              settings.authorizationStatus == AuthorizationStatus.provisional;

      if (granted) {
        final uid = FirebaseAuth.instance.currentUser?.uid;
        if (uid != null) await _registerFor(uid);
      }
      return granted;
    } catch (e, s) {
      FirebaseCrashlytics.instance
          .recordError(e, s, reason: 'requestPermission');
      return false;
    }
  }

  static Future<void> _registerFor(String uid) async {
    try {
      final token = await _messaging.getToken();
      if (token != null) await _saveToken(uid, token);
    } catch (e, s) {
      FirebaseCrashlytics.instance.recordError(e, s, reason: 'getToken');
    }
  }

  /// El id del documento es el token mismo: guardar dos veces el mismo token
  /// no crea duplicados, y borrarlo cuando el servidor lo marca inválido es
  /// un delete directo sin tener que leer un array entero.
  static Future<void> _saveToken(String uid, String token) async {
    try {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(uid)
          .collection('fcmTokens')
          .doc(token)
          .set({
        'token': token,
        'platform': defaultTargetPlatform.name,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e, s) {
      FirebaseCrashlytics.instance.recordError(e, s, reason: 'saveFcmToken');
    }
  }

  /// Al cerrar sesión hay que sacar el token de este dispositivo o el usuario
  /// sigue recibiendo notificaciones de una cuenta que ya no está abierta.
  static Future<void> unregister(String uid) async {
    try {
      final token = await _messaging.getToken();
      if (token == null) return;
      await FirebaseFirestore.instance
          .collection('users')
          .doc(uid)
          .collection('fcmTokens')
          .doc(token)
          .delete();
    } catch (e, s) {
      FirebaseCrashlytics.instance.recordError(e, s, reason: 'unregisterToken');
    }
  }

  static Future<void> dispose() async {
    await _tokenRefreshSub?.cancel();
    await _authSub?.cancel();
  }
}
