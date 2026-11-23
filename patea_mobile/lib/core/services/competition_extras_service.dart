import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/competition_extras_models.dart';
import 'callable_functions.dart';

/// Avisos, sedes y patrocinadores de una liga o copa. Todo lo que cambia pasa
/// por funciones del servidor: el organizador es el único que puede escribir.
class CompetitionExtrasService {
  /// Manda un aviso. Devuelve a cuántas personas les llegó.
  Future<int> sendMessage(
    String collection,
    String id, {
    required String subject,
    required String body,
    required String audience,
  }) async {
    final result = await callFunction('sendCompetitionMessage', {
      'collection': collection,
      'id': id,
      'subject': subject,
      'body': body,
      'audience': audience,
    }, timeout: const Duration(seconds: 60));
    return (result['recipientCount'] as num?)?.toInt() ?? 0;
  }

  Future<void> saveVenue(
    String collection,
    String id, {
    String? venueId,
    required String name,
    String address = '',
    String capacity = '',
    String costPerMatch = '',
    String notes = '',
  }) async {
    await callFunction('manageCompetitionVenue', {
      'collection': collection,
      'id': id,
      'action': venueId == null ? 'add' : 'update',
      'venueId': ?venueId,
      'venue': {
        'name': name,
        'address': address,
        'capacity': capacity,
        'costPerMatch': costPerMatch,
        'notes': notes,
      },
    });
  }

  Future<void> removeVenue(String collection, String id, String venueId) async {
    await callFunction('manageCompetitionVenue', {
      'collection': collection,
      'id': id,
      'action': 'remove',
      'venueId': venueId,
    });
  }

  Future<void> saveSponsor(
    String collection,
    String id, {
    String? sponsorId,
    required String name,
    String websiteUrl = '',
  }) async {
    await callFunction('manageCompetitionSponsor', {
      'collection': collection,
      'id': id,
      'action': sponsorId == null ? 'add' : 'update',
      'sponsorId': ?sponsorId,
      'sponsor': {'name': name, 'websiteUrl': websiteUrl},
    });
  }

  Future<void> removeSponsor(
    String collection,
    String id,
    String sponsorId,
  ) async {
    await callFunction('manageCompetitionSponsor', {
      'collection': collection,
      'id': id,
      'action': 'remove',
      'sponsorId': sponsorId,
    });
  }
}

final competitionExtrasServiceProvider = Provider<CompetitionExtrasService>(
  (ref) => CompetitionExtrasService(),
);

/// Las sedes de una competición, por nombre.
final competitionVenuesProvider = StreamProvider.autoDispose
    .family<List<CompetitionVenue>, (String, String)>(
      (ref, key) => FirebaseFirestore.instance
          .collection(key.$1)
          .doc(key.$2)
          .collection('venues')
          .snapshots()
          .map(
            (snap) =>
                [
                  for (final d in snap.docs)
                    CompetitionVenue.fromMap(d.data(), d.id),
                ]..sort(
                  (a, b) =>
                      a.name.toLowerCase().compareTo(b.name.toLowerCase()),
                ),
          ),
    );

/// Los avisos que mandó el organizador, del más nuevo al más viejo. Solo los
/// puede leer él (las reglas lo exigen).
final competitionMessagesProvider = StreamProvider.autoDispose
    .family<List<CompetitionMessage>, (String, String)>(
      (ref, key) => FirebaseFirestore.instance
          .collection(key.$1)
          .doc(key.$2)
          .collection('messages')
          .orderBy('createdAt', descending: true)
          .limit(30)
          .snapshots()
          .map(
            (snap) => [
              for (final d in snap.docs)
                CompetitionMessage.fromMap(d.data(), d.id),
            ],
          ),
    );
