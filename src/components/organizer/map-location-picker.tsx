'use client';

import * as React from 'react';
import { Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { pateaMapStyle } from '@/components/maps/map-styles';
import { ACCENT_COLOR } from '@/components/maps/map-styles';
import { Loader2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

interface MapLocationPickerProps {
  value?: LocationData;
  onChange: (loc: LocationData) => void;
}

const DEFAULT_CENTER = { lat: -34.9011, lng: -56.1645 }; // Montevideo

export function MapLocationPicker({ value, onChange }: MapLocationPickerProps) {
  const [center, setCenter] = React.useState(value && value.lat ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER);
  const [markerPos, setMarkerPos] = React.useState<{ lat: number; lng: number } | null>(
    value && value.lat ? { lat: value.lat, lng: value.lng } : null
  );
  
  const map = useMap();
  const markerRef = React.useRef<google.maps.Marker | null>(null);

  React.useEffect(() => {
    if (!map) return;
    
    if (markerPos) {
      if (!markerRef.current) {
        markerRef.current = new google.maps.Marker({
          position: markerPos,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: ACCENT_COLOR,
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#000000',
          },
          animation: google.maps.Animation.DROP,
        });
      } else {
        markerRef.current.setPosition(markerPos);
      }
    } else if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
    };
  }, [map, markerPos]);

  const handleMapClick = async (e: any) => {
    if (!e.detail.latLng) return;
    const lat = e.detail.latLng.lat;
    const lng = e.detail.latLng.lng;
    
    setMarkerPos({ lat, lng });
    
    try {
      // Intentar reverse geocoding
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await response.json();
      
      const newAddress = data?.display_name || 'Ubicación seleccionada en el mapa';
      onChange({ address: newAddress, lat, lng });
    } catch (err) {
      onChange({ address: 'Ubicación seleccionada en el mapa', lat, lng });
    }
  };

  return (
    <div className="w-full h-[250px] relative rounded-lg overflow-hidden border border-border">
      <GoogleMap
        defaultCenter={center}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        styles={pateaMapStyle}
        onClick={handleMapClick}
        className="w-full h-full"
      />
      {!markerPos && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-border pointer-events-none text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Hacé clic en el mapa para fijar la sede
        </div>
      )}
    </div>
  );
}
