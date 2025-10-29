'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUser, useAuth, initializeFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { doc, writeBatch } from 'firebase/firestore';
import { Loader2, Upload, Scissors, Sparkles } from 'lucide-react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { generatePlayerCardImageAction } from '@/lib/actions';

interface ImageCropperDialogProps {
  player: {
    photoUrl?: string;
  };
  onSaveComplete?: (newUrl: string) => void;
  children: React.ReactNode;
}

async function getCroppedImg(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  canvas.width = pixelCrop.width * scaleX;
  canvas.height = pixelCrop.height * scaleY;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg');
  });
}


export function ImageCropperDialog({ player, onSaveComplete, children }: ImageCropperDialogProps) {
  const [open, setOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const { user } = useUser();
  const auth = useAuth();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // Reset crop when new image is selected
      const reader = new FileReader();
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(e.target.files[0]);
    }
  };
  
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
        setImgSrc(player.photoUrl || '');
    }
  }

  const handleGenerateAIPhoto = async () => {
    if (!user?.uid) return;

    setIsGeneratingAI(true);
    try {
      const result = await generatePlayerCardImageAction(user.uid);

      if ('error' in result) {
        toast({
          variant: 'destructive',
          title: 'Error al generar imagen',
          description: result.error,
        });
        return;
      }
      
      if (result.newPhotoURL && onSaveComplete) {
        onSaveComplete(result.newPhotoURL);
      }

      toast({
        title: 'Foto generada con éxito',
        description: 'Tu foto profesional ha sido creada con IA.',
      });

      setOpen(false);
    } catch (error: any) {
      console.error('Error generating AI photo:', error);
      toast({
        variant: 'destructive',
        title: 'Error al generar imagen',
        description: error.message || 'No se pudo generar la imagen con IA.',
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSaveCrop = async () => {
    if (!completedCrop || !imgRef.current) {
        toast({ variant: 'destructive', title: 'Error', description: 'Por favor, recortá la imagen primero.' });
        return;
    }
    
    // If not logged in (e.g., registration page), just pass the data URL back
    if (!user || !auth?.currentUser) {
        const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop);
        if (croppedImageBlob) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (onSaveComplete) {
                    onSaveComplete(reader.result as string);
                }
                setOpen(false);
            };
            reader.readAsDataURL(croppedImageBlob);
        }
        return;
    }


    setIsUploading(true);
    try {
      const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop);
      if (!croppedImageBlob) {
        throw new Error('No se pudo recortar la imagen.');
      }

      const { firebaseApp, firestore } = initializeFirebase();
      const storage = getStorage(firebaseApp);
      const filePath = `profile-images/${user.uid}/profile_${Date.now()}.jpg`;
      const storageRef = ref(storage, filePath);

      const uploadResult = await uploadBytes(storageRef, croppedImageBlob);
      const newPhotoURL = await getDownloadURL(uploadResult.ref);

      const userDocRef = doc(firestore, 'users', user.uid);
      const playerDocRef = doc(firestore, 'players', user.uid);

      const batch = writeBatch(firestore);
      batch.update(userDocRef, { photoURL: newPhotoURL });
      batch.update(playerDocRef, { photoUrl: newPhotoURL });
      await batch.commit();

      await updateProfile(auth.currentUser, { photoURL: newPhotoURL });
      
      if(onSaveComplete) {
        onSaveComplete(newPhotoURL);
      }

      toast({ title: '¡Foto actualizada!', description: 'Tu foto de perfil ha sido recortada y guardada.' });
      setOpen(false);

    } catch (error: any) {
      console.error("Error saving cropped image:", error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo guardar la imagen.' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Foto de Perfil</DialogTitle>
          <DialogDescription>
            Ajustá tu foto de perfil. Hacé clic y arrastrá para recortar la imagen.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center items-center bg-muted/50 p-4 rounded-md">
          {imgSrc ? (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              circularCrop
            >
              <img
                ref={imgRef}
                src={imgSrc}
                alt="Crop preview"
                style={{ maxHeight: '60vh' }}
                crossOrigin="anonymous" 
              />
            </ReactCrop>
          ) : (
            <p className="text-muted-foreground">Subí una imagen para empezar.</p>
          )}
        </div>
        <DialogFooter className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/png, image/jpeg, image/gif"
            />
            <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isGeneratingAI}
            >
                <Upload className="mr-2 h-4 w-4" />
                Cambiar Imagen
            </Button>
            {user && ( // Only show AI generation for logged-in users
              <Button
                  type="button"
                  onClick={handleGenerateAIPhoto}
                  disabled={isUploading || isGeneratingAI}
                  className="relative"
              >
                  {isGeneratingAI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {isGeneratingAI ? "Generando..." : "Generar con IA"}
              </Button>
            )}
            <Button
                type="button"
                onClick={handleSaveCrop}
                disabled={!completedCrop || isUploading || isGeneratingAI}
            >
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scissors className="mr-2 h-4 w-4" />}
                {isUploading ? 'Guardando...' : 'Guardar Recorte'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
