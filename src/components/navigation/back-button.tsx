'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type BackButtonProps = {
  href?: string;
  label?: string;
  preferBack?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

export function BackButton({
  href = '/dashboard',
  label = 'Volver',
  preferBack = true,
  className,
  size = 'sm',
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (preferBack && typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else if (href) {
      router.push(href);
    }
  };

  return (
    <div className={cn('mb-3', className)}>
      <Button
        variant="ghost"
        size={size === 'lg' ? 'lg' : size === 'md' ? 'default' : 'sm'}
        className="inline-flex items-center gap-2"
        onClick={handleClick}
        aria-label={label}
      >
        <ArrowLeft className={cn(size === 'lg' ? 'h-5 w-5' : 'h-4 w-4')} />
        <span>{label}</span>
      </Button>
    </div>
  );
}
