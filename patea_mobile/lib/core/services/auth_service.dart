import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'callable_functions.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(FirebaseAuth.instance);
});

final authStateProvider = StreamProvider<User?>((ref) {
  return ref.watch(authServiceProvider).authStateChanges;
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
      await callFunction('initializeUserProfile', {
        'displayName': user.displayName?.trim().isNotEmpty == true
            ? user.displayName!.trim()
            : (user.email?.split('@').first ?? 'Jugador'),
        'position': 'MED',
      });
    } catch (_) {
      // Que no se pueda reparar no puede impedir el ingreso.
    }
  }

  Future<UserCredential> signInWithGoogle() async {
    final GoogleAuthProvider googleProvider = GoogleAuthProvider();
    return await _auth.signInWithProvider(googleProvider);
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }
}
