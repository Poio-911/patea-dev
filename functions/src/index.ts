// Runtime: Node.js 22 (ver `runtime` en firebase.json y `engines.node` acá al
// lado, en package.json — los dos tienen que coincidir; si difieren, gana el de
// firebase.json). Se subió desde el 20, que se dio de baja el 2026-04-30 y se
// apaga el 2026-10-30.
//
// Ojo si hay que volver a moverlo: `firebase deploy` decide qué redesplegar
// hasheando el código fuente, no la configuración, así que cambiar el runtime
// solo hace que saltee todo con "No changes detected". Hay que tocar algún
// archivo del bundle para invalidar el hash.

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
export { startMatch, updateLiveState, updateLiveMinute, joinMatch, leaveMatch, recordLiveEvent, finishMatch, finalizePendingMatches } from './callable/match-lifecycle';
export { deleteMatch, updateMatchDate, updateMatchLocation, shuffleTeams, updateMatchTeams } from './callable/match-management';
export { createGroup, joinGroupByInviteCode, setActiveGroup, createTeam, updateTeam, updateTeamMembers, deleteTeam } from './callable/group-management';
export { createManualPlayer } from './callable/player-management';
export { saveUserLocation, enableAvailability, disableAvailability, updateAvailabilityPreferences, getAvailableLocalPlayers, sendMatchInvitations } from './callable/explore';
export { submitEvaluationSubmission, respondToIdentityReveal, finalizeMatchEvaluation } from './callable/evaluations';
export { generateMatchChronicle } from './callable/match-chronicle';
export { requestJoinMatch, respondJoinRequest } from './callable/match-join-requests';
export { proposeMatchDate, voteMatchDate, confirmMatchDate, proposeMatchLocation, voteMatchLocation, confirmMatchLocation } from './callable/match-planning';
export { getPlayerEvaluations } from './callable/player-profile';
export { updateProfile } from './callable/update-profile';
export { initializeUserProfile } from './callable/initialize-user-profile';
export { generatePlayerPhoto } from './callable/generate-player-photo';
// NOTE: onUserCreate requires GCIP (paid plan). Client-side rollback in register/page.tsx is used instead.
