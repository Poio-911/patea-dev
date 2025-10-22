
'use client';

import { cn } from '@/lib/utils';
import type { JerseyStyle } from '@/lib/types';

export const JerseyIcon = ({ primaryColor, secondaryColor, style }: { primaryColor: string, secondaryColor: string, style: JerseyStyle, number?: number }) => {
    const uniqueIdSuffix = `${primaryColor.replace('#','')}-${secondaryColor.replace('#','')}`;
    
    // Fallback to solid style if colors are the same for stripe/sash
    let effectiveStyle = style;
    if ((style === 'stripes' || style === 'sash') && primaryColor === secondaryColor) {
        effectiveStyle = 'solid';
    }

    return (
        <svg viewBox="0 0 48 48" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                {effectiveStyle === 'stripes' && (
                    <pattern id={`pattern-stripes-${uniqueIdSuffix}`} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(90)">
                        <rect width="8" height="8" fill={primaryColor}/>
                        <rect width="4" height="8" fill={secondaryColor}/>
                    </pattern>
                )}
                 {effectiveStyle === 'sash' && (
                     <linearGradient id={`pattern-sash-${uniqueIdSuffix}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="45%" stopColor={primaryColor} />
                        <stop offset="45%" stopColor={secondaryColor} />
                        <stop offset="55%" stopColor={secondaryColor} />
                        <stop offset="55%" stopColor={primaryColor} />
                    </linearGradient>
                )}
            </defs>
            <path 
                d="M12 8C12 4.68629 14.6863 2 18 2H30C33.3137 2 36 4.68629 36 8V34C36 38 30 46 24 46C18 46 12 38 12 34V8Z" 
                fill={
                    effectiveStyle === 'solid' ? primaryColor :
                    effectiveStyle === 'stripes' ? `url(#pattern-stripes-${uniqueIdSuffix})` :
                    `url(#pattern-sash-${uniqueIdSuffix})`
                }
                stroke={secondaryColor} 
                strokeWidth="2"
            />
            <path d="M18,2 H16 C14 4, 14 7, 16 9 H18" stroke={secondaryColor} strokeWidth="2" />
            <path d="M30,2 H32 C34 4, 34 7, 32 9 H30" stroke={secondaryColor} strokeWidth="2" />
        </svg>
    );
};
