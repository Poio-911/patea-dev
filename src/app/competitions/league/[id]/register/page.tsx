'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { League } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { submitTeamApplicationAction } from '@/lib/actions/registration-actions';
import {
  ArrowLeft, CheckCircle2, Shield, Users, Calendar,
  DollarSign, ClipboardList, Loader2, AlertCircle
} from 'lucide-react';
import { format, parseISO, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';

export default function LeagueRegistrationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const leagueRef = React.useMemo(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'leagues', params.id);
  }, [firestore, params.id]);

  const { data: league, loading } = useDoc<League>(leagueRef);

  const [teamName, setTeamName] = React.useState('');
  const [captainName, setCaptainName] = React.useState('');
  const [captainEmail, setCaptainEmail] = React.useState('');
  const [captainPhone, setCaptainPhone] = React.useState('');
  const [playerCount, setPlayerCount] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const registrationClosed = React.useMemo(() => {
    if (!league?.registrationDeadline) return false;
    try {
      return isBefore(parseISO(league.registrationDeadline), new Date());
    } catch {
      return false;
    }
  }, [league?.registrationDeadline]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !captainName.trim() || !captainEmail.trim()) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Completá el nombre del equipo, capitán y email.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitTeamApplicationAction({
        competitionId: params.id,
        competitionType: 'leagues',
        teamName,
        captainName,
        captainEmail,
        captainPhone: captainPhone || undefined,
        playerCount: playerCount ? parseInt(playerCount) : undefined,
        message: message || undefined,
      });

      if (result.success) {
        setSubmitted(true);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Hubo un problema al enviar la solicitud.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-lg space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!league) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-12 text-center">
        <Shield className="h-16 w-16 text-muted-foreground/20 mb-4" />
        <h2 className="text-xl font-bold">Liga no encontrada</h2>
        <Button variant="ghost" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>
    );
  }

  if (!league.allowPublicRegistration) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-12 text-center">
        <AlertCircle className="h-16 w-16 text-muted-foreground/20 mb-4" />
        <h2 className="text-xl font-bold">Inscripciones cerradas</h2>
        <p className="text-sm text-muted-foreground mt-2">Esta liga no tiene inscripciones públicas habilitadas.</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push(`/competitions/league/${params.id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Ver liga
        </Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-12 text-center gap-4">
        <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight">¡Solicitud enviada!</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Tu solicitud de inscripción para <strong>{league.name}</strong> fue recibida.
          El organizador la revisará y te contactará por email.
        </p>
        <Button onClick={() => router.push(`/competitions/league/${params.id}`)}>
          <Shield className="mr-2 h-4 w-4" /> Ver la liga
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-lg space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push(`/competitions/league/${params.id}`)}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver a la liga
      </Button>

      {/* League info card */}
      <Card className="border-border/40 bg-card/70 backdrop-blur-xl">
        <CardContent className="flex items-center gap-4 pt-6">
          <Avatar className="h-16 w-16 rounded-xl border-2 border-border/40">
            <AvatarImage src={league.logoUrl || undefined} />
            <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-black text-xl">
              {league.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black uppercase tracking-tight truncate">{league.name}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              {league.registrationFee !== undefined && league.registrationFee !== null && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <DollarSign className="h-3 w-3" />
                  {league.registrationFee === 0 ? 'Gratis' : `$${league.registrationFee}`}
                </Badge>
              )}
              {league.maxTeams && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Users className="h-3 w-3" />
                  Máx. {league.maxTeams} equipos
                </Badge>
              )}
              {league.registrationDeadline && (
                <Badge
                  variant="outline"
                  className={`gap-1 text-xs ${registrationClosed ? 'text-destructive border-destructive/40' : ''}`}
                >
                  <Calendar className="h-3 w-3" />
                  {registrationClosed ? 'Cerrado' : `Hasta ${format(parseISO(league.registrationDeadline), "d MMM", { locale: es })}`}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {registrationClosed && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">El período de inscripción ya cerró.</p>
        </div>
      )}

      {/* Registration Form */}
      <Card className="border-border/40 bg-card/70 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
            <ClipboardList className="h-5 w-5 text-primary" />
            Solicitud de Inscripción
          </CardTitle>
          <CardDescription>
            Completá el formulario para inscribir tu equipo. El organizador revisará tu solicitud.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="teamName" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nombre del equipo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="teamName"
                placeholder="Ej: FC Los Halcones"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                disabled={registrationClosed || isSubmitting}
                required
                className="bg-muted/30"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="captainName" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Nombre del capitán <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="captainName"
                  placeholder="Nombre completo"
                  value={captainName}
                  onChange={e => setCaptainName(e.target.value)}
                  disabled={registrationClosed || isSubmitting}
                  required
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="captainPhone" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Teléfono
                </Label>
                <Input
                  id="captainPhone"
                  placeholder="Opcional"
                  type="tel"
                  value={captainPhone}
                  onChange={e => setCaptainPhone(e.target.value)}
                  disabled={registrationClosed || isSubmitting}
                  className="bg-muted/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="captainEmail" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Email del capitán <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="captainEmail"
                  placeholder="nombre@email.com"
                  type="email"
                  value={captainEmail}
                  onChange={e => setCaptainEmail(e.target.value)}
                  disabled={registrationClosed || isSubmitting}
                  required
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="playerCount" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cantidad de jugadores
                </Label>
                <Input
                  id="playerCount"
                  placeholder="Ej: 12"
                  type="number"
                  min={1}
                  max={50}
                  value={playerCount}
                  onChange={e => setPlayerCount(e.target.value)}
                  disabled={registrationClosed || isSubmitting}
                  className="bg-muted/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="message" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mensaje para el organizador
              </Label>
              <Textarea
                id="message"
                placeholder="Contanos sobre tu equipo, categoría, nivel de juego..."
                rows={3}
                value={message}
                onChange={e => setMessage(e.target.value)}
                disabled={registrationClosed || isSubmitting}
                className="bg-muted/30 resize-none"
              />
            </div>

            <Button
              type="submit"
              disabled={registrationClosed || isSubmitting}
              className="w-full font-bold uppercase tracking-wide"
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
              ) : (
                <><ClipboardList className="mr-2 h-4 w-4" /> Enviar Solicitud</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
