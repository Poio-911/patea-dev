'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Share2, MessageCircle, Twitter, Facebook, Link2, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
  imageUrl?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export function ShareButton({
  title,
  text,
  url,
  imageUrl,
  variant = 'outline',
  size = 'default',
  showLabel = true,
}: ShareButtonProps) {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const fullText = `${title}\n\n${text}\n\n${shareUrl}`;

  const handleWhatsAppShare = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
  };

  const handleFacebookShare = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Enlace copiado',
        description: 'El enlace se copió al portapapeles',
      });
    } catch (error) {
      console.error('Error copying link:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo copiar el enlace',
      });
    }
  };

  const handleDownloadImage = async () => {
    if (!imageUrl) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No hay imagen disponible para descargar',
      });
      return;
    }

    setIsDownloading(true);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `patea-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Imagen descargada',
        description: 'La imagen se guardó en tu dispositivo',
      });
    } catch (error) {
      console.error('Error downloading image:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo descargar la imagen',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled or error occurred
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback to copy link
      handleCopyLink();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <Share2 className={showLabel ? 'mr-2 h-4 w-4' : 'h-4 w-4'} />
          {showLabel && 'Compartir'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Compartir en</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleWhatsAppShare}>
          <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
          WhatsApp
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleTwitterShare}>
          <Twitter className="mr-2 h-4 w-4 text-blue-400" />
          Twitter
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleFacebookShare}>
          <Facebook className="mr-2 h-4 w-4 text-blue-600" />
          Facebook
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleCopyLink}>
          <Link2 className="mr-2 h-4 w-4" />
          Copiar enlace
        </DropdownMenuItem>

        {imageUrl && (
          <DropdownMenuItem onClick={handleDownloadImage} disabled={isDownloading}>
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Descargar imagen
          </DropdownMenuItem>
        )}

        {typeof window !== 'undefined' && 'share' in navigator && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleNativeShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Compartir...
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
