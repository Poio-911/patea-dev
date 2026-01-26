import { getAdminDb } from "../src/firebase/admin-init";
import type { Cup, BracketMatch } from "../src/lib/types";

const cupId = process.argv[2];
if (!cupId) {
  console.error("Usage: tsx scripts/check-cup.ts <cupId>");
  process.exit(1);
}

async function main() {
  const db = getAdminDb();
  const snap = await db.collection("cups").doc(cupId).get();
  if (!snap.exists) {
    console.error("Cup not found:", cupId);
    process.exit(1);
  }
  const cup = { id: snap.id, ...snap.data() } as Cup;
  console.log("Cup status:", cup.status);
  console.log("Current round:", cup.currentRound);
  const bracket: BracketMatch[] = (cup as any).bracket || [];
  const final = bracket.find(b => b.round === "final");
  console.log("Final teams:", final?.team1Name, "vs", final?.team2Name);
  console.log("Final matchId:", final?.matchId);
  console.log("Champion:", cup.championTeamName);
}

main().catch(err => { console.error(err); process.exit(1); });
