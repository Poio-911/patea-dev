"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEvaluationSubmission = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
/**
 * Cloud Function que procesa submissions de evaluaciones automáticamente.
 *
 * Trigger: Cuando se crea un documento en `evaluationSubmissions/{submissionId}`
 *
 * Proceso:
 * 1. Lee la submission
 * 2. Crea selfEvaluation si hay goles/asistencias
 * 3. Crea evaluaciones peer en `evaluations/` y actualiza assignments
 * 4. Soft delete: mueve a `processedSubmissions/`
 * 5. Elimina submission original
 *
 * El client-side `processPendingSubmissions` queda como fallback/backup.
 */
exports.processEvaluationSubmission = (0, firestore_1.onDocumentCreated)({
    document: 'evaluationSubmissions/{submissionId}',
    region: 'us-central1',
}, async (event) => {
    var _a;
    const db = admin.firestore();
    const submissionId = event.params.submissionId;
    const submissionData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!submissionData) {
        console.warn(`[ProcessSubmission] No data for submission ${submissionId}`);
        return;
    }
    const { evaluatorId, matchId, submission: formData } = submissionData;
    if (!evaluatorId || !matchId || !formData) {
        console.error(`[ProcessSubmission] Missing required fields in submission ${submissionId}`);
        return;
    }
    try {
        await db.runTransaction(async (transaction) => {
            // 1. Self-evaluation (goals/assists reported by the evaluator)
            if (formData.evaluatorGoals > 0 || (formData.evaluatorAssists && formData.evaluatorAssists > 0)) {
                const selfEvalRef = db.collection(`matches/${matchId}/selfEvaluations`).doc();
                transaction.set(selfEvalRef, {
                    playerId: evaluatorId,
                    matchId,
                    goals: formData.evaluatorGoals || 0,
                    assists: formData.evaluatorAssists || 0,
                    reportedAt: submissionData.submittedAt || new Date().toISOString(),
                });
            }
            // 2. Peer evaluations
            if (formData.evaluations && Array.isArray(formData.evaluations)) {
                for (const evaluation of formData.evaluations) {
                    const evalRef = db.collection('evaluations').doc();
                    const newEval = {
                        assignmentId: evaluation.assignmentId,
                        playerId: evaluation.subjectId,
                        evaluatorId,
                        matchId,
                        goals: 0,
                        evaluatedAt: submissionData.submittedAt || new Date().toISOString(),
                    };
                    if (evaluation.evaluationType === 'points') {
                        newEval.rating = evaluation.rating;
                    }
                    else if (evaluation.evaluationType === 'tags') {
                        newEval.performanceTags = evaluation.performanceTags;
                    }
                    else if (evaluation.evaluationType === 'text') {
                        if (evaluation.aiAttributeChanges) {
                            newEval.aiAttributeChanges = evaluation.aiAttributeChanges;
                        }
                        if (evaluation.aiConfidence) {
                            newEval.aiConfidence = evaluation.aiConfidence;
                        }
                        newEval.textDescription = evaluation.textDescription || '';
                        if (evaluation.aiSummary) {
                            newEval.aiSummary = evaluation.aiSummary;
                        }
                    }
                    transaction.set(evalRef, newEval);
                    // Update assignment status
                    const assignRef = db.doc(`matches/${matchId}/assignments/${evaluation.assignmentId}`);
                    transaction.update(assignRef, {
                        status: 'completed',
                        evaluationId: evalRef.id,
                    });
                }
            }
            // 3. Soft delete → processedSubmissions (for audit trail)
            const processedRef = db.collection(`matches/${matchId}/processedSubmissions`).doc();
            transaction.set(processedRef, Object.assign(Object.assign({}, submissionData), { processedAt: new Date().toISOString(), originalSubmissionId: submissionId, processingStatus: 'completed', processedBy: 'cloud-function' }));
            // 4. Delete original submission
            transaction.delete(db.doc(`evaluationSubmissions/${submissionId}`));
        });
        console.log(`[ProcessSubmission] Processed submission ${submissionId} for match ${matchId}`);
    }
    catch (error) {
        console.error(`[ProcessSubmission] Error processing submission ${submissionId}:`, error);
        throw error; // Re-throw to trigger retry
    }
});
//# sourceMappingURL=process-evaluation-submission.js.map