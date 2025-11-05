import { cn } from '@/lib/utils';

export const DelanteroIcon = ({ className, ...props }: { className?: string }) => (
    <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={cn("w-full h-full", className)} {...props}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9.5h4V13h-4v-2.5z m0 4h4v2.5h-4V15z m-4.5-2.5h2.5V13H7.5v-2.5z m9 0h2.5V13H16.5v-2.5z M9.5 6h5v2.5h-5V6z"/>
    </svg>
);

export const MediocampistaIcon = ({ className, ...props }: { className?: string }) => (
    <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={cn("w-full h-full", className)} {...props}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-8h10v2H7v-2z"/>
    </svg>
);

export const DefensaIcon = ({ className, ...props }: { className?: string }) => (
    <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={cn("w-full h-full", className)} {...props}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM7 11h10v2H7v-2z"/>
    </svg>
);

export const PorteroIcon = ({ className, ...props }: { className?: string }) => (
    <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={cn("w-full h-full", className)} {...props}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4-8h8v2H8v-2z"/>
    </svg>
);
