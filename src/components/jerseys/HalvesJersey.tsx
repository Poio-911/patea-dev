import { JerseyProps } from '.';

export function HalvesJersey({ primaryColor, secondaryColor, className, number }: JerseyProps) {
    const id = `halves-${primaryColor}-${secondaryColor}`.replace(/#/g, '');
    return (
        <svg viewBox="-20 -50 40 40" className={className}>
            <defs>
                <clipPath id={id}>
                    <path d="M 0,-40 C 10,-40 10,-30 15,-20 L 15,10 L -15,10 L -15,-20 C -10,-30 -10,-40 0,-40 Z" />
                </clipPath>
            </defs>
            <g clipPath={`url(#${id})`}>
                <rect x="-20" y="-50" width="20" height="60" fill={primaryColor} />
                <rect x="0" y="-50" width="20" height="60" fill={secondaryColor} />
            </g>
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
