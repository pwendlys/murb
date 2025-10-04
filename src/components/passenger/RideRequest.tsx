import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MapPin, Navigation, Clock, DollarSign, Crosshair, CreditCard, Banknote, QrCode } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { toast } from 'sonner';
import { 
  reverseGeocode, 
  getPlaceDetails, 
  calculateRoute,
  geocodeAddress,
  LocationCoords,
  RouteDetails 
} from '@/services/googleMaps';
import { usePricingSettings, computePriceFromSettings } from '@/hooks/usePricingSettings';
import { MotoNegociaOffer } from './MotoNegociaOffer';
import { centsToReais } from '@/utils/currency';
import { ServiceTypeSelector } from './ServiceTypeSelector';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import type { ServiceType } from '@/types';

export type RideType = 'normal' | 'negotiated';

interface RideRequestProps {
  currentLocation: LocationCoords | null;
  onDestinationUpdate?: (destination: LocationCoords | null) => void;
  onOriginUpdate?: (origin: LocationCoords | null) => void;
  variant?: "card" | "overlay";
  rideType?: RideType;
}

export const RideRequest = ({ currentLocation, onDestinationUpdate, onOriginUpdate, variant = "card", rideType = "normal" }: RideRequestProps) => {
  const { user } = useAuth();
  const flags = useFeatureFlags();
  const [serviceType, setServiceType] = useState<ServiceType>('moto_taxi');
  const { settings } = usePricingSettings(serviceType);
  const [originAddress, setOriginAddress] = useState('');
  const [originPlaceId, setOriginPlaceId] = useState<string | null>(null);
  const [destination, setDestination] = useState('');
  const [destinationPlaceId, setDestinationPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [rideDetails, setRideDetails] = useState<RouteDetails | null>(null);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [showNegotiationOffer, setShowNegotiationOffer] = useState(false);
  const [negotiatedPrice, setNegotiatedPrice] = useState<number | null>(null);
  const [estimatedPrices, setEstimatedPrices] = useState<Record<ServiceType, number | null>>({
    moto_taxi: null,
    passenger_car: null,
    delivery_bike: null,
    delivery_car: null,
  });
  const [loadingPrices, setLoadingPrices] = useState(false);

  // Set current location address when available and user chooses to use it
  useEffect(() => {
    if (currentLocation && usingCurrentLocation && !originAddress) {
      reverseGeocode(currentLocation.lat, currentLocation.lng)
        .then(address => {
          setOriginAddress(address);
          setOriginPlaceId(null);
        })
        .catch(() => {
          setOriginAddress('Localização Atual');
          setOriginPlaceId(null);
        });
    }
  }, [currentLocation, usingCurrentLocation, originAddress]);

  const getOriginCoords = async (): Promise<LocationCoords | null> => {
    if (usingCurrentLocation && currentLocation) {
      return currentLocation;
    }
    
    if (originPlaceId) {
      try {
        return await getPlaceDetails(originPlaceId);
      } catch (error) {
        console.error('Error getting origin place details:', error);
      }
    }
    
    if (originAddress.trim()) {
      try {
        return await geocodeAddress(originAddress);
      } catch (error) {
        console.error('Error geocoding origin address:', error);
      }
    }
    
    return null;
  };

  const getDestinationCoords = async (): Promise<LocationCoords | null> => {
    if (destinationPlaceId) {
      try {
        return await getPlaceDetails(destinationPlaceId);
      } catch (error) {
        console.error('Error getting destination place details:', error);
      }
    }
    
    if (destination.trim()) {
      try {
        return await geocodeAddress(destination);
      } catch (error) {
        console.error('Error geocoding destination address:', error);
      }
    }
    
    return null;
  };

  const updateMapCoordinates = useCallback(async () => {
    // Update origin coordinates for map
    if (onOriginUpdate) {
      try {
        const originCoords = await getOriginCoords();
        onOriginUpdate(originCoords);
      } catch (error) {
        console.error('Error updating origin coords:', error);
        onOriginUpdate(null);
      }
    }

    // Update destination coordinates for map
    if (onDestinationUpdate) {
      try {
        const destinationCoords = await getDestinationCoords();
        onDestinationUpdate(destinationCoords);
      } catch (error) {
        console.error('Error updating destination coords:', error);
        onDestinationUpdate(null);
      }
    }
  }, [originAddress, destination, originPlaceId, destinationPlaceId, usingCurrentLocation, currentLocation, onOriginUpdate, onDestinationUpdate]);

  const calculateRideDetails = useCallback(async () => {
    // Check if we have origin (either text or current location) and destination
    const hasOrigin = (usingCurrentLocation && currentLocation) || originAddress.trim();
    if (!hasOrigin || !destination.trim()) {
      setRideDetails(null);
      return;
    }

    setCalculatingRoute(true);
    try {
      const originCoords = await getOriginCoords();
      if (!originCoords) {
        throw new Error('Não foi possível obter as coordenadas da origem');
      }

      let destinationCoords: LocationCoords;
      
      if (destinationPlaceId) {
        destinationCoords = await getPlaceDetails(destinationPlaceId);
      } else if (destination.trim()) {
        // Try to geocode the destination address even without placeId
        destinationCoords = await geocodeAddress(destination);
      } else {
        // Fallback to simple calculation if no placeId and no address
        const estimatedDistance = Math.random() * 20 + 2; // km
        const estimatedDuration = Math.round(estimatedDistance * 2 + Math.random() * 10); // min
        const estimatedPrice = settings 
          ? computePriceFromSettings(settings, estimatedDistance)
          : 5 + estimatedDistance * 2.5;

        setRideDetails({
          distance: `${estimatedDistance.toFixed(1)} km`,
          duration: `${estimatedDuration} min`,
          price: estimatedPrice
        });
        return;
      }

      const routeDetails = await calculateRoute(originCoords, destinationCoords);

      // Parse "X km" into number
      const distanceKm = parseFloat(routeDetails.distance);
      const computedPrice = settings 
        ? computePriceFromSettings(settings, distanceKm)
        : routeDetails.price;

      setRideDetails({
        ...routeDetails,
        price: computedPrice
      });
    } catch (error) {
      console.error('Error calculating ride details:', error);
      toast.error('Erro ao calcular detalhes da corrida');
      setRideDetails(null);
    } finally {
      setCalculatingRoute(false);
    }
  }, [originAddress, destination, originPlaceId, destinationPlaceId, settings, usingCurrentLocation, currentLocation]);

  // Update map coordinates when addresses change
  useEffect(() => {
    const hasOrigin = (usingCurrentLocation && currentLocation) || (originAddress.length > 0);
    const hasDestination = destination.length > 0;
    
    if (hasOrigin || hasDestination) {
      const timeoutId = setTimeout(updateMapCoordinates, 300);
      return () => clearTimeout(timeoutId);
    } else {
      // Clear map when both fields are empty
      if (onOriginUpdate) onOriginUpdate(null);
      if (onDestinationUpdate) onDestinationUpdate(null);
    }
  }, [originAddress, destination, usingCurrentLocation, currentLocation, updateMapCoordinates]);

  // Recalculate when origin or destination changes
  useEffect(() => {
    const hasOrigin = (usingCurrentLocation && currentLocation) || (originAddress.length > 3);
    if (hasOrigin && destination.length > 3) {
      const timeoutId = setTimeout(calculateRideDetails, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setRideDetails(null);
    }
  }, [originAddress, destination, calculateRideDetails, usingCurrentLocation, currentLocation]);

  const handleOriginChange = (value: string, placeId?: string) => {
    setOriginAddress(value);
    setOriginPlaceId(placeId || null);
    setUsingCurrentLocation(false);
  };

  const handleDestinationChange = (value: string, placeId?: string) => {
    setDestination(value);
    setDestinationPlaceId(placeId || null);
  };

  const useCurrentLocation = () => {
    if (!currentLocation) {
      toast.error('Localização atual não disponível');
      return;
    }
    
    setUsingCurrentLocation(true);
    setOriginPlaceId(null);
    setOriginAddress('Localização Atual'); // Set immediately, then update in background
    
    // Update with proper address in background
    reverseGeocode(currentLocation.lat, currentLocation.lng)
      .then(address => {
        setOriginAddress(address);
      })
      .catch(() => {
        // Keep "Localização Atual" if reverse geocoding fails
      });
  };

  const handleShowNegotiationOffer = () => {
    const hasOrigin = (usingCurrentLocation && currentLocation) || originAddress.trim();
    if (!hasOrigin || !destination.trim() || !rideDetails) {
      toast.error('Por favor, preencha origem e destino');
      return;
    }

    // Verificar se uma forma de pagamento foi selecionada
    if (!paymentMethod) {
      toast.error('Por favor, selecione uma forma de pagamento');
      return;
    }

    setShowNegotiationOffer(true);
  };

  const handleNegotiationConfirm = async (offerCents: number) => {
    const offerPrice = centsToReais(offerCents);
    setNegotiatedPrice(offerPrice);
    await requestRide(offerPrice);
    setShowNegotiationOffer(false);
  };

  const handleNegotiationCancel = () => {
    setShowNegotiationOffer(false);
  };

  const requestRide = async (customPrice?: number) => {
    const hasOrigin = (usingCurrentLocation && currentLocation) || originAddress.trim();
    if (!user || !hasOrigin || !destination.trim() || !rideDetails) {
      toast.error('Por favor, preencha origem e destino');
      return;
    }

    // Verificar se uma forma de pagamento foi selecionada
    if (!paymentMethod) {
      toast.error('Por favor, selecione uma forma de pagamento');
      return;
    }

    setLoading(true);
    try {
      const originCoords = await getOriginCoords();
      if (!originCoords) {
        throw new Error('Não foi possível obter as coordenadas da origem');
      }

      let destinationCoords: LocationCoords;
      
      if (destinationPlaceId) {
        destinationCoords = await getPlaceDetails(destinationPlaceId);
      } else if (destination.trim()) {
        destinationCoords = await geocodeAddress(destination);
      } else {
        // Fallback coordinates if no placeId
        destinationCoords = {
          lat: originCoords.lat + (Math.random() - 0.5) * 0.1,
          lng: originCoords.lng + (Math.random() - 0.5) * 0.1
        };
      }

      const finalPrice = customPrice || rideDetails.price;
      
      const { error } = await supabase.from('rides').insert({
        passenger_id: user.id,
        origin_address: originAddress,
        destination_address: destination,
        origin_lat: originCoords.lat,
        origin_lng: originCoords.lng,
        destination_lat: destinationCoords.lat,
        destination_lng: destinationCoords.lng,
        estimated_duration: parseInt(rideDetails.duration),
        estimated_distance: parseFloat(rideDetails.distance),
        estimated_price: finalPrice,
        status: 'pending',
        payment_method: paymentMethod,
        service_type: serviceType
      });

      if (error) throw error;

      const message = rideType === 'negotiated' 
        ? 'Sua oferta foi enviada aos motoristas!' 
        : 'Corrida solicitada com sucesso!';
      toast.success(message);
      
      setOriginAddress('');
      setOriginPlaceId(null);
      setDestination('');
      setDestinationPlaceId(null);
      setRideDetails(null);
      setUsingCurrentLocation(false);
      setPaymentMethod('');
      setNegotiatedPrice(null);
      
      // Clear map coordinates
      if (onOriginUpdate) onOriginUpdate(null);
      if (onDestinationUpdate) onDestinationUpdate(null);
    } catch (error: any) {
      console.error('Error requesting ride:', error);
      toast.error('Erro ao solicitar corrida');
    } finally {
      setLoading(false);
    }
  };

  if (variant === "overlay") {
    // Se está mostrando tela de negociação, renderizar apenas ela
    if (rideType === 'negotiated' && showNegotiationOffer) {
      return (
        <MotoNegociaOffer
          initialValueCents={rideDetails ? Math.round(rideDetails.price * 100) : 1470}
          onConfirm={handleNegotiationConfirm}
          onCancel={handleNegotiationCancel}
        />
      );
    }

    return (
      <div className="space-y-3">
        {/* Address Fields - Compact */}
        <div className="flex gap-2">
          <AddressAutocomplete
            value={originAddress}
            onChange={handleOriginChange}
            placeholder="De onde..."
            className="h-10 flex-1 bg-background/90 backdrop-blur border-border/50"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={useCurrentLocation}
            disabled={!currentLocation}
            className="h-10 w-10 bg-background/90 backdrop-blur border-border/50"
            title="Usar localização atual"
          >
            <Crosshair className="w-3 h-3" />
          </Button>
        </div>

        <AddressAutocomplete
          value={destination}
          onChange={handleDestinationChange}
          placeholder="Para onde..."
          className="h-10 bg-background/90 backdrop-blur border-border/50"
        />

        {/* Service Type Selector */}
            {flags.serviceTypeSelection && (
              <ServiceTypeSelector 
                value={serviceType} 
                onChange={setServiceType}
                estimatedPrices={estimatedPrices}
                loading={loadingPrices}
              />
            )}

        {/* Route Calculation Loading */}
        {calculatingRoute && (
          <div className="flex items-center justify-center py-2 bg-background/80 backdrop-blur rounded-lg">
            <LoadingSpinner size="sm" />
            <span className="ml-2 text-xs text-muted-foreground">Calculando...</span>
          </div>
        )}

        {/* Route Details & Payment - Compact */}
        {rideDetails && !calculatingRoute && (
          <div className="bg-background/90 backdrop-blur rounded-lg p-3 border border-border/50">
            {/* Route details in horizontal layout */}
            <div className="flex justify-between items-center mb-3 text-sm">
              <div className="flex items-center gap-1">
                <Navigation className="w-3 h-3 text-primary" />
                <span className="font-medium">{rideDetails.distance}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary" />
                <span className="font-medium">{rideDetails.duration}</span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-primary" />
                <span className="font-bold text-primary">R$ {rideDetails.price.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment method - Horizontal radio buttons */}
            <div className="mb-3">
              <span className="text-xs font-medium text-muted-foreground block mb-2">Pagamento:</span>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex gap-2">
                <div className="flex items-center space-x-1 p-2 rounded border bg-background/50 hover:bg-muted/50 transition-colors flex-1">
                  <RadioGroupItem value="dinheiro" id="dinheiro-overlay" className="h-3 w-3" />
                  <Label htmlFor="dinheiro-overlay" className="flex items-center gap-1 cursor-pointer text-xs">
                    <Banknote className="w-3 h-3 text-green-600" />
                    <span>Dinheiro</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-1 p-2 rounded border bg-background/50 hover:bg-muted/50 transition-colors flex-1">
                  <RadioGroupItem value="pix" id="pix-overlay" className="h-3 w-3" />
                  <Label htmlFor="pix-overlay" className="flex items-center gap-1 cursor-pointer text-xs">
                    <QrCode className="w-3 h-3 text-blue-600" />
                    <span>Pix</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-1 p-2 rounded border bg-background/50 hover:bg-muted/50 transition-colors flex-1">
                  <RadioGroupItem value="cartao" id="cartao-overlay" className="h-3 w-3" />
                  <Label htmlFor="cartao-overlay" className="flex items-center gap-1 cursor-pointer text-xs">
                    <CreditCard className="w-3 h-3 text-purple-600" />
                    <span>Cartão</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Request Button */}
            <Button 
              onClick={() => rideType === 'negotiated' ? handleShowNegotiationOffer() : requestRide()}
              disabled={loading || !rideDetails || calculatingRoute || (!originAddress.trim() && !usingCurrentLocation) || !destination.trim() || !paymentMethod}
              className="w-full h-9 bg-ride-gradient hover:opacity-90 transition-opacity text-sm"
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                rideType === 'negotiated' ? 'Fazer Oferta' : 'Solicitar Corrida'
              )}
            </Button>
          </div>
        )}

        {/* Show payment options always when no route details */}
        {!rideDetails && !calculatingRoute && (originAddress.trim() || destination.trim() || usingCurrentLocation) && (
          <div className="bg-background/90 backdrop-blur rounded-lg p-3 border border-border/50">
            <span className="text-xs font-medium text-muted-foreground block mb-2">Pagamento:</span>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex gap-2">
              <div className="flex items-center space-x-1 p-2 rounded border bg-background/50 hover:bg-muted/50 transition-colors flex-1">
                <RadioGroupItem value="dinheiro" id="dinheiro-pre" className="h-3 w-3" />
                <Label htmlFor="dinheiro-pre" className="flex items-center gap-1 cursor-pointer text-xs">
                  <Banknote className="w-3 h-3 text-green-600" />
                  <span>Dinheiro</span>
                </Label>
              </div>
              <div className="flex items-center space-x-1 p-2 rounded border bg-background/50 hover:bg-muted/50 transition-colors flex-1">
                <RadioGroupItem value="pix" id="pix-pre" className="h-3 w-3" />
                <Label htmlFor="pix-pre" className="flex items-center gap-1 cursor-pointer text-xs">
                  <QrCode className="w-3 h-3 text-blue-600" />
                  <span>Pix</span>
                </Label>
              </div>
              <div className="flex items-center space-x-1 p-2 rounded border bg-background/50 hover:bg-muted/50 transition-colors flex-1">
                <RadioGroupItem value="cartao" id="cartao-pre" className="h-3 w-3" />
                <Label htmlFor="cartao-pre" className="flex items-center gap-1 cursor-pointer text-xs">
                  <CreditCard className="w-3 h-3 text-purple-600" />
                  <span>Cartão</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="shadow-ride-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-primary" />
          Solicitar Corrida
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Origem</label>
          <div className="flex gap-2">
            <AddressAutocomplete
              value={originAddress}
              onChange={handleOriginChange}
              placeholder="Digite o endereço de origem..."
              className="h-12 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={useCurrentLocation}
              disabled={!currentLocation}
              className="h-12 w-12 flex-shrink-0"
              title="Usar localização atual"
            >
              <Crosshair className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Destino</label>
          <AddressAutocomplete
            value={destination}
            onChange={handleDestinationChange}
            placeholder="Digite o endereço de destino..."
            className="h-12"
          />
        </div>

        {/* Service Type Selector */}
          {flags.serviceTypeSelection && (
            <ServiceTypeSelector 
              value={serviceType} 
              onChange={setServiceType}
              estimatedPrices={estimatedPrices}
              loading={loadingPrices}
            />
          )}

        {calculatingRoute && (
          <div className="flex items-center justify-center py-4">
            <LoadingSpinner size="sm" />
            <span className="ml-2 text-sm text-muted-foreground">Calculando rota...</span>
          </div>
        )}

        {rideDetails && !calculatingRoute && (
          <>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 text-primary">Detalhes da Corrida</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full mx-auto mb-1">
                      <Navigation className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">Distância</p>
                    <p className="font-semibold">{rideDetails.distance}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full mx-auto mb-1">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">Tempo</p>
                    <p className="font-semibold">{rideDetails.duration}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full mx-auto mb-1">
                      <DollarSign className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">Preço</p>
                    <p className="font-semibold">R$ {rideDetails.price.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 border-muted">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 text-foreground">Forma de Pagamento</h3>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="dinheiro" id="dinheiro" />
                    <Label htmlFor="dinheiro" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Banknote className="w-4 h-4 text-green-600" />
                      <span>Dinheiro</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="pix" id="pix" />
                    <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer flex-1">
                      <QrCode className="w-4 h-4 text-blue-600" />
                      <span>Pix</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="cartao" id="cartao" />
                    <Label htmlFor="cartao" className="flex items-center gap-2 cursor-pointer flex-1">
                      <CreditCard className="w-4 h-4 text-purple-600" />
                      <span>Cartão</span>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </>
        )}

        <Button 
          onClick={() => requestRide()}
          disabled={loading || !rideDetails || calculatingRoute || (!originAddress.trim() && !usingCurrentLocation) || !destination.trim() || !paymentMethod}
          className="w-full h-12 bg-ride-gradient hover:opacity-90 transition-opacity"
        >
          {loading ? <LoadingSpinner size="sm" /> : 'Solicitar Corrida'}
        </Button>
      </CardContent>
    </Card>
  );
};
