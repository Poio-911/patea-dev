'use client';
import { JerseyProps } from '.';

export function SashJersey({ primaryColor, secondaryColor, className, number }: JerseyProps) {
  const id = `sash-${primaryColor}-${secondaryColor}`.replace(/#/g, '');
  const shirtPath = "M14.32,158.336c2.691,10.546,12.167,17.909,23.057,17.909c1.922,0,3.845-0.236,5.723-0.701l39.417-9.79 c4.466-1.072,5.626,2.404,5.626,4.396v249.939c0,13.049,10.63,23.676,23.686,23.676H374.7c13.063,0,23.699-10.627,23.699-23.676 V170.208c0-1.729,0.497-4.626,3.892-4.626c0.528,0,1.13,0.08,1.719,0.23l39.237,9.74c1.871,0.465,3.803,0.702,5.727,0.702 c10.892,0,20.369-7.364,23.051-17.909l13.577-53.215c1.566-6.141,0.645-12.509-2.605-17.941 c-3.241-5.422-8.411-9.253-14.559-10.778L343.975,45.511c-7.489-1.905-15.212-2.879-22.998-2.879l-30.453-0.05l-1.454,6.015 c-5.154,21.454-24.149,36.434-46.196,36.434c-22.051,0-41.05-14.979-46.198-36.434l-1.453-6.015h-28.569l-1.403,0.058 c-7.72,0-15.437,0.974-22.876,2.863L17.915,76.41c-6.155,1.525-11.319,5.356-14.569,10.778c-3.242,5.424-4.17,11.8-2.599,17.941 L14.32,158.336z";

  return (
    <svg viewBox="0 0 486.347 486.347" className={className} xmlSpace="preserve">
      <defs>
        <clipPath id={id}>
          <path d={shirtPath} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect x="0" y="0" width="487" height="487" fill={primaryColor} />
        <path
          d="M170,0 L486,316 L486,486 L316,486 Z"
          transform="translate(-150, 20) rotate(-45 243 243)"
          fill={secondaryColor}
        />
      </g>
       {number && (
        <text
          x="243"
          y="260"
          fontFamily="sans-serif"
          fontSize="120"
          textAnchor="middle"
          fill="#ffffff"
          stroke='#00000080'
          strokeWidth="4"
          fontWeight="bold"
        >
          {number}
        </text>
      )}
    </svg>
  );
}
