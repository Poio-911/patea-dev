import { JerseyProps } from '.';

export function SolidJersey({ primaryColor, className, number }: JerseyProps) {
  return (
    <svg viewBox="-20 -50 40 40" className={className}>
      <path
        d="M 0,-40 C 10,-40 10,-30 15,-20 L 15,10 L -15,10 L -15,-20 C -10,-30 -10,-40 0,-40 Z"
        fill={primaryColor}
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
