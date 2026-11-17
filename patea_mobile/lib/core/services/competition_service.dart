import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/competition_model.dart';
import '../models/group_model.dart';
import 'callable_functions.dart';
import 'firestore_service.dart';

final competitionServiceProvider = Provider<CompetitionService>((ref) {
  ref.watch(currentUidProvider);
  return CompetitionService(FirebaseFirestore.instance);
});
final competitionDetailProvider =
    StreamProvider.family<CompetitionModel?, (String, String)>(
      (ref, key) => ref
          .watch(competitionServiceProvider)
          .watchCompetition(key.$1, key.$2),
    );
final competitionMatchesProvider =
    StreamProvider.family<List<Map<String, dynamic>>, (String, String)>(
      (ref, key) =>
          ref.watch(competitionServiceProvider).watchMatches(key.$1, key.$2),
    );
final competitionTeamsProvider =
    StreamProvider.family<List<GroupTeamModel>, (String, String, String)>(
      (ref, key) => ref
          .watch(competitionServiceProvider)
          .watchTeams(
            key.$1,
            key.$2,
            key.$3.split(',').where((id) => id.isNotEmpty).toList(),
          ),
    );
final competitionApplicationsProvider =
    StreamProvider.family<List<Map<String, dynamic>>, (String, String)>(
      (ref, key) => ref
          .watch(competitionServiceProvider)
          .watchApplications(key.$1, key.$2),
    );
final myCompetitionApplicationsProvider =
    StreamProvider.family<List<Map<String, dynamic>>, (String, String, String)>(
      (ref, key) => ref
          .watch(competitionServiceProvider)
          .watchApplications(key.$1, key.$2, submittedBy: key.$3),
    );
final ownedCompetitionTeamsProvider =
    StreamProvider.family<List<GroupTeamModel>, String>(
      (ref, uid) => ref.watch(competitionServiceProvider).watchOwnedTeams(uid),
    );

class CompetitionPage {
  final List<CompetitionModel> items;
  final DocumentSnapshot<Map<String, dynamic>>? cursor;
  final bool hasMore;
  const CompetitionPage(this.items, {this.cursor, this.hasMore = false});
}

class CompetitionService {
  final FirebaseFirestore db;
  final Future<Map<String, dynamic>> Function(String, Map<String, dynamic>)?
  gateway;
  CompetitionService(this.db, {this.gateway});
  Future<Map<String, dynamic>> command(
    String collection,
    String id,
    String action, [
    Map<String, dynamic> payload = const {},
  ]) => gateway != null
      ? gateway!('manageCompetition', {
          'collection': collection,
          'id': id,
          'action': action,
          ...payload,
        })
      : callFunction('manageCompetition', {
          'collection': collection,
          'id': id,
          'action': action,
          ...payload,
        }, timeout: const Duration(seconds: 120));
  Future<CompetitionPage> page({
    required String collection,
    required String scope,
    required String? uid,
    required String? groupId,
    DocumentSnapshot<Map<String, dynamic>>? after,
  }) async {
    if (uid == null ||
        (scope == 'group' && (groupId == null || groupId.isEmpty)))
      return const CompetitionPage([]);
    Query<Map<String, dynamic>> query = db.collection(collection);
    if (scope == 'public') {
      query = query.where('isPublic', isEqualTo: true);
    } else if (scope == 'owner') {
      query = query.where('ownerUid', isEqualTo: uid);
    } else {
      query = query.where('groupId', isEqualTo: groupId);
    }
    // Document ID orders legacy documents too, including those without createdAt.
    query = query.orderBy(FieldPath.documentId).limit(20);
    if (after != null) query = query.startAfterDocument(after);
    final snap = await query.get();
    return CompetitionPage(
      snap.docs
          .map(
            (d) => CompetitionModel.fromFirestore(
              d.data(),
              d.id,
              collection == 'cups' ? 'cup' : 'league',
            ),
          )
          .toList(),
      cursor: snap.docs.lastOrNull,
      hasMore: snap.docs.length == 20,
    );
  }

  Stream<CompetitionModel?> watchCompetition(String collection, String id) => db
      .collection(collection)
      .doc(id)
      .snapshots()
      .map(
        (s) => s.exists
            ? CompetitionModel.fromFirestore(
                s.data()!,
                s.id,
                collection == 'cups' ? 'cup' : 'league',
              )
            : null,
      );
  Stream<List<Map<String, dynamic>>> watchMatches(
    String collection,
    String id,
  ) => db
      .collection('matches')
      .where('leagueInfo.leagueId', isEqualTo: id)
      .limit(500)
      .snapshots()
      .map(
        (s) => [
          for (final doc in s.docs)
            if (doc.data()['type'] == (collection == 'cups' ? 'cup' : 'league'))
              {...doc.data(), 'id': doc.id},
        ],
      );

