
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { Button } from '@/components/ui/button';
import { MapPin, MapPinOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DriverLocationToggle = () => {
  const { isTracking, startTracking, stopTracking } = useDriverLocation();

  return (
    <Button
      onClick={isTracking ? stopTracking : startTracking}
      variant={isTracking ? "default" : "secondary"}
      size="sm"
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-full shadow-lg backdrop-blur-sm transition-all duration-200",
        isTracking 
          ? "bg-green-600/90 hover:bg-green-700/90 text-white border-green-500/20" 
          : "bg-background/90 hover:bg-background text-foreground border-border/20"
      )}
      title={isTracking ? "Parar compartilhamento de localização" : "Ativar compartilhamento de localização"}
    >
      {isTracking ? (
        <>
          <MapPin className="w-4 h-4" />
          <span className="text-sm font-medium">Ativo</span>
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        </>
      ) : (
        <>
          <MapPinOff className="w-4 h-4" />
          <span className="text-sm font-medium">Inativo</span>
        </>
      )}
    </Button>
  );
};
