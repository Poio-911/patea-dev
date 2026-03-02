'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { recordCampaignInteraction } from '@/lib/actions/ad-actions';

// Tipo mock para lo que vendría de Firestore
export interface SponsorCampaign {
    id: string;
    title: string;
    imageUrl: string;
    redirectUrl: string;
    placement: 'feed' | 'match' | 'leaderboard';
    sponsorName: string;
}

interface SponsorCardProps {
    campaign: SponsorCampaign;
    className?: string;
}

export function SponsorCard({ campaign, className = '' }: SponsorCardProps) {
    const [isIntersecting, setIntersecting] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const impressionRecorded = useRef(false);

    // Intersection Observer para registrar la impresión SOLO cuando se ve en pantalla
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            setIntersecting(entry.isIntersecting);
        }, { rootMargin: '0px', threshold: 0.5 }); // 50% de visibilidad requerida

        if (cardRef.current) observer.observe(cardRef.current);

        return () => {
            observer.disconnect();
        };
    }, []);

    // Grabar impresión una vez
    useEffect(() => {
        if (isIntersecting && !impressionRecorded.current) {
            impressionRecorded.current = true;
            // Enviamos el evento de impresión sin bloquear
            recordCampaignInteraction(campaign.id, 'impression').catch(() => null);
        }
    }, [isIntersecting, campaign.id]);

    const handleCardClick = () => {
        // Registrar el Click (asincrono no bloqueante)
        recordCampaignInteraction(campaign.id, 'click').catch(() => null);
    };

    return (
        <div
            ref={cardRef}
            className={`relative w-full overflow-hidden rounded-2xl bg-card border border-border shadow-md group ${className}`}
        >
            <Link
                href={campaign.redirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCardClick}
                className="block relative aspect-[21/9] sm:aspect-[4/1]"
            >
                <Image
                    src={campaign.imageUrl}
                    alt={campaign.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Overlay subtle shadow */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                {/* Brand label & Sponsor mark */}
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-sm bg-black/50 backdrop-blur-sm border border-white/10 text-[9px] font-black uppercase tracking-widest text-primary font-headline">
                    Patrocinado
                </div>

                <div className="absolute bottom-2 sm:bottom-3 left-3 flex justify-between items-end w-[calc(100%-24px)]">
                    <div className="text-white space-y-0.5">
                        <p className="text-xs font-medium text-white/80">{campaign.sponsorName}</p>
                        <h4 className="font-bold text-sm sm:text-base leading-tight drop-shadow-md">
                            {campaign.title}
                        </h4>
                    </div>
                    <div className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-2 opacity-90 transition-transform group-hover:scale-110">
                        <ExternalLink className="h-4 w-4" />
                    </div>
                </div>
            </Link>
        </div>
    );
}
