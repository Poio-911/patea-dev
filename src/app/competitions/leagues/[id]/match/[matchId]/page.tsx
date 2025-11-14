'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, collection, query, where } from 'firebase/firestore';
import type { Match, League, GroupTeam, Player, MatchGoalScorer, MatchCard } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Calendar, MapPin, Loader2, Save, Trash2, Plus } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { checkAndCompleteLeague, resolveTiebreakerFinal } from '@/lib/actions/league-completion-actions';
import { updatePlayerStatsFromMatch } from '@/lib/actions/player-stats-actions';

type TeamPlayer = {
  id: string;
  name: string;
  number: number;
};

export default function LeagueMatchManagePage() {
  const { id: leagueId, matchId } = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    location: '',
    team1Score: '',
    team2Score: '',
  });

  // Estados para goleadores y tarjetas
  const [team1Goals, setTeam1Goals] = useState<MatchGoalScorer[]>([]);
  const [team2Goals, setTeam2Goals] = useState<MatchGoalScorer[]>([]);
  const [team1Cards, setTeam1Cards] = useState<MatchCard[]>([]);
  const [team2Cards, setTeam2Cards] = useState<MatchCard[]>([]);
  const [team1Players, setTeam1Players] = useState<TeamPlayer[]>([]);
  const [team2Players, setTeam2Players] = useState<TeamPlayer[]>([]);

  // Fetch match data
  const matchRef = useMemo(() => {
    if (!firestore || !matchId) return null;
    return doc(firestore, 'matches', matchId as string);
  }, [firestore, matchId]);

  const { data: match, loading: matchLoading } = useDoc<Match>(matchRef);

  // Fetch league data
  const leagueRef = useMemo(() => {
    if (!firestore || !leagueId) return null;
    return doc(firestore, 'leagues', leagueId as string);
  }, [firestore, leagueId]);

  const { data: league } = useDoc<League>(leagueRef);

  // Fetch teams
  const teamsQuery = useMemo(() => {
    if (!firestore || !match?.participantTeamIds || match.participantTeamIds.length === 0) return null;
    return query(
      collection(firestore, 'teams'),
      where('__name__', 'in', match.participantTeamIds)
    );
  }, [firestore, match?.participantTeamIds]);

  const { data: groupTeams } = useCollection<GroupTeam>(teamsQuery);

  // Fetch all players from the group
  const playersQuery = useMemo(() => {
    if (!firestore || !league?.groupId) return null;
    return query(
      collection(firestore, 'players'),
      where('groupId', '==', league.groupId)
    );
  }, [firestore, league?.groupId]);

  const { data: players } = useCollection<Player>(playersQuery);

  // Initialize form data and load players when match and teams load
  useEffect(() => {
    if (match && !formData.date) {
      setFormData({
        date: format(new Date(match.date), 'yyyy-MM-dd'),
        time: match.time || '19:00',
        location: match.location?.name || '',
        team1Score: match.teams?.[0]?.finalScore?.toString() || '',
        team2Score: match.teams?.[1]?.finalScore?.toString() || '',
      });

      // Load existing goals and cards if any
      if (match.goalScorers) {
        const team1Id = match.participantTeamIds?.[0];
        const team2Id = match.participantTeamIds?.[1];
        setTeam1Goals(match.goalScorers.filter(g => g.teamId === team1Id));
        setTeam2Goals(match.goalScorers.filter(g => g.teamId === team2Id));
      }

      if (match.cards) {
        const team1Id = match.participantTeamIds?.[0];
        const team2Id = match.participantTeamIds?.[1];
        setTeam1Cards(match.cards.filter(c => c.teamId === team1Id));
        setTeam2Cards(match.cards.filter(c => c.teamId === team2Id));
      }
    }
  }, [match]);

  // Load team players when teams and players data is available
  useEffect(() => {
    if (groupTeams && players && match?.participantTeamIds) {
      const team1Id = match.participantTeamIds[0];
      const team2Id = match.participantTeamIds[1];

      const team1 = groupTeams.find(t => t.id === team1Id);
      const team2 = groupTeams.find(t => t.id === team2Id);

      if (team1) {
        const team1PlayersList = team1.members.map(member => {
          const player = players.find(p => p.id === member.playerId);
          return {
            id: member.playerId,
            name: player?.name || 'Jugador desconocido',
            number: member.number
          };
        }).sort((a, b) => a.number - b.number);
        setTeam1Players(team1PlayersList);
      }

      if (team2) {
        const team2PlayersList = team2.members.map(member => {
          const player = players.find(p => p.id === member.playerId);
          return {
            id: member.playerId,
            name: player?.name || 'Jugador desconocido',
            number: member.number
          };
        }).sort((a, b) => a.number - b.number);
        setTeam2Players(team2PlayersList);
      }
    }
  }, [groupTeams, players, match]);

  const isOwner = user?.uid === league?.ownerUid;

  const handleSaveSchedule = async () => {
    if (!match || !firestore) return;

    setIsSaving(true);
    try {
      const dateTimeString = new Date(`${formData.date}T${formData.time}`).toISOString();

      await updateDoc(doc(firestore, 'matches', match.id), {
        date: dateTimeString,
        time: formData.time,
        'location.name': formData.location || 'A definir',
      });

      toast({
        title: 'Fecha actualizada',
        description: 'La programación del partido ha sido guardada.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo actualizar la fecha.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveResult = async () => {
    if (!match || !firestore) return;

    const score1 = parseInt(formData.team1Score);
    const score2 = parseInt(formData.team2Score);

    if (isNaN(score1) || isNaN(score2)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Los goles deben ser números válidos.',
      });
      return;
    }

    // Validate goal counts match scores
    if (team1Goals.length !== score1) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `${match.teams![0].name} debe tener exactamente ${score1} goleador(es) registrado(s).`,
      });
      return;
    }

    if (team2Goals.length !== score2) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `${match.teams![1].name} debe tener exactamente ${score2} goleador(es) registrado(s).`,
      });
      return;
    }

    setIsSaving(true);
    try {
      // Preserve all team data, only update finalScore
      const updatedTeams = [
        { ...match.teams![0], finalScore: score1 },
        { ...match.teams![1], finalScore: score2 }
      ];

      const allGoals = [...team1Goals, ...team2Goals];
      const allCards = [...team1Cards, ...team2Cards];

      await updateDoc(doc(firestore, 'matches', match.id), {
        teams: updatedTeams,
        status: 'completed',
        goalScorers: allGoals,
        cards: allCards,
      });

      // Update player stats globally
      await updatePlayerStatsFromMatch(match.id);

      // Check if league should be completed automatically
      if (match.type === 'league' && leagueId) {
        const result = await checkAndCompleteLeague(leagueId as string);

        if (result.requiresTiebreaker) {
          toast({
            title: '¡Se requiere partido final!',
            description: result.message,
            duration: 5000,
          });
        } else if (result.success) {
          toast({
            title: '¡Liga finalizada!',
            description: result.message,
            duration: 5000,
          });
        }
      }

      // Resolve tiebreaker if this was a final match
      if (match.type === 'league_final' && leagueId) {
        const result = await resolveTiebreakerFinal(leagueId as string, match.id);

        if (result.success) {
          toast({
            title: '¡Campeón definido!',
            description: result.message,
            duration: 5000,
          });
        }
      }

      toast({
        title: 'Resultado guardado',
        description: 'El resultado del partido ha sido registrado.',
      });

      // Refresh the page to show updated data
      window.location.reload();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo guardar el resultado.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddGoal = (teamId: string, playerId: string) => {
    const player = (teamId === match?.participantTeamIds?.[0] ? team1Players : team2Players).find(p => p.id === playerId);
    if (!player) return;

    const goal: MatchGoalScorer = {
      playerId: player.id,
      playerName: player.name,
      teamId: teamId
    };

    if (teamId === match?.participantTeamIds?.[0]) {
      setTeam1Goals([...team1Goals, goal]);
    } else {
      setTeam2Goals([...team2Goals, goal]);
    }
  };

  const handleRemoveGoal = (teamId: string, index: number) => {
    if (teamId === match?.participantTeamIds?.[0]) {
      setTeam1Goals(team1Goals.filter((_, i) => i !== index));
    } else {
      setTeam2Goals(team2Goals.filter((_, i) => i !== index));
    }
  };

  const handleAddCard = (teamId: string, playerId: string, cardType: 'yellow' | 'red') => {
    const player = (teamId === match?.participantTeamIds?.[0] ? team1Players : team2Players).find(p => p.id === playerId);
    if (!player) return;

    const card: MatchCard = {
      playerId: player.id,
      playerName: player.name,
      teamId: teamId,
      cardType: cardType
    };

    if (teamId === match?.participantTeamIds?.[0]) {
      setTeam1Cards([...team1Cards, card]);
    } else {
      setTeam2Cards([...team2Cards, card]);
    }
  };

  const handleRemoveCard = (teamId: string, index: number) => {
    if (teamId === match?.participantTeamIds?.[0]) {
      setTeam1Cards(team1Cards.filter((_, i) => i !== index));
    } else {
      setTeam2Cards(team2Cards.filter((_, i) => i !== index));
    }
  };

  if (matchLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-bold">Partido no encontrado</h2>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/competitions/leagues/${leagueId}`}>Volver a la Liga</Link>
        </Button>
      </div>
    );
  }

  const team1 = match.teams?.[0];
  const team2 = match.teams?.[1];
  const team1Id = match.participantTeamIds?.[0];
  const team2Id = match.participantTeamIds?.[1];
  const isCompleted = match.status === 'completed' || match.status === 'evaluated';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestionar Partido</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fecha {match.leagueInfo?.round} - {league?.name}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/competitions/leagues/${leagueId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a la Liga
          </Link>
        </Button>
      </div>

      {/* Match Teams */}
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-around items-center">
            <div className="flex flex-col items-center gap-3">
              <JerseyPreview jersey={team1?.jersey} size="lg" />
              <p className="font-bold text-lg">{team1?.name}</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl font-bold text-muted-foreground">vs</span>
              {isCompleted && (
                <div className="flex gap-4 text-3xl font-bold">
                  <span>{team1?.finalScore ?? 0}</span>
                  <span>-</span>
                  <span>{team2?.finalScore ?? 0}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-3">
              <JerseyPreview jersey={team2?.jersey} size="lg" />
              <p className="font-bold text-lg">{team2?.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schedule Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Programación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                disabled={!isOwner || isCompleted}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Hora</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                disabled={!isOwner || isCompleted}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <Input
                id="location"
                placeholder="Ej: Cancha Municipal"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                disabled={!isOwner || isCompleted}
              />
            </div>

            {isOwner && !isCompleted && (
              <Button onClick={handleSaveSchedule} disabled={isSaving} className="w-full">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Guardar Programación
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Result Section */}
        <Card>
          <CardHeader>
            <CardTitle>Resultado del Partido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="team1Score">{team1?.name}</Label>
                <Input
                  id="team1Score"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.team1Score}
                  onChange={(e) => setFormData({ ...formData, team1Score: e.target.value })}
                  disabled={!isOwner || isCompleted}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="team2Score">{team2?.name}</Label>
                <Input
                  id="team2Score"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.team2Score}
                  onChange={(e) => setFormData({ ...formData, team2Score: e.target.value })}
                  disabled={!isOwner || isCompleted}
                />
              </div>
            </div>

            {isCompleted && (
              <div className="bg-muted/50 p-4 rounded-md">
                <p className="text-sm text-muted-foreground text-center">
                  Este partido ya ha sido finalizado. No se pueden modificar los resultados.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Goalscorers Section */}
      {!isCompleted && isOwner && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team 1 Goalscorers */}
          <Card>
            <CardHeader>
              <CardTitle>{team1?.name} - Goleadores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {team1Players.length > 0 ? (
                <>
                  <div className="flex gap-2">
                    <Select
                      onValueChange={(playerId) => team1Id && handleAddGoal(team1Id, playerId)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar jugador" />
                      </SelectTrigger>
                      <SelectContent>
                        {team1Players.map(player => (
                          <SelectItem key={player.id} value={player.id}>
                            #{player.number} - {player.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="icon" disabled>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {team1Goals.map((goal, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm">⚽ {goal.playerName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => team1Id && handleRemoveGoal(team1Id, index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {team1Goals.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No hay goles registrados
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Cargando jugadores...</p>
              )}
            </CardContent>
          </Card>

          {/* Team 2 Goalscorers */}
          <Card>
            <CardHeader>
              <CardTitle>{team2?.name} - Goleadores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {team2Players.length > 0 ? (
                <>
                  <div className="flex gap-2">
                    <Select
                      onValueChange={(playerId) => team2Id && handleAddGoal(team2Id, playerId)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar jugador" />
                      </SelectTrigger>
                      <SelectContent>
                        {team2Players.map(player => (
                          <SelectItem key={player.id} value={player.id}>
                            #{player.number} - {player.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="icon" disabled>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {team2Goals.map((goal, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm">⚽ {goal.playerName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => team2Id && handleRemoveGoal(team2Id, index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {team2Goals.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No hay goles registrados
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Cargando jugadores...</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cards Section */}
      {!isCompleted && isOwner && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team 1 Cards */}
          <Card>
            <CardHeader>
              <CardTitle>{team1?.name} - Tarjetas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {team1Players.length > 0 ? (
                <>
                  <div className="flex gap-2">
                    <Select
                      onValueChange={(playerId) => {
                        if (team1Id) {
                          // We'll set this temporarily, then user clicks yellow or red button
                          (document.getElementById('team1-card-player') as any).value = playerId;
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar jugador" />
                      </SelectTrigger>
                      <SelectContent>
                        {team1Players.map(player => (
                          <SelectItem key={player.id} value={player.id}>
                            #{player.number} - {player.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input type="hidden" id="team1-card-player" />
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-yellow-400 hover:bg-yellow-500"
                      onClick={() => {
                        const playerId = (document.getElementById('team1-card-player') as any)?.value;
                        if (playerId && team1Id) handleAddCard(team1Id, playerId, 'yellow');
                      }}
                    >
                      Amarilla
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-red-500 hover:bg-red-600 text-white"
                      onClick={() => {
                        const playerId = (document.getElementById('team1-card-player') as any)?.value;
                        if (playerId && team1Id) handleAddCard(team1Id, playerId, 'red');
                      }}
                    >
                      Roja
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {team1Cards.map((card, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={card.cardType === 'yellow' ? 'bg-yellow-400' : 'bg-red-500 text-white'}
                          >
                            {card.cardType === 'yellow' ? '🟨' : '🟥'}
                          </Badge>
                          <span className="text-sm">{card.playerName}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => team1Id && handleRemoveCard(team1Id, index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {team1Cards.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No hay tarjetas registradas
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Cargando jugadores...</p>
              )}
            </CardContent>
          </Card>

          {/* Team 2 Cards */}
          <Card>
            <CardHeader>
              <CardTitle>{team2?.name} - Tarjetas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {team2Players.length > 0 ? (
                <>
                  <div className="flex gap-2">
                    <Select
                      onValueChange={(playerId) => {
                        (document.getElementById('team2-card-player') as any).value = playerId;
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar jugador" />
                      </SelectTrigger>
                      <SelectContent>
                        {team2Players.map(player => (
                          <SelectItem key={player.id} value={player.id}>
                            #{player.number} - {player.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input type="hidden" id="team2-card-player" />
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-yellow-400 hover:bg-yellow-500"
                      onClick={() => {
                        const playerId = (document.getElementById('team2-card-player') as any)?.value;
                        if (playerId && team2Id) handleAddCard(team2Id, playerId, 'yellow');
                      }}
                    >
                      Amarilla
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-red-500 hover:bg-red-600 text-white"
                      onClick={() => {
                        const playerId = (document.getElementById('team2-card-player') as any)?.value;
                        if (playerId && team2Id) handleAddCard(team2Id, playerId, 'red');
                      }}
                    >
                      Roja
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {team2Cards.map((card, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={card.cardType === 'yellow' ? 'bg-yellow-400' : 'bg-red-500 text-white'}
                          >
                            {card.cardType === 'yellow' ? '🟨' : '🟥'}
                          </Badge>
                          <span className="text-sm">{card.playerName}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => team2Id && handleRemoveCard(team2Id, index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {team2Cards.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No hay tarjetas registradas
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Cargando jugadores...</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Save Result Button */}
      {isOwner && !isCompleted && (
        <Card>
          <CardContent className="pt-6">
            <Button onClick={handleSaveResult} disabled={isSaving} className="w-full" size="lg">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Guardar Resultado y Finalizar Partido
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Display goalscorers and cards if completed */}
      {isCompleted && (match.goalScorers || match.cards) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Goalscorers Display */}
          {match.goalScorers && match.goalScorers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Goleadores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {match.goalScorers.map((goal, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded">
                      <span className="text-sm">⚽ {goal.playerName}</span>
                      <span className="text-xs text-muted-foreground">
                        ({goal.teamId === team1Id ? team1?.name : team2?.name})
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cards Display */}
          {match.cards && match.cards.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tarjetas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {match.cards.map((card, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded">
                      <Badge
                        variant="outline"
                        className={card.cardType === 'yellow' ? 'bg-yellow-400' : 'bg-red-500 text-white'}
                      >
                        {card.cardType === 'yellow' ? '🟨' : '🟥'}
                      </Badge>
                      <span className="text-sm">{card.playerName}</span>
                      <span className="text-xs text-muted-foreground">
                        ({card.teamId === team1Id ? team1?.name : team2?.name})
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Match Info */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Partido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(new Date(match.date), "EEEE d 'de' MMMM 'de' yyyy, HH:mm'hs'", { locale: es })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{match.location?.name || 'Sin ubicación definida'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
