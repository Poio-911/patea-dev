
'use client';

import { cn } from '@/lib/utils';
import type { GroupTeam, JerseyStyle } from '@/lib/types';


export function JerseyIcon({
  style,
  primaryColor,
  secondaryColor,
  className,
}: {
  style: JerseyStyle;
  primaryColor: string;
  secondaryColor: string;
  className?: string;
}) {
  const SvgBase = ({ children }: { children: React.ReactNode }) => (
     <svg
        version="1.1"
        viewBox="0 0 486.347 486.347"
        xmlSpace="preserve"
        className={cn('w-full h-full', className)}
    >
        {children}
    </svg>
  );

  const MainPath = () => (
     <path fill={primaryColor} d="M14.32,158.336c2.691,10.546,12.167,17.909,23.057,17.909c1.922,0,3.845-0.236,5.723-0.701l39.417-9.79 c4.466-1.072,5.626,2.404,5.626,4.396v249.939c0,13.049,10.63,23.676,23.686,23.676H374.7c13.063,0,23.699-10.627,23.699-23.676 V170.208c0-1.729,0.497-4.626,3.892-4.626c0.528,0,1.13,0.08,1.719,0.23l39.237,9.74c1.871,0.465,3.803,0.702,5.727,0.702 c10.892,0,20.369-7.364,23.051-17.909l13.577-53.215c1.566-6.141,0.645-12.509-2.605-17.941 c-3.241-5.422-8.411-9.253-14.559-10.778L343.975,45.511c-7.489-1.905-15.212-2.879-22.998-2.879l-30.453-0.05l-1.454,6.015 c-5.154,21.454-24.149,36.434-46.196,36.434c-22.051,0-41.05-14.979-46.198-36.434l-1.453-6.015h-28.569l-1.403,0.058 c-7.72,0-15.437,0.974-22.876,2.863L17.915,76.41c-6.155,1.525-11.319,5.356-14.569,10.778c-3.242,5.424-4.17,11.8-2.599,17.941 L14.32,158.336z"/>
  );

   switch (style) {
    case 'stripes':
      return (
        <SvgBase>
            <MainPath />
            <path fill={secondaryColor} d="M243.173,83.03v403.317h50V83.03h-50z" />
            <path fill={secondaryColor} d="M143.173,83.03v403.317h50V83.03h-50z" />
            <path fill={secondaryColor} d="M343.173,83.03v403.317h50V83.03h-50z" />
        </SvgBase>
      )
    case 'sash':
       return (
        <SvgBase>
            <MainPath />
            <polygon fill={secondaryColor} points="389.28,83.03 97.067,486.347 146.52,486.347 438.733,83.03 "/>
        </SvgBase>
      )
    case 'solid':
    default:
        return (
            <SvgBase>
                <g stroke={secondaryColor} strokeWidth="20">
                     <MainPath />
                </g>
            </SvgBase>
        )
  }
}
