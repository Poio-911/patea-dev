import type { Match } from '@/lib/types';

/**
 * Configuración centralizada de estilos y etiquetas por estado de partido.
 * Importar desde aquí en lugar de redefinir en cada componente.
 */
export const matchStatusConfig: Record<Match['status'], { label: string; className: string }> = {
    planning: {
        label: 'A Confirmar',
        className:
            'bg-muted text-muted-foreground border-border',
    },
    upcoming: {
        label: 'Próximo',
        className:
            'bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:border-primary/40',
    },
    active: {
        label: 'Activo',
        className:
            'bg-green-500/10 text-green-700 border-green-500/20 dark:bg-green-500/30 dark:text-green-200 dark:border-green-400/40',
    },
    completed: {
        label: 'Finalizado',
        className:
            'bg-muted/50 text-muted-foreground border-border/50',
    },
    evaluated: {
        label: 'Evaluado',
        className:
            'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/30',
    },
    delayed: {
        label: 'Demorado',
        className:
            'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/30',
    },
};

/**
 * Etiqueta dinámica del botón de detalle según el estado del partido.
 */
export function getMatchActionLabel(status: Match['status']): string {
    switch (status) {
        case 'active':
            return 'Ver En Vivo ⚡';
        case 'evaluated':
            return 'Ver Resultado';
        case 'completed':
            return 'Ver Resumen';
        case 'planning':
            return 'Ver y Confirmar';
        case 'delayed':
            return 'Ver Novedades';
        case 'upcoming':
        default:
            return 'Ver Detalles';
    }
}
