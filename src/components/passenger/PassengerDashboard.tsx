import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RideRequest } from './RideRequest';
import { RateDriverDialog } from './RateDriverDialog';
import { GoogleMap } from '@/components/ui/google-map';
import { MapPin, Clock, Car, CheckCircle, XCircle, Map, Star, X } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Ride, RideStatus, Profile, LocationCoords, DriverDetails } from '@/types';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export const PassengerDashboard = () => {
  const { user } = useAuth();
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [ratedRides, setRatedRides] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(true);
  const [mapOrigin, setMapOrigin] = useState<LocationCoords | null>(null);
  const [mapDestination, setMapDestination] = useState<LocationCoords | null>(null);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [selectedRideForRating, setSelectedRideForRating] = useState<Ride | null>(null);
  const [cancellingRideId, setCancellingRideId] = useState<string | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocationLoading(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Erro ao obter localização');
          setLocationLoading(false);
        }
      );
    } else {
      toast.error('Geolocalização não suportada');
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchRides();
      const subscription = supabase
        .channel('passenger-rides')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'rides',
            filter: `passenger_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Ride update:', payload);
            fetchRides();
            if (payload.eventType === 'UPDATE' && (payload as any).new.status === 'completed') {
              checkAndAutoOpenRatingDialog((payload as any).new.id);
            }
          }
        )
        .subscribe();
      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchRides = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('passenger_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;

      if (data && data.length > 0) {
        const driverIds = [...new Set(
          data.map(ride => ride.driver_id).filter(id => id !== null)
        )] as string[];

        let driverProfiles: any[] = [];
        if (driverIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, phone, user_type, avatar_url, is_active, created_at, updated_at')
            .in('id', driverIds);
          if (profilesError) throw profilesError;
          driverProfiles = profiles || [];
        }

        // Buscar detalhes do motorista (placa, modelo, cor) respeitando RLS
        let driverDetails: DriverDetails[] = [];
        if (driverIds.length > 0) {
          const { data: details, error: detailsError } = await supabase
            .from('driver_details')
            .select('user_id, vehicle_brand, vehicle_model, vehicle_color, vehicle_plate')
            .in('user_id', driverIds);
          if (detailsError) throw detailsError;
          driverDetails = (details as DriverDetails[]) || [];
        }

        const processedRides: Ride[] = data.map((ride) => ({
          ...ride,
          status: ride.status as RideStatus,
          profiles: ride.driver_id 
            ? driverProfiles.find(profile => profile.id === ride.driver_id) || null
            : null,
          driver_details: ride.driver_id
            ? driverDetails.find(d => d.user_id === ride.driver_id) || null
            : null,
        }));

        setRides(processedRides);

        const completedRideIds = processedRides
          .filter(ride => ride.status === 'completed')
          .map(ride => ride.id);

        if (completedRideIds.length > 0) {
          const { data: ratings } = await supabase
            .from('ride_ratings')
            .select('ride_id')
            .in('ride_id', completedRideIds);
          if (ratings) {
            setRatedRides(new Set(ratings.map(rating => rating.ride_id)));
          }
        }

        const activeRide = processedRides.find(ride => 
          ride.status === 'accepted' || ride.status === 'in_progress'
        );
        if (activeRide) {
          setMapDestination({
            lat: activeRide.destination_lat,
            lng: activeRide.destination_lng
          });
        }
      } else {
        setRides([]);
      }
    } catch (error: any) {
      console.error('Error fetching rides:', error);
      toast.error('Erro ao carregar corridas');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async (ride: Ride) => {
    if (!user) return;

    // Verificar se a corrida já foi finalizada
    if (ride.status === 'completed') {
      toast.error('Não é possível cancelar uma corrida já finalizada');
      return;
    }

    // Se a corrida foi aceita ou está em andamento, mostrar alerta vermelho
    if (ride.status === 'accepted' || ride.status === 'in_progress') {
      toast.error('Não é possível cancelar: o motorista já aceitou a corrida e está a caminho!', {
        style: {
          backgroundColor: '#dc2626',
          color: 'white',
          border: '1px solid #b91c1c'
        }
      });
      return;
    }

    setCancellingRideId(ride.id);
    try {
      const { error } = await supabase
        .from('rides')
        .update({ status: 'cancelled' })
        .eq('id', ride.id)
        .eq('passenger_id', user.id); // Garantir que só o passageiro pode cancelar sua própria corrida

      if (error) throw error;

      toast.success('Corrida cancelada com sucesso');
      fetchRides(); // Atualizar a lista
    } catch (error: any) {
      console.error('Error cancelling ride:', error);
      toast.error('Erro ao cancelar corrida');
    } finally {
      setCancellingRideId(null);
    }
  };

  const checkAndAutoOpenRatingDialog = async (rideId: string) => {
    try {
      const { data: existingRating } = await supabase
        .from('ride_ratings')
        .select('id')
        .eq('ride_id', rideId)
        .single();
      if (!existingRating) {
        const ride = rides.find(r => r.id === rideId);
        if (ride && ride.status === 'completed' && ride.profiles) {
          setSelectedRideForRating(ride);
          setRateDialogOpen(true);
          toast.info('Sua corrida foi finalizada! Avalie o motorista.');
        }
      }
    } catch (error) {
      console.error('Error checking rating status:', error);
    }
  };

  const handleRateDriver = (ride: Ride) => {
    setSelectedRideForRating(ride);
    setRateDialogOpen(true);
  };

  const handleRatingSubmitted = () => {
    if (selectedRideForRating) {
      setRatedRides(prev => new Set([...prev, selectedRideForRating.id]));
    }
    setSelectedRideForRating(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 animate-spin" />;
      case 'accepted':
      case 'in_progress':
        return <Car className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4 animate-spin" />;
    }
  };

  const getStatusText = (status: string, ride?: Ride) => {
    if (status === 'accepted') {
      return 'Corrida Aceita';
    }
    if (status === 'in_progress') {
      if (ride?.driver_arrived) {
        // Se o motorista chegou mas driver_en_route é false, significa que clicou em "Ir Agora"
        if (ride?.driver_en_route === false) {
          return 'Corrida Em Andamento';
        }
        return 'Motorista Chegou';
      }
      if (ride?.driver_en_route === true) {
        return 'Motorista Indo Até Você';
      }
      return 'Em andamento';
    }
    const statusMap = {
      pending: 'Aguardando',
      completed: 'Viagem Finalizada',
      cancelled: 'Cancelada'
    } as const;
    return (statusMap as any)[status] || status;
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'accepted':
        return 'default';
      case 'in_progress':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const handleOriginUpdate = useCallback((origin: LocationCoords | null) => {
    setMapOrigin(origin);
  }, []);

  const handleDestinationUpdate = useCallback((destination: LocationCoords | null) => {
    setMapDestination(destination);
  }, []);

  if (locationLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-muted-foreground">Obtendo sua localização...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary mb-2">Painel do Passageiro</h1>
        <p className="text-muted-foreground">Solicite sua corrida e acompanhe em tempo real</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <RideRequest 
            currentLocation={currentLocation} 
            onDestinationUpdate={handleDestinationUpdate}
            onOriginUpdate={handleOriginUpdate}
          />
        </div>
        <div className="lg:col-span-1">
          <Card className="shadow-ride-card border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="w-5 h-5 text-primary" />
                Mapa da Corrida
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GoogleMap 
                origin={mapOrigin || currentLocation} 
                destination={mapDestination}
                className="w-full h-80"
              />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-1">
          <Card className="shadow-ride-card border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="w-5 h-5 text-primary" />
                Suas Corridas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : rides.length === 0 ? (
                <div className="text-center py-8">
                  <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma corrida encontrada</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {rides.map((ride) => (
                    <div key={ride.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge 
                            variant={getStatusVariant(ride.status)} 
                            className="flex items-center gap-1"
                          >
                            {getStatusIcon(ride.status)}
                            {getStatusText(ride.status, ride)}
                          </Badge>
                          
                          {/* Botão de cancelar - aparece para todas as corridas exceto as finalizadas */}
                          {ride.status !== 'completed' && ride.status !== 'cancelled' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelRide(ride)}
                              disabled={cancellingRideId === ride.id}
                              className="h-6 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 flex-shrink-0"
                            >
                              {cancellingRideId === ride.id ? (
                                <LoadingSpinner size="sm" />
                              ) : (
                                <>
                                  <X className="w-3 h-3 mr-1" />
                                  Cancelar
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                        
                        {ride.estimated_price && (
                          <span className="font-semibold text-primary">
                            R$ {ride.estimated_price.toFixed(2)}
                          </span>
                        )}
                      </div>
                      
                      {/* Avatar do motorista quando a corrida for aceita */}
                      {ride.profiles && (ride.status === 'accepted' || ride.status === 'in_progress' || ride.status === 'completed') && (
                        <div className="flex items-center gap-3 mb-4 p-2 bg-muted/30 rounded-lg">
                          <Avatar className="h-10 w-10">
                            <AvatarImage 
                              src={ride.profiles?.avatar_url || undefined} 
                              alt={ride.profiles?.full_name || 'Motorista'} 
                            />
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                              {ride.profiles?.full_name ? ride.profiles.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'M'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">Motorista</p>
                            <p className="text-sm text-muted-foreground">{ride.profiles?.full_name}</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Para:</span>
                          <span>{ride.destination_address}</span>
                        </div>
                        
                        {ride.profiles && (
                          <div className="flex items-center gap-2 text-primary">
                            <Car className="w-3 h-3" />
                            <span>Motorista: {ride.profiles.full_name}</span>
                          </div>
                        )}

                        {ride.driver_details && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Car className="w-3 h-3" />
                            <span>
                              Veículo: {[
                                ride.driver_details.vehicle_brand,
                                ride.driver_details.vehicle_model
                              ].filter(Boolean).join(' ')}
                              {ride.driver_details.vehicle_color ? ` (${ride.driver_details.vehicle_color})` : ''}
                              {ride.driver_details.vehicle_plate ? ` • Placa: ${ride.driver_details.vehicle_plate}` : ''}
                            </span>
                          </div>
                        )}
                        
                        <div className="text-xs text-muted-foreground">
                          {new Date(ride.created_at).toLocaleString('pt-BR')}
                        </div>

                        {ride.status === 'completed' && ride.profiles && !ratedRides.has(ride.id) && (
                          <div className="pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRateDriver(ride)}
                              className="w-full flex items-center gap-2"
                            >
                              <Star className="w-4 h-4" />
                              Avaliar Motorista
                            </Button>
                          </div>
                        )}

                        {ride.status === 'completed' && ratedRides.has(ride.id) && (
                          <div className="pt-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              Corrida avaliada
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <RateDriverDialog
        ride={selectedRideForRating}
        open={rateDialogOpen}
        onOpenChange={setRateDialogOpen}
        onSubmitted={handleRatingSubmitted}
      />
    </div>
  );
};
