import 'dart:async';

import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'core/services/notifications_service.dart';
import 'core/theme/app_theme.dart';
import 'firebase_options.dart';

void main() {
  // Todo el arranque corre dentro de la misma zona protegida, así que los
  // errores asincrónicos que no atrapa nadie terminan en Crashlytics en vez
  // de perderse. Antes no había ningún manejador global: si la app crasheaba
  // en el celular de alguien, esa información no llegaba a ningún lado.
  runZonedGuarded<Future<void>>(
    () async {
      WidgetsFlutterBinding.ensureInitialized();

      // Modo nativo Edge-to-Edge: toda la pantalla inmersiva (detrás de status y nav bar)
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      SystemChrome.setSystemUIOverlayStyle(
        const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          systemNavigationBarColor: Colors.transparent,
          systemNavigationBarIconBrightness: Brightness.light,
          systemNavigationBarDividerColor: Colors.transparent,
        ),
      );

      // En Android, desde que existe `google-services.json` + el plugin de
      // Gradle, el SDK nativo inicializa la app por defecto ANTES de que
      // corra Dart. Volver a inicializarla acá tira `duplicate-app` y, como
      // eso pasaba antes de `runApp`, la pantalla quedaba en blanco.
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        );
      }

      await _initCrashlytics();
      await _initAppCheck();
      await NotificationsService.initialize();

      runApp(
        const ProviderScope(
          child: PateaApp(),
        ),
      );
    },
    (error, stack) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
    },
  );
}

Future<void> _initCrashlytics() async {
  // En debug los crashes quedan en la consola y no ensucian el panel.
  await FirebaseCrashlytics.instance
      .setCrashlyticsCollectionEnabled(!kDebugMode);

  // Errores del framework de Flutter (excepciones dentro de build/layout/paint).
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    FirebaseCrashlytics.instance.recordFlutterError(details);
  };

  // Errores de la plataforma que no pasan por el framework.
  PlatformDispatcher.instance.onError = (error, stack) {
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
    return true;
  };
}

Future<void> _initAppCheck() async {
  // App Check es lo que hace que la API key embebida en el cliente sea segura:
  // atestigua que la petición viene de una build legítima de la app y no de un
  // script. Sin esto, cualquiera con la key podía abrir un listener sobre
  // `players` o `matches` e invocar las Cloud Functions desde afuera.
  //
  // Se activa primero en modo monitoreo desde la consola de Firebase: hay que
  // ver el tráfico legítimo antes de forzar el cumplimiento, o se cae la web
  // en producción.
  try {
    await FirebaseAppCheck.instance.activate(
      // En debug hace falta registrar el token que imprime el log en
      // Firebase Console → App Check → Apps → Administrar tokens de depuración.
      providerAndroid:
          kDebugMode ? AndroidDebugProvider() : AndroidPlayIntegrityProvider(),
      providerApple: kDebugMode ? AppleDebugProvider() : AppleAppAttestProvider(),
    );
  } catch (e, s) {
    // Que App Check no arranque no debe impedir usar la app.
    FirebaseCrashlytics.instance.recordError(e, s, reason: 'App Check activate');
  }
}

final analyticsProvider = Provider<FirebaseAnalytics>((ref) {
  return FirebaseAnalytics.instance;
});

class PateaApp extends ConsumerWidget {
  const PateaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'Pateá',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      routerConfig: router,
    );
  }
}
