
'use client';

import { cn } from '@/lib/utils';
import type { JerseyStyle } from '@/lib/types';

interface JerseyIconProps {
  style: JerseyStyle;
  primaryColor: string;
  secondaryColor: string;
  className?: string;
}

export function JerseyIcon({ style, primaryColor, secondaryColor, className }: JerseyIconProps) {
  const shirtPath = "M46.196,83.033c-22.051,0-41.05-14.979-46.198-36.434l-1.453-6.015H-3h-0.003L-4.459,40.641 c-7.72,0-15.437,0.974-22.876,2.863L-149.37,74.406c-6.155,1.525-11.319,5.356-14.569,10.778 c-3.242,5.424-4.17,11.8-2.599,17.941l13.577,53.215c2.691,10.546,12.167,17.909,23.057,17.909c1.922,0,3.845-0.236,5.723-0.701 l39.417-9.79c4.466-1.072,5.626,2.404,5.626,4.396v249.939c0,13.049,10.63,23.676,23.686,23.676H210.65c13.063,0,23.699-10.627,23.699-23.676 V168.109c0-1.729,0.497-4.626,3.892-4.626c0.528,0,1.13,0.08,1.719,0.23l39.237,9.74c1.871,0.465,3.803,0.702,5.727,0.702 c10.892,0,20.369-7.364,23.051-17.909l13.577-53.215c1.566-6.141,0.645-12.509-2.605-17.941 c-3.241-5.422-8.411-9.253-14.559-10.778L180,43.412c-7.489-1.905-15.212-2.879-22.998-2.879l-30.453-0.05l-1.454,6.015 C99.941,68.053,80.946,83.033,58.899,83.033";
  const uniqueId = "jerseyClipPath";

  return (
    <svg
      viewBox="-170 -10 580 486.347"
      xmlSpace="preserve"
      className={cn('w-full h-full', className)}
    >
      <defs>
        <clipPath id={uniqueId}>
          <path transform="translate(187.3, 37.03)" d={shirtPath} />
        </clipPath>
      </defs>
      
      <g clipPath={`url(#${uniqueId})`}>
        {/* Base Layer */}
        <rect x="-200" y="0" width="600" height="500" fill={primaryColor} />
        
        {/* Style Layer */}
        {style === 'stripes' && (
          <>
            <rect x="-25" y="0" width="50" height="500" fill={secondaryColor} />
            <rect x="125" y="0" width="50" height="500" fill={secondaryColor} />
            <rect x="275" y="0" width="50" height="500" fill={secondaryColor} />
          </>
        )}
        {style === 'sash' && (
           <polygon fill={secondaryColor} points="225,0 450,500 550,500 325,0" />
        )}
      </g>
      
      {/* Outline Layer (visible for solid style) */}
      {style === 'solid' && (
         <path transform="translate(187.3, 37.03)" d={shirtPath} fill="none" stroke={primaryColor} strokeWidth="20" />
      )}

    </svg>
  );
}
