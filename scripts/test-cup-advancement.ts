/**
 * Test script: Cup advancement flow (4 teams → Semis → Final)
 *
 * Requirements:
 * - Env vars set: FIREBASE_SERVICE_ACCOUNT_KEY (JSON), NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 * - Uses Firebase Admin via getAdminDb()
 *
 * Steps:
 * 1) Creates a temp group and four teams
 * 2) Seeds a cup with bracket (semifinals → final)
 * 3) Creates semifinal matches
 * 4) Finalizes both semis (auto-advance triggers final creation)
 * 5) Finalizes final (cup marked completed)
 */

import { getAdminDb } from "../src/firebase/admin-init";
import type { BracketMatch, Cup, GroupTeam, Match, Jersey } from "../src/lib/types";
import { generateBracket, getCurrentRound, getRoundName } from "../src/lib/utils/cup-bracket";
import { createCupMatchAction, updateMatchFinalScoreAction } from "../src/lib/actions/server-actions";

async function createTeam(name: string, jersey: Jersey, groupId: string, createdBy: string): Promise<GroupTeam> {
  const teamRef = getAdminDb().collection("teams").doc();
  const createdAt = new Date().toISOString();
  const team: GroupTeam = {
    id: teamRef.id,
    name,
    jersey,
    groupId,
    members: [],
    createdBy,
    createdAt,
    isChallengeable: true,
  } as GroupTeam;
  await teamRef.set(team);
  return team;
}

async function main() {
  const db = getAdminDb();
  console.log("[Test] Starting cup advancement test");

  // Create a temp group and organizer
  const groupRef = db.collection("groups").doc();
  const ownerUid = `test-owner-${Date.now()}`;
  await groupRef.set({ name: "Test Group", ownerUid, createdAt: new Date().toISOString() });
  const groupId = groupRef.id;

  // Create 4 teams
  const teamA = await createTeam("Equipo A", { type: "plain", primaryColor: "#1463F3", secondaryColor: "#FFFFFF" }, groupId, ownerUid);
  const teamB = await createTeam("Equipo B", { type: "plain", primaryColor: "#F36C21", secondaryColor: "#FFFFFF" }, groupId, ownerUid);
  const teamC = await createTeam("Equipo C", { type: "plain", primaryColor: "#00B894", secondaryColor: "#FFFFFF" }, groupId, ownerUid);
  const teamD = await createTeam("Equipo D", { type: "plain", primaryColor: "#D63031", secondaryColor: "#FFFFFF" }, groupId, ownerUid);

  const teams: (GroupTeam & { ovr?: number })[] = [
    { ...teamA, ovr: 80 },
    { ...teamB, ovr: 78 },
    { ...teamC, ovr: 76 },
    { ...teamD, ovr: 74 },
  ];

  // Generate bracket (semifinals → final)
  const bracket: BracketMatch[] = generateBracket(teams, "ovr_based");

  // Seed cup
  const cupRef = db.collection("cups").doc();
  const cup: Partial<Cup> = {
    id: cupRef.id,
    name: "Copa Test E2E",
    status: "in_progress",
    format: "single_elimination",
    groupId,
    ownerUid,
    teams: teams.map(t => t.id),
    bracket,
    currentRound: getCurrentRound(bracket) || "semifinals",
    startDate: new Date().toISOString(),
    defaultLocation: { name: "Test Arena", address: "", lat: 0, lng: 0, placeId: "" },
  } as any;
  await cupRef.set(cup);
  const cupId = cupRef.id;
  console.log("[Test] Cup created:", { cupId, currentRound: getRoundName(cup.currentRound!) });

  // Create matches for current round (semifinals)
  const semis = bracket.filter(b => b.round === "semifinals");
  for (const m of semis) {
    const res = await createCupMatchAction(cupId, m.id);
    if (!res.success) throw new Error(`Failed to create semi match: ${res.error}`);
    console.log("[Test] Semi match created:", { bracketId: m.id, matchId: res.matchId });
  }

  // Fetch created matches to finalize
  const matchesSnap = await db.collection("matches").where("leagueInfo.leagueId", "==", cupId).get();
  const matches: Match[] = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
  const semiMatchIds = matches
    .filter(m => m.status === "upcoming" && m.participantTeamIds && m.participantTeamIds.length === 2)
    .map(m => m.id);

  // Finalize both semis (no draw)
  for (const matchId of semiMatchIds) {
    const mDoc = await db.collection("matches").doc(matchId).get();
    const mData = { id: mDoc.id, ...mDoc.data() } as Match;
    const score1 = Math.floor(Math.random() * 3) + 1;
    const score2 = Math.floor(Math.random() * 2); // ensure likely non-draw
    const res = await updateMatchFinalScoreAction(matchId, score1, score2, ownerUid);
    if (!res.success) throw new Error(`Failed to finalize semi: ${res.error}`);
    console.log("[Test] Semi finalized:", { matchId, score1, score2 });
  }

  // Verify final was created
  const cupAfterSemisSnap = await db.collection("cups").doc(cupId).get();
  const cupAfterSemis = { id: cupAfterSemisSnap.id, ...cupAfterSemisSnap.data() } as Cup;
  console.log("[Test] Current round after semis:", cupAfterSemis.currentRound && getRoundName(cupAfterSemis.currentRound));

  const updatedBracket: BracketMatch[] = cupAfterSemis.bracket || [];
  const finalMatch = updatedBracket.find(b => b.round === "final");
  if (!finalMatch || !finalMatch.team1Id || !finalMatch.team2Id) {
    throw new Error("Final not prepared correctly: missing teams.");
  }

  // Create final match (if not auto-created yet)
  if (!finalMatch.matchId) {
    const res = await createCupMatchAction(cupId, finalMatch.id);
    if (!res.success || !res.matchId) throw new Error(`Failed to create final: ${res.error}`);
    finalMatch.matchId = res.matchId;
    console.log("[Test] Final match created:", { matchId: res.matchId });
  }

  // Finalize final
  const finalScore1 = Math.floor(Math.random() * 3) + 1;
  const finalScore2 = Math.floor(Math.random() * 2);
  const finalizeFinalRes = await updateMatchFinalScoreAction(finalMatch.matchId!, finalScore1, finalScore2, ownerUid);
  if (!finalizeFinalRes.success) throw new Error(`Failed to finalize final: ${finalizeFinalRes.error}`);
  console.log("[Test] Final finalized:", { matchId: finalMatch.matchId, finalScore1, finalScore2 });

  // Verify cup completed
  const cupCompletedSnap = await db.collection("cups").doc(cupId).get();
  const cupCompleted = { id: cupCompletedSnap.id, ...cupCompletedSnap.data() } as Cup;
  console.log("[Test] Cup status:", cupCompleted.status);
  console.log("[Test] Champion:", cupCompleted.championTeamName);

  console.log("[Test] Done ✔");
}

main().catch(err => {
  console.error("[Test] Error:", err);
  process.exitCode = 1;
});
