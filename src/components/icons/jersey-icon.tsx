// This component has been deprecated in favor of the modular jerseys in /components/jerseys
// It is kept for reference but should not be used in new implementations.
// Please use the JerseyIcon from '/components/jerseys' instead.
import { cn } from '@/lib/utils';
import type { JerseyStyle } from '@/lib/types';

interface JerseyIconProps {
  style: JerseyStyle;
  primaryColor: string;
  secondaryColor: string;
  className?: string;
  number?: number;
}

export function JerseyIcon({ style, primaryColor, secondaryColor, className, number }: JerseyIconProps) {
  const shirtPath = "M 0,-40 C 10,-40 10,-30 15,-20 L 15,10 L -15,10 L -15,-20 C -10,-30 -10,-40 0,-40 Z";
  const clipId = `jersey_clip_${style}_${primaryColor.replace('#','')}_${secondaryColor.replace('#','')}`
  
  return (
    <svg
      viewBox="-20 -50 40 40"
      xmlSpace="preserve"
      className={cn('w-full h-full', className)}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={shirtPath} />
        </clipPath>
      </defs>
      
      <g clipPath={`url(#${clipId})`}>
        <rect x="-20" y="-50" width="40" height="60" fill={primaryColor} />
        
        {style === 'stripes' && (
          <>
            <rect x="-15" y="-50" width="10" height="60" fill={secondaryColor} />
            <rect x="5" y="-50" width="10" height="60" fill={secondaryColor} />
          </>
        )}
        
        {style === 'sash' && (
           <polygon points="-20,-25 5,-50 -5,-50 -20,-5" fill={secondaryColor} />
        )}

      </g>
       {number && (
        <text
          x="0"
          y="-5"
          fontFamily="sans-serif"
          fontSize="20"
          textAnchor="middle"
          fill="#ffffff"
          stroke='#00000080'
          strokeWidth="0.5"
          fontWeight="bold"
        >
          {number}
        </text>
      )}
    </svg>
  );
}
