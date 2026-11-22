import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../utils/photo_url.dart';
import 'callable_functions.dart';
import 'notifications_service.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(FirebaseAuth.instance);
});

final authStateProvider = StreamProvider<User?>((ref) {
  return ref.watch(authServiceProvider).authStateChanges;
});

/// Safe resolved photo URL from the signed-in Firebase Auth user.
final currentAuthPhotoUrlProvider = Provider<String?>((ref) {
  final user = ref.watch(authStateProvider).value;
  if (user == null) return null;
  try {
    return nonEmptyPhotoUrl(user.photoURL);
  } on NoSuchMethodError {
    // Partial User test stubs may only override `uid`.
    return null;
  }
});

class AuthService {
  final FirebaseAuth _auth;

  AuthService(this._auth);

  Stream<User?> get authStateChanges => _auth.authStateChanges();

  User? get currentUser => _auth.currentUser;

  Future<UserCredential> signInWithEmail(String email, String password) async {
    return await _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
  }

  /// Registra la cuenta Y crea los documentos que necesita para existir.
  ///
  /// Sin el segundo paso la cuenta queda sólo en Authentication: entra y no
  /// tiene perfil de jugador, ni grupo, ni nada. Era exactamente lo que
  /// pasaba — el registro creaba el usuario en Auth y nada más, mientras la
  /// web sí llamaba a su `initializeUserProfileAction`.
  ///
  /// Si la inicialización falla se borra la cuenta recién creada, igual que
  /// hace la web (register/page.tsx:137). Dejar una cuenta a medias es peor
  /// que no crearla: el usuario puede iniciar sesión en una app rota y no
  /// tiene forma de salir de ahí.
  Future<UserCredential> registerWithEmail(
    String email,
    String password, {
    required String displayName,
    required String position,
  }) async {
    final cred = await _auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );

    try {
      await cred.user?.updateDisplayName(displayName);
      await callFunction('initializeUserProfile', {
        'displayName': displayName,
        'position': position,
      });
    } catch (e) {
      await cred.user?.delete().catchError((_) {});
      rethrow;
    }

    return cred;
  }

  /// Repara una cuenta que quedó sin sus documentos.
  ///
  /// La callable es idempotente, así que llamarla al iniciar sesión no cuesta
  /// nada cuando la cuenta está bien, y arregla las que se crearon antes de
  /// este cambio. Falla en silencio: si no anda, el usuario igual entra.
  Future<void> ensureProfile() async {
    final user = _auth.currentUser;
    if (user == null) return;
    try {
      final authPhoto = nonEmptyPhotoUrl(user.photoURL);
      await callFunction('initializeUserProfile', {
        'displayName': user.displayName?.trim().isNotEmpty == true
            ? user.displayName!.trim()
            : (user.email?.split('@').first ?? 'Jugador'),
        'position': 'MED',
        'photoURL': ?authPhoto,
      });
    } catch (_) {
      // Que no se pueda reparar no puede impedir el ingreso.
    }
  }

  Future<UserCredential> signInWithGoogle() async {
    final GoogleAuthProvider googleProvider = GoogleAuthProvider();
    return await _auth.signInWithProvider(googleProvider);
  }

  /// Sign in with Apple (guideline 4.8: hay login con Google, así que Apple
  /// exige ofrecer este también). Usa el flujo nativo de iOS a través de
  /// Firebase, sin plugin extra.
  ///
  /// Apple sólo entrega el nombre la PRIMERA vez que la persona autoriza la app,
  /// y Firebase no siempre lo copia a `displayName`: se lo pasamos nosotros a
  /// `ensureProfile` desde acá para que el perfil no quede como "Jugador".
  Future<UserCredential> signInWithApple() async {
    final provider = AppleAuthProvider()
      ..addScope('email')
      ..addScope('name');
    final cred = await _auth.signInWithProvider(provider);

    final user = cred.user;
    final profile = cred.additionalUserInfo?.profile;
    final given = (profile?['firstName'] ?? '').toString().trim();
    final family = (profile?['lastName'] ?? '').toString().trim();
    final fullName = '$given $family'.trim();
    if (user != null &&
        (user.displayName ?? '').trim().isEmpty &&
        fullName.isNotEmpty) {
      await user.updateDisplayName(fullName);
    }
    return cred;
  }

  /// Con qué se inició sesión: decide cómo se vuelve a autenticar al borrar.
  bool get usesPassword =>
      _auth.currentUser?.providerData.any((p) => p.providerId == 'password') ??
      false;

  /// Borra la cuenta y sus datos (guideline 5.1.1(v)).
  ///
  /// Firebase y el servidor piden una sesión iniciada hace poco, así que
  /// primero se vuelve a autenticar: con la contraseña, o con Apple/Google
  /// según cómo entró. Si la cuenta es de Apple se revoca además el permiso
  /// concedido a la app, como exige Apple al borrar una cuenta con Sign in
  /// with Apple.
  Future<void> deleteAccount({String? password}) async {
    final user = _auth.currentUser;
    if (user == null) throw Exception('No hay sesión activa.');

    final providers = user.providerData.map((p) => p.providerId).toSet();
    String? appleAuthorizationCode;
    if (providers.contains('password')) {
      final email = user.email;
      if (email == null || password == null || password.isEmpty) {
        throw FirebaseAuthException(code: 'missing-password');
      }
      await user.reauthenticateWithCredential(
        EmailAuthProvider.credential(email: email, password: password),
      );
    } else if (providers.contains('apple.com')) {
      final result = await user.reauthenticateWithProvider(
        AppleAuthProvider()..addScope('email'),
      );
      appleAuthorizationCode = result.additionalUserInfo?.authorizationCode;
    } else if (providers.contains('google.com')) {
      await user.reauthenticateWithProvider(GoogleAuthProvider());
    }

    // El ID token tiene que reflejar la sesión recién renovada.
    await user.getIdToken(true);

    if (appleAuthorizationCode != null) {
      try {
        await _auth.revokeTokenWithAuthorizationCode(appleAuthorizationCode);
      } catch (_) {
        // Si Apple no responde no frenamos el borrado: es lo que pidió la persona.
      }
    }

    await callFunction(
      'deleteMyAccount',
      const {},
      timeout: const Duration(seconds: 150),
    );

    try {
      await _auth.signOut();
    } catch (_) {
      // La cuenta ya no existe; el listener de sesión igual la va a limpiar.
    }
  }

  Future<void> signOut() async {
    final uid = _auth.currentUser?.uid;
    if (uid != null) await NotificationsService.unregister(uid);
    await _auth.signOut();
  }
}
