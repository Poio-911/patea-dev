'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  DollarSign,
  Users,
  Lightbulb,
  Car,
  Home,
  Droplets,
  MoreVertical,
  Edit,
  Trash2,
  Phone,
  Mail,
  Globe,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Venue, VenueSurface } from '@/lib/types';
import { cn } from '@/lib/utils';

type VenueCardProps = {
  venue: Venue;
  onEdit?: () => void;
  onDelete?: () => void;
  onSelect?: () => void;
  showActions?: boolean;
  selectable?: boolean;
  selected?: boolean;
};

const surfaceConfig: Record<VenueSurface, { label: string; color: string }> = {
  grass: { label: 'Césped', color: 'bg-green-500' },
  artificial: { label: 'Sintético', color: 'bg-blue-500' },
  indoor: { label: 'Indoor', color: 'bg-purple-500' },
  clay: { label: 'Tierra', color: 'bg-orange-500' },
  concrete: { label: 'Cemento', color: 'bg-gray-500' },
};

export function VenueCard({
  venue,
  onEdit,
  onDelete,
  onSelect,
  showActions = true,
  selectable = false,
  selected = false,
}: VenueCardProps) {
  const surfaceInfo = venue.surface ? surfaceConfig[venue.surface] : null;

  const handleCardClick = () => {
    if (selectable && onSelect) {
      onSelect();
    }
  };

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all',
        selectable && 'cursor-pointer hover:border-primary',
        selected && 'border-primary border-2 bg-primary/5'
      )}
      onClick={handleCardClick}
    >
      {/* Badge de selección */}
      {selected && (
        <div className="absolute top-2 right-2 z-10">
          <Badge className="bg-primary">Seleccionada</Badge>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-8">
            <CardTitle className="text-lg">{venue.name}</CardTitle>
            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span className="line-clamp-1">{venue.address}</span>
            </div>
          </div>

          {showActions && !selectable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                )}
                {onEdit && onDelete && <DropdownMenuSeparator />}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Precio */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="font-semibold">
              {venue.currency} ${venue.pricePerHour}
            </span>
            <span className="text-sm text-muted-foreground">/ hora</span>
          </div>
          {venue.fieldSize && (
            <Badge variant="secondary" className="text-xs">
              {venue.fieldSize}
            </Badge>
          )}
        </div>

        {/* Detalles */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {surfaceInfo && (
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', surfaceInfo.color)} />
              <span className="text-muted-foreground">{surfaceInfo.label}</span>
            </div>
          )}

          {venue.capacity && (
            <div className="flex items-center gap-2">
              <Users className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">{venue.capacity} jugadores</span>
            </div>
          )}
        </div>

        {/* Amenities */}
        <div className="flex flex-wrap gap-2">
          {venue.hasLighting && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Iluminación
            </Badge>
          )}
          {venue.hasParking && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Car className="w-3 h-3" />
              Estacionamiento
            </Badge>
          )}
          {venue.hasChangingRooms && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Home className="w-3 h-3" />
              Vestuarios
            </Badge>
          )}
          {venue.hasShowers && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Droplets className="w-3 h-3" />
              Duchas
            </Badge>
          )}
        </div>

        {/* Contacto */}
        {(venue.contactPhone || venue.contactEmail || venue.website) && (
          <div className="pt-2 border-t space-y-1">
            {venue.contactPhone && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="w-3 h-3" />
                <span>{venue.contactPhone}</span>
              </div>
            )}
            {venue.contactEmail && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="w-3 h-3" />
                <span className="truncate">{venue.contactEmail}</span>
              </div>
            )}
            {venue.website && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe className="w-3 h-3" />
                <a
                  href={venue.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {venue.website}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Notas */}
        {venue.notes && (
          <p className="text-xs text-muted-foreground italic line-clamp-2">
            {venue.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
