
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
import { doc, writeBatch, getDoc } from 'firebase/firestore';
import { Loader2, Upload, Scissors } from 'lucide-react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { convertStorageUrlToBase64 } from '@/lib/actions/image-generation';

interface ImageCropperDialogProps {
  player: {
    photoURL?: string;
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

// Helper function to validate and normalize Firebase Storage URLs
function normalizeFirebaseStorageUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // If it's already a proper Firebase Storage URL, return as-is
    if (urlObj.hostname === 'firebasestorage.googleapis.com' && urlObj.pathname.includes('/o/')) {
      return url;
    }
    
    // If it's a Firebase App domain, try to extract the file path and convert
    if (urlObj.hostname.includes('firebasestorage.app')) {
      // Extract the file path and reconstruct the URL
      const pathMatch = url.match(/\/v0\/b\/[^/]+\/o\/(.+?)(\?|$)/);
      if (pathMatch) {
        const filePath = pathMatch[1];
        return `https://firebasestorage.googleapis.com/v0/b/${urlObj.hostname.split('.')[0]}.appspot.com/o/${filePath}?alt=media`;
      }
    }
    
    return url;
  } catch {
    return url; // Return original if URL parsing fails
  }
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
    if (open && player.photoURL) {
      const photoUrl = player.photoURL; // Capture for TypeScript narrowing
      setIsLoadingImage(true);

      // Use server action to load image (bypasses CORS issues in production)
      const loadImageViaServer = async () => {
        const result = await convertStorageUrlToBase64(photoUrl);
        if (result.error) {
          throw new Error(result.error);
        }
        return result.dataUri!;
      };

      // Fallback: Try client-side strategies
      const loadImageClientSide = async () => {
        try {
          // Normalize the URL first
          const normalizedUrl = normalizeFirebaseStorageUrl(photoUrl);

          // Strategy 1: Direct fetch with proper error handling
          const response = await fetch(normalizedUrl, {
            method: 'GET',
            headers: {
              'Accept': 'image/*',
            },
            mode: 'cors',
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const blob = await response.blob();

          // Verify it's actually an image
          if (!blob.type.startsWith('image/')) {
            throw new Error('Response is not an image');
          }

          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
            reader.readAsDataURL(blob);
          });
        } catch (fetchError) {
          console.warn('Direct fetch failed:', fetchError);

          // Strategy 2: Try loading via Image element (handles CORS better in some cases)
          return new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  reject(new Error('Could not get canvas context'));
                  return;
                }

                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                ctx.drawImage(img, 0, 0);

                resolve(canvas.toDataURL('image/jpeg', 0.9));
              } catch (canvasError) {
                reject(canvasError);
              }
            };

            img.onerror = () => {
              reject(new Error('Failed to load image via Image element'));
            };

            // Try both normalized URL and original URL
            const urlToTry = normalizeFirebaseStorageUrl(photoUrl);
            const urlWithCacheBust = urlToTry.includes('?')
              ? `${urlToTry}&_cb=${Date.now()}`
              : `${urlToTry}?_cb=${Date.now()}`;

            img.src = urlWithCacheBust;
          });
        }
      };

      // Try server action first (production-safe), fallback to client-side
      loadImageViaServer()
        .catch((serverError) => {
          console.warn('Server-side image loading failed:', serverError);
          return loadImageClientSide();
        })
        .then((dataUri) => {
          setImgSrc(dataUri);
        })
        .catch((error) => {
          console.error('All image loading strategies failed for URL:', player.photoURL);
          console.error('Error details:', error);
          toast({
            variant: 'destructive',
            title: 'Error al cargar imagen',
            description: 'No se pudo cargar la imagen actual. Intenta subir una nueva imagen.',
          });
        })
        .finally(() => {
          setIsLoadingImage(false);
        });
    }
  }, [open, player.photoURL, toast]);

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

      console.log('Uploading to path:', filePath);

      const uploadResult = await uploadBytes(storageRef, croppedImageBlob);
      console.log('Upload completed:', uploadResult.metadata.fullPath);
      
      const newPhotoURL = await getDownloadURL(uploadResult.ref);
      console.log('Download URL obtained:', newPhotoURL);

      // ✅ FIX: Update user, player, and availablePlayers documents in a single batch
      const userDocRef = doc(firestore, 'users', user.uid);
      const playerDocRef = doc(firestore, 'players', user.uid);
      const availablePlayerRef = doc(firestore, 'availablePlayers', user.uid);

      // Check if availablePlayers document exists before updating
      const availablePlayerSnap = await getDoc(availablePlayerRef);

      const photoUpdates = {
        photoUrl: newPhotoURL,
        // Reset crop and zoom as the new image is already cropped
        cropPosition: { x: 50, y: 50 },
        cropZoom: 1
      };

      const batch = writeBatch(firestore);
      batch.update(userDocRef, { photoURL: newPhotoURL });
      batch.update(playerDocRef, photoUpdates);

      // Only update availablePlayers if document exists (player is looking for match)
      if (availablePlayerSnap.exists()) {
        batch.update(availablePlayerRef, photoUpdates);
      }

      await batch.commit();
      console.log('Firestore batch update completed (including availablePlayers if exists)');

      // ✅ FIX: Force update the auth user profile to propagate changes globally
      await updateProfile(auth.currentUser, { photoURL: newPhotoURL });
      console.log('Auth profile updated');
      
      if(onSaveComplete) {
        onSaveComplete(newPhotoURL);
      }

      toast({ title: '¡Foto actualizada!', description: 'Tu foto de perfil ha sido recortada y guardada.' });
      setOpen(false);

    } catch (error: any) {
      console.error("Error saving cropped image:", error);
      
      let errorMessage = 'No se pudo guardar la imagen.';
      
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'No tienes permisos para subir la imagen. Verifica que estés autenticado.';
      } else if (error.code === 'storage/quota-exceeded') {
        errorMessage = 'Se ha excedido la cuota de almacenamiento.';
      } else if (error.code === 'storage/unauthenticated') {
        errorMessage = 'Tu sesión ha expirado. Por favor, vuelve a iniciar sesión.';
      } else if (error.code === 'storage/retry-limit-exceeded') {
        errorMessage = 'Error de conexión. Por favor, intenta nuevamente.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: errorMessage 
      });
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
