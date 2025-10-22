
'use client';
import { JerseyProps } from '.';

const shirtPath = "M90 4.5C60.7 4.5 36.9 28.3 36.9 57.6v104.4h106.2V57.6C143.1 28.3 119.3 4.5 90 4.5zM47.5 16.8L33.7 28.3c-2.3 1.9-3.7 4.8-3.7 7.7v20.4h120V36.4c0-2.9-1.4-5.8-3.7-7.7L132.5 16.8c-8.6-7.2-19.4-11.3-30.8-11.3h-21.4C100.9 5.5 90.1 9.6 81.5 16.8L47.5 16.8z";

export function HoopsJersey({ primaryColor = '#cccccc', secondaryColor = '#aaaaaa', className }: JerseyProps) {
    const id = `hoops-jersey-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
        <svg viewBox="0 0 180 180" className={className} preserveAspectRatio="xMidYMid meet">
             <defs>
                <clipPath id={id}>
                    <path d={shirtPath} />
                </clipPath>
                 <pattern id={`pattern-${id}`} width="100%" height="25%" patternContentUnits="objectBoundingBox">
                    <rect y="0" width="1" height="0.5" fill={primaryColor} />
                    <rect y="0.5" width="1" height="0.5" fill={secondaryColor} />
                </pattern>
            </defs>
            <g clipPath={`url(#${id})`}>
                <rect x="0" y="0" width="180" height="180" fill={`url(#pattern-${id})`} />
            </g>
            <path d="M79 8.5c0 0-1.8 7.5 11 7.5s11-7.5 11-7.5" fill="none" stroke={primaryColor} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
