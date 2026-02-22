import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

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
export const processEvaluationSubmission = onDocumentCreated({
    document: 'evaluationSubmissions/{submissionId}',
    region: 'us-central1',
}, async (event) => {
    const db = admin.firestore();
    const submissionId = event.params.submissionId;
    const submissionData = event.data?.data();

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
            // 1. Self-evaluation (goals/assists/personal chronicle/mvp vote reported by the evaluator)
            if (
                formData.evaluatorGoals > 0 ||
                (formData.evaluatorAssists && formData.evaluatorAssists > 0) ||
                formData.personalChronicle ||
                formData.mvpVote
            ) {
                const selfEvalRef = db.collection(`matches/${matchId}/selfEvaluations`).doc();
                const selfEvalData: Record<string, unknown> = {
                    playerId: evaluatorId,
                    matchId,
                    goals: formData.evaluatorGoals || 0,
                    assists: formData.evaluatorAssists || 0,
                    reportedAt: submissionData.submittedAt || new Date().toISOString(),
                };
                if (formData.personalChronicle) {
                    selfEvalData.personalChronicle = formData.personalChronicle;
                }
                if (formData.mvpVote) {
                    selfEvalData.mvpVote = formData.mvpVote;
                }
                transaction.set(selfEvalRef, selfEvalData);
            }

            // 1b. Increment MVP vote counter on the voted player
            if (formData.mvpVote && typeof formData.mvpVote === 'string') {
                const votedPlayerRef = db.collection('players').doc(formData.mvpVote);
                transaction.update(votedPlayerRef, {
                    'stats.mvpVotes': admin.firestore.FieldValue.increment(1),
                });
            }

            // 2. Peer evaluations
            if (formData.evaluations && Array.isArray(formData.evaluations)) {
                for (const evaluation of formData.evaluations) {
                    const evalRef = db.collection('evaluations').doc();
                    const newEval: Record<string, unknown> = {
                        assignmentId: evaluation.assignmentId,
                        playerId: evaluation.subjectId,
                        evaluatorId,
                        matchId,
                        goals: 0,
                        evaluatedAt: submissionData.submittedAt || new Date().toISOString(),
                    };

                    if (evaluation.evaluationType === 'points') {
                        newEval.rating = evaluation.rating;
                    } else if (evaluation.evaluationType === 'tags') {
                        newEval.performanceTags = evaluation.performanceTags;
                    } else if (evaluation.evaluationType === 'text') {
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
            transaction.set(processedRef, {
                ...submissionData,
                processedAt: new Date().toISOString(),
                originalSubmissionId: submissionId,
                processingStatus: 'completed',
                processedBy: 'cloud-function',
            });

            // 4. Delete original submission
            transaction.delete(db.doc(`evaluationSubmissions/${submissionId}`));
        });

        console.log(`[ProcessSubmission] Processed submission ${submissionId} for match ${matchId}`);
    } catch (error) {
        console.error(`[ProcessSubmission] Error processing submission ${submissionId}:`, error);
        throw error; // Re-throw to trigger retry
    }
});
