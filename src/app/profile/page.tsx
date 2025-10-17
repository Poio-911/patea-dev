'use client';

import { useUser, useFirestore, useDoc, useFirebase } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, RefreshCw, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { Player } from '@/lib/types';
import { PlayerCard } from '@/components/player-card';
import { StatCard } from '@/components/stat-card';
import { Goal, Shield, Star } from 'lucide-react';
import { useState, useRef } from 'react';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';


export default function ProfilePage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const firebase = useFirebase();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const playerRef = user ? doc(firestore, 'players', user.uid) : null;
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  const loading = userLoading || playerLoading;
  
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !firestore || !auth?.currentUser || !firebase) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    const storage = getStorage(firebase.firebaseApp);
    const fileExtension = file.name.split('.').pop();
    const fileName = `${user.uid}-${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `profile-images/${fileName}`);

    try {
        await uploadBytes(storageRef, file);
        const newPhotoURL = await getDownloadURL(storageRef);

        const batch = writeBatch(firestore);

        // Update auth profile
        await updateProfile(auth.currentUser, { photoURL: newPhotoURL });

        // Update user document
        const userDocRef = doc(firestore, 'users', user.uid);
        batch.update(userDocRef, { photoURL: newPhotoURL });
        
        // Update player document
        const playerDocRef = doc(firestore, 'players', user.uid);
        batch.update(playerDocRef, { photoUrl: newPhotoURL });

        await batch.commit();

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

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user || !player) {
    return <div>No se encontraron datos del perfil.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Mi Perfil" description="Tu información personal y estadísticas de jugador." />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handlePhotoUpload}
        className="hidden"
        accept="image/png, image/jpeg, image/gif" 
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Información de la Cuenta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.photoURL || ''} alt={user.displayName || ''} data-ai-hint="user avatar" />
                  <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                    <p className="text-lg font-semibold">{user.displayName}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                     <Button onClick={handleButtonClick} size="sm" variant="outline" disabled={isUploading}>
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Cambiar Foto
                    </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
                <CardTitle>Estadísticas Generales</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
                <StatCard title="Partidos" value={player.stats?.matchesPlayed || 0} icon={<Shield className="h-6 w-6 text-primary"/>} />
                <StatCard title="Goles" value={player.stats?.goals || 0} icon={<Goal className="h-6 w-6 text-primary"/>} />
                <StatCard title="Asistencias" value={player.stats?.assists || 0} icon={<User className="h-6 w-6 text-primary"/>} />
                <StatCard title="Rating Prom." value={player.stats?.averageRating?.toFixed(2) || 'N/A'} icon={<Star className="h-6 w-6 text-primary"/>} />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
            <Card className="max-w-sm mx-auto">
                <CardHeader>
                    <CardTitle className="text-center">Tu Carta de Jugador</CardTitle>
                </CardHeader>
                <CardContent>
                    <PlayerCard player={player} isLink={false} />
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
