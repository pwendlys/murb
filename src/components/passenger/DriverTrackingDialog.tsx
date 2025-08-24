import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GoogleMap } from '@/components/ui/google-map';
import { Badge } from '@/components/ui/badge';
import { useLiveDriverLocation } from '@/hooks/useLiveDriverLocation';
import { calculateRoute, LocationCoords } from '@/services/googleMaps';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Bike,
  X,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface DriverTrackingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string;
  driverName: string;
  pickupLocation: LocationCoords;
  pickupAddress: string;
  destinationLocation?: LocationCoords;
  destinationAddress?: string;
  rideStatus: string;
  driverEnRoute?: boolean;
  driverArrived?: boolean;
}

export const DriverTrackingDialog: React.FC<DriverTrackingDialogProps> = ({
  isOpen,
  onClose,
  driverId,
  driverName,
  pickupLocation,
  pickupAddress,
  destinationLocation,
  destinationAddress,
  rideStatus,
  driverEnRoute = false,
  driverArrived = false
}) => {
  const { driverLocation, loading, error, lastUpdateAt, refetch } = useLiveDriverLocation(driverId, isOpen);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [lastDriverPosition, setLastDriverPosition] = useState<LocationCoords | null>(null);
  const [showOfflineWarning, setShowOfflineWarning] = useState(false);
  const offlineTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to determine map origin and destination based on ride status
  const getMapPoints = () => {
    // Linha azul A-B só deve aparecer quando motorista chegou
    if (driverArrived || rideStatus === 'arrived' || rideStatus === 'pickup_arrived_at') {
      return {
        origin: pickupLocation,
        destination: destinationLocation
      };
    } else {
      // Em todos os outros casos, não mostrar linha azul A-B
      return {
        origin: pickupLocation,
        destination: null
      };
    }
  };

  // Determine if we should show the driver-to-origin or driver-to-destination green line
  const shouldShowDriverToOriginRoute = (): boolean => {
    // Antes do motorista chegar: linha verde do motorista até a origem
    if ((rideStatus === 'accepted' || driverEnRoute) && !driverArrived && driverLocation) {
      return true;
    }
    // Durante a corrida: linha verde do motorista até o destino
    if (rideStatus === 'in_progress' && driverLocation && destinationLocation && !driverArrived) {
      return true;
    }
    return false;
  };

  // Get the target for the green line
  const getDriverRouteTarget = (): LocationCoords | null => {
    // Antes do motorista chegar: linha verde para a origem
    if ((rideStatus === 'accepted' || driverEnRoute) && !driverArrived) {
      return pickupLocation;
    }
    // Durante a corrida: linha verde para o destino
    if (rideStatus === 'in_progress' && destinationLocation && !driverArrived) {
      return destinationLocation;
    }
    return null;
  };

  // Check if driver moved significantly (>30m) to recalculate route
  const hasDriverMovedSignificantly = (newPos: LocationCoords, oldPos: LocationCoords | null) => {
    if (!oldPos) return true;
    
    const R = 6371e3; // Earth's radius in meters
    const φ1 = oldPos.lat * Math.PI/180;
    const φ2 = newPos.lat * Math.PI/180;
    const Δφ = (newPos.lat - oldPos.lat) * Math.PI/180;
    const Δλ = (newPos.lng - oldPos.lng) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const distance = R * c; // Distance in meters
    return distance > 30; // Only recalculate if moved more than 30m
  };

  // Monitor driver offline status using lastUpdateAt
  useEffect(() => {
    if (!lastUpdateAt || !isOpen) {
      setShowOfflineWarning(false);
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
      return;
    }

    const checkOfflineStatus = () => {
      const now = new Date();
      const updateTime = new Date(lastUpdateAt);
      const timeDiff = (now.getTime() - updateTime.getTime()) / 1000;
      
      if (timeDiff > 15) {
        setShowOfflineWarning(true);
      } else {
        setShowOfflineWarning(false);
      }
    };

    // Clear existing timer
    if (offlineTimerRef.current) {
      clearTimeout(offlineTimerRef.current);
    }

    // Set new timer to check after 15 seconds
    offlineTimerRef.current = setTimeout(checkOfflineStatus, 15000);
    
    // Also check immediately
    checkOfflineStatus();

    return () => {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
    };
  }, [lastUpdateAt, isOpen]);

  // Calculate route and ETA when driver location changes or ride status changes
  useEffect(() => {
    const calculateRouteInfo = async () => {
      // Don't show route for arrived status
      if (rideStatus === 'arrived' || rideStatus === 'pickup_arrived_at' || driverArrived) {
        setRouteInfo(null);
        return;
      }

      setRouteLoading(true);
      try {
        let routeDetails;
        const routeTarget = getDriverRouteTarget();
        
        if (driverLocation && routeTarget) {
          // Only recalculate if driver moved significantly
          if (lastDriverPosition && !hasDriverMovedSignificantly(driverLocation, lastDriverPosition)) {
            setRouteLoading(false);
            return;
          }
          
          console.log('Calculando rota do motorista para o target:', driverLocation, routeTarget);
          routeDetails = await calculateRoute(driverLocation, routeTarget);
          setLastDriverPosition(driverLocation);
        } else {
          setRouteInfo(null);
          setRouteLoading(false);
          return;
        }

        setRouteInfo({
          distance: routeDetails.distance,
          duration: routeDetails.duration
        });
      } catch (err) {
        console.error('Error calculating route:', err);
        toast.error('Erro ao calcular rota');
        setRouteInfo(null);
      } finally {
        setRouteLoading(false);
      }
    };

    // Only calculate route if dialog is open
    if (isOpen) {
      calculateRouteInfo();
    }
  }, [driverLocation, rideStatus, pickupLocation, destinationLocation, isOpen, driverEnRoute, driverArrived]);

  const getStatusText = () => {
    if (driverArrived) {
      return 'Motorista chegou';
    }
    switch (rideStatus) {
      case 'accepted':
      case 'driver_en_route':
        return 'Motorista a caminho da coleta';
      case 'arrived':
      case 'pickup_arrived_at':
        return 'Motorista chegou';
      case 'in_progress':
        return 'Em direção ao destino';
      default:
        return 'Rastreando motorista';
    }
  };

  const getTargetLocation = () => {
    return rideStatus === 'in_progress' ? destinationLocation : pickupLocation;
  };

  const getTargetAddress = () => {
    return rideStatus === 'in_progress' ? destinationAddress : pickupAddress;
  };

  const getTargetLabel = () => {
    return rideStatus === 'in_progress' ? 'Destino:' : 'Origem:';
  };

  const formatLastUpdate = () => {
    // Use lastUpdateAt primarily, fallback to driverLocation.timestamp
    const timestampToUse = lastUpdateAt || driverLocation?.timestamp;
    if (!timestampToUse) return '';
    
    const now = new Date();
    const timestamp = new Date(timestampToUse);
    const diffSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
    
    if (diffSeconds < 10) return 'Agora mesmo';
    if (diffSeconds < 60) return `${diffSeconds}s atrás`;
    const minutes = Math.floor(diffSeconds / 60);
    return `${minutes}min atrás`;
  };

  const mapPoints = getMapPoints();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[95vh] p-0 flex flex-col">
        <DialogHeader className="px-3 pb-0 pt-[calc(env(safe-area-inset-top)+12px)] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bike className="w-4 h-4 text-primary" />
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base">{driverName}</DialogTitle>
                  {/* ETA Badge - Show for driver en route to pickup */}
                  {(rideStatus === 'accepted' || driverEnRoute) && 
                   !driverArrived && routeInfo && !routeLoading && (
                    <Badge variant="secondary" className="text-xs h-5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                      Chega em {routeInfo.duration}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{getStatusText()}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </DialogHeader>

        <div className="px-3 pb-2 flex-shrink-0">
          {/* Offline Warning */}
          {showOfflineWarning && (
            <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Sinal do motorista instável
                </p>
              </div>
            </div>
          )}

          {/* Route Info and Last Update - Only show if not arrived */}
          {!driverArrived && rideStatus !== 'arrived' && rideStatus !== 'pickup_arrived_at' && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              {/* Route Info */}
              <div className="flex items-center gap-2 p-2 bg-background/50 rounded-md border">
                {routeLoading ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                ) : (
                  <Navigation className="w-3 h-3 text-primary" />
                )}
                <div className="text-xs">
                  {routeLoading ? (
                    'Calculando...'
                  ) : routeInfo ? (
                    <span className="font-medium">{routeInfo.distance} • {routeInfo.duration}</span>
                  ) : (
                    'Estimando rota...'
                  )}
                </div>
              </div>

              {/* Last Update */}
              <div className="flex items-center gap-2 p-2 bg-background/50 rounded-md border">
                <Clock className="w-3 h-3 text-primary" />
                <div className="text-xs">
                  {loading ? (
                    'Atualizando...'
                  ) : (
                    <span className="font-medium">{formatLastUpdate()}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Target Address */}
          <div className="flex items-start gap-2 p-2 bg-primary/5 rounded-md border border-primary/10">
            <MapPin className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <div className="text-muted-foreground">
                {getTargetLabel()}
              </div>
              <div className="font-medium">{getTargetAddress()}</div>
            </div>
          </div>

          {error && (
            <div className="mt-2 p-2 bg-destructive/10 rounded-md border border-destructive/20">
              <p className="text-xs text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={refetch}
                className="mt-1 h-6 text-xs"
              >
                Tentar novamente
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 px-3 pb-2 min-h-0">
          <div className="h-full rounded-lg overflow-hidden border">
            <GoogleMap
              origin={mapPoints.origin}
              destination={mapPoints.destination}
              driverMarker={driverLocation ? {
                position: driverLocation,
                heading: driverLocation.heading
              } : undefined}
              className="w-full h-full"
              driverIconUrl="/motorcycle-icon.png"
              showDriverToOriginRoute={shouldShowDriverToOriginRoute()}
              driverRouteTarget={getDriverRouteTarget()}
            />
          </div>
        </div>

        <div className="p-3 pt-0 border-t flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={loading ? "secondary" : "default"} className="text-xs h-5">
                {loading ? 'Atualizando' : 'Conectado'}
              </Badge>
              {driverLocation?.speed !== undefined && (
                <Badge variant="outline" className="text-xs h-5">
                  {Math.round(driverLocation.speed * 3.6)} km/h
                </Badge>
              )}
              {showOfflineWarning && (
                <Badge variant="secondary" className="text-xs h-5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                  Offline
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Atualização automática a cada 5s
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
