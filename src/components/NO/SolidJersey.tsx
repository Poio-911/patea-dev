'use client';
import { JerseyProps } from '.';

const shirtPath = "M90 4.5C60.7 4.5 36.9 28.3 36.9 57.6v104.4h106.2V57.6C143.1 28.3 119.3 4.5 90 4.5z";
const collarPath = "M79 8.5c0 0-1.8 7.5 11 7.5s11-7.5 11-7.5";

export function SolidJersey({ primaryColor = '#cccccc', className }: JerseyProps) {
  return (
    <svg viewBox="0 0 180 180" className={className} preserveAspectRatio="xMidYMid meet">
        <path
            d={shirtPath}
            fill={primaryColor}
        />
        <path d={collarPath} fill="none" stroke={primaryColor} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
