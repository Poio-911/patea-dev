
'use client';

import { useUser, useFirestore, initializeFirebase } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { doc, collection, query, where, writeBatch } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Loader2, Upload, Settings, UserRound, CaseSensitive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Player, Match } from '@/lib/types';
import { useState, useRef, useMemo } from 'react';
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


export default function ProfilePage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAvailable, setIsAvailable] = useState(false);

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
        const fileName = `${user.uid}-${crypto.randomUUID()}.${fileExtension}`;
        const filePath = `profile-images/${user.uid}/${fileName}`;
        
        const storageRef = ref(storage, filePath);
        const uploadResult = await uploadBytes(storageRef, file);
        const newPhotoURL = await getDownloadURL(uploadResult.ref);

        const userDocRef = doc(firestore, 'users', user.uid);
        const playerDocRef = doc(firestore, 'players', user.uid);

        const batch = writeBatch(firestore);
        batch.update(userDocRef, { photoURL: newPhotoURL });
        batch.update(playerDocRef, { photoUrl: newPhotoURL });
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

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvailabilityChange = (checked: boolean) => {
    // TODO: Implement logic to update Firestore /availablePlayers collection
    setIsAvailable(checked);
    toast({
      title: `Disponibilidad ${checked ? 'Activada' : 'Desactivada'}`,
      description: checked ? 'Ahora aparecerás en la lista de jugadores libres.' : 'Ya no eres visible para otros organizadores.',
    });
  };
  
  const loading = userLoading || createdPlayersLoading || createdMatchesLoading;

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) {
    return <div>No se encontraron datos del perfil.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
        <PageHeader
            title="Mi Perfil"
            description="Tu información personal, estadísticas de jugador y actividad."
        >
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handlePhotoUpload}
                className="hidden"
                accept="image/png, image/jpeg, image/gif" 
            />
            <Button onClick={handleButtonClick} size="sm" variant="outline" disabled={isUploading}>
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {isUploading ? "Subiendo..." : "Cambiar Foto"}
            </Button>
      </PageHeader>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-3">
             <PlayerProfileView playerId={user.uid} isUploading={isUploading} />
        </div>

        <Card className="lg:col-span-3">
            <CardHeader>
                <CardTitle>Configuración de Jugador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex items-center space-x-4 rounded-md border p-4">
                    <UserRound className="h-6 w-6"/>
                    <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">
                            Disponible para Partidos
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Permite que otros organizadores te encuentren y te inviten a sus partidos.
                        </p>
                    </div>
                    <Switch
                        checked={isAvailable}
                        onCheckedChange={handleAvailabilityChange}
                        aria-label="Disponibilidad para partidos"
                    />
                </div>
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
    </div>
  );
}
