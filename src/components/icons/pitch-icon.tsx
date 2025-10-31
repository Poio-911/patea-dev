'use client';
import { cn } from '@/lib/utils';

export const PitchIcon = ({ className }: { className?: string }) => (
    <svg 
        viewBox="0 0 120 180" 
        xmlns="http://www.w3.org/2000/svg"
        className={cn(className)}
        preserveAspectRatio="xMidYMid meet"
    >
        <rect width="120" height="180" fill="transparent" stroke="currentColor" strokeWidth="2"/>
        <line x1="0" y1="90" x2="120" y2="90" stroke="currentColor" strokeWidth="2"/>
        <circle cx="60" cy="90" r="15" stroke="currentColor" strokeWidth="2" fill="transparent"/>
        <circle cx="60" cy="90" r="1.5" fill="currentColor"/>
        <rect x="25" y="0" width="70" height="25" stroke="currentColor" strokeWidth="2" fill="transparent"/>
        <rect x="40" y="0" width="40" height="10" stroke="currentColor" strokeWidth="2" fill="transparent"/>
        <rect x="25" y="155" width="70" height="25" stroke="currentColor" strokeWidth="2" fill="transparent"/>
        <rect x="40" y="170" width="40" height="10" stroke="currentColor" strokeWidth="2" fill="transparent"/>
    </svg>
);
