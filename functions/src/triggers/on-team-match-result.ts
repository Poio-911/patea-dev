import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { recordTeamMatchResult } from '../lib/team-rivals-store';

export const onTeamMatchResult = onDocumentWritten({document: 'matches/{matchId}', region: 'us-central1', retry: true}, async event => {
  const before = event.data?.before.data(), after = event.data?.after.data();
  if (!after || after.type !== 'intergroup_friendly' || !['completed', 'evaluated'].includes(after.status)) return;
  // Marker-only updates and completed → evaluated with unchanged score stop
  // before any reads. Corrections to a finished score update the same ledger.
  if (before && ['completed', 'evaluated'].includes(before.status)
      && JSON.stringify([before.teams, before.finalScore, before.participantTeamIds]) === JSON.stringify([after.teams, after.finalScore, after.participantTeamIds])) return;
  const result = await recordTeamMatchResult(admin.firestore(), event.params.matchId);
  if (result.reason === 'incomplete-or-out-of-scope') console.warn('Rival result requires repair', event.params.matchId);
});
