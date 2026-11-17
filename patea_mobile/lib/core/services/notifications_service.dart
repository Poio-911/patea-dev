import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../router/app_router.dart';
import '../theme/app_radii.dart';
import '../theme/app_typography.dart';
import '../theme/patea_colors.dart';

/// Handler de segundo plano para mensajes FCM (requiere función top-level).
///
/// Las notificaciones con bloque `notification` se muestran en la bandeja del
/// sistema de forma nativa incluso con la app cerrada; este entry point cubre
/// mensajes silenciosos/`data-only` sin warnings de aislamiento en Android/iOS.
@pragma('vm:entry-point')
Future<void> pateaMessagingBackgroundHandler(RemoteMessage message) async {}

/// Registro de tokens FCM y recepción de notificaciones push (primer plano,
/// segundo plano y arranque desde notificación cerrada).
class NotificationsService {
  static final _messaging = FirebaseMessaging.instance;
  static final GlobalKey<ScaffoldMessengerState> messengerKey =
      GlobalKey<ScaffoldMessengerState>();

  static final RegExp _allowedRoutePattern = RegExp(
    r'^/(matches|evaluations|players|groups|competitions|social|explorar|profile|leaderboard|coach)(/[A-Za-z0-9_.-]+)*$',
  );

  static StreamSubscription<String>? _tokenRefreshSub;
  static StreamSubscription<User?>? _authSub;
  static StreamSubscription<RemoteMessage>? _foregroundSub;
  static StreamSubscription<RemoteMessage>? _openedSub;

  static GoRouter? _router;
  static AuthRouterState? _authState;
  static VoidCallback? _authListener;
  static String? _pendingLink;

  static String? _unregisteringUid;
  static Future<void> _tokenWrites = Future<void>.value();

  /// Valida y normaliza rutas internas recibidas en `message.data['link']`.
  @visibleForTesting
  static String? normalizeLink(dynamic rawLink) {
    if (rawLink is! String) return null;
    final trimmed = rawLink.trim();
    if (trimmed.isEmpty) return null;
    if (trimmed == '/') return '/';
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
    if (!_allowedRoutePattern.hasMatch(trimmed)) return null;
    return trimmed;
  }

  /// Conecta el router y el estado de sesión para resolver enlaces pendientes
  /// cuando el usuario toca una notificación con la app en segundo plano o cerrada.
  static void attachNavigation({
    required GoRouter router,
    required AuthRouterState auth,
  }) {
    if (!identical(_authState, auth)) {
      if (_authListener != null) {
        _authState?.removeListener(_authListener!);
      }
      _authState = auth;
      _authListener = () {
        if (auth.initialized && auth.isLoggedIn) {
          consumePendingLink();
        }
      };
      auth.addListener(_authListener!);
    }
    _router = router;
    consumePendingLink();
  }

