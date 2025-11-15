'use client';

import { useState, useEffect } from 'react';
import { League, Cup, GroupTeam } from '@/lib/types';
import { getPublicCompetitionsAction, submitCompetitionApplicationAction } from '@/lib/actions/server-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, Users, Calendar, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PublicCompetitionsBrowserProps {
  userId: string;
  userTeams: GroupTeam[];
}

export function PublicCompetitionsBrowser({ userId, userTeams }: PublicCompetitionsBrowserProps) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [cups, setCups] = useState<Cup[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadPublicCompetitions();
  }, []);

  const loadPublicCompetitions = async () => {
    setLoading(true);
    try {
      const result = await getPublicCompetitionsAction();
      if (result.success) {
        setLeagues(result.leagues || []);
        setCups(result.cups || []);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudieron cargar las competiciones públicas.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error al cargar competiciones.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (competitionId: string, competitionType: 'league' | 'cup', teamId: string) => {
    if (!teamId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debes seleccionar un equipo.',
      });
      return;
    }

    setApplying(competitionId);
    try {
      const result = await submitCompetitionApplicationAction(
        competitionId,
        competitionType,
        teamId,
        userId
      );

      if (result.success) {
        toast({
          title: 'Postulación enviada',
          description: 'Tu equipo ha sido postulado. El organizador revisará tu solicitud.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudo enviar la postulación.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error al enviar postulación.',
      });
    } finally {
      setApplying(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (leagues.length === 0 && cups.length === 0) {
    return (
      <Alert>
        <Trophy className="h-4 w-4" />
        <AlertDescription>
          No hay competiciones públicas abiertas en este momento.
        </AlertDescription>
      </Alert>
    );
  }

  if (userTeams.length === 0) {
    return (
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          Necesitás crear un equipo antes de poder postularte a competiciones públicas.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      {/* Ligas Públicas */}
      {leagues.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Ligas Abiertas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leagues.map(league => (
              <CompetitionCard
                key={league.id}
                competition={league}
                type="league"
                userTeams={userTeams}
                onApply={handleApply}
                isApplying={applying === league.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Copas Públicas */}
      {cups.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Copas Abiertas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cups.map(cup => (
              <CompetitionCard
                key={cup.id}
                competition={cup}
                type="cup"
                userTeams={userTeams}
                onApply={handleApply}
                isApplying={applying === cup.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface CompetitionCardProps {
  competition: League | Cup;
  type: 'league' | 'cup';
  userTeams: GroupTeam[];
  onApply: (competitionId: string, type: 'league' | 'cup', teamId: string) => void;
  isApplying: boolean;
}

function CompetitionCard({ competition, type, userTeams, onApply, isApplying }: CompetitionCardProps) {
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          {competition.logoUrl && (
            <div className="w-12 h-12 rounded-lg overflow-hidden border shrink-0 bg-muted/30">
              <img src={competition.logoUrl} alt={competition.name} className="w-full h-full object-contain" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg">{competition.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Trophy className="h-3 w-3" />
              <span>{type === 'league' ? 'Liga' : 'Copa'}</span>
              <span>·</span>
              <Users className="h-3 w-3" />
              <span>{competition.teams.length} equipos</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Format */}
        <div className="text-sm">
          <Badge variant="outline">
            {type === 'league'
              ? (competition as League).format === 'round_robin'
                ? 'Todos vs Todos'
                : 'Ida y Vuelta'
              : 'Eliminación Directa'}
          </Badge>
        </div>

        {/* Start Date */}
        {competition.startDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Inicia: {new Date(competition.startDate).toLocaleDateString()}</span>
          </div>
        )}

        {/* Location */}
        {competition.defaultLocation && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span className="truncate">{competition.defaultLocation.name}</span>
          </div>
        )}

        {/* Team Selector */}
        <div className="space-y-2">
          <Label htmlFor={`team-select-${competition.id}`}>Seleccionar Equipo</Label>
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger id={`team-select-${competition.id}`}>
              <SelectValue placeholder="Elegí tu equipo" />
            </SelectTrigger>
            <SelectContent>
              {userTeams.map(team => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          onClick={() => onApply(competition.id, type, selectedTeam)}
          disabled={!selectedTeam || isApplying}
        >
          {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Postularse
        </Button>
      </CardFooter>
    </Card>
  );
}