  Stream<List<Map<String, dynamic>>> _merge(
    List<Stream<List<Map<String, dynamic>>>> sources,
  ) {
    late StreamController<List<Map<String, dynamic>>> controller;
    final subscriptions = <StreamSubscription<List<Map<String, dynamic>>>>[];
    final values = List<List<Map<String, dynamic>>?>.filled(
      sources.length,
      null,
    );
    var cancelled = false;
    controller = StreamController(
      onListen: () {
        if (sources.isEmpty) {
          controller.add([]);
          return;
        }
        for (var i = 0; i < sources.length; i++) {
          subscriptions.add(
            sources[i].listen(
              (items) {
                if (cancelled) return;
                values[i] = items;
                if (values.every((v) => v != null))
                  controller.add([for (final v in values) ...v!]);
              },
              onError: (Object e, StackTrace st) {
                if (!cancelled) controller.addError(e, st);
              },
            ),
          );
        }
      },
      onCancel: () async {
        cancelled = true;
        for (final s in subscriptions) {
          await s.cancel();
        }
      },
    );
    return controller.stream;
  }

  Stream<List<Map<String, dynamic>>> _documents(
    Query<Map<String, dynamic>> query,
  ) => query.snapshots().map(
    (s) => [
      for (final d in s.docs) {...d.data(), 'id': d.id},
    ],
  );
  Stream<List<GroupTeamModel>> watchTeams(
    String collection,
    String id,
    List<String> ids,
  ) {
    final sources = <Stream<List<Map<String, dynamic>>>>[];
    for (var i = 0; i < ids.length; i += 30) {
      sources.add(
        _documents(
          db
              .collection('teams')
              .where(
                FieldPath.documentId,
                whereIn: ids.sublist(i, (i + 30).clamp(0, ids.length)),
              ),
        ),
      );
    }
    sources.add(
      _documents(
        db.collection(collection).doc(id).collection('teams').limit(32),
      ),
    );
    return _merge(sources).map((items) {
      final byId = {
        for (final d in items)
          d['id'] as String: GroupTeamModel.fromMap(d, d['id'] as String),
      };
      return [
        for (final id in ids)
          if (byId[id] != null) byId[id]!,
      ];
    });
  }

  Stream<List<GroupTeamModel>> watchOwnedTeams(String uid) =>
      _merge([
        _documents(db.collection('teams').where('createdBy', isEqualTo: uid)),
        _documents(db.collection('teams').where('ownerUid', isEqualTo: uid)),
      ]).map(
        (items) => {
          for (final d in items)
            d['id'] as String: GroupTeamModel.fromMap(d, d['id'] as String),
        }.values.toList(),
      );
  Stream<List<Map<String, dynamic>>> watchApplications(
    String collection,
    String id, {
    String? submittedBy,
  }) {
    Query<Map<String, dynamic>> query = db
        .collection('competitionApplications')
        .where('competitionId', isEqualTo: id)
        .where(
          'competitionType',
          isEqualTo: collection == 'cups' ? 'cup' : 'league',
        );
    if (submittedBy != null)
      query = query.where('submittedBy', isEqualTo: submittedBy);
    return _merge([
      _documents(query).map(
        (items) => [
          for (final d in items) {...d, 'source': 'team'},
        ],
      ),
      if (submittedBy == null)
        _documents(
          db.collection(collection).doc(id).collection('applications'),
        ).map(
          (items) => [
            for (final d in items) {...d, 'source': 'external'},
          ],
        ),
    ]);
  }

  Future<void> startLeague(
    String id,
    Map<String, dynamic> schedule,
    String frequency,
  ) async {
    final data = {
      'leagueId': id,
      'startDate': schedule['date'],
      'time': schedule['time'],
      'location': schedule['location'],
      'matchFrequency': frequency,
    };
    if (gateway != null) {
      await gateway!('startLeagueTournament', data);
    } else {
      await callFunction(
        'startLeagueTournament',
        data,
        timeout: const Duration(seconds: 120),
      );
    }
  }

  Future<String> create({
    required String collection,
    required String requestId,
    required Map<String, dynamic> data,
  }) async =>
      (await command(collection, '', 'create', {
            'requestId': requestId,
            ...data,
          }))['id']
          as String;
  Future<String> prepareCupMatch(String id, BracketMatchModel match) async {
    if (match.matchId != null) return match.matchId!;
    return (await command('cups', id, 'prepareCupMatch', {
          'bracketMatchId': match.id,
        }))['matchId']
        as String;
  }

  Future<void> recordResult(
    String collection,
    String id,
    String matchId,
    int a,
    int b, {
    String? penaltyWinnerId,
  }) async {
    await command(collection, id, 'recordResult', {
      'matchId': matchId,
      'team1': a,
      'team2': b,
      'penaltyWinnerId': penaltyWinnerId,
    });
    await command(collection, id, 'syncResult', {'matchId': matchId});
  }
}
