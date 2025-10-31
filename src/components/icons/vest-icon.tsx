import { cn } from '@/lib/utils';

export const VestIcon = ({ className, ...props }: { className?: string }) => (
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
    {...props}
  >
    <path d="M11 2a1 1 0 0 1 2 0v5a1 1 0 0 1-2 0V2Z" />
    <path d="M6.7 15.5a1 1 0 0 1-1.4 0L3 13.2a1 1 0 1 1 1.4-1.4l2.3 2.3a1 1 0 0 1 0 1.4Z" />
    <path d="M17.3 15.5a1 1 0 0 0 1.4 0l2.3-2.3a1 1 0 0 0-1.4-1.4l-2.3 2.3a1 1 0 0 0 0 1.4Z" />
    <path d="M7 18a1 1 0 0 0-1.2 1.2l.4 2.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8l.4-2.4a1 1 0 0 0-1.2-1.2" />
    <path d="M7 8a5 5 0 0 0-5 5v3" />
    <path d="M17 8a5 5 0 0 1 5 5v3" />
  </svg>
);
