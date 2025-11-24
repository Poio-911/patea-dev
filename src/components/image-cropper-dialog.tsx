
'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { useUser, useAuth, initializeFirebase } from '../firebase';
import { useToast } from '../hooks/use-toast';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { doc, writeBatch } from 'firebase/firestore';
import { Loader2, Upload, Scissors } from 'lucide-react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

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
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const { user } = useUser();
  const auth = useAuth();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined);
      const reader = new FileReader();
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(e.target.files[0]);
    }
  };
  
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setImgSrc('');
      setCrop(undefined);
      setCompletedCrop(undefined);
    }
  };

  useEffect(() => {
    if (open && player.photoUrl) {
      setIsLoadingImage(true);

      // Fetch image directly from client (Firebase Storage URLs are public with token)
      fetch(player.photoUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to fetch image');
          }
          return response.blob();
        })
        .then((blob) => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        })
        .then((dataUri) => {
          setImgSrc(dataUri);
        })
        .catch((error) => {
          console.error('Error loading image:', error);
          toast({
            variant: 'destructive',
            title: 'Error al cargar imagen',
            description: 'No se pudo cargar la imagen actual.',
          });
        })
        .finally(() => {
          setIsLoadingImage(false);
        });
    }
  }, [open, player.photoUrl, toast]);

  const handleSaveCrop = async () => {
    if (!completedCrop || !imgRef.current) {
        toast({ variant: 'destructive', title: 'Error', description: 'Por favor, recortá la imagen primero.' });
        return;
    }
    
    setIsUploading(true);

    try {
      const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop);
      if (!croppedImageBlob) {
        throw new Error('No se pudo recortar la imagen.');
      }
      
      if (!user || !auth?.currentUser) {
        // If not logged in (e.g., during registration), just pass the data URI back
        const reader = new FileReader();
        reader.onloadend = () => {
            if (onSaveComplete) {
                onSaveComplete(reader.result as string);
            }
            setOpen(false);
        };
        reader.readAsDataURL(croppedImageBlob);
        setIsUploading(false);
        return;
      }

      // Logged-in user flow
      const { firebaseApp, firestore } = initializeFirebase();
      const storage = getStorage(firebaseApp);
      const filePath = `profile-images/${user.uid}/profile_${Date.now()}.jpg`;
      const storageRef = ref(storage, filePath);

      const uploadResult = await uploadBytes(storageRef, croppedImageBlob);
      const newPhotoURL = await getDownloadURL(uploadResult.ref);

      // ✅ FIX: Update both user and player documents in a single batch
      const userDocRef = doc(firestore, 'users', user.uid);
      const playerDocRef = doc(firestore, 'players', user.uid);

      const batch = writeBatch(firestore);
      batch.update(userDocRef, { photoURL: newPhotoURL });
      batch.update(playerDocRef, { 
          photoUrl: newPhotoURL,
          // Reset crop and zoom as the new image is already cropped
          cropPosition: { x: 50, y: 50 }, 
          cropZoom: 1
      });
      await batch.commit();

      // ✅ FIX: Force update the auth user profile to propagate changes globally
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
            Subí una nueva imagen y ajusta el recorte.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center items-center bg-muted/50 p-4 rounded-md">
          {isLoadingImage ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="h-10 w-10 mb-2 animate-spin" />
              <p>Cargando imagen...</p>
            </div>
          ) : imgSrc ? (
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
              />
            </ReactCrop>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
              <Upload className="h-10 w-10 mb-2" />
              <p>Subí una imagen para empezar.</p>
            </div>
          )}
        </div>
        <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                disabled={isUploading || isLoadingImage}
            >
                <Upload className="mr-2 h-4 w-4" />
                Subir Nueva Foto
            </Button>
            <Button
                type="button"
                onClick={handleSaveCrop}
                disabled={!completedCrop || isUploading || isLoadingImage}
            >
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scissors className="mr-2 h-4 w-4" />}
                {isUploading ? 'Guardando...' : 'Guardar Recorte'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
