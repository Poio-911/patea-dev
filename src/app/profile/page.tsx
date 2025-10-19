

'use client';

import { useUser, useFirestore, initializeFirebase } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { doc, collection, query, where, writeBatch, getDoc, increment, updateDoc } from 'firebase/firestore';
import { useCollection, useDoc } from '@/firebase/firestore/use-collection';
import { Upload, Settings, UserRound, CaseSensitive, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Player, Match, AvailablePlayer } from '@/lib/types';
import { useState, useRef, useMemo, useEffect, useTransition } from 'react';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import PlayerProfileView from '@/components/player-profile-view';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SetAvailabilityDialog } from '@/components/set-availability-dialog';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { generatePlayerCardImageAction } from '@/lib/actions';
import { Separator } from '@/components/ui/separator';

export default function ProfilePage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, startTransition] = useTransition();
  
  const playerRef = useMemo(() => firestore && user?.uid ? doc(firestore, 'players', user.uid) : null, [firestore, user?.uid]);
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  const availablePlayerRef = useMemo(() => firestore && user?.uid ? doc(firestore, 'availablePlayers', user.uid) : null, [firestore, user?.uid]);
  const { data: availablePlayerData, loading: availablePlayerLoading } = useDoc<AvailablePlayer>(availablePlayerRef);

  const createdPlayersQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'players'), where('ownerUid', '==', user.uid));
  }, [firestore, user?.uid]);
  const { data: createdPlayers, loading: createdPlayersLoading } = useCollection<Player>(createdPlayersQuery);

  const createdMatchesQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'matches'), where('ownerUid', '==', user.uid));
  }, [firestore, user?.uid]);
  const { data: createdMatches, loading: createdMatchesLoading } = useCollection<Match>(createdMatchesQuery);
  
  const manualPlayers = useMemo(() => {
    if(!createdPlayers || !user) return [];
    return createdPlayers.filter(p => p.id !== user.uid);
  }, [createdPlayers, user]);


  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !auth?.currentUser || !firestore) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
        const { firebaseApp } = initializeFirebase();
        const storage = getStorage(firebaseApp);

        const fileExtension = file.name.split('.').pop();
        const fileName = `${user.uid}-${Date.now()}.${fileExtension}`;
        const filePath = `profile-images/${user.uid}/${fileName}`;
        
        const storageRef = ref(storage, filePath);
        const uploadResult = await uploadBytes(storageRef, file);
        const newPhotoURL = await getDownloadURL(uploadResult.ref);

        const userDocRef = doc(firestore, 'users', user.uid);
        const playerDocRef = doc(firestore, 'players', user.uid);

        const batch = writeBatch(firestore);
        batch.update(userDocRef, { photoURL: newPhotoURL });
        batch.update(playerDocRef, { photoUrl: newPhotoURL });
        
        if (availablePlayerData) {
             const availablePlayerDocRef = doc(firestore, 'availablePlayers', user.uid);
             batch.update(availablePlayerDocRef, { photoUrl: newPhotoURL });
        }
        
        await batch.commit();

        await updateProfile(auth.currentUser, { photoURL: newPhotoURL });

        toast({
            title: '¡Foto actualizada!',
            description: 'Tu foto de perfil ha cambiado.'
        });

    } catch (error: any) {
        console.error('Error updating photo:', error);
        toast({
            variant: 'destructive',
            title: 'Error al subir la imagen',
            description: error.message || 'No se pudo actualizar la foto de perfil.',
        });
    } finally {
        setIsUploading(false);
    }
  };

  const handleGenerateAICard = () => {
    if (!user?.uid) return;
    startTransition(async () => {
        const result = await generatePlayerCardImageAction(user.uid);
        if (result.error) {
            toast({
                variant: 'destructive',
                title: 'Error al generar imagen',
                description: result.error,
            });
        } else {
            toast({
                title: '¡Imagen de jugador generada!',
                description: 'Tu nueva foto de perfil está lista.',
            });
        }
    });
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  const loading = userLoading || createdPlayersLoading || createdMatchesLoading || playerLoading || availablePlayerLoading;
  
  const credits = player?.cardGenerationCredits === undefined ? 2 : player.cardGenerationCredits;

  if (loading) {
    return <div className="flex justify-center items-center h-full"><SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" /></div>;
  }

  if (!user || !player) {
    return <div>No se encontraron datos del perfil.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
        <PageHeader
            title="Mi Perfil"
            description="Tu información personal, estadísticas de jugador y actividad."
        />
      
        <div className="lg:col-span-3">
             <Card>
                <CardContent className="pt-6">
                   <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="relative">
                            <Avatar className="h-32 w-32 border-4 border-primary/50">
                                <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                                <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            {(isUploading || isGenerating) && (
                                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handlePhotoUpload}
                                className="hidden"
                                accept="image/png, image/jpeg, image/gif" 
                            />
                            <Button onClick={handleButtonClick} size="sm" variant="outline" disabled={isUploading || isGenerating} className="w-full">
                                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                {isUploading ? "Subiendo..." : "Cambiar Foto"}
                            </Button>
                            <Button onClick={handleGenerateAICard} size="sm" variant="default" disabled={isGenerating || credits <= 0} className="w-full">
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                Generar con IA ({credits})
                            </Button>
                        </div>
                   </div>
                   <div className='mt-6'>
                     <PlayerProfileView playerId={user.uid} />
                   </div>
                </CardContent>
             </Card>
        </div>

        <Card className="lg:col-span-3">
            <CardHeader>
                <CardTitle>Configuración de Jugador</CardTitle>
            </CardHeader>
            <CardContent>
                <SetAvailabilityDialog player={player} availability={availablePlayerData?.availability || {}}>
                    <Button variant="outline">
                        <UserRound className="mr-2 h-4 w-4" />
                        Configurar mi disponibilidad para partidos
                    </Button>
                </SetAvailabilityDialog>
            </CardContent>
        </Card>

        <div className="lg:col-span-3">
            <Tabs defaultValue="created-matches" className="w-full">
                <TabsList>
                    <TabsTrigger value="created-matches">Partidos Creados</TabsTrigger>
                    <TabsTrigger value="created-players">Jugadores Creados</TabsTrigger>
                </TabsList>
                <TabsContent value="created-matches">
                    <Card>
                        <CardHeader>
                            <CardTitle>Partidos que has Creado</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Partido</TableHead>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Jugadores</TableHead>
                                        <TableHead>Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {createdMatches && createdMatches.length > 0 ? createdMatches.map(match => (
                                        <TableRow key={match.id}>
                                            <TableCell className="font-medium">{match.title}</TableCell>
                                            <TableCell>{format(new Date(match.date), 'dd/MM/yyyy', { locale: es })}</TableCell>
                                            <TableCell>{match.players.length} / {match.matchSize}</TableCell>
                                            <TableCell>
                                                <Badge variant={match.status === 'completed' ? 'secondary' : 'default'}>{match.status}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center h-24">No has creado ningún partido.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="created-players">
                    <Card>
                        <CardHeader>
                            <CardTitle>Jugadores Manuales que has Creado</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Jugador</TableHead>
                                        <TableHead>Posición</TableHead>
                                        <TableHead>OVR</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {manualPlayers && manualPlayers.length > 0 ? manualPlayers.map(player => (
                                        <TableRow key={player.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9">
                                                        <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                                                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium">{player.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{player.position}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge>{player.ovr}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center h-24">No has creado ningún jugador manual.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    </div>
  );
}
