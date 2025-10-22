
'use client';
import { JerseyProps } from '.';

const shirtPath = "M90 4.5C60.7 4.5 36.9 28.3 36.9 57.6v104.4h106.2V57.6C143.1 28.3 119.3 4.5 90 4.5z";
const collarPath = "M79 8.5c0 0-1.8 7.5 11 7.5s11-7.5 11-7.5";

export function CheckeredJersey({ primaryColor = '#cccccc', secondaryColor = '#aaaaaa', className }: JerseyProps) {
    const id = `checkered-jersey-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
        <svg viewBox="0 0 180 180" className={className} preserveAspectRatio="xMidYMid meet">
             <defs>
                <clipPath id={id}>
                    <path d={shirtPath} />
                </clipPath>
                 <pattern id={`pattern-${id}`} width="40" height="40" patternUnits="userSpaceOnUse">
                    <rect width="20" height="20" fill={primaryColor} />
                    <rect x="20" y="0" width="20" height="20" fill={secondaryColor} />
                    <rect x="0" y="20" width="20" height="20" fill={secondaryColor} />
                    <rect x="20" y="20" width="20" height="20" fill={primaryColor} />
                </pattern>
            </defs>
            <g clipPath={`url(#${id})`}>
                <rect x="0" y="0" width="180" height="180" fill={`url(#pattern-${id})`} />
            </g>
            <path d={collarPath} fill="none" stroke={primaryColor} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
