import { JerseyProps } from '.';

export function StripesJersey({ primaryColor, secondaryColor, className, number }: JerseyProps) {
  const id = `stripes-${primaryColor}-${secondaryColor}`.replace(/#/g, '');
  return (
    <svg viewBox="-20 -50 40 40" className={className}>
      <defs>
        <pattern
          id={id}
          patternUnits="userSpaceOnUse"
          width="10"
          height="10"
          patternTransform="rotate(90)"
        >
          <rect width="5" height="10" fill={primaryColor} />
          <rect x="5" width="5" height="10" fill={secondaryColor} />
        </pattern>
      </defs>
      <path
        d="M 0,-40 C 10,-40 10,-30 15,-20 L 15,10 L -15,10 L -15,-20 C -10,-30 -10,-40 0,-40 Z"
        fill={`url(#${id})`}
        stroke="#00000020"
        strokeWidth="1"
      />
       {number && (
        <text
          x="0"
          y="-5"
          fontFamily="sans-serif"
          fontSize="20"
          textAnchor="middle"
          fill="#ffffff"
          stroke='#00000080'
          strokeWidth="0.5"
          fontWeight="bold"
        >
          {number}
        </text>
      )}
    </svg>
  );
}
