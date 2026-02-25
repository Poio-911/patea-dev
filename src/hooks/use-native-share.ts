'use client';

import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

/**
 * Native Web Share API hook. Falls back to clipboard copy if the
 * browser/device doesn't support `navigator.share`.
 *
 * Usage:
 *   const { share } = useNativeShare();
 *   await share({ title: 'Unirte al partido', url: inviteUrl });
 */
export function useNativeShare() {
    const { toast } = useToast();

    const share = useCallback(async (data: { title: string; text?: string; url: string }) => {
        // Prefer native share sheet (works on iOS Safari, Chrome Android, and PWA)
        if (typeof navigator !== 'undefined' && 'share' in navigator) {
            try {
                await navigator.share(data);
                return;
            } catch (err: unknown) {
                // User dismissed the share sheet — not an error
                if (err instanceof Error && err.name === 'AbortError') return;
            }
        }

        // Fallback: copy URL to clipboard
        try {
            await navigator.clipboard.writeText(data.url);
            toast({
                title: '📋 Enlace copiado',
                description: 'El enlace fue copiado al portapapeles.',
                duration: 3000,
            });
        } catch {
            toast({
                title: 'Error',
                description: 'No se pudo copiar el enlace.',
                variant: 'destructive',
                duration: 3000,
            });
        }
    }, [toast]);

    const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

    return { share, canShare };
}
