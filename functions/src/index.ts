import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export all functions
export { resetMonthlyCredits } from './scheduled/reset-monthly-credits';
export { sendMatchReminders } from './scheduled/send-match-reminders';
export { processEvaluationSubmission } from './triggers/process-evaluation-submission';
export { onMatchCreate } from './triggers/on-match-create';
export { onInvitationCreate } from './triggers/on-invitation-create';
export { cleanupAiCache } from './cleanup-ai-cache';
// NOTE: onUserCreate requires GCIP (paid plan). Client-side rollback in register/page.tsx is used instead.
