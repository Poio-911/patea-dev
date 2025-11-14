'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { Match, League } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Calendar, MapPin, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

  // Initialize form data when match loads
  useMemo(() => {
    if (match && !formData.date) {
      setFormData({
        date: format(new Date(match.date), 'yyyy-MM-dd'),
        time: match.time || '19:00',
        location: match.location?.name || '',
        team1Score: match.teams?.[0]?.finalScore?.toString() || '',
        team2Score: match.teams?.[1]?.finalScore?.toString() || '',
      });
    }
  }, [match]);

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

    setIsSaving(true);
    try {
      // Preserve all team data, only update finalScore
      const updatedTeams = [
        { ...match.teams![0], finalScore: score1 },
        { ...match.teams![1], finalScore: score2 }
      ];

      await updateDoc(doc(firestore, 'matches', match.id), {
        teams: updatedTeams,
        status: 'completed',
      });

      toast({
        title: 'Resultado guardado',
        description: 'El resultado del partido ha sido registrado.',
      });
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

            {isOwner && !isCompleted && (
              <Button onClick={handleSaveResult} disabled={isSaving} className="w-full">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Guardar Resultado y Finalizar
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

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
