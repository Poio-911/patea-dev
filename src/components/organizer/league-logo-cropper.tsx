'use client';

import { useState, useRef } from 'react';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogTrigger as DialogTrigger,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Scissors, Camera } from 'lucide-react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface LeagueLogoCropperDialogProps {
  onSaveComplete: (base64Url: string) => void;
  children: React.ReactNode;
}

async function getCroppedImg(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  maxWidth = 500,
  maxHeight = 500
): Promise<string | null> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const actualWidth = pixelCrop.width * scaleX;
  const actualHeight = pixelCrop.height * scaleY;

  let targetWidth = actualWidth;
  let targetHeight = actualHeight;

  if (targetWidth > maxWidth || targetHeight > maxHeight) {
    const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
    targetWidth *= ratio;
    targetHeight *= ratio;
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return canvas.toDataURL('image/webp', 0.9);
}

export function LeagueLogoCropperDialog({ onSaveComplete, children }: LeagueLogoCropperDialogProps) {
  const [open, setOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
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

  const handleSaveCrop = async () => {
    if (!completedCrop || !imgRef.current) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, recortá la imagen primero.' });
      return;
    }

    setIsProcessing(true);

    try {
      const croppedImageBase64 = await getCroppedImg(imgRef.current, completedCrop);
      if (!croppedImageBase64) {
        throw new Error('No se pudo recortar la imagen.');
      }
      
      onSaveComplete(croppedImageBase64);
      setOpen(false);
      
    } catch (error: any) {
      console.error("Error validando el logo:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ocurrió un error al procesar el logo.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} handleOnly>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Logo de la Competición</DialogTitle>
          <DialogDescription>
            Subí una imagen cuadrada para que sirva de escudo o logo del torneo.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-center items-center bg-muted/50 p-4 rounded-md min-h-[300px]">
          {imgSrc ? (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1} // Cuadrado perfecto para logo
            >
              <img
                ref={imgRef}
                src={imgSrc}
                alt="Crop preview"
                style={{ maxHeight: '60vh' }}
              />
            </ReactCrop>
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground w-full h-full py-12">
              <Camera className="h-12 w-12 mb-4 animate-pulse opacity-50" />
              <p>Seleccioná o arrastrá el logo.</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            <Upload className="mr-2 h-4 w-4" />
            {imgSrc ? 'Cambiar Logo' : 'Explorar Logo'}
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={handleSaveCrop}
            disabled={!completedCrop || isProcessing}
          >
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scissors className="mr-2 h-4 w-4" />}
            {isProcessing ? 'Procesando...' : 'Guardar Logo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