  static void consumePendingLink() {
    final link = _pendingLink;
    final router = _router;
    final auth = _authState;
    if (link == null || router == null || auth == null) return;
    if (!auth.initialized || !auth.isLoggedIn) return;

    _pendingLink = null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _router?.push(link);
    });
  }

  static void openLink(String rawLink) {
    final link = normalizeLink(rawLink);
    if (link == null) return;
    _pendingLink = link;
    consumePendingLink();
  }

  @visibleForTesting
  static void handleNotificationOpen(RemoteMessage message) {
    final link = normalizeLink(message.data['link']);
    if (link == null) return;
    _pendingLink = link;
    consumePendingLink();
  }

  @visibleForTesting
  static void handleForegroundMessage(
    RemoteMessage message, {
    TargetPlatform? platformOverride,
  }) {
    final platform = platformOverride ?? defaultTargetPlatform;
    // En iOS `setForegroundNotificationPresentationOptions(alert: true)` ya
    // presenta el banner nativo cuando hay bloque `notification`.
    if (!kIsWeb &&
        platform == TargetPlatform.iOS &&
        message.notification != null) {
      return;
    }

    final title =
        (message.notification?.title ?? message.data['title'] as String? ?? '')
            .trim();
    final body =
        (message.notification?.body ?? message.data['body'] as String? ?? '')
            .trim();
    if (title.isEmpty && body.isEmpty) return;

    final link = normalizeLink(message.data['link']);
    showForegroundBanner(
      title.isNotEmpty ? title : 'Aviso de Pateá',
      body,
      link: link,
    );
  }

  @visibleForTesting
  static void showForegroundBanner(
    String title,
    String body, {
    String? link,
  }) {
    final messenger = messengerKey.currentState;
    final ctx = messengerKey.currentContext;
    if (messenger == null || ctx == null) return;

    final c = ctx.c;
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: c.popover,
          elevation: 0,
          margin: const EdgeInsets.all(14),
          duration: const Duration(seconds: 5),
          shape: RoundedRectangleBorder(
            borderRadius: AppRadii.cardAll,
            side: BorderSide(color: c.primary.withValues(alpha: 0.45)),
          ),
          action: link == null
              ? null
              : SnackBarAction(
                  label: 'Ver',
                  textColor: c.primary,
                  onPressed: () => openLink(link),
                ),
          content: Row(
            children: [
              Icon(
                Icons.notifications_active_outlined,
                color: c.primary,
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.headline(
                        size: 13,
                        weight: FontWeight.w700,
                        color: c.textPrimary,
                      ),
                    ),
                    if (body.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        body,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.body(
                          size: 12,
                          color: c.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      );
  }

  static Future<void> initialize() async {
    try {
      await _authSub?.cancel();
      await _tokenRefreshSub?.cancel();
      await _foregroundSub?.cancel();
      await _openedSub?.cancel();

      FirebaseMessaging.onBackgroundMessage(pateaMessagingBackgroundHandler);
      await _messaging.setAutoInitEnabled(true);

      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
        await _messaging.setForegroundNotificationPresentationOptions(
          alert: true,
          badge: true,
          sound: true,
        );
      }

      // El token sólo se puede guardar con sesión iniciada, y hay que
      // volver a guardarlo cuando cambia de usuario.
      _authSub = FirebaseAuth.instance.authStateChanges().listen((user) {
        if (user != null) {
          _unregisteringUid = null;
          _registerFor(user.uid);
        }
      });

      _tokenRefreshSub = _messaging.onTokenRefresh.listen((token) {
        final uid = FirebaseAuth.instance.currentUser?.uid;
        if (uid != null) _saveToken(uid, token);
      });

      // Mensajes con la app abierta en primer plano.
      _foregroundSub = FirebaseMessaging.onMessage.listen(
        handleForegroundMessage,
      );

      // Tocar la notificación con la app en segundo plano.
      _openedSub = FirebaseMessaging.onMessageOpenedApp.listen(
        handleNotificationOpen,
      );

      // Tocar la notificación cuando la app estaba cerrada (cold start).
      final initialMessage = await _messaging.getInitialMessage();
      if (initialMessage != null) {
        handleNotificationOpen(initialMessage);
      }
    } catch (e, s) {
      FirebaseCrashlytics.instance.recordError(
        e,
        s,
        reason: 'NotificationsService.initialize',
      );
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
      FirebaseCrashlytics.instance.recordError(
        e,
        s,
        reason: 'requestPermission',
      );
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
  static Future<void> _saveToken(String uid, String token) {
    // Serializar escrituras permite esperar las que ya estaban en curso antes
    // de borrar; las que llegan durante el cierre no pueden recrear el token.
    _tokenWrites = _tokenWrites.then((_) async {
      if (_unregisteringUid == uid ||
          FirebaseAuth.instance.currentUser?.uid != uid) {
        return;
      }
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
    });
    return _tokenWrites;
  }

  /// Al cerrar sesión hay que sacar el token de este dispositivo o el usuario
  /// sigue recibiendo notificaciones de una cuenta que ya no está abierta.
  static Future<void> unregister(String uid) async {
    _unregisteringUid = uid;
    await _tokenWrites;
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
      FirebaseCrashlytics.instance.recordError(
        e,
        s,
        reason: 'unregisterToken',
      );
    }
  }

  static Future<void> dispose() async {
    if (_authListener != null) {
      _authState?.removeListener(_authListener!);
      _authListener = null;
    }
    await _tokenRefreshSub?.cancel();
    await _authSub?.cancel();
    await _foregroundSub?.cancel();
    await _openedSub?.cancel();
  }
}
