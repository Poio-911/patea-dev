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

/// Impacto sugerido por el análisis de una reseña escrita.
class TextPerformanceChange {
  final String attribute;
  final int change;
  final String reason;

  const TextPerformanceChange({
    required this.attribute,
    required this.change,
    required this.reason,
  });

  factory TextPerformanceChange.fromMap(Map<String, dynamic> map) {
    return TextPerformanceChange(
      attribute: (map['attribute'] as String? ?? '').toLowerCase(),
      change: (map['change'] as num?)?.round() ?? 0,
      reason: map['reason'] as String? ?? '',
    );
  }
}

/// Vista previa del análisis de una reseña de partido.
class TextPerformancePreview {
  final String summary;
  final double confidence;
  final List<TextPerformanceChange> attributeChanges;

  const TextPerformancePreview({
    required this.summary,
    required this.confidence,
    required this.attributeChanges,
  });

  factory TextPerformancePreview.fromMap(Map<String, dynamic> map) {
    final rawChanges = map['attributeChanges'] as List<dynamic>? ?? const [];
    return TextPerformancePreview(
      summary: map['summary'] as String? ?? '',
      confidence: (map['confidence'] as num?)?.toDouble() ?? 0.0,
      attributeChanges: rawChanges
          .whereType<Map>()
          .map((m) => TextPerformanceChange.fromMap(Map<String, dynamic>.from(m)))
          .where((c) => c.attribute.isNotEmpty && c.change != 0)
          .toList(),
    );
  }
}

/// Una evaluación pendiente de un formulario de "evaluar partido" — combina
/// el assignment con los datos del jugador y la elección del evaluador
/// (points, tags o text).
class PlayerEvaluationDraft {
  final String assignmentId;
  final String subjectId;
  final String displayName;
  final String photoURL;
  final String position;
  final int currentOvr;
  final Map<String, int> currentAttributes;
  String evaluationType; // 'points' | 'tags' | 'text'
  String reviewMode; // 'write' | 'audio' (cuando evaluationType == 'text')
  double rating;
  List<PerformanceTagItem> performanceTags;
  String textDescription;
  String? localAudioPath;
  String? uploadedAudioPath;
  int audioDurationSec;
  TextPerformancePreview? aiPreview;
  final List<PerformanceTagItem> tagPool;

  PlayerEvaluationDraft({
    required this.assignmentId,
    required this.subjectId,
    required this.displayName,
    required this.photoURL,
    required this.position,
    required this.tagPool,
    this.currentOvr = 60,
    Map<String, int>? currentAttributes,
    this.evaluationType = 'points',
    this.reviewMode = 'write',
    this.rating = 5,
    List<PerformanceTagItem>? performanceTags,
    this.textDescription = '',
    this.localAudioPath,
    this.uploadedAudioPath,
    this.audioDurationSec = 0,
    this.aiPreview,
  }) : currentAttributes = currentAttributes ??
           {
             'pac': currentOvr,
             'sho': currentOvr,
             'pas': currentOvr,
             'dri': currentOvr,
             'def': currentOvr,
             'phy': currentOvr,
           },
       performanceTags = performanceTags ?? [];

  bool get isAudioReview => evaluationType == 'text' && reviewMode == 'audio';
  bool get hasReadyAudio =>
      uploadedAudioPath != null && uploadedAudioPath!.trim().isNotEmpty;

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
      if (evaluationType == 'text' && isAudioReview && hasReadyAudio) ...{
        'audioPath': uploadedAudioPath!.trim(),
        if (audioDurationSec > 0) 'audioDurationSec': audioDurationSec,
      } else if (evaluationType == 'text')
        'textDescription': textDescription.trim(),
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
  final bool hasAudio;

  IdentityRevealRequest({
    required this.evaluationId,
    required this.fromPlayerName,
    required this.fromPlayerPhotoUrl,
    required this.matchTitle,
    this.hasAudio = false,
  });
}
