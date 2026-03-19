'use client';

import * as React from 'react';
import { Sponsor } from '@/lib/types';
import { motion } from 'framer-motion';

interface CompetitionSponsorsMarqueeProps {
  sponsors?: Sponsor[];
}

export function CompetitionSponsorsMarquee({ sponsors = [] }: CompetitionSponsorsMarqueeProps) {
  if (sponsors.length === 0) return null;

  // Duplicate sponsors for a continuous loop
  const marqueeSponsors = [...sponsors, ...sponsors, ...sponsors];

  return (
    <div className="w-full py-8 bg-gradient-to-r from-background/0 via-muted/30 to-background/0 border-y border-border/40 overflow-hidden relative">
      <div className="max-w-6xl mx-auto px-4 mb-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 text-center">
          Nuestros Sponsors
        </h3>
      </div>
      
      <div className="flex overflow-hidden relative group">
        {/* Left Fade Overlay */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10" />
        
        <motion.div 
          className="flex gap-12 items-center whitespace-nowrap px-6"
          animate={{ x: [0, -1000] }}
          transition={{ 
            duration: 30, 
            repeat: Infinity, 
            ease: "linear" 
          }}
        >
          {marqueeSponsors.map((sponsor, idx) => (
            <a
              key={`${sponsor.id}-${idx}`}
              href={sponsor.websiteUrl || '#'}
              target={sponsor.websiteUrl ? "_blank" : undefined}
              rel="noreferrer"
              className="flex-shrink-0 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500 transform hover:scale-110 px-4"
              title={sponsor.name}
            >
              <img 
                src={sponsor.logoUrl} 
                alt={sponsor.name} 
                className="h-12 md:h-16 w-auto object-contain max-w-[120px]"
              />
            </a>
          ))}
        </motion.div>

        {/* Right Fade Overlay */}
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10" />
      </div>
    </div>
  );
}
