'use client';

import { useState, useEffect, useTransition } from 'react';
import {
    ResponsiveDialog as Dialog,
    ResponsiveDialogContent as DialogContent,
    ResponsiveDialogHeader as DialogHeader,
    ResponsiveDialogTitle as DialogTitle,
    ResponsiveDialogTrigger as DialogTrigger,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { AvailablePlayer, Match } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, MapPin, Send, UserCheck, Star } from 'lucide-react';
import { getAvailableLocalPlayersAction } from '@/lib/actions/recruitment-actions';
import { PlayersMap } from '@/components/maps/players-map';
import { MapsProvider } from '@/components/maps/maps-provider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { sendMatchInvitationsAction } from '@/lib/actions/match-invitation-actions';

interface RecruitmentDialogProps {
    match: Match;
    children: React.ReactNode;
}

export function RecruitmentDialog({ match, children }: RecruitmentDialogProps) {
    const [open, setOpen] = useState(false);
    const [radiusInKm, setRadiusInKm] = useState<number>(10);
    const [players, setPlayers] = useState<AvailablePlayer[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const selectedPlayer = players.find(p => p.uid === selectedPlayerId);

    // Fetch players on open and when radius changes
    useEffect(() => {
        if (!open || !match.location.lat || !match.location.lng) return;

        let isMounted = true;

        // We can extract day/time of the match if established to filter availabilities
        const matchDayStr = match.date ? format(new Date(match.date), 'eeee', { locale: es }).toLowerCase() : undefined;
        // Map date-fns 'eeee' output to our DayOfWeek types if necessary, handling tildes:
        // lunes, martes, miercoles, jueves, viernes, sabado, domingo
        let matchDayOfWeek: any = undefined;
        if (matchDayStr) {
            const charMap: Record<string, string> = { 'miércoles': 'miercoles', 'sábado': 'sabado' };
            matchDayOfWeek = charMap[matchDayStr] || matchDayStr;
        }

        const fetchPlayers = async () => {
            setIsLoading(true);
            const res = await getAvailableLocalPlayersAction({
                lat: match.location.lat!,
                lng: match.location.lng!,
                radiusInKm,
                dayOfWeek: matchDayOfWeek
            });

            if (isMounted) {
                if (res.success && res.players) {
                    // filter out already invited players or already in match
                    const inMatchUids = new Set([
                        ...(match.players?.map(p => p.uid) || []),
                        match.ownerUid
                    ]);
                    setPlayers(res.players.filter(p => !inMatchUids.has(p.uid)));
                } else {
                    toast({ variant: 'destructive', title: 'Error', description: res.error || 'No se pudieron cargar jugadores' });
                }
                setIsLoading(false);
            }
        };

        fetchPlayers();

        return () => { isMounted = false; };
    }, [open, radiusInKm, match.location, match.date, toast, match.players, match.ownerUid]);

    const handleInvite = () => {
        if (!selectedPlayer) return;

        startTransition(async () => {
            try {
                const result = await sendMatchInvitationsAction(match.id, [selectedPlayer.uid]);
                if (!result.success) {
                    throw new Error(result.error || 'No se pudo enviar la invitación.');
                }
                toast({
                    title: '¡Invitación Enviada!',
                    description: `Se notificó a ${selectedPlayer.displayName} para el partido.`,
                });

                // Remove locally so it cannot be spammed
                setPlayers(prev => prev.filter(p => p.uid !== selectedPlayer.uid));
                setSelectedPlayerId(null);

            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar.' });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-h-[90vh] flex flex-col p-0 overflow-hidden w-full max-w-3xl">
                <DialogHeader className="p-4 pb-2 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" />
                        Reclutar Jugadores
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-grow flex flex-col h-[60vh] relative">
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 w-11/12 max-w-sm bg-background/80 backdrop-blur-md p-3 rounded-lg border shadow-lg flex items-center gap-4">
                        <span className="text-xs font-semibold whitespace-nowrap">Distancia: {radiusInKm}km</span>
                        <Slider
                            value={[radiusInKm]}
                            onValueChange={(v) => setRadiusInKm(v[0])}
                            max={50} min={1} step={1}
                            className="flex-1"
                        />
                    </div>

                    {isLoading && (
                        <div className="absolute inset-0 z-20 bg-background/50 flex items-center justify-center backdrop-blur-sm">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    )}

                    <div className="flex-grow w-full h-full">
                        <MapsProvider>
                            <PlayersMap
                                players={players}
                                userLocation={match.location.lat && match.location.lng ? { lat: match.location.lat, lng: match.location.lng } : null}
                                activePlayerId={selectedPlayerId}
                                onPlayerSelect={setSelectedPlayerId}
                                searchRadius={radiusInKm}
                            />
                        </MapsProvider>
                    </div>

                    <div className="absolute bottom-4 left-0 right-0 px-4 flex justify-center pointer-events-none">
                        <div className="pointer-events-auto w-full max-w-md transition-all duration-300 transform">
                            {selectedPlayer ? (
                                <Card className="p-3 shadow-xl border-2 border-primary/20 backdrop-blur-md bg-card/90">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-12 w-12 border shadow-sm">
                                                <AvatarImage src={selectedPlayer.photoUrl} alt={selectedPlayer.displayName} />
                                                <AvatarFallback>{selectedPlayer.displayName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="font-bold">{selectedPlayer.displayName}</span>
                                                <div className="flex gap-1.5 mt-0.5">
                                                    <Badge variant="outline" className="text-[10px] h-4 leading-none bg-primary/10 border-primary/20 text-primary uppercase">{selectedPlayer.position}</Badge>
                                                    <Badge variant="secondary" className="text-[10px] h-4 leading-none gap-0.5"><Star className="h-2.5 w-2.5 fill-info text-info" /> {selectedPlayer.ovr}</Badge>
                                                </div>
                                            </div>
                                        </div>
                                        <Button onClick={handleInvite} disabled={isPending} className="shrink-0 group">
                                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1.5 transition-transform group-hover:translate-x-1" />}
                                            Invitar
                                        </Button>
                                    </div>
                                </Card>
                            ) : (
                                <div className="bg-foreground/80 text-background px-4 py-2 rounded-full text-xs font-semibold shadow-md text-center mx-auto opacity-80 max-w-xs">
                                    {players.length > 0 ? `Tocá un marcador para ver al jugador` : `No se encontraron jugadores cerca`}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
