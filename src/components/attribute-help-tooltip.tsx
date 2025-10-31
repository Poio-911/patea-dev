
'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { attributeDescriptions } from '@/lib/data';
import type { AttributeKey } from '@/lib/types';

interface AttributeHelpTooltipProps {
    attribute: AttributeKey;
}

export function AttributeHelpTooltip({ attribute }: AttributeHelpTooltipProps) {
    const info = attributeDescriptions[attribute];

    if (!info) return null;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button type="button" className="ml-1 text-muted-foreground hover:text-foreground transition-colors">
                        <HelpCircle className="h-3 w-3" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top" align="center" className="max-w-xs">
                    <p className="font-bold">{info.name}</p>
                    <p>{info.description}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
