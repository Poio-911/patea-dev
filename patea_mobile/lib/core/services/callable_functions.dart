import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

const kFunctionsBaseUrl = 'https://us-central1-mil-disculpis.cloudfunctions.net';

/// Invoca una Cloud Function "callable" por HTTP directo (POST {data} con
/// Bearer del ID token), en vez de usar el plugin `cloud_functions`.
///
/// Se hizo así porque ese plugin se quedó colgado indefinidamente sin
/// resolver la Future en el emulador Android usado para esta migración —
/// Firestore/Auth funcionan bien en el mismo emulador, así que el problema
/// es específico del canal nativo de cloud_functions, no de la red.
Future<Map<String, dynamic>> callFunction(
  String name,
  Map<String, dynamic> data, {
  Duration timeout = const Duration(seconds: 30),
}) async {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) throw Exception('No hay sesión activa.');
  final idToken = await user.getIdToken();

  final response = await http
      .post(
        Uri.parse('$kFunctionsBaseUrl/$name'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $idToken',
        },
        body: jsonEncode({'data': data}),
      )
      .timeout(timeout);

  final decoded = jsonDecode(response.body) as Map<String, dynamic>;
  if (response.statusCode != 200) {
    final message = (decoded['error'] as Map?)?['message'] ?? 'Error desconocido ($name).';
    throw Exception(message);
  }

  return decoded['result'] as Map<String, dynamic>;
}
