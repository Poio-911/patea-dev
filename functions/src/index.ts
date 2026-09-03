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
export { generateBalancedTeams } from './callable/generate-balanced-teams';
export { createMatch } from './callable/create-match';
export { startMatch, updateLiveMinute, joinMatch, leaveMatch, recordLiveEvent, finishMatch, finalizePendingMatches } from './callable/match-lifecycle';
export { deleteMatch, updateMatchDate, updateMatchLocation, shuffleTeams } from './callable/match-management';
export { createGroup, joinGroupByInviteCode, setActiveGroup, createTeam, updateTeam, updateTeamMembers, deleteTeam } from './callable/group-management';
export { createManualPlayer } from './callable/player-management';
export { saveUserLocation, enableAvailability, disableAvailability, updateAvailabilityPreferences, getAvailableLocalPlayers, sendMatchInvitations } from './callable/explore';
export { submitEvaluationSubmission, respondToIdentityReveal, finalizeMatchEvaluation } from './callable/evaluations';
export { getPlayerEvaluations } from './callable/player-profile';
export { updateProfile } from './callable/update-profile';
export { generatePlayerPhoto } from './callable/generate-player-photo';
// NOTE: onUserCreate requires GCIP (paid plan). Client-side rollback in register/page.tsx is used instead.
