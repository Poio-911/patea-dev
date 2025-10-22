'use client';
import { JerseyProps } from '.';

export function StripesJersey({ primaryColor, secondaryColor, className }: JerseyProps) {
  const id = `stripes-${primaryColor}-${secondaryColor}`.replace(/#/g, '');
  const shirtPath = "M243.2,4.5C148.8,4.5,70.3,55.8,35.4,122.3c-23.3,44.4-28,95.5-13.8,141.5c1.2,4.1,2.8,8.2,4.8,12.1 c13.4,26.7,35.1,49.2,62.1,64.2c27.1,15,58.3,22.7,90.2,22.7c31.9,0,63-7.7,90.2-22.7c27.1-15,48.7-37.5,62.1-64.2 c384.8,354,411.3,276,243.2,4.5z";
  
  return (
    <svg viewBox="0 0 486 420" className={className} xmlSpace="preserve">
      <defs>
        <clipPath id={id}>
          <path d={shirtPath} />
        </clipPath>
        <pattern
          id={`pattern-${id}`}
          patternUnits="userSpaceOnUse"
          width="80"
          height="80"
        >
          <rect width="40" height="80" fill={primaryColor} />
          <rect x="40" width="40" height="80" fill={secondaryColor} />
        </pattern>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect x="0" y="0" width="486" height="420" fill={`url(#pattern-${id})`} />
      </g>
    </svg>
  );
}
