'use client';
import { JerseyProps } from '.';

export function StripesJersey({ primaryColor = '#cccccc', secondaryColor = '#aaaaaa', className }: JerseyProps) {
  const id = `stripes-${primaryColor}-${secondaryColor}`.replace(/#/g, '');
  const shirtPath = "M90.3,4.5C64.6,4.5,41.2,16.2,20.8,35.4c-13.6,12.8-20.9,29.9-20.9,47.3 c0,29.5,15.6,56.3,42,72.2c16.1,9.7,35,14.6,54.4,14.6c19.4,0,38.3-4.9,54.4-14.6c26.4-15.9,42-42.7,42-72.2 c0-17.4-7.3-34.5-20.9-47.3C139.4,16.2,116.1,4.5,90.3,4.5z";
  
  return (
    <svg viewBox="0 0 180 180" className={className} xmlSpace="preserve">
      <defs>
        <clipPath id={id}>
          <path d={shirtPath} />
        </clipPath>
        <pattern
          id={`pattern-${id}`}
          patternUnits="userSpaceOnUse"
          width="40"
          height="40"
        >
          <rect width="20" height="40" fill={primaryColor} />
          <rect x="20" width="20" height="40" fill={secondaryColor} />
        </pattern>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect x="0" y="0" width="180" height="180" fill={`url(#pattern-${id})`} />
      </g>
    </svg>
  );
}
