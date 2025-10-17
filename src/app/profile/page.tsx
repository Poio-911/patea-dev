
'use client';

import { useUser, useFirestore } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { doc, collection, query, where, setDoc, updateDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Loader2, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Player, Match } from '@/lib/types';
import { useState, useRef, useMemo } from 'react';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import PlayerProfileView from '@/components/player-profile-view';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';


export default function ProfilePage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!user || !firestore || !auth?.currentUser) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    const storage = getStorage(auth.app);
    const fileExtension = file.name.split('.').pop();
    const fileName = `${user.uid}-${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `profile-images/${fileName}`);

    try {
        const uploadTask = await uploadBytes(storageRef, file);
        const newPhotoURL = await getDownloadURL(uploadTask.ref);

        const userDocRef = doc(firestore, 'users', user.uid);
        const playerDocRef = doc(firestore, 'players', user.uid);

        await updateProfile(auth.currentUser, { photoURL: newPhotoURL });
        await setDoc(userDocRef, { photoURL: newPhotoURL }, { merge: true });
        await setDoc(playerDocRef, { photoUrl: newPhotoURL }, { merge: true });


        toast({
            title: '¡Foto actualizada!',
            description: 'Tu foto de perfil ha cambiado.'
        });

    } catch (error) {
        console.error('Error updating photo:', error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se pudo actualizar la foto de perfil.',
        });
    } finally {
        setIsUploading(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
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
                Cambiar Foto de Perfil
            </Button>
      </PageHeader>
      
      <PlayerProfileView playerId={user.uid} />

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
                                    <TableCell>{format(new Date(match.date), 'dd/MM/yyyy')}</TableCell>
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
  );
}
