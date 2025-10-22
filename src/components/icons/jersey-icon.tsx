
import { cn } from '@/lib/utils';
import type { JerseyStyle } from '@/lib/types';

export const JerseyIcon = ({ primaryColor, secondaryColor, style, number }: { primaryColor: string, secondaryColor: string, style: JerseyStyle, number?: number }) => {
    const uniqueIdSuffix = `${primaryColor.replace('#','')}-${secondaryColor.replace('#','')}`;
    return (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <pattern id={`stripes-${uniqueIdSuffix}`} patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
              <rect width="10" height="10" fill={primaryColor} />
              <rect width="5" height="10" fill={secondaryColor} />
            </pattern>
            <linearGradient id={`sash-${uniqueIdSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="45%" stopColor={primaryColor} />
              <stop offset="45%" stopColor={secondaryColor} />
              <stop offset="55%" stopColor={secondaryColor} />
              <stop offset="55%" stopColor={primaryColor} />
            </linearGradient>
          </defs>
          <g clipPath="url(#jersey-clip)">
            <path
              d="M10,30 C10,10 30,0 50,0 C70,0 90,10 90,30 V80 C90,95 75,100 50,100 C25,100 10,95 10,80 V30 Z"
              fill={style === 'solid' ? primaryColor : style === 'stripes' ? `url(#stripes-${uniqueIdSuffix})` : `url(#sash-${uniqueIdSuffix})`}
              stroke={secondaryColor}
              strokeWidth="4"
            />
            {number && (
                <text
                    x="50"
                    y="60"
                    fontFamily="Arial, sans-serif"
                    fontSize="40"
                    fontWeight="bold"
                    fill={secondaryColor}
                    textAnchor="middle"
                    stroke="black"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                >
                    {number}
                </text>
            )}
          </g>
          <clipPath id="jersey-clip">
             <path d="M10,30 C10,10 30,0 50,0 C70,0 90,10 90,30 V80 C90,95 75,100 50,100 C25,100 10,95 10,80 V30 Z" />
          </clipPath>
        </svg>
    );
};
