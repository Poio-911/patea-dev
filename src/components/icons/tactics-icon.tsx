import { cn } from '@/lib/utils';

export const TacticsIcon = ({ className }: { className?: string }) => (
    <svg
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(className)}
    >
        <path d="M21.174 6.812a1 1 0 0 0-1.342-.326l-3 1.732a1 1 0 0 1-1.09-.095l-3-3a1 1 0 0 0-1.414 0l-3 3a1 1 0 0 1-1.09.095l-3-1.732a1 1 0 0 0-1.342.326l-1.732 3a1 1 0 0 0 .326 1.342l3 1.732a1 1 0 0 1 .095 1.09l-3 3a1 1 0 0 0-.326 1.342l1.732 3a1 1 0 0 0 1.342.326l3-1.732a1 1 0 0 1 1.09.095l3 3a1 1 0 0 0 1.414 0l3-3a1 1 0 0 1 1.09-.095l3 1.732a1 1 0 0 0 1.342-.326l1.732-3a1 1 0 0 0-.326-1.342l-3-1.732a1 1 0 0 1-.095-1.09l3-3a1 1 0 0 0 .326-1.342Z" />
    </svg>
);
