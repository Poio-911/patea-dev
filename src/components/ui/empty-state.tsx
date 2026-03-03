'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type EmptyStateProps = {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: {
        label: string;
        href?: string;
        onClick?: () => void;
    };
    className?: string;
};

/**
 * Componente unificado de estado vacío.
 * Usar en todas las secciones para mantener consistencia visual.
 * 
 * @example
 * <EmptyState
 *   icon={<Calendar className="h-14 w-14" />}
 *   title="No hay partidos"
 *   description="¡Organizá el próximo encuentro!"
 *   action={{ label: "Crear partido", href: "/matches" }}
 * />
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center py-14 px-6 text-center',
                'border-2 border-dashed border-muted-foreground/20 rounded-xl',
                'bg-muted/10',
                className
            )}
        >
            {icon && (
                <div className="text-muted-foreground/40 mb-4">
                    {icon}
                </div>
            )}
            <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>
            {description && (
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
                    {description}
                </p>
            )}
            {action && (
                action.href ? (
                    <Button asChild variant="default" size="sm">
                        <Link href={action.href}>{action.label}</Link>
                    </Button>
                ) : (
                    <Button variant="default" size="sm" onClick={action.onClick}>
                        {action.label}
                    </Button>
                )
            )}
        </div>
    );
}
