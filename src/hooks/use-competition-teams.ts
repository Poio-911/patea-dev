'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { collection, doc, getDoc, onSnapshot, query } from 'firebase/firestore';

type TeamLike = {
  id: string;
  name: string;
  jersey: any;
  [key: string]: any;
};

export function useCompetitionTeams(
  competitionId: string,
  competitionType: 'leagues' | 'cups',
  compData: any
): { teams: TeamLike[]; loading: boolean } {
  const firestore = useFirestore();
  const [ghostTeams, setGhostTeams] = React.useState<TeamLike[]>([]);
  const [realTeams, setRealTeams] = React.useState<TeamLike[]>([]);
  const [ghostLoaded, setGhostLoaded] = React.useState(false);
  const [realLoaded, setRealLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!firestore || !competitionId) return;
    setGhostLoaded(false);

    const teamsRef = collection(firestore, competitionType, competitionId, 'teams');
    const unsub = onSnapshot(query(teamsRef), (snap) => {
      setGhostTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TeamLike)));
      setGhostLoaded(true);
    });

    return () => unsub();
  }, [firestore, competitionId, competitionType]);

  React.useEffect(() => {
    if (!firestore) return;
    setRealLoaded(false);

    const realTeamIds: string[] = Array.isArray(compData?.teams) ? compData.teams : [];
    if (realTeamIds.length === 0) {
      setRealTeams([]);
      setRealLoaded(true);
      return;
    }

    let cancelled = false;
    (async () => {
      const fetched: TeamLike[] = [];
      for (const teamId of realTeamIds) {
        try {
          const teamDoc = await getDoc(doc(firestore, 'teams', teamId));
          if (teamDoc.exists()) {
            const data = teamDoc.data() as any;
            fetched.push({
              id: teamDoc.id,
              name: data.name,
              jersey: data.jersey,
              ...data,
            });
          }
        } catch {}
      }
      if (!cancelled) {
        setRealTeams(fetched);
        setRealLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [firestore, compData]);

  const teams = React.useMemo(() => {
    const ghostIds = new Set(ghostTeams.map((t) => t.id));
    return [...ghostTeams, ...realTeams.filter((t) => !ghostIds.has(t.id))];
  }, [ghostTeams, realTeams]);

  return {
    teams,
    loading: !ghostLoaded || !realLoaded,
  };
}
