import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Reloj consultado al construir la vista; los tests pueden fijar el día.
final clockProvider = Provider<DateTime Function()>((ref) => DateTime.now);
