import '../constants/performance_tags.dart';

/// Port de EvaluationAssignment (src/lib/types.ts) — `matches/{id}/assignments/{id}`.
class EvaluationAssignmentModel {
  final String id;
  final String matchId;
  final String evaluatorId;
  final String subjectId;
  final String status; // pending, completed

  EvaluationAssignmentModel({
    required this.id,
    required this.matchId,
    required this.evaluatorId,
    required this.subjectId,
    required this.status,
  });

  factory EvaluationAssignmentModel.fromMap(Map<String, dynamic> map, String id) {
    return EvaluationAssignmentModel(
      id: id,
      matchId: map['matchId'] as String? ?? '',
      evaluatorId: map['evaluatorId'] as String? ?? '',
      subjectId: map['subjectId'] as String? ?? '',
      status: map['status'] as String? ?? 'pending',
    );
  }
}

/// Un jugador asignado a evaluar, con los datos mínimos para mostrar en la
/// tarjeta del inbox y armar el formulario (mismo shape que
/// PlayerEvaluationFormData en la web, previo a completar el formulario).
class AssignedPlayerInfo {
  final String id;
  final String name;
  final String? photoURL;
  final String position;

  AssignedPlayerInfo({required this.id, required this.name, this.photoURL, required this.position});
}

/// Item del inbox de evaluaciones — no es un doc de Firestore, se arma
/// client-side combinando assignments + matches + processedSubmissions,
/// igual que `PendingItem` en src/app/evaluations/page.tsx.
class EvaluationInboxItem {
  final String matchId;
  final String matchTitle;
  final String matchDate;
  final bool isSubmitted;
  final String? submittedAt;
  final int? submittedEvaluationsCount;
  final int? submittedGoals;
  final int? submittedAssists;
  final List<AssignedPlayerInfo> assignedPlayers;

  EvaluationInboxItem({
    required this.matchId,
    required this.matchTitle,
    required this.matchDate,
    required this.isSubmitted,
    this.submittedAt,
    this.submittedEvaluationsCount,
    this.submittedGoals,
    this.submittedAssists,
    this.assignedPlayers = const [],
  });
}

/// Una evaluación pendiente de un formulario de "evaluar partido" — combina
/// el assignment con los datos del jugador y la elección del evaluador
/// (points o tags). El tipo 'text' (con análisis IA) no se porta en esta
/// pasada — ver cabecera de evaluation_form_screen.dart.
class PlayerEvaluationDraft {
  final String assignmentId;
  final String subjectId;
  final String displayName;
  final String photoURL;
  final String position;
  String evaluationType; // 'points' | 'tags'
  double rating;
  List<PerformanceTagItem> performanceTags;
  final List<PerformanceTagItem> tagPool;

  PlayerEvaluationDraft({
    required this.assignmentId,
    required this.subjectId,
    required this.displayName,
    required this.photoURL,
    required this.position,
    required this.tagPool,
    this.evaluationType = 'points',
    this.rating = 5,
    List<PerformanceTagItem>? performanceTags,
  }) : performanceTags = performanceTags ?? [];

  Map<String, dynamic> toSubmissionMap() {
    return {
      'assignmentId': assignmentId,
      'subjectId': subjectId,
      'displayName': displayName,
      'photoURL': photoURL,
      'position': position,
      'evaluationType': evaluationType,
      if (evaluationType == 'points') 'rating': rating.round(),
      if (evaluationType == 'tags')
        'performanceTags': performanceTags
            .map((t) => {
                  'id': t.id,
                  'name': t.name,
                  'description': t.description,
                  'impact': t.impact,
                  'positions': t.positions,
                  // El backend (igual que PerformanceTag en la web) espera
                  // effects como TagEffect[] ({attribute, change}[]), no como
                  // el Map<String,int> que usa el modelo Dart internamente.
                  'effects': t.effects.entries.map((e) => {'attribute': e.key, 'change': e.value}).toList(),
                })
            .toList(),
    };
  }
}

/// Una solicitud de "quiero saber quién me evaluó" dirigida a este usuario
/// (evaluador) — port de IdentityRevealRequest en page.tsx.
class IdentityRevealRequest {
  final String evaluationId;
  final String fromPlayerName;
  final String fromPlayerPhotoUrl;
  final String matchTitle;

  IdentityRevealRequest({
    required this.evaluationId,
    required this.fromPlayerName,
    required this.fromPlayerPhotoUrl,
    required this.matchTitle,
  });
}
