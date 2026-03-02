'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface AdBannerProps {
    dataAdSlot: string;
    dataAdFormat?: string;
    dataFullWidthResponsive?: boolean;
    className?: string;
}

export function AdBanner({
    dataAdSlot,
    dataAdFormat = 'auto',
    dataFullWidthResponsive = true,
    className = '',
}: AdBannerProps) {
    const pathname = usePathname();
    const adRef = useRef<HTMLModElement>(null);
    const hasInitialized = useRef(false);

    useEffect(() => {
        // Only load if AdSense is configured
        if (!process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID) return;

        // Prevent double loading in React Strict Mode or on route changes 
        // if the ad block still exists and hasn't been emptied by Next.js
        if (!hasInitialized.current && adRef.current && adRef.current.innerHTML === '') {
            try {
                // @ts-ignore
                (window.adsbygoogle = window.adsbygoogle || []).push({});
                hasInitialized.current = true;
            } catch (error) {
                console.error('AdSense initialization error:', error);
            }
        }

        // Reset initialization when pathname changes if the ad block is cleared
        return () => {
            hasInitialized.current = false;
        }
    }, [pathname]);

    if (!process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID) {
        // Return a simulation banner if AdSense isn't configured for visual debugging
        return (
            <div className={`overflow-hidden w-full flex justify-center items-center py-4 px-2 ${className}`}>
                <div className="w-full max-w-md bg-muted/30 border border-dashed border-primary/40 rounded-xl relative aspect-[12/3] sm:aspect-[12/2] flex flex-col items-center justify-center text-muted-foreground">
                    <div className="absolute top-1 left-2 text-[8px] font-black uppercase tracking-widest text-primary/60">
                        AdSense Space
                    </div>
                    <span className="font-semibold text-sm sm:text-base text-foreground/70 tracking-tight">Publicidad Genérica (Simulación)</span>
                    <span className="text-[10px] text-muted-foreground mt-1">Acá se inyectaría Google AdSense</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`overflow-hidden w-full flex justify-center items-center ${className}`}>
            <ins
                className="adsbygoogle"
                ref={adRef}
                style={{ display: 'block', minWidth: '300px', minHeight: '100px', width: '100%' }}
                data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
                data-ad-slot={dataAdSlot}
                data-ad-format={dataAdFormat}
                data-full-width-responsive={dataFullWidthResponsive ? "true" : "false"}
            />
        </div>
    );
}
