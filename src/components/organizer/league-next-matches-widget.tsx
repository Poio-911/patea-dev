'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';

interface MatchObj {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  status: 'pending' | 'finished';
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  venue?: string; 
}

interface FixtureRound {
  id: string;
  roundName: string;
  matches: MatchObj[];
}

interface Team {
  id: string;
  jersey: any;
}

export function LeagueNextMatchesWidget({ leagueId }: { leagueId: string }) {
  const firestore = useFirestore();

  const [teams, setTeams] = React.useState<Team[]>([]);
  const [rounds, setRounds] = React.useState<FixtureRound[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore) return;
    
    const teamsRef = collection(firestore, 'leagues', leagueId, 'teams');
    const unsubTeams = onSnapshot(query(teamsRef), (snap) => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    });

    const fixturesRef = collection(firestore, 'leagues', leagueId, 'fixtures');
    const qFixtures = query(fixturesRef, orderBy('roundNumber', 'asc'));
    const unsubFixtures = onSnapshot(qFixtures, (snap) => {
      setRounds(snap.docs.map(d => ({ id: d.id, ...d.data() } as FixtureRound)));
      setLoading(false);
    });

    return () => {
      unsubTeams();
      unsubFixtures();
    };
  }, [firestore, leagueId]);

  const nextMatches = React.useMemo(() => {
    if (!rounds || rounds.length === 0) return [];
    
    // Find all pending matches, keeping track of their round name
    const pending: (MatchObj & { roundName: string })[] = [];
    
    rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.status === 'pending' && match.homeTeamId && match.awayTeamId) {
          pending.push({ ...match, roundName: round.roundName });
        }
      });
    });

    // Optionally sort by date here if dates are strictly set. 
    // Right now they are just sorted by round automatically.
    
    return pending.slice(0, 3); // Take top 3 next matches
  }, [rounds]);

  if (loading) {
    return (
      <Card className="animate-pulse bg-muted/20">
        <CardContent className="h-48"></CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3 border-b border-border/20">
        <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Próximos Partidos
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {nextMatches.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <span className="block opacity-50 mb-1">🏁</span>
            No hay partidos pendientes.
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {nextMatches.map(match => {
              const homeTeam = teams.find(t => t.id === match.homeTeamId);
              const awayTeam = teams.find(t => t.id === match.awayTeamId);

              return (
                <div key={match.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full">
                      {match.roundName}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" /> {match.date ? `${match.date} ${match.time || ''}` : 'A definir'}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-center gap-1 w-[40%]">
                      {homeTeam ? <JerseyPreview jersey={homeTeam.jersey} size="xs" /> : <div className="w-6 h-6 rounded-full bg-muted" />}
                      <span className="text-xs font-bold text-center truncate w-full">{match.homeTeamName}</span>
                    </div>

                    <div className="text-xs font-black text-muted-foreground px-2">VS</div>

                    <div className="flex flex-col items-center gap-1 w-[40%]">
                      {awayTeam ? <JerseyPreview jersey={awayTeam.jersey} size="xs" /> : <div className="w-6 h-6 rounded-full bg-muted" />}
                      <span className="text-xs font-bold text-center truncate w-full">{match.awayTeamName}</span>
                    </div>
                  </div>

                  {match.venue && (
                    <div className="mt-3 flex items-center justify-center gap-1 text-[10px] text-muted-foreground bg-muted/20 py-1 rounded-md">
                      <MapPin className="w-3 h-3" /> {match.venue}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
