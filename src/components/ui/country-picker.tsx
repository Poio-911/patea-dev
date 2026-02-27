'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

export type Country = {
    name: string;
    flag: string;
};

export const COUNTRIES: Country[] = [
    { name: 'Uruguay', flag: '🇺🇾' },
    { name: 'Argentina', flag: '🇦🇷' },
    { name: 'Brasil', flag: '🇧🇷' },
    { name: 'Paraguay', flag: '🇵🇾' },
    { name: 'Chile', flag: '🇨🇱' },
    { name: 'Bolivia', flag: '🇧🇴' },
    { name: 'Perú', flag: '🇵🇪' },
    { name: 'Colombia', flag: '🇨🇴' },
    { name: 'Venezuela', flag: '🇻🇪' },
    { name: 'Ecuador', flag: '🇪🇨' },
    { name: 'México', flag: '🇲🇽' },
    { name: 'Costa Rica', flag: '🇨🇷' },
    { name: 'Panamá', flag: '🇵🇦' },
    { name: 'Honduras', flag: '🇭🇳' },
    { name: 'Guatemala', flag: '🇬🇹' },
    { name: 'Nicaragua', flag: '🇳🇮' },
    { name: 'El Salvador', flag: '🇸🇻' },
    { name: 'Cuba', flag: '🇨🇺' },
    { name: 'Rep. Dominicana', flag: '🇩🇴' },
    { name: 'España', flag: '🇪🇸' },
    { name: 'Italia', flag: '🇮🇹' },
    { name: 'Portugal', flag: '🇵🇹' },
    { name: 'Francia', flag: '🇫🇷' },
    { name: 'Alemania', flag: '🇩🇪' },
    { name: 'Reino Unido', flag: '🇬🇧' },
    { name: 'Países Bajos', flag: '🇳🇱' },
    { name: 'Croacia', flag: '🇭🇷' },
    { name: 'Turquía', flag: '🇹🇷' },
    { name: 'Estados Unidos', flag: '🇺🇸' },
    { name: 'Japón', flag: '🇯🇵' },
    { name: 'Nigeria', flag: '🇳🇬' },
    { name: 'Marruecos', flag: '🇲🇦' },
    { name: 'Ghana', flag: '🇬🇭' },
    { name: 'Australia', flag: '🇦🇺' },
];

export function getFlagForCountry(name: string): string {
    return COUNTRIES.find(c => c.name === name)?.flag ?? '';
}

type CountryPickerProps = {
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
};

export function CountryPicker({ value, onChange, placeholder = 'Seleccionar país' }: CountryPickerProps) {
    const [open, setOpen] = React.useState(false);

    const selected = COUNTRIES.find(c => c.name === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {selected ? (
                        <span className="flex items-center gap-2">
                            <span>{selected.flag}</span>
                            <span>{selected.name}</span>
                        </span>
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Buscar país..." />
                    <CommandList>
                        <CommandEmpty>No se encontró el país.</CommandEmpty>
                        <CommandGroup>
                            {COUNTRIES.map((country) => (
                                <CommandItem
                                    key={country.name}
                                    value={country.name}
                                    onSelect={(currentValue) => {
                                        onChange(currentValue === value ? '' : currentValue);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 h-4 w-4',
                                            value === country.name ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                    <span className="mr-2">{country.flag}</span>
                                    {country.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
