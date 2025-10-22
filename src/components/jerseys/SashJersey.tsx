'use client';
import { JerseyProps } from '.';

export function SashJersey({ primaryColor = '#cccccc', secondaryColor = '#aaaaaa', className }: JerseyProps) {
  const id = `sash-${primaryColor}-${secondaryColor}`.replace(/#/g, '');
  const shirtPath = "M90,4.5c-29.3,0-53.1,23.8-53.1,53.1v104.4h106.2V57.6C143.1,28.3,119.3,4.5,90,4.5z M47.5,16.8 l-13.8,11.5c-2.3,1.9-3.7,4.8-3.7,7.7v20.4h120V36.4c0-2.9-1.4-5.8-3.7-7.7L132.5,16.8c-8.6-7.2-19.4-11.3-30.8-11.3h-21.4 C100.9,5.5,90.1,9.6,81.5,16.8L47.5,16.8z";

  return (
    <svg viewBox="0 0 180 180" className={className} xmlSpace="preserve">
      <defs>
        <clipPath id={id}>
          <path d={shirtPath} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect x="0" y="0" width="180" height="180" fill={primaryColor} />
        <path
          d="M-20,0 L70,0 L200,180 L110,180 Z"
          fill={secondaryColor}
        />
      </g>
       <path d="M79,8.5c0,0-1.8,7.5,11,7.5s11-7.5,11-7.5" fill="none" stroke={primaryColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
